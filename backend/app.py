import os
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth
from flask import Flask, request, jsonify
from flask_cors import CORS
import datetime

# --- NEW IMPORTS ---
from dotenv import load_dotenv
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

# --- LOAD ENVIRONMENT VARIABLES ---
load_dotenv()

# --- Initialization ---
app = Flask(__name__)
# Make sure this is your React port
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}}) 

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'blockchain-a9608.firebasestorage.app' 
})

db = firestore.client()
bucket = storage.bucket()

# --- Brevo (Sendinblue) API Configuration ---
configuration = sib_api_v3_sdk.Configuration()
configuration.api_key['api-key'] = os.getenv("BREVO_API_KEY")

# ===================================================================
# --- NOTIFICATION & EMAIL HELPER FUNCTIONS ---
# ===================================================================

def send_email(to_email, to_name, subject, html_content):
    """Sends a transactional email using Brevo."""
    if not configuration.api_key['api-key']:
        print("WARNING: BREVO_API_KEY is not set. Skipping email.")
        return False
        
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
    sender_email = "nexusapp@victorkirui.dev" # Your "from" email
    sender_name = "Nexus App"
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": to_email, "name": to_name}],
        sender={"email": sender_email, "name": sender_name},
        subject=subject,
        html_content=html_content
    )
    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(f"Email sent successfully to {to_email}. Response: {api_response.message_id}")
        return True
    except ApiException as e:
        print(f"Exception when calling TransactionalEmailsApi->send_transac_email: {e}")
        return False

def create_notification(user_id, message, link):
    """Creates a new notification document in Firestore for a user."""
    try:
        db.collection('notifications').add({
            "userId": user_id,
            "message": message,
            "read": False,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "link": link
        })
        print(f"Notification created for user {user_id}.")
    except Exception as e:
        print(f"Error creating notification: {e}")

# ===================================================================
# --- FILE UPLOAD & DB HELPER FUNCTIONS ---
# ===================================================================

def upload_file_to_storage(file, uid, file_name_prefix):
    """Uploads a file to Firebase Storage and returns its public URL."""
    if not file:
        return None
    file_path = f"uploads/{uid}/{file_name_prefix}-{file.filename}"
    blob = bucket.blob(file_path)
    blob.content_type = file.content_type
    blob.upload_from_file(file.stream)
    blob.make_public()
    return blob.public_url

def get_user_wallet_by_national_id(national_id):
    """
    Finds a user by their idNumber and returns their walletAddress.
    """
    if not national_id:
        return None
        
    users_ref = db.collection("users")
    query = users_ref.where("idNumber", "==", national_id).limit(1)
    results = query.stream()
    
    user_docs = list(results)
    
    if len(user_docs) == 0:
        return None # User not found
        
    user_data = user_docs[0].to_dict()
    return user_data.get("walletAddress") # Returns wallet address or None

def get_property_token_id(parcel_number):
    """
    Finds an *approved* property by its parcelNumber and returns its tokenId.
    """
    if not parcel_number:
        return None
    
    props_ref = db.collection("properties")
    query = props_ref.where("parcelNumber", "==", parcel_number).limit(1)
    results = query.stream()
    prop_docs = list(results)
    
    if len(prop_docs) == 0:
        return None # Property not found or not approved
        
    prop_data = prop_docs[0].to_dict()
    return prop_data.get("tokenId") 

def get_user_uid_by_national_id(national_id):
    """
    Finds a user by their idNumber and returns their Firebase UID (document ID).
    """
    if not national_id:
        return None
    users_ref = db.collection("users")
    query = users_ref.where("idNumber", "==", national_id).limit(1)
    results = query.stream()
    user_docs = list(results)
    
    if len(user_docs) == 0:
        return None # User not found
        
    return user_docs[0].id

# ===================================================================
# --- API ENDPOINTS ---
# ===================================================================

@app.route("/submit-advocate-application", methods=["POST"])
def submit_advocate_application():
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token["uid"]
        form_data = request.form
        files = request.files
        
        file_urls = {
            'cert-file': upload_file_to_storage(files.get('cert-file'), uid, 'advocate-practicing-cert'),
            'lsk-id-file': upload_file_to_storage(files.get('lsk-id-file'), uid, 'advocate-lsk-id'),
            'national-id-file': upload_file_to_storage(files.get('national-id-file'), uid, 'advocate-national-id'),
            'profile-photo-file': upload_file_to_storage(files.get('profile-photo-file'), uid, 'advocate-profile-photo'),
        }

        app_data = {
            "uid": uid,
            "fullName": form_data.get('full-name'),
            "email": form_data.get('email'),
            "practicingCertNumber": form_data.get('cert-number'),
            "firmName": form_data.get('firm-name'),
            "firmRegNumber": form_data.get('firm-reg'),
            "phone": form_data.get('phone'),
            "address": form_data.get('address'),
            "fileUrls": file_urls,
            "status": "pending",
            "assignedAdmin": None,
            "submittedAt": firestore.SERVER_TIMESTAMP
        }
        
        db.collection("advocateApplications").add(app_data)
        
        create_notification(uid, "Your advocate application was submitted successfully and is now pending review.", "/dashboard")

        return jsonify({"message": "Application submitted successfully!"}), 201

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500


@app.route("/add-property", methods=["POST"])
def add_property():
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token["uid"]

        user_doc_ref = db.collection("users").document(uid)
        user_doc = user_doc_ref.get()
        if not user_doc.exists:
            return jsonify({"error": "User profile not found"}), 404
        
        user_data = user_doc.to_dict()
        user_wallet_address = user_data.get("walletAddress")
        if not user_wallet_address:
            return jsonify({"error": "User wallet address not found. Please update your profile."}), 400

        form_data = request.form
        files = request.files
        
        file_urls = {
            'titleDeedFile': upload_file_to_storage(files.get('titleDeedFile'), uid, 'property-title-deed'),
            'surveyMapFile': upload_file_to_storage(files.get('surveyMapFile'), uid, 'property-survey-map'),
        }

        property_data = {
            "uid": uid,
            "ownerWalletAddress": user_wallet_address, 
            "parcelNumber": form_data.get('parcelNumber'),
            "location": form_data.get('location'),
            "fileUrls": file_urls,
            "status": "pending",
            "submittedAt": firestore.SERVER_TIMESTAMP,
            "assignedAdmin": None,
        }
        
        timestamp, doc_ref = db.collection("pendingProperties").add(property_data)
        
        create_notification(uid, f"Your property ({property_data['parcelNumber']}) was submitted successfully and is pending verification.", "/properties")
        
        return jsonify({"message": "Property submitted successfully for verification!", "propertyId": doc_ref.id}), 201

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500

@app.route("/review-property", methods=["POST"])
def review_property():
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        admin_uid = decoded_token["uid"]

        admin_doc = db.collection("users").document(admin_uid).get()
        if not admin_doc.exists or not admin_doc.to_dict().get("isAdmin"):
            return jsonify({"error": "Insufficient permissions. Admin role required."}), 403

        data = request.get_json()
        property_id = data.get("propertyId")
        action = data.get("action")
        comment = data.get("comment")

        if not property_id or not action:
            return jsonify({"error": "Missing propertyId or action"}), 400
            
        pending_prop_ref = db.collection("pendingProperties").document(property_id)
        pending_prop_doc = pending_prop_ref.get()
        
        approved_prop_ref = db.collection("properties").document(property_id)
        approved_prop_doc = approved_prop_ref.get()
        
        rejected_prop_ref = db.collection("rejectedProperties").document(property_id)

        if action == "reject":
            if not comment:
                return jsonify({"error": "Comment is required for rejection"}), 400
            
            if not pending_prop_doc.exists:
                return jsonify({"error": "Property already processed or not found."}), 404
            
            prop_data = pending_prop_doc.to_dict()
            owner_uid = prop_data.get("uid")
            
            owner_doc = db.collection("users").document(owner_uid).get()
            owner_name = "User"
            owner_email = None
            if owner_doc.exists:
                owner_name = owner_doc.to_dict().get("firstName", "User")
                owner_email = owner_doc.to_dict().get("email")

            new_rejected_data = prop_data.copy()
            new_rejected_data['status'] = "rejected"
            new_rejected_data['rejectionComment'] = comment
            new_rejected_data['reviewedBy'] = admin_uid
            new_rejected_data['rejectedAt'] = firestore.SERVER_TIMESTAMP
            
            batch = db.batch()
            batch.set(rejected_prop_ref, new_rejected_data)
            batch.delete(pending_prop_ref)
            batch.commit()
            
            subject = f"Action Required: Your Property ({prop_data.get('parcelNumber')}) Was Rejected"
            message_html = f"Hello {owner_name},<br><br>There was an issue verifying <b>{prop_data.get('parcelNumber')}</b>. <br><b>Reason:</b> {comment}"
            message_plain = f"There was an issue verifying {prop_data.get('parcelNumber')}. Reason: {comment}"
            
            create_notification(owner_uid, message_plain, "/properties")
            if owner_email:
                send_email(owner_email, owner_name, subject, message_html)
                
            return jsonify({"message": "Property rejected and moved successfully"}), 200

        elif action == "approve":
            
            if pending_prop_doc.exists:
                prop_data = pending_prop_doc.to_dict()
                owner_uid = prop_data.get("uid")

                owner_doc = db.collection("users").document(owner_uid).get()
                owner_name = "User"
                owner_email = None
                if owner_doc.exists:
                    owner_name = owner_doc.to_dict().get("firstName", "User")
                    owner_email = owner_doc.to_dict().get("email")

                on_chain_data = {
                    "ownerWalletAddress": prop_data.get("ownerWalletAddress"),
                    "parcelNumber": prop_data.get("parcelNumber")
                }

                new_prop_data = prop_data.copy()
                new_prop_data['status'] = "approved"
                new_prop_data['reviewedBy'] = admin_uid
                new_prop_data['approvedAt'] = firestore.SERVER_TIMESTAMP
                new_prop_data['txHash'] = None
                new_prop_data['tokenId'] = None
                
                batch = db.batch()
                batch.set(approved_prop_ref, new_prop_data)
                batch.delete(pending_prop_ref)
                batch.commit()
                
                subject = f"Your Property Has Been Approved ({prop_data.get('parcelNumber')})"
                message_html = f"Hello {owner_name},<br><br>Good news! Your property <b>{prop_data.get('parcelNumber')}</b> has been approved by an admin. It is now ready to be minted to the blockchain."
                message_plain = f"Good news! Your property {prop_data.get('parcelNumber')} has been approved by an admin."
                
                create_notification(owner_uid, message_plain, "/properties")
                if owner_email:
                    send_email(owner_email, owner_name, subject, message_html)
                
                return jsonify({
                    "message": "Property approved in database. Please confirm on-chain minting.",
                    "onChainData": on_chain_data
                }), 200

            elif approved_prop_doc.exists:
                prop_data = approved_prop_doc.to_dict()
                
                if prop_data.get('txHash'):
                    return jsonify({"error": "This property has already been approved and minted."}), 400
                
                on_chain_data = {
                    "ownerWalletAddress": prop_data.get("ownerWalletAddress"),
                    "parcelNumber": prop_data.get("parcelNumber")
                }
                return jsonify({
                    "message": "Property already approved. Retrying mint...",
                    "onChainData": on_chain_data
                }), 200
            
            else:
                return jsonify({"error": "Property not found. It may have been rejected or already processed."}), 404
        else:
            return jsonify({"error": "Invalid action"}), 400

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"Error in review-property: {e}")
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500

@app.route("/review-advocate-application", methods=["POST"])
def review_advocate_application():
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        admin_uid = decoded_token["uid"]

        admin_doc = db.collection("users").document(admin_uid).get()
        if not admin_doc.exists or not admin_doc.to_dict().get("isAdmin"):
            return jsonify({"error": "Insufficient permissions. Admin role required."}), 403

        data = request.get_json()
        application_id = data.get("applicationId")
        action = data.get("action")
        comment = data.get("comment")

        if not application_id or not action:
            return jsonify({"error": "Missing applicationId or action"}), 400
            
        app_ref = db.collection("advocateApplications").document(application_id)
        app_doc = app_ref.get()
        if not app_doc.exists:
            return jsonify({"error": "Application not found"}), 404
        app_data = app_doc.to_dict()
        
        applicant_uid = app_data.get("uid")
        user_ref = db.collection("users").document(applicant_uid)
        user_doc = user_ref.get()
        if not user_doc.exists:
            return jsonify({"error": "Applicant's user profile not found"}), 404
        
        user_data = user_doc.to_dict()
        user_name = user_data.get("firstName", "Applicant")
        user_email = user_data.get("email")

        if action == "reject":
            if not comment:
                return jsonify({"error": "Comment is required for rejection"}), 400
            
            app_ref.update({
                "status": "rejected",
                "rejectionComment": comment,
                "reviewedBy": admin_uid
            })
            
            subject = "Your Advocate Application Has Been Rejected"
            message_html = f"Hello {user_name},<br><br>Your advocate application has been rejected. <br><b>Reason:</b> {comment}"
            message_plain = f"Your advocate application has been rejected. Reason: {comment}"
            
            create_notification(applicant_uid, message_plain, "/dashboard")
            if user_email:
                send_email(user_email, user_name, subject, message_html)
                
            return jsonify({"message": "Application rejected successfully"}), 200

        elif action == "approve":
            on_chain_data = {
                "advocateWalletAddress": user_data.get("walletAddress")
            }

            if not on_chain_data["advocateWalletAddress"]:
                return jsonify({"error": "Cannot approve: User has no wallet address linked."}), 400

            app_ref.update({
                "status": "approved",
                "reviewedBy": admin_uid
            })
            user_ref.update({
                "isAdvocate": True
            })
            
            subject = "Your Advocate Application is Approved!"
            message_html = f"Hello {user_name},<br><br>Congratulations! Your application to be an advocate has been approved. You will now be asked to confirm this action on-chain."
            message_plain = "Congratulations! Your advocate application has been approved."
            
            create_notification(applicant_uid, message_plain, "/dashboard")
            if user_email:
                send_email(user_email, user_name, subject, message_html)
            
            return jsonify({
                "message": "Application approved in database. Please confirm on-chain role grant.",
                "onChainData": on_chain_data
            }), 200

        else:
            return jsonify({"error": "Invalid action"}), 400

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500

# ---
# --- ENDPOINT 1: Get Transaction Prerequisites ---
# ---
@app.route("/get-transaction-prereqs", methods=["POST"])
def get_transaction_prereqs():
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        advocate_uid = decoded_token["uid"]

        advocate_doc = db.collection("users").document(advocate_uid).get()
        if not advocate_doc.exists:
            return jsonify({"error": "Advocate profile not found."}), 403
        
        advocate_data = advocate_doc.to_dict()
        if not advocate_data.get("isAdvocate") and not advocate_data.get("isAdmin"):
            return jsonify({"error": "Insufficient permissions."}), 403

        data = request.get_json()
        seller_national_id = data.get("sellerNationalId")
        buyer_national_id = data.get("buyerNationalId")
        parcel_number = data.get("parcelNumber")

        if not seller_national_id or not buyer_national_id or not parcel_number:
            return jsonify({"error": "Missing seller ID, buyer ID, or parcel number"}), 400

        seller_wallet = get_user_wallet_by_national_id(seller_national_id)
        buyer_wallet = get_user_wallet_by_national_id(buyer_national_id)
        token_id = get_property_token_id(parcel_number)
        
        if not seller_wallet:
            return jsonify({"error": f"Seller with National ID '{seller_national_id}' not found or has no wallet."}), 404
        if not buyer_wallet:
            return jsonify({"error": f"Buyer with National ID '{buyer_national_id}' not found or has no wallet."}), 404
        if not token_id:
            return jsonify({"error": f"Property with Parcel Number '{parcel_number}' not found, not approved, or not yet minted (no Token ID)."}), 404

        return jsonify({
            "sellerWalletAddress": seller_wallet,
            "buyerWalletAddress": buyer_wallet,
            "tokenId": token_id
        }), 200

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"Error in get-transaction-prereqs: {e}")
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500

# ---
# --- ENDPOINT 2: Create Transaction ---
# ---
@app.route("/create-transaction", methods=["POST"])
def create_transaction():
    try:
        # 1. Verify Advocate/Admin
        auth_header = request.headers.get("Authorization")
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        advocate_uid = decoded_token["uid"]
        advocate_doc = db.collection("users").document(advocate_uid).get()
        advocate_data = advocate_doc.to_dict()

        if not advocate_data.get("isAdvocate") and not advocate_data.get("isAdmin"):
            return jsonify({"error": "Insufficient permissions."}), 403

        # 2. Get Full Payload from React
        data = request.get_json()
        
        # 3. Get Firebase UIDs for Buyer and Seller
        seller_national_id = data.get("seller-id")
        buyer_national_id = data.get("buyer-id")
        seller_uid = get_user_uid_by_national_id(seller_national_id)
        buyer_uid = get_user_uid_by_national_id(buyer_national_id)
        
        if not seller_uid:
            return jsonify({"error": f"Seller with National ID '{seller_national_id}' not found."}), 404
        if not buyer_uid:
            return jsonify({"error": f"Buyer with National ID '{buyer_national_id}' not found."}), 404

        # 4. Prepare Data for Batched Write
        transaction_data = data.copy()
        advocate_name = advocate_data.get("firstName", advocate_data.get("email"))
        
        transaction_data["advocate"] = {
            "uid": advocate_uid,
            "name": advocate_name,
            "walletAddress": data.get("advocateAddress")
        }
        transaction_data["buyer"] = {
            "uid": buyer_uid,
            "name": data.get("buyer-name"),
            "walletAddress": data.get("buyerWalletAddress"),
            "email": data.get("buyer-email"), 
            "phone": data.get("buyer-phone"),
            "accepted": False,
            "verifiedDocs": None 
        }
        transaction_data["seller"] = {
            "uid": seller_uid,
            "name": data.get("seller-name"),
            "walletAddress": data.get("sellerWalletAddress"),
            "email": data.get("seller-email"),
            "phone": data.get("seller-phone"),
            "accepted": False,
            "verifiedDocs": None
        }
        
        transaction_data["createdAt"] = firestore.SERVER_TIMESTAMP
        
        # ---
        # --- *** THIS IS THE FIX *** ---
        # ---
        # We must add 'assignedAdmin: None' so the query can find it
        transaction_data["assignedAdmin"] = None
        # ---
        # --- *** END OF FIX *** ---
        # ---
        
        redundant_keys = [
            'advocateAddress', 'seller-name', 'seller-id', 'seller-email', 'seller-phone',
            'sellerWalletAddress', 'buyer-name', 'buyer-id', 'buyer-email', 'buyer-phone',
            'buyerWalletAddress'
        ]
        for key in redundant_keys:
            transaction_data.pop(key, None)

        
        # B. Log Document
        log_message = f"Advocate {advocate_name} initiated transaction for property {data.get('parcelNumber')} (Token ID: {data.get('tokenId')})."
        log_data = {
            "message": log_message,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "txHash": data.get('txHash'),
            "advocateUid": advocate_uid,
            "relatedTransaction": None 
        }
        
        # 5. Use a BATCH for atomic write
        batch = db.batch()
        new_tx_ref = db.collection("transactions").document()
        log_data["relatedTransaction"] = new_tx_ref.id
        batch.set(new_tx_ref, transaction_data)
        batch.set(db.collection("logs").document(), log_data)
        batch.commit()

        # 6. Return the new Transaction ID
        return jsonify({"message": "Transaction created successfully", "transactionId": new_tx_ref.id}), 201

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"Error in create-transaction: {e}")
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500

# ---
# --- ENDPOINT 3: Verify Documents ---
# ---
@app.route("/verify-documents", methods=["POST"])
def verify_documents():
    try:
        # 1. Verify the user is authenticated
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        user_uid = decoded_token["uid"]

        # 2. Get data from React
        data = request.get_json()
        transaction_id = data.get("transactionId")
        action = data.get("action")
        comment = data.get("comment")

        if not transaction_id or not action:
            return jsonify({"error": "Missing transactionId or action"}), 400
        
        if action == 'reject' and not comment:
            return jsonify({"error": "Comment is required for rejection"}), 400

        # 3. Get the transaction document
        tx_ref = db.collection("transactions").document(transaction_id)
        tx_doc = tx_ref.get()
        if not tx_doc.exists:
            return jsonify({"error": "Transaction not found"}), 404
        
        tx_data = tx_doc.to_dict()
        
        # 4. Identify user's role and set update path
        user_role = None
        update_path = None
        other_party_status = None
        advocate_uid = tx_data.get("advocate", {}).get("uid")
        
        if tx_data.get("buyer", {}).get("uid") == user_uid:
            user_role = "Buyer"
            update_path = "buyer.verifiedDocs"
            other_party_status = tx_data.get("seller", {}).get("verifiedDocs")
        elif tx_data.get("seller", {}).get("uid") == user_uid:
            user_role = "Seller"
            update_path = "seller.verifiedDocs"
            other_party_status = tx_data.get("buyer", {}).get("verifiedDocs")
        else:
            return jsonify({"error": "You are not a participant in this transaction."}), 403
        
        # 5. Prepare the update
        update_value = True if action == 'accept' else False
        update_data = {
            update_path: update_value
        }
        
        # 6. Check if this action moves the stage forward
        if action == 'accept' and other_party_status == True:
            # If I accept AND the other party has already accepted
            update_data["status"] = "Under Review" # <-- Set to "Under Review"
            
            # Notify all admins that it's ready for review
            try:
                admin_query = db.collection("users").where("isAdmin", "==", True).stream()
                admin_ids = [admin.id for admin in admin_query]
                
                if not admin_ids:
                    print("Warning: No admins found to notify.")
                
                for admin_id in admin_ids:
                    create_notification(
                        admin_id,
                        f"Transaction {tx_data.get('parcelNumber')} is ready for final review.",
                        f"/admin/transactions/{transaction_id}"
                    )
            except Exception as e:
                print(f"Warning: Failed to create admin notifications: {e}")
            
        # 7. Add rejection comment if one exists
        if action == 'reject':
            update_data[f"{user_role.lower()}.rejectionComment"] = comment

        # 8. Commit the update to Firestore
        tx_ref.update(update_data)
        
        # 9. (Optional) Create notifications
        if advocate_uid:
            action_text = "accepted" if action == 'accept' else "rejected"
            create_notification(advocate_uid, f"{user_role} has {action_text} the documents for {tx_data.get('parcelNumber')}.", f"/advocate/transactions/{transaction_id}")

        return jsonify({"message": f"Successfully {action}ed documents."}), 200

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"Error in verify-documents: {e}")
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500

# ---
# --- ENDPOINT 4: Advocate Upload Docs ---
# ---
@app.route("/advocate-upload-docs", methods=["POST"])
def advocate_upload_docs():
    try:
        # 1. Verify Advocate/Admin
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        advocate_uid = decoded_token["uid"]

        advocate_doc = db.collection("users").document(advocate_uid).get()
        if not advocate_doc.exists:
            return jsonify({"error": "Advocate profile not found."}), 403
        
        advocate_data = advocate_doc.to_dict()
        if not advocate_data.get("isAdvocate") and not advocate_data.get("isAdmin"):
            return jsonify({"error": "Insufficient permissions."}), 403
        
        advocate_name = advocate_data.get("firstName", advocate_data.get("email"))

        # 2. Get data from FormData
        transaction_id = request.form.get("transactionId")
        files = request.files.getlist("files")
        doc_names = request.form.getlist("docNames")

        if not transaction_id:
            return jsonify({"error": "Missing transactionId"}), 400
        if not files or not doc_names or len(files) != len(doc_names):
            return jsonify({"error": "File and document name mismatch"}), 400
            
        # 3. Get the transaction to update it
        tx_ref = db.collection("transactions").document(transaction_id)
        tx_doc = tx_ref.get()
        if not tx_doc.exists:
            return jsonify({"error": "Transaction not found"}), 404
            
        tx_data = tx_doc.to_dict()

        # 4. Upload files and build the doc list
        newly_uploaded_docs = []
        for i in range(len(files)):
            file = files[i]
            doc_name = doc_names[i]
            
            file_prefix = f"tx/{transaction_id}/{advocate_uid}/{doc_name}"
            file_url = upload_file_to_storage(file, advocate_uid, file_prefix)
            
            if file_url:
                newly_uploaded_docs.append({
                    "name": doc_name,
                    "url": file_url,
                    "uploadedAt": datetime.datetime.now(datetime.timezone.utc), # Use client-side timestamp
                    "uploadedBy": {
                        "uid": advocate_uid,
                        "name": advocate_name
                    }
                })

        # 5. Update the transaction document
        update_data = {
            "advocateDocuments": firestore.ArrayUnion(newly_uploaded_docs),
            "status": "Awaiting Verification", 
            "buyer.verifiedDocs": None,
            "seller.verifiedDocs": None
        }
        
        tx_ref.update(update_data)
        
        # 6. Create notifications for buyer and seller
        buyer_uid = tx_data.get("buyer", {}).get("uid")
        seller_uid = tx_data.get("seller", {}).get("uid")
        
        notification_message = f"New documents have been uploaded by your advocate for transaction {tx_data.get('parcelNumber')}."
        notification_link = f"/transactions/{transaction_id}"
        
        if buyer_uid:
            create_notification(buyer_uid, notification_message, notification_link)
        if seller_uid:
            create_notification(seller_uid, notification_message, notification_link)

        return jsonify({"message": "Documents uploaded successfully", "uploadedDocs": newly_uploaded_docs}), 200

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"Error in advocate-upload-docs: {e}")
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500

# ---
# --- *** THIS IS THE NEW ADMIN ENDPOINT *** ---
# ---
@app.route("/admin-review-transaction", methods=["POST"])
def admin_review_transaction():
    try:
        # 1. Verify Admin
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        admin_uid = decoded_token["uid"]

        admin_doc = db.collection("users").document(admin_uid).get()
        if not admin_doc.exists or not admin_doc.to_dict().get("isAdmin"):
            return jsonify({"error": "Insufficient permissions."}), 403

        # 2. Get data from React
        data = request.get_json()
        transaction_id = data.get("transactionId")
        action = data.get("action")
        comment = data.get("comment")

        if not transaction_id or not action:
            return jsonify({"error": "Missing transactionId or action"}), 400
        
        tx_ref = db.collection("transactions").document(transaction_id)
        tx_doc = tx_ref.get()
        if not tx_doc.exists:
            return jsonify({"error": "Transaction not found"}), 404
        
        tx_data = tx_doc.to_dict()
        
        # 3. Handle REJECT action
        if action == "reject":
            if not comment:
                return jsonify({"error": "Comment is required for rejection"}), 400
            
            tx_ref.update({
                "status": "Rejected",
                "adminRejectionComment": comment,
                "reviewedBy": admin_uid
            })
            
            # (Notify advocate/buyer/seller...)
            return jsonify({"message": "Transaction rejected successfully"}), 200

        # 4. Handle APPROVE action
        elif action == "approve":
            # Get the on-chain ID we saved
            on_chain_tx_id = tx_data.get("onChainTxId")
            
            if not on_chain_tx_id:
                return jsonify({"error": "CRITICAL: On-chain transaction ID is missing from this document."}), 500
            
            # Send the on-chain ID back to React for the contract call
            return jsonify({
                "message": "Database updated. Please confirm the final on-chain approval.",
                "onChainData": {
                    "onChainTxId": on_chain_tx_id
                }
            }), 200

        else:
            return jsonify({"error": "Invalid action"}), 400

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"Error in admin-review-transaction: {e}")
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500
        
        
# --- Run the Server ---
if __name__ == "__main__":
    app.run(debug=True, port=5000)# Notification routes
