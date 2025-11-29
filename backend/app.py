import os
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth
from flask import Flask, request, jsonify
from flask_cors import CORS
import datetime
from web3 import Web3
import uuid

from faker import Faker
import random

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

w3 = Web3(Web3.HTTPProvider('http://127.0.0.1:7545'))  # Your Ganache URL

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

def upload_file_to_storage(file, user_uid, file_prefix):
    """
    Upload a file to Firebase Storage and return the download URL with token.
    """
    try:
        bucket = storage.bucket()
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
        # Sanitize prefix to prevent directory traversal or weird chars
        safe_prefix = str(file_prefix).replace('/', '_')
        unique_filename = f"{safe_prefix}_{uuid.uuid4().hex[:8]}.{file_extension}"
        
        # Generate a download token (UUID)
        download_token = str(uuid.uuid4())
        
        # Upload file with metadata including the token
        blob = bucket.blob(unique_filename)
        blob.metadata = {'firebaseStorageDownloadTokens': download_token}
        blob.upload_from_file(
            file.stream,
            content_type=file.content_type or 'application/pdf'
        )
        
        # Construct the Firebase download URL with token
        # This dynamically uses the correct bucket name from config
        download_url = f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{unique_filename}?alt=media&token={download_token}"
        
        print(f"✅ File uploaded: {unique_filename}")
        return download_url
        
    except Exception as e:
        print(f"❌ Error uploading file: {e}")
        return None

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


@app.route("/log-transaction", methods=["POST"])
def log_transaction():
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        admin_uid = decoded_token["uid"]

        data = request.get_json()
        
        # Create transaction log without parcelNumber
        transaction_log = {
            "operation": data.get("operation", "property minting"),
            "txHash": data.get("txHash"),
            "timestamp": firestore.SERVER_TIMESTAMP,
            "tokenNo": data.get("tokenNo"),
            "advocateUID": data.get("advocateUID", "N/A"),
            "adminUID": admin_uid,
            "sellerUID": data.get("sellerUID", "N/A"),
            "buyerUID": data.get("buyerUID"),
            "propertyId": data.get("propertyId"),
            "status": data.get("status", "success")
        }
        
        # Store in transactionLogs collection
        timestamp, doc_ref = db.collection("transactionLogs").add(transaction_log)
        
        return jsonify({
            "message": "Transaction logged successfully",
            "logId": doc_ref.id
        }), 201

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"Error logging transaction: {e}")
        return jsonify({"error": f"Failed to log transaction: {str(e)}"}), 500


@app.route("/review-property", methods=["POST"])
def review_property():
    try:
        # --- 1. AUTH & ADMIN CHECK ---
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        admin_uid = decoded_token["uid"]

        # Verify admin permissions
        admin_doc = db.collection("users").document(admin_uid).get()
        if not admin_doc.exists or not admin_doc.to_dict().get("isAdmin"):
            return jsonify({"error": "Insufficient permissions. Admin role required."}), 403

        # --- 2. GET DATA ---
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

        # --- 3. REJECT ACTION ---
        if action == "reject":
            if not comment: 
                return jsonify({"error": "Comment is required for rejection"}), 400
            
            if not pending_prop_doc.exists: 
                return jsonify({"error": "Property not found in pending"}), 404
            
            prop_data = pending_prop_doc.to_dict()
            owner_uid = prop_data.get("uid")
            
            # Get owner details for notification
            owner_doc = db.collection("users").document(owner_uid).get()
            owner_name = "User"
            owner_email = None
            if owner_doc.exists:
                owner_name = owner_doc.to_dict().get("firstName", "User")
                owner_email = owner_doc.to_dict().get("email")
            
            # Move to Rejected collection
            new_rejected_data = prop_data.copy()
            new_rejected_data.update({
                'status': "rejected",
                'rejectionComment': comment,
                'reviewedBy': admin_uid,
                'rejectedAt': firestore.SERVER_TIMESTAMP
            })
            
            batch = db.batch()
            batch.set(rejected_prop_ref, new_rejected_data)
            batch.delete(pending_prop_ref)
            batch.commit()
            
            # Log the rejection
            db.collection("logs").add({
                "userId": admin_uid,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "message": f"Admin rejected property {prop_data.get('parcelNumber')} for {owner_name}. Reason: {comment}",
                "txHash": None,
                "type": "PROPERTY_REJECTION"
            })
            
            # Send notification
            notification_msg = f"Your property ({prop_data.get('parcelNumber', 'N/A')}) has been rejected. Reason: {comment}"
            create_notification(owner_uid, notification_msg, "/properties")
            
            # Send email
            if owner_email:
                subject = "Property Registration Rejected"
                message_html = f"""
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #EF4444;">Property Registration Update</h2>
                    <p>Dear {owner_name},</p>
                    <p>Your property registration for <strong>{prop_data.get('parcelNumber', 'N/A')}</strong> has been rejected by our admin team.</p>
                    <div style="background: #FEE2E2; padding: 15px; border-left: 4px solid #EF4444; margin: 20px 0;">
                        <strong>Reason:</strong><br>
                        {comment}
                    </div>
                    <p>You may resubmit your property after addressing the issues mentioned above.</p>
                    <p>Best regards,<br>The Land Registry Team</p>
                </div>
                """
                try:
                    send_email(owner_email, owner_name, subject, message_html)
                    print(f"✅ Rejection email sent to {owner_email}")
                except Exception as email_error:
                    print(f"⚠️ Email failed: {email_error}")
            
            return jsonify({"message": "Property rejected successfully"}), 200

        # --- 4. APPROVE ACTION ---
        elif action == "approve":
            
            # Case A: Approving from pending
            if pending_prop_doc.exists:
                prop_data = pending_prop_doc.to_dict()
                owner_uid = prop_data.get("uid")

                on_chain_data = {
                    "ownerWalletAddress": prop_data.get("ownerWalletAddress"),
                    "parcelNumber": prop_data.get("parcelNumber")
                }

                if not on_chain_data["ownerWalletAddress"]:
                    return jsonify({"error": "Cannot approve: Owner has no wallet address"}), 400

                # Get owner details
                owner_doc = db.collection("users").document(owner_uid).get()
                owner_name = "User"
                owner_email = None
                if owner_doc.exists:
                    owner_name = owner_doc.to_dict().get("firstName", "User")
                    owner_email = owner_doc.to_dict().get("email")

                # Move to approved collection
                new_prop_data = prop_data.copy()
                new_prop_data.update({
                    'status': "approved",
                    'reviewedBy': admin_uid,
                    'approvedAt': firestore.SERVER_TIMESTAMP,
                    'txHash': None,
                    'tokenId': None
                })
                
                batch = db.batch()
                batch.set(approved_prop_ref, new_prop_data)
                batch.delete(pending_prop_ref)
                batch.commit()
                
                # Log the approval
                db.collection("logs").add({
                    "userId": admin_uid,
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "message": f"Admin approved property {prop_data.get('parcelNumber')} for {owner_name}.",
                    "txHash": None,
                    "type": "PROPERTY_APPROVAL"
                })
                
                # Send notification
                notification_msg = f"Your property ({prop_data.get('parcelNumber', 'N/A')}) has been approved and is ready for minting!"
                create_notification(owner_uid, notification_msg, "/properties")
                
                # Send email
                if owner_email:
                    subject = "Property Registration Approved!"
                    message_html = f"""
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2 style="color: #10B981;">🎉 Property Approved!</h2>
                        <p>Dear {owner_name},</p>
                        <p>Great news! Your property registration for <strong>{prop_data.get('parcelNumber', 'N/A')}</strong> has been approved.</p>
                        <p>Your property will now be minted on the blockchain. You will receive another notification once the minting is complete.</p>
                        <p><a href="http://localhost:3000/properties" style="background: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Your Properties</a></p>
                        <p>Best regards,<br>The Land Registry Team</p>
                    </div>
                    """
                    try:
                        send_email(owner_email, owner_name, subject, message_html)
                        print(f"✅ Approval email sent to {owner_email}")
                    except Exception as email_error:
                        print(f"⚠️ Email failed: {email_error}")

                return jsonify({
                    "message": "Property approved in database. Ready for blockchain minting.",
                    "onChainData": on_chain_data
                }), 200

            # Case B: Retrying mint for already approved property
            elif approved_prop_doc.exists:
                prop_data = approved_prop_doc.to_dict()
                
                if prop_data.get('txHash'):
                    return jsonify({"error": "Property already minted on blockchain."}), 400
                
                return jsonify({
                    "message": "Property already approved. Retrying blockchain mint...",
                    "onChainData": {
                        "ownerWalletAddress": prop_data.get("ownerWalletAddress"),
                        "parcelNumber": prop_data.get("parcelNumber")
                    }
                }), 200
            
            else:
                return jsonify({"error": "Property not found in pending or approved collections."}), 404

        else:
            return jsonify({"error": "Invalid action. Must be 'approve' or 'reject'."}), 400

    except Exception as e:
        print(f"Error in review_property: {e}")
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500


@app.route("/review-advocate-application", methods=["POST"])
def review_advocate_application():
    try:
        # --- 1. AUTH & ADMIN CHECK ---
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        admin_uid = decoded_token["uid"]

        admin_doc = db.collection("users").document(admin_uid).get()
        if not admin_doc.exists or not admin_doc.to_dict().get("isAdmin"):
            return jsonify({"error": "Insufficient permissions. Admin role required."}), 403

        # --- 2. DATA FETCHING ---
        data = request.get_json()
        application_id = data.get("applicationId")
        action = data.get("action")
        comment = data.get("comment")

        if not application_id or not action:
            return jsonify({"error": "Missing applicationId or action"}), 400
            
        # Get Application
        app_ref = db.collection("advocateApplications").document(application_id)
        app_doc = app_ref.get()
        if not app_doc.exists:
            return jsonify({"error": "Application not found"}), 404
        app_data = app_doc.to_dict()
        
        # Get User (Applicant)
        applicant_uid = app_data.get("uid")
        user_ref = db.collection("users").document(applicant_uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({"error": "Applicant's user profile not found"}), 404
        
        user_data = user_doc.to_dict() 
        user_name = user_data.get("firstName", "Applicant")
        user_email = user_data.get("email")

        # --- 3. ACTION LOGIC ---
        
        # --- A. ROLLBACK ---
        if action == "rollback_approval":
            app_ref.update({
                "status": "pending",
                "reviewedBy": firestore.DELETE_FIELD,
                "approvedAt": firestore.DELETE_FIELD
            })
            user_ref.update({
                "isAdvocate": False
            })

            # Log the rollback
            db.collection("logs").add({
                "userId": admin_uid,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "message": f"System rolled back approval for {user_name} due to blockchain error.",
                "txHash": None,
                "type": "SYSTEM_ROLLBACK"
            })

            return jsonify({"message": "Rolled back successfully"}), 200

        # --- B. APPROVE ---
        elif action == "approve":
            on_chain_data = {
                "advocateWalletAddress": user_data.get("walletAddress")
            }

            if not on_chain_data["advocateWalletAddress"]:
                return jsonify({"error": "Cannot approve: User has no wallet address linked."}), 400

            # Update application status
            app_ref.update({
                "status": "approved",
                "reviewedBy": admin_uid,
                "approvedAt": firestore.SERVER_TIMESTAMP
            })
            
            # Grant advocate role
            user_ref.update({
                "isAdvocate": True
            })
            
            # Log the approval
            db.collection("logs").add({
                "userId": admin_uid, 
                "timestamp": firestore.SERVER_TIMESTAMP,
                "message": f"Admin approved {user_name} (ID: {applicant_uid}) to be an advocate.",
                "txHash": None,
                "type": "ADMIN_APPROVAL"
            })

            # Send Email/Notifications
            subject = "Your Advocate Application is Approved!"
            message_html = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #10B981;">Congratulations, {user_name}!</h2>
                <p>Your application to become an advocate has been <strong>approved</strong>.</p>
                <p>You now have access to advocate-specific features, including:</p>
                <ul>
                    <li>Initiating land transactions</li>
                    <li>Uploading legal documents</li>
                    <li>Managing buyer-seller deals</li>
                </ul>
                <p><a href="http://localhost:3000/dashboard" style="background: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a></p>
                <p>Best regards,<br>The Land Registry Team</p>
            </div>
            """
            message_plain = "Congratulations! Your advocate application has been approved. You now have access to advocate features."
            
            create_notification(applicant_uid, message_plain, "/dashboard")
            
            if user_email:
                try:
                    send_email(user_email, user_name, subject, message_html)
                    print(f"✅ Approval email sent to {user_email}")
                except Exception as email_error:
                    print(f"⚠️ Email failed but application still approved: {email_error}")
            
            return jsonify({
                "message": "Application approved in database. Please confirm on-chain role grant.",
                "onChainData": on_chain_data
            }), 200

        # --- C. REJECT ---
        elif action == "reject":
            if not comment:
                return jsonify({"error": "Comment is required for rejection"}), 400
            
            # Update application status
            app_ref.update({
                "status": "rejected",
                "rejectionComment": comment,
                "reviewedBy": admin_uid,
                "rejectedAt": firestore.SERVER_TIMESTAMP
            })
            
            # Log the rejection
            db.collection("logs").add({
                "userId": admin_uid,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "message": f"Admin rejected {user_name}'s advocate application. Reason: {comment}",
                "txHash": None,
                "type": "ADMIN_REJECTION"
            })
            
            # Send Email/Notifications
            subject = "Your Advocate Application Has Been Rejected"
            message_html = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #EF4444;">Application Update</h2>
                <p>Dear {user_name},</p>
                <p>Thank you for your interest in becoming an advocate. Unfortunately, your application has not been approved at this time.</p>
                <div style="background: #FEE2E2; padding: 15px; border-left: 4px solid #EF4444; margin: 20px 0;">
                    <strong>Reason:</strong><br>
                    {comment}
                </div>
                <p>If you believe this was a mistake or would like to reapply, please contact our support team.</p>
                <p>Best regards,<br>The Land Registry Team</p>
            </div>
            """
            message_plain = f"Your advocate application has been rejected. Reason: {comment}"
            
            create_notification(applicant_uid, message_plain, "/dashboard")
            
            if user_email:
                try:
                    send_email(user_email, user_name, subject, message_html)
                    print(f"✅ Rejection email sent to {user_email}")
                except Exception as email_error:
                    print(f"⚠️ Email failed but application still rejected: {email_error}")
                
            return jsonify({"message": "Application rejected successfully"}), 200

        else:
            return jsonify({"error": "Invalid action"}), 400

    except Exception as e:
        print(f"Error in review_advocate_application: {e}")
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500


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

        # Get seller and buyer wallets
        seller_wallet = get_user_wallet_by_national_id(seller_national_id)
        buyer_wallet = get_user_wallet_by_national_id(buyer_national_id)
        
        if not seller_wallet:
            return jsonify({"error": f"Seller with National ID '{seller_national_id}' not found or has no wallet."}), 404
        if not buyer_wallet:
            return jsonify({"error": f"Buyer with National ID '{buyer_national_id}' not found or has no wallet."}), 404

        # Get property by parcel number
        properties_ref = db.collection("properties")
        property_query = properties_ref.where("parcelNumber", "==", parcel_number).limit(1)
        property_results = property_query.get()
        
        if not property_results:
            return jsonify({"error": f"Property with Parcel Number '{parcel_number}' not found or not approved."}), 404
        
        property_doc = property_results[0]
        property_data = property_doc.to_dict()
        property_id = property_doc.id  # ← THE MISSING propertyId
        token_id = property_data.get("tokenId")
        
        if not token_id:
            return jsonify({"error": f"Property '{parcel_number}' is not yet minted on blockchain (no Token ID)."}), 404

        # Verify seller owns the property
        seller_uid = get_user_uid_by_national_id(seller_national_id)
        if property_data.get("uid") != seller_uid:
            return jsonify({"error": f"Seller does not own property '{parcel_number}'."}), 403

        return jsonify({
            "sellerWalletAddress": seller_wallet,
            "buyerWalletAddress": buyer_wallet,
            "tokenId": token_id,
            "propertyId": property_id  # ← ADD THIS
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
        # --- 1. VERIFY ADVOCATE/ADMIN ---
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header missing"}), 401
            
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        advocate_uid = decoded_token["uid"]
        
        advocate_doc = db.collection("users").document(advocate_uid).get()
        if not advocate_doc.exists:
            return jsonify({"error": "User not found"}), 404
            
        advocate_data = advocate_doc.to_dict()

        if not advocate_data.get("isAdvocate") and not advocate_data.get("isAdmin"):
            return jsonify({"error": "Insufficient permissions. Advocate role required."}), 403

        # --- 2. GET PAYLOAD ---
        data = request.get_json()
        
        # Validate required fields
        required_fields = ["seller-id", "buyer-id", "propertyId", "location", "parcelNumber", "txHash"]  # ← Added txHash
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # --- 3. VERIFY BLOCKCHAIN TRANSACTION ---
        tx_hash = data.get("txHash")
        on_chain_tx_id = data.get("onChainTxId")
        
        if not tx_hash or not on_chain_tx_id:
            return jsonify({"error": "Missing blockchain transaction data"}), 400
        
        try:
            tx_receipt = w3.eth.get_transaction_receipt(tx_hash)
            
            if not tx_receipt:
                return jsonify({"error": "Transaction hash not found on blockchain"}), 400
            
            if tx_receipt['status'] != 1:
                return jsonify({"error": "Blockchain transaction failed"}), 400
            
            print(f"✅ Verified initiation transaction on-chain: {tx_hash}")
            
        except Exception as e:
            return jsonify({"error": f"Failed to verify blockchain transaction: {str(e)}"}), 400
        
        # --- 4. GET USER UIDs ---
        seller_national_id = data.get("seller-id")
        buyer_national_id = data.get("buyer-id")
        
        seller_uid = get_user_uid_by_national_id(seller_national_id)
        buyer_uid = get_user_uid_by_national_id(buyer_national_id)
        
        if not seller_uid:
            return jsonify({"error": f"Seller with National ID {seller_national_id} not found"}), 404
        if not buyer_uid:
            return jsonify({"error": f"Buyer with National ID {buyer_national_id} not found"}), 404
        
        # Prevent seller from buying their own property
        if seller_uid == buyer_uid:
            return jsonify({"error": "Seller and buyer cannot be the same person"}), 400

        # --- 5. VERIFY PROPERTY OWNERSHIP ---
        property_id = data.get("propertyId")
        property_ref = db.collection("properties").document(property_id)
        property_doc = property_ref.get()
        
        if not property_doc.exists:
            return jsonify({"error": "Property not found"}), 404
        
        property_data = property_doc.to_dict()
        
        # Verify seller owns the property
        if property_data.get("uid") != seller_uid:
            return jsonify({"error": "Seller does not own this property"}), 403

        # --- 6. PREPARE TRANSACTION DATA ---
        advocate_name = advocate_data.get("firstName", advocate_data.get("email"))
        
        transaction_data = {
            "propertyId": property_id,
            "tokenId": property_data.get("tokenId"),
            "parcelNumber": data.get("parcelNumber"),
            "titleNumber": data.get("titleNumber", data.get("parcelNumber")),
            "location": data.get("location"),
            "status": "Awaiting Signatures",
            "onChainTxId": on_chain_tx_id,  # Smart contract's internal ID
            "txHash": tx_hash,  # ✅ REAL blockchain transaction hash
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "assignedAdmin": None,
            
            "advocate": {
                "uid": advocate_uid,
                "name": advocate_name,
                "walletAddress": data.get("advocateAddress") or advocate_data.get("walletAddress"),
                "email": advocate_data.get("email"),
                "phone": advocate_data.get("phoneNumber")
            },
            
            "buyer": {
                "uid": buyer_uid,
                "name": data.get("buyer-name"),
                "walletAddress": data.get("buyerWalletAddress"),
                "email": data.get("buyer-email"), 
                "phone": data.get("buyer-phone"),
                "accepted": False,
                "verifiedDocs": None 
            },
            
            "seller": {
                "uid": seller_uid,
                "name": data.get("seller-name"),
                "walletAddress": data.get("sellerWalletAddress"),
                "email": data.get("seller-email"),
                "phone": data.get("seller-phone"),
                "accepted": False,
                "verifiedDocs": None
            },
            
            "advocateDocuments": []
        }

        # --- 7. CREATE TRANSACTION IN DB ---
        new_tx_ref = db.collection("transactions").document()
        tx_id = new_tx_ref.id
        
        new_tx_ref.set(transaction_data)

        # --- 8. LOG TRANSACTION ---
        transaction_log = {
            "operation": "Transaction Initiation",
            "txHash": tx_hash,  # ✅ Real hash, not onChainTxId
            "onChainTxId": on_chain_tx_id,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "tokenNo": property_data.get("tokenId", "N/A"),
            "advocateUID": advocate_uid,
            "adminUID": "N/A",
            "sellerUID": seller_uid,
            "buyerUID": buyer_uid,
            "propertyId": property_id,
            "transactionId": tx_id,
            "location": data.get("location"),
            "status": "Success"
        }
        
        db.collection("transactionLogs").add(transaction_log)

        # --- 9. SEND NOTIFICATIONS & EMAILS ---
        dashboard_link = f"/transactions/{tx_id}"
        
        # Notify Buyer
        buyer_email = transaction_data["buyer"].get("email")
        buyer_name = transaction_data["buyer"].get("name", "User")

        print(f"\n📧 EMAIL DEBUG:")
        print(f"   Buyer: {buyer_name} <{buyer_email}>")
        
        buyer_notification = f"A new land transaction has been initiated for property {data.get('parcelNumber')}. Please review and accept."
        create_notification(buyer_uid, buyer_notification, dashboard_link)
        
        if buyer_email:
            subject = "Action Required: New Land Transaction Initiated"
            message_html = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #10B981;">New Transaction Initiated</h2>
                <p>Hello {buyer_name},</p>
                <p>Advocate <strong>{advocate_name}</strong> has initiated a new land transaction involving you as the <strong>buyer</strong>.</p>
                <div style="background: #F0FDF4; padding: 15px; border-left: 4px solid #10B981; margin: 20px 0;">
                    <strong>Property Details:</strong><br>
                    Parcel Number: {data.get('parcelNumber')}<br>
                    Location: {data.get('location')}<br>
                    Transaction ID: {tx_id}
                </div>
                <p>Please log in to your dashboard to review the details and <strong>accept the initiation</strong>.</p>
                <p><a href="http://localhost:3000{dashboard_link}" style="background: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Transaction</a></p>
                <p>Best regards,<br>The Land Registry Team</p>
            </div>
            """
            try:
                send_email(buyer_email, buyer_name, subject, message_html)
                print(f"✅ Transaction notification sent to buyer: {buyer_email}")
            except Exception as email_error:
                print(f"⚠️ Email to buyer failed: {email_error}")

        # Notify Seller
        seller_email = transaction_data["seller"].get("email")
        seller_name = transaction_data["seller"].get("name", "User")
        
        seller_notification = f"A new land transaction has been initiated for your property {data.get('parcelNumber')}. Please review and accept."
        create_notification(seller_uid, seller_notification, dashboard_link)
        
        if seller_email:
            subject = "Action Required: New Land Transaction Initiated"
            message_html = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #10B981;">New Transaction Initiated</h2>
                <p>Hello {seller_name},</p>
                <p>Advocate <strong>{advocate_name}</strong> has initiated a new land transaction for your property as the <strong>seller</strong>.</p>
                <div style="background: #F0FDF4; padding: 15px; border-left: 4px solid #10B981; margin: 20px 0;">
                    <strong>Property Details:</strong><br>
                    Parcel Number: {data.get('parcelNumber')}<br>
                    Location: {data.get('location')}<br>
                    Transaction ID: {tx_id}
                </div>
                <p>Please log in to your dashboard to review the details and <strong>accept the initiation</strong>.</p>
                <p><a href="http://localhost:3000{dashboard_link}" style="background: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Transaction</a></p>
                <p>Best regards,<br>The Land Registry Team</p>
            </div>
            """
            try:
                send_email(seller_email, seller_name, subject, message_html)
                print(f"✅ Transaction notification sent to seller: {seller_email}")
            except Exception as email_error:
                print(f"⚠️ Email to seller failed: {email_error}")

        return jsonify({
            "message": "Transaction created successfully",
            "transactionId": tx_id,
            "txHash": tx_hash  # ✅ Return the real hash
        }), 201

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"❌ Error in create-transaction: {e}")
        
        # Log failed transaction attempt
        try:
            failed_log = {
                "operation": "Transaction Initiation",
                "txHash": tx_hash if 'tx_hash' in locals() else "N/A",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "tokenNo": property_data.get("tokenId", "N/A") if 'property_data' in locals() else "N/A",
                "advocateUID": advocate_uid if 'advocate_uid' in locals() else "N/A",
                "adminUID": "N/A",
                "sellerUID": seller_uid if 'seller_uid' in locals() else "N/A",
                "buyerUID": buyer_uid if 'buyer_uid' in locals() else "N/A",
                "propertyId": data.get("propertyId", "N/A") if 'data' in locals() else "N/A",
                "transactionId": "N/A",
                "location": data.get("location", "Unknown") if 'data' in locals() else "Unknown",
                "status": "Failed",
                "errorMessage": str(e)
            }
            db.collection("transactionLogs").add(failed_log)
        except Exception as log_error:
            print(f"⚠️ Failed to log error: {log_error}")
            
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500


# --- ENDPOINT: Accept Transaction ---
@app.route("/accept-transaction", methods=["POST"])
def accept_transaction():
    try:
        # --- 1. Authentication (With Network Error Handling) ---
        auth_header = request.headers.get("Authorization")
        if not auth_header: 
            return jsonify({"error": "No token provided"}), 401
        
        try:
            id_token = auth_header.split("Bearer ")[1]
            decoded_token = auth.verify_id_token(id_token)
            user_uid = decoded_token["uid"]
        except (ConnectionError, Timeout) as e:
            print(f"Network Error during Auth: {e}")
            return jsonify({"error": "Server could not reach authentication provider. Check internet connection."}), 503
        except Exception as e:
            return jsonify({"error": f"Invalid token: {str(e)}"}), 401


        # --- 2. Get Transaction Data ---
        data = request.get_json()
        tx_id = data.get("transactionId")
        acceptance_tx_hash = data.get("acceptanceTxHash")  # ← NEW
        
        if not tx_id:
            return jsonify({"error": "Missing transactionId"}), 400


        tx_ref = db.collection("transactions").document(tx_id)
        tx_doc = tx_ref.get()
        
        if not tx_doc.exists:
            return jsonify({"error": "Transaction not found"}), 404
        
        tx_data = tx_doc.to_dict()


        # --- 3. Verify Blockchain Hash (if provided) ---
        if acceptance_tx_hash:
            try:
                tx_receipt = w3.eth.get_transaction_receipt(acceptance_tx_hash)
                
                if not tx_receipt:
                    return jsonify({"error": "Acceptance transaction hash not found on blockchain"}), 400
                
                if tx_receipt['status'] != 1:  # 1 = success, 0 = failed
                    return jsonify({"error": "Blockchain acceptance transaction failed"}), 400
                
                print(f"✅ Verified acceptance transaction on-chain: {acceptance_tx_hash}")
                
            except Exception as e:
                return jsonify({"error": f"Failed to verify blockchain transaction: {str(e)}"}), 400
        else:
            # If no hash provided, it might be a retry or recovery scenario
            print("⚠️ No acceptance hash provided - proceeding with database sync only")


        # --- 4. Determine Role & Update Logic ---
        updates = {}
        role = ""
        
        # Safe access to nested fields using .get() to prevent KeyErrors
        buyer_data = tx_data.get("buyer", {})
        seller_data = tx_data.get("seller", {})
        
        if buyer_data.get("uid") == user_uid:
            role = "Buyer"
            updates["buyer.accepted"] = True
            if acceptance_tx_hash:
                updates["buyer.acceptanceTxHash"] = acceptance_tx_hash  # ← NEW: Store hash
            updates["buyer.acceptedAt"] = firestore.SERVER_TIMESTAMP  # ← NEW: Timestamp
            
            # Check if this completes the stage
            if seller_data.get("accepted") is True:
                updates["status"] = "Docs Shared"
                
        elif seller_data.get("uid") == user_uid:
            role = "Seller"
            updates["seller.accepted"] = True
            if acceptance_tx_hash:
                updates["seller.acceptanceTxHash"] = acceptance_tx_hash  # ← NEW: Store hash
            updates["seller.acceptedAt"] = firestore.SERVER_TIMESTAMP  # ← NEW: Timestamp
            
            # Check if this completes the stage
            if buyer_data.get("accepted") is True:
                updates["status"] = "Docs Shared"
        else:
            return jsonify({"error": "User is not a participant in this transaction"}), 403


        # Update the transaction document
        tx_ref.update(updates)


        # --- 5. Logging (Enhanced with Hash) ---
        transaction_log = {
            "operation": "Transaction Acceptance",
            "txHash": acceptance_tx_hash if acceptance_tx_hash else tx_data.get("txHash", "N/A"),
            "acceptanceTxHash": acceptance_tx_hash,  # ← NEW: Specific field for acceptance
            "timestamp": firestore.SERVER_TIMESTAMP,
            "tokenNo": tx_data.get("tokenId", "N/A"),
            "advocateUID": tx_data.get("advocate", {}).get("uid", "N/A"),
            "adminUID": "N/A",
            "sellerUID": seller_data.get("uid", "N/A"),
            "buyerUID": buyer_data.get("uid", "N/A"),
            "propertyId": tx_data.get("propertyId", "N/A"),
            "transactionId": tx_id,
            "location": tx_data.get("location", "Unknown"),
            "status": "Success",
            "role": role,
            "actionBy": user_uid
        }
        db.collection("transactionLogs").add(transaction_log)


        return jsonify({
            "message": "Acceptance recorded successfully", 
            "role": role,
            "acceptanceTxHash": acceptance_tx_hash
        }), 200


    except Exception as e:
        print(f"❌ Unhandled Error in accept-transaction: {e}")
        
        # Log failed attempt
        try:
            failed_log = {
                "operation": "Transaction Acceptance",
                "txHash": acceptance_tx_hash if 'acceptance_tx_hash' in locals() else "N/A",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "tokenNo": tx_data.get("tokenId", "N/A") if 'tx_data' in locals() else "N/A",
                "transactionId": tx_id if 'tx_id' in locals() else "N/A",
                "status": "Failed",
                "errorMessage": str(e),
                "actionBy": user_uid if 'user_uid' in locals() else "N/A"
            }
            db.collection("transactionLogs").add(failed_log)
        except Exception as log_error:
            print(f"⚠️ Failed to log error: {log_error}")
            
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500

from datetime import datetime, timedelta
@app.route("/stage-advocate-docs", methods=["POST"])
def stage_advocate_docs():
    try:
        # 1. Auth Check
        auth_header = request.headers.get("Authorization")
        if not auth_header: 
            return jsonify({"error": "No token"}), 401
        
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        advocate_uid = decoded_token["uid"]


        # 2. Get Data
        tx_id = request.form.get("transactionId")
        uploaded_files = request.files.getlist("files")
        doc_names = request.form.getlist("docNames")
        
        if not tx_id or not uploaded_files:
            return jsonify({"error": "Missing transactionId or files"}), 400


        documents = []
        file_names_for_hash = []
        
        # 3. Upload Loop
        for i, file in enumerate(uploaded_files):
            # Call the helper function
            real_url = upload_file_to_storage(file, advocate_uid, tx_id)
            
            if not real_url:
                return jsonify({"error": f"Failed to upload file: {file.filename}"}), 500
            
            doc_name = doc_names[i] if i < len(doc_names) else file.filename
            
            documents.append({
                "name": doc_name,
                "url": real_url, # ✅ Now using the valid, generated URL
                "uploadedBy": {"uid": advocate_uid},
                "uploadedAt": datetime.now().isoformat()
            })
            file_names_for_hash.append(file.filename)


        # 4. Create Hash (for Blockchain consistency)
        combined_string = "".join(sorted(file_names_for_hash))
        doc_hash = Web3.keccak(text=combined_string).hex()


        # Return data for Frontend to sign
        return jsonify({
            "docHash": doc_hash,
            "documents": documents
        }), 200


    except Exception as e:
        print(f"❌ Error staging docs: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/finalize-advocate-upload", methods=["POST"])
def finalize_advocate_upload():
    try:
        # 1. Auth Check
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "No token"}), 401
        
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        advocate_uid = decoded_token["uid"]
        
        # 2. Get Data
        data = request.get_json()
        tx_id = data.get("transactionId")
        documents = data.get("documents")
        doc_hash = data.get("docHash")
        upload_tx_hash = data.get("uploadTxHash")  # ← NEW


        if not tx_id or not documents or not doc_hash:
            return jsonify({"error": "Missing required fields"}), 400


        # --- 3. Verify Blockchain Hash (if provided) ---
        if upload_tx_hash:
            try:
                tx_receipt = w3.eth.get_transaction_receipt(upload_tx_hash)
                
                if not tx_receipt:
                    return jsonify({"error": "Upload transaction hash not found on blockchain"}), 400
                
                if tx_receipt['status'] != 1:  # 1 = success, 0 = failed
                    return jsonify({"error": "Blockchain upload transaction failed"}), 400
                
                print(f"✅ Verified document upload transaction on-chain: {upload_tx_hash}")
                
            except Exception as e:
                return jsonify({"error": f"Failed to verify blockchain transaction: {str(e)}"}), 400
        else:
            print("⚠️ No upload hash provided - proceeding without blockchain verification")


        # --- 4. Get Transaction ---
        tx_ref = db.collection("transactions").document(tx_id)
        tx_doc = tx_ref.get()
        
        if not tx_doc.exists:
            return jsonify({"error": "Transaction not found"}), 404
        
        tx_data = tx_doc.to_dict()
        
        # Verify advocate authorization
        if tx_data.get("advocate", {}).get("uid") != advocate_uid:
            return jsonify({"error": "Unauthorized: You are not the assigned advocate"}), 403


        # --- 5. Add hash to each document ---
        for doc in documents:
            doc["uploadTxHash"] = upload_tx_hash  # ← NEW: Add blockchain hash
            doc["uploadedAt"] = datetime.now().isoformat()
            doc["uploadedBy"] = {"uid": advocate_uid}


        # --- 6. Update Transaction State ---
        tx_ref.update({
            "advocateDocuments": documents,
            "docHash": doc_hash,
            "lastDocUploadTxHash": upload_tx_hash,  # ← NEW: Store latest upload hash
            "status": "Awaiting Verification",
            "advocateDocsUploaded": True,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            # Reset verification status so parties must review new docs
            "buyer.verifiedDocs": None,
            "seller.verifiedDocs": None
        })


        # --- 7. Notify Buyer & Seller ---
        buyer_uid = tx_data.get("buyer", {}).get("uid")
        seller_uid = tx_data.get("seller", {}).get("uid")
        buyer_email = tx_data.get("buyer", {}).get("email")
        seller_email = tx_data.get("seller", {}).get("email")
        buyer_name = tx_data.get("buyer", {}).get("name", "User")
        seller_name = tx_data.get("seller", {}).get("name", "User")
        advocate_name = tx_data.get("advocate", {}).get("name", "Advocate")


        dashboard_link = f"/transactions/{tx_id}"
        notification_message = f"New documents have been shared by {advocate_name}. Please review and verify."


        # Notify Buyer
        if buyer_uid:
            create_notification(buyer_uid, notification_message, dashboard_link)
        
        if buyer_email:
            subject = "New Documents Available for Review"
            message_html = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #10B981;">Documents Shared</h2>
                <p>Hello {buyer_name},</p>
                <p>Advocate <strong>{advocate_name}</strong> has shared new documents for your transaction.</p>
                <p>Please log in to review and verify the documents.</p>
                <p><a href="http://localhost:3000{dashboard_link}" style="background: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Documents</a></p>
                <p>Best regards,<br>The Land Registry Team</p>
            </div>
            """
            try:
                send_email(buyer_email, buyer_name, subject, message_html)
                print(f"✅ Document notification sent to buyer: {buyer_email}")
            except Exception as email_error:
                print(f"⚠️ Email to buyer failed: {email_error}")


        # Notify Seller
        if seller_uid:
            create_notification(seller_uid, notification_message, dashboard_link)
        
        if seller_email:
            subject = "New Documents Available for Review"
            message_html = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #10B981;">Documents Shared</h2>
                <p>Hello {seller_name},</p>
                <p>Advocate <strong>{advocate_name}</strong> has shared new documents for your transaction.</p>
                <p>Please log in to review and verify the documents.</p>
                <p><a href="http://localhost:3000{dashboard_link}" style="background: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Documents</a></p>
                <p>Best regards,<br>The Land Registry Team</p>
            </div>
            """
            try:
                send_email(seller_email, seller_name, subject, message_html)
                print(f"✅ Document notification sent to seller: {seller_email}")
            except Exception as email_error:
                print(f"⚠️ Email to seller failed: {email_error}")


        # --- 8. Log to transactionLogs ---
        transaction_log = {
            "operation": "Document Upload",
            "txHash": tx_data.get("txHash", "N/A"),
            "uploadTxHash": upload_tx_hash,  # ← NEW: Specific field for upload hash
            "docHash": doc_hash,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "tokenNo": tx_data.get("tokenId", "N/A"),
            "propertyId": tx_data.get("propertyId", "N/A"),
            "transactionId": tx_id,
            "location": tx_data.get("location", "Unknown"),
            "advocateUID": advocate_uid,
            "adminUID": "N/A",
            "buyerUID": buyer_uid or "N/A",
            "sellerUID": seller_uid or "N/A",
            "status": "Success",
            "role": "Advocate",
            "actionBy": advocate_uid,
            "docsCount": len(documents)
        }
        db.collection("transactionLogs").add(transaction_log)


        return jsonify({
            "message": "Upload finalized and parties notified",
            "uploadTxHash": upload_tx_hash
        }), 200


    except Exception as e:
        print(f"❌ Error finalizing upload: {e}")
        
        # Log failed attempt
        try:
            failed_log = {
                "operation": "Document Upload",
                "uploadTxHash": upload_tx_hash if 'upload_tx_hash' in locals() else "N/A",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "transactionId": tx_id if 'tx_id' in locals() else "N/A",
                "status": "Failed",
                "errorMessage": str(e),
                "actionBy": advocate_uid if 'advocate_uid' in locals() else "N/A"
            }
            db.collection("transactionLogs").add(failed_log)
        except Exception as log_error:
            print(f"⚠️ Failed to log error: {log_error}")
            
        return jsonify({"error": str(e)}), 500

# --- ENDPOINT: Reject Transaction ---
@app.route("/reject-transaction", methods=["POST"])
def reject_transaction():
    try:
        # Auth Check
        auth_header = request.headers.get("Authorization")
        if not auth_header: 
            return jsonify({"error": "No token"}), 401
        
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        user_uid = decoded_token["uid"]

        # Get Data
        data = request.get_json()
        tx_id = data.get("transactionId")
        reason = data.get("reason", "No reason provided")
        
        if not tx_id:
            return jsonify({"error": "Transaction ID required"}), 400
        
        tx_ref = db.collection("transactions").document(tx_id)
        tx_doc = tx_ref.get()
        
        if not tx_doc.exists:
            return jsonify({"error": "Transaction not found"}), 404
        
        tx_data = tx_doc.to_dict()

        # Verify user is participant
        is_buyer = tx_data.get("buyer", {}).get("uid") == user_uid
        is_seller = tx_data.get("seller", {}).get("uid") == user_uid
        is_advocate = tx_data.get("advocate", {}).get("uid") == user_uid
        
        # Check if user is admin
        user_doc = db.collection("users").document(user_uid).get()
        is_admin = user_doc.to_dict().get("isAdmin", False) if user_doc.exists else False
        
        if not (is_buyer or is_seller or is_advocate or is_admin):
            return jsonify({"error": "Not authorized to cancel this transaction"}), 403

        # Determine role
        if is_buyer:
            role = "Buyer"
        elif is_seller:
            role = "Seller"
        elif is_advocate:
            role = "Advocate"
        elif is_admin:
            role = "Admin"
        else:
            role = "Unknown"

        # Update transaction status
        tx_ref.update({
            "status": "Cancelled",
            "cancellationReason": reason,
            "cancelledBy": user_uid,
            "cancelledByRole": role,
            "cancelledAt": firestore.SERVER_TIMESTAMP
        })

        # Get property details for notification
        property_id = tx_data.get("propertyId", "")
        parcel_number = tx_data.get("parcelNumber", "Unknown Property")

        # Notify other participants
        notification_message = f"Transaction for {parcel_number} has been cancelled by {role}. Reason: {reason}"
        notification_link = f"/transactions/{tx_id}"
        
        # Notify all participants (except the one who cancelled)
        if is_buyer:
            # Notify seller and advocate
            if tx_data.get("seller", {}).get("uid"):
                create_notification(tx_data["seller"]["uid"], notification_message, notification_link)
            if tx_data.get("advocate", {}).get("uid"):
                create_notification(tx_data["advocate"]["uid"], notification_message, notification_link)
        elif is_seller:
            # Notify buyer and advocate
            if tx_data.get("buyer", {}).get("uid"):
                create_notification(tx_data["buyer"]["uid"], notification_message, notification_link)
            if tx_data.get("advocate", {}).get("uid"):
                create_notification(tx_data["advocate"]["uid"], notification_message, notification_link)
        elif is_advocate:
            # Notify buyer and seller
            if tx_data.get("buyer", {}).get("uid"):
                create_notification(tx_data["buyer"]["uid"], notification_message, notification_link)
            if tx_data.get("seller", {}).get("uid"):
                create_notification(tx_data["seller"]["uid"], notification_message, notification_link)

        # LOG IN transactionLogs
        transaction_log = {
            "operation": "Transaction Cancellation",
            "txHash": tx_data.get("txHash", "N/A"),
            "timestamp": firestore.SERVER_TIMESTAMP,
            "tokenNo": tx_data.get("tokenId", "N/A"),
            "advocateUID": tx_data.get("advocate", {}).get("uid", "N/A"),
            "adminUID": user_uid if is_admin else "N/A",
            "sellerUID": tx_data.get("seller", {}).get("uid", "N/A"),
            "buyerUID": tx_data.get("buyer", {}).get("uid", "N/A"),
            "propertyId": property_id,
            "location": tx_data.get("location", "Unknown"),
            "status": "Rejected",
            "role": role,
            "actionBy": user_uid,
            "rejectionReason": reason,
            "transactionId": tx_id
        }
        db.collection("transactionLogs").add(transaction_log)

        # Return data needed for blockchain cancellation
        return jsonify({
            "message": "Transaction cancelled in database",
            "onChainTxId": tx_data.get("onChainTxId"),
            "requiresBlockchainCancellation": tx_data.get("onChainTxId") is not None
        }), 200

    except Exception as e:
        print(f"Error rejecting transaction: {e}")
        return jsonify({"error": str(e)}), 500

# ---
# --- ENDPOINT 3: Verify Documents ---
# ---
@app.route("/verify-documents", methods=["POST"])
def verify_documents():
    try:
        # 1. Auth Check
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "No token"}), 401
        
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        user_uid = decoded_token["uid"]


        # 2. Get Data
        data = request.get_json()
        tx_id = data.get("transactionId")
        action = data.get("action")  # 'accept' or 'reject'
        comment = data.get("comment", "")
        verification_tx_hash = data.get("verificationTxHash")  # ← NEW


        if not tx_id:
            return jsonify({"error": "Missing transactionId"}), 400


        tx_ref = db.collection("transactions").document(tx_id)
        tx_doc = tx_ref.get()
        if not tx_doc.exists:
            return jsonify({"error": "Transaction not found"}), 404
        
        tx_data = tx_doc.to_dict()


        # --- 3. Verify Blockchain Hash (if provided) ---
        if verification_tx_hash:
            try:
                tx_receipt = w3.eth.get_transaction_receipt(verification_tx_hash)
                
                if not tx_receipt:
                    return jsonify({"error": "Verification transaction hash not found on blockchain"}), 400
                
                if tx_receipt['status'] != 1:
                    return jsonify({"error": "Blockchain verification transaction failed"}), 400
                
                print(f"✅ Verified document {action} transaction on-chain: {verification_tx_hash}")
                
            except Exception as e:
                return jsonify({"error": f"Failed to verify blockchain transaction: {str(e)}"}), 400
        else:
            print("⚠️ No verification hash provided")


        # --- 4. Determine Role ---
        updates = {}
        role = None
        field_prefix = None
        other_party_verified = None


        if tx_data.get("buyer", {}).get("uid") == user_uid:
            role = "Buyer"
            field_prefix = "buyer"
            other_party_verified = tx_data.get("seller", {}).get("verifiedDocs")
        elif tx_data.get("seller", {}).get("uid") == user_uid:
            role = "Seller"
            field_prefix = "seller"
            other_party_verified = tx_data.get("buyer", {}).get("verifiedDocs")
        else:
            return jsonify({"error": "Unauthorized"}), 403


        # --- 5. Accept/Reject Logic ---
        if action == "reject":
            updates[f"{field_prefix}.verifiedDocs"] = False
            updates[f"{field_prefix}.rejectionComment"] = comment or "No comment provided."
            if verification_tx_hash:
                updates[f"{field_prefix}.rejectionTxHash"] = verification_tx_hash
            updates[f"{field_prefix}.verifiedAt"] = firestore.SERVER_TIMESTAMP
            updates["status"] = "Documents Rejected"
            
        elif action == "accept":
            updates[f"{field_prefix}.verifiedDocs"] = True
            updates[f"{field_prefix}.rejectionComment"] = firestore.DELETE_FIELD
            if verification_tx_hash:
                updates[f"{field_prefix}.verificationTxHash"] = verification_tx_hash
            updates[f"{field_prefix}.verifiedAt"] = firestore.SERVER_TIMESTAMP
            
            # Check if both parties have accepted
            if other_party_verified is True:
                updates["status"] = "Under Review"


        # --- 6. Commit Update ---
        tx_ref.update(updates)


        # --- 7. LOG TO transactionLogs ---
        log_entry = {
            "operation": "Document Verification",
            "txHash": tx_data.get("txHash", "N/A"),
            "verificationTxHash": verification_tx_hash,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "tokenNo": tx_data.get("tokenId", "N/A"),
            "propertyId": tx_data.get("propertyId", "N/A"),
            "transactionId": tx_id,
            "location": tx_data.get("location", "Unknown"),
            "advocateUID": tx_data.get("advocate", {}).get("uid", "N/A"),
            "adminUID": "N/A",
            "buyerUID": tx_data.get("buyer", {}).get("uid", "N/A"),
            "sellerUID": tx_data.get("seller", {}).get("uid", "N/A"),
            "status": "Success" if action == "accept" else "Rejected",
            "role": role,
            "actionBy": user_uid,
            "action": action
        }
        
        if action == "reject":
            log_entry["rejectionReason"] = comment or "No comment provided."
        
        db.collection("transactionLogs").add(log_entry)


        return jsonify({
            "message": f"Verification {action}ed successfully",
            "verificationTxHash": verification_tx_hash
        }), 200


    except Exception as e:
        print(f"❌ Error verifying documents: {e}")
        
        # Log failed attempt
        try:
            failed_log = {
                "operation": "Document Verification",
                "verificationTxHash": verification_tx_hash if 'verification_tx_hash' in locals() else "N/A",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "transactionId": tx_id if 'tx_id' in locals() else "N/A",
                "status": "Failed",
                "errorMessage": str(e),
                "actionBy": user_uid if 'user_uid' in locals() else "N/A"
            }
            db.collection("transactionLogs").add(failed_log)
        except Exception as log_error:
            print(f"⚠️ Failed to log error: {log_error}")
            
        return jsonify({"error": str(e)}), 500

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
# --- ENDPOINT 1: Review Prep (Keep this as you wrote it, it is good) ---
@app.route("/admin-review-transaction", methods=["POST"])
def admin_review_transaction():
    try:
        # 1. Verify Admin Authentication and Permissions
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401

        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        admin_uid = decoded_token["uid"]

        admin_doc = db.collection("users").document(admin_uid).get()
        if not admin_doc.exists or not admin_doc.to_dict().get("isAdmin"):
            return jsonify({"error": "Insufficient permissions."}), 403

        # 2. Get and Validate Request Data
        data = request.get_json()
        transaction_id = data.get("transactionId")
        action = data.get("action")
        comment = data.get("comment", "")

        if not transaction_id or not action:
            return jsonify({"error": "Missing transactionId or action"}), 400

        tx_ref = db.collection("transactions").document(transaction_id)
        tx_doc = tx_ref.get()
        if not tx_doc.exists:
            return jsonify({"error": "Transaction not found"}), 404

        tx_data = tx_doc.to_dict()

        # 3. Handle Actions
        if action == "reject":
            if not comment:
                return jsonify({"error": "Comment is required for rejection"}), 400

            tx_ref.update({
                "status": "Rejected",
                "adminRejectionComment": comment,
                "reviewedBy": admin_uid
            })

            # Log the rejection in transactionLogs
            db.collection("transactionLogs").add({
                "operation": "admin rejection",
                "status": "rejected",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "propertyId": transaction_id,
                "txHash": tx_data.get("txHash", "N/A"),
                "tokenNo": tx_data.get("tokenId", "N/A"),
                "advocateUID": tx_data.get("advocate", {}).get("uid", "N/A"),
                "adminUID": admin_uid,
                "buyerUID": tx_data.get("buyer", {}).get("uid", "N/A"),
                "sellerUID": tx_data.get("seller", {}).get("uid", "N/A"),
                "role": "Admin",
                "actionBy": admin_uid,
                "rejectionReason": comment
            })

            return jsonify({"message": "Transaction rejected successfully"}), 200

        elif action == "approve":
            on_chain_tx_id = tx_data.get("onChainTxId")
            if not on_chain_tx_id:
                return jsonify({"error": "On-chain transaction ID is missing."}), 500

            # Log the admin approval
            db.collection("transactionLogs").add({
                "operation": "admin approval",
                "status": "pending",  # Will become 'success' on blockchain transfer
                "timestamp": firestore.SERVER_TIMESTAMP,
                "propertyId": transaction_id,
                "txHash": tx_data.get("txHash", "N/A"),
                "tokenNo": tx_data.get("tokenId", "N/A"),
                "advocateUID": tx_data.get("advocate", {}).get("uid", "N/A"),
                "adminUID": admin_uid,
                "buyerUID": tx_data.get("buyer", {}).get("uid", "N/A"),
                "sellerUID": tx_data.get("seller", {}).get("uid", "N/A"),
                "role": "Admin",
                "actionBy": admin_uid
            })

            return jsonify({
                "message": "Database updated. Please confirm the final on-chain approval.",
                "onChainData": {"onChainTxId": on_chain_tx_id}
            }), 200

        else:
            return jsonify({"error": "Invalid action"}), 400

    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid or expired token"}), 403
    except Exception as e:
        print(f"Error in admin-review-transaction: {e}")
        return jsonify({"error": "An internal error occurred."}), 500


# --- ENDPOINT 2: Finalize & Swap Ownership (ADD THIS NEW FUNCTION) ---
@app.route("/finalize-transaction", methods=["POST"])
def finalize_transaction():
    try:
        # 1. Auth Check
        auth_header = request.headers.get("Authorization")
        if not auth_header: return jsonify({"error": "No token"}), 401
        id_token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(id_token)
        admin_uid = decoded_token["uid"]

        # 2. Get Data
        data = request.get_json()
        tx_id = data.get("transactionId")
        tx_hash = data.get("txHash")
        raw_token_id = data.get("tokenId")
        new_owner_uid = data.get("newOwnerUid")
        new_owner_wallet = data.get("newOwnerWallet")
        if not raw_token_id:
            return jsonify({"error": "Missing Token ID"}), 400

        print(f"Finalizing Tx: {tx_id} for Token: {raw_token_id}")

        # **DEFINE THE BATCH HERE**
        batch = db.batch()

        # A. Update Transaction Status
        tx_ref = db.collection("transactions").document(tx_id)
        batch.update(tx_ref, {
            "status": "Finalized",
            "finalTxHash": tx_hash,
            "finalizedAt": firestore.SERVER_TIMESTAMP,
            "approvedBy": admin_uid
        })

        # B. Update Property Ownership
        props_ref = db.collection("properties")
        query = props_ref.where("tokenId", "==", str(raw_token_id)).limit(1)
        results = list(query.stream())
        if not results and str(raw_token_id).isdigit():
            query = props_ref.where("tokenId", "==", int(raw_token_id)).limit(1)
            results = list(query.stream())
        if results:
            doc = results[0]
            current_data = doc.to_dict()
            old_owner_id = current_data.get("uid") or current_data.get("ownerUid")
            update_data = {
                "uid": new_owner_uid,
                "ownerUid": new_owner_uid,
                "ownerWallet": new_owner_wallet,
                "previousOwners": firestore.ArrayUnion([old_owner_id]) if old_owner_id else firestore.DELETE_FIELD
            }
            batch.update(doc.reference, update_data)
        else:
            print(f"CRITICAL WARNING: Property with Token ID {raw_token_id} not found in DB. Ownership not updated.")

        # C. Log it (optionally use transactionLogs as advised)
        # Here, replace with transactionLogs for best practice.
        log_ref = db.collection("transactionLogs").document()
        batch.set(log_ref, {
            "operation": "ownership transfer",
            "status": "success",
            "timestamp": firestore.SERVER_TIMESTAMP,
            "propertyId": tx_id,
            "txHash": tx_hash,
            "tokenNo": raw_token_id,
            "advocateUID": "N/A",
            "adminUID": admin_uid,
            "buyerUID": new_owner_uid,
            "sellerUID": old_owner_id,
            "role": "Admin",
            "actionBy": admin_uid
        })

        # 4. Commit the batch!
        batch.commit()

        return jsonify({"message": "Transfer finalized successfully"}), 200

    except Exception as e:
        print(f"Error finalizing: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/hotspot-radar-report", methods=["GET"])
def hotspot_radar_report():
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "No token"}), 401

        # Token validation
        parts = auth_header.split("Bearer ")
        if len(parts) < 2:
            return jsonify({"error": "Invalid token format. Expected 'Bearer <token>'"}), 401
        id_token = parts[1]
        decoded_token = auth.verify_id_token(id_token)

        # Load all transaction logs
        logs = [doc.to_dict() for doc in db.collection("transactionLogs").stream()]
        # You must fetch locations via a properties join — unless you store it in logs
        # Let's pull property locations into a dict for a fast join:
        property_locations = {}
        prop_stream = db.collection("properties").stream()
        for p in prop_stream:
            prop = p.to_dict()
            prop_id = p.id
            prop_location = prop.get("location", "Unknown")
            prop_token = str(prop.get("tokenId", ""))
            property_locations[prop_id] = prop_location
            if prop_token:
                property_locations[prop_token] = prop_location

        # Build stats: location -> [total, rejected]
        location_stats = {}
        for log in logs:
            status = (log.get("status") or "").lower()
            prop_id = str(log.get("propertyId", "")).strip()
            token_no = str(log.get("tokenNo", "")).strip()

            # Try both propertyId and tokenNo for location lookup
            location = property_locations.get(prop_id) or property_locations.get(token_no) or "Unknown"
            if location not in location_stats:
                location_stats[location] = {"total": 0, "rejected": 0}
            location_stats[location]["total"] += 1
            if status == "rejected":
                location_stats[location]["rejected"] += 1

        hotspots = []
        for loc, stat in location_stats.items():
            total = stat["total"]
            rejected = stat["rejected"]
            if total > 0 and rejected > 0:
                rejection_rate = (rejected / total) * 100
                if rejection_rate > 40:
                    risk = "High"
                elif rejection_rate > 20:
                    risk = "Medium"
                else:
                    risk = "Low"
                hotspots.append({
                    "location": loc,
                    "count": rejected,
                    "risk": risk,
                    "rate": round(rejection_rate, 2)
                })

        hotspots.sort(key=lambda x: x["rate"], reverse=True)
        return jsonify({"hotspots": hotspots[:10]}), 200

    except Exception as e:
        print(f"HotspotRadar endpoint error: {e}")
        return jsonify({"error": str(e)}), 500

from faker import Faker
import random
from datetime import datetime, timedelta

fake = Faker()

@app.route("/generate-fake-logs", methods=["POST"])
def generate_fake_logs():
    try:
        # --- Get how many logs to generate ---
        data = request.get_json() or {}
        n = int(data.get("count", 50))

        # --- Optional: Example Location Pool and Tokens ---
        location_pool = [
            "Donholm, Nairobi", "Syokimau", "Kitengela", "Juja", "Langata", "Kileleshwa",
            "Kahawa West", "Buruburu", "Ruiru", "Mlolongo"
        ]
        status_pool = ["success", "rejected", "failed"]
        risk_levels = ["High", "Medium", "Low"]
        operations = [
            "property minting", "transaction initiation", "transaction acceptance",
            "transaction rejection", "ownership transfer", "admin approval"
        ]

        db_client = db if 'db' in globals() else firestore.client()  # Use your actual db variable

        # --- Optional: create some fake properties with locations for joining ---
        prop_collection = db_client.collection("properties")
        prop_ids = []
        location_map = {}
        for _ in range(15):
            prop_id = fake.uuid4()[:8]
            location = random.choice(location_pool)
            prop_collection.document(prop_id).set({
                "parcelNumber": fake.bothify(text="KAJ/####/###"),
                "location": location,
                "tokenId": str(random.randint(10, 9999)),
                "ownerUid": fake.uuid4()[:12],
                "ownerWallet": fake.sha256(),
            })
            prop_ids.append(prop_id)
            location_map[prop_id] = location

        # --- Actually generate the fake logs ---
        log_collection = db_client.collection("transactionLogs")
        now = datetime.utcnow()
        fake_logs = []
        for _ in range(n):
            prop_id = random.choice(prop_ids)
            status = random.choices(status_pool, weights=[0.7, 0.25, 0.05])[0]  # More success
            operation = random.choice(operations)
            fake_time = now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))

            log = {
                "operation": operation,
                "txHash": fake.sha256(),
                "timestamp": fake_time,
                "tokenNo": fake.random_number(digits=4, fix_len=True),
                "advocateUID": fake.uuid4()[:12],
                "adminUID": fake.uuid4()[:12] if operation in ["admin approval", "ownership transfer"] else "N/A",
                "sellerUID": fake.uuid4()[:12],
                "buyerUID": fake.uuid4()[:12],
                "propertyId": prop_id,
                "status": status,
                "riskLevel": random.choices(risk_levels, weights=[0.4, 0.4, 0.2])[0],
                "location": location_map[prop_id]
            }
            if status == "rejected":
                log["rejectionReason"] = fake.sentence(nb_words=8)
            fake_logs.append(log)

        # --- Write logs in batches (max 500 at a time) ---
        batch_size = 400
        for i in range(0, len(fake_logs), batch_size):
            batch = db_client.batch()
            for log in fake_logs[i:i+batch_size]:
                # Set Firestore timestamp field
                if isinstance(log["timestamp"], datetime):
                    from google.cloud.firestore_v1 import SERVER_TIMESTAMP
                    log["timestamp"] = log["timestamp"]
                ref = log_collection.document()
                batch.set(ref, log)
            batch.commit()

        return jsonify({"message": f"Inserted {n} fake logs."}), 201

    except Exception as e:
        print(f"Error generating fake logs: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/market-health-stats", methods=["GET"])
def market_health_stats():
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "No token"}), 401

        parts = auth_header.split("Bearer ")
        if len(parts) < 2:
            return jsonify({"error": "Invalid token format"}), 401
        
        id_token = parts[1]
        decoded_token = auth.verify_id_token(id_token)

        # Optional: Admin-only check (remove if dashboard is open to all users)
        # user_doc = db.collection("users").document(decoded_token["uid"]).get()
        # if not user_doc.exists or not user_doc.to_dict().get("isAdmin"):
        #     return jsonify({"error": "Admin access required"}), 403

        # Fetch all transaction logs
        logs = [doc.to_dict() for doc in db.collection("transactionLogs").stream()]
        
        if not logs:
            return jsonify({
                "total": 0,
                "safe": 0,
                "risky": 0,
                "safePercent": 0,
                "riskyPercent": 0
            }), 200

        total = len(logs)
        risky_count = 0
        
        for log in logs:
            status = (log.get("status") or "").lower()
            # Count as risky/flagged if rejected or failed
            if status in ["rejected", "failed"]:
                risky_count += 1
        
        safe_count = total - risky_count
        
        # Calculate percentages
        safe_percent = round((safe_count / total) * 100, 1) if total > 0 else 0
        risky_percent = round((risky_count / total) * 100, 1) if total > 0 else 0

        return jsonify({
            "total": total,
            "safe": safe_count,
            "risky": risky_count,
            "safePercent": safe_percent,
            "riskyPercent": risky_percent
        }), 200

    except Exception as e:
        print(f"Error fetching market health stats: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/property-risk-profile/<property_id>", methods=["GET"])
def property_risk_profile(property_id):
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "No token"}), 401

        parts = auth_header.split("Bearer ")
        if len(parts) < 2:
            return jsonify({"error": "Invalid token format"}), 401
        
        id_token = parts[1]
        decoded_token = auth.verify_id_token(id_token)

        # Query the TRANSACTIONS collection for this property
        transactions_query = db.collection("transactions").where("propertyId", "==", property_id).stream()
        transactions = [{"id": doc.id, **doc.to_dict()} for doc in transactions_query]

        if not transactions:
            # Property exists but has no transactions yet (just minted)
            return jsonify({
                "totalTransactions": 0,
                "rejected": 0,
                "accepted": 0,
                "inProgress": 0,
                "lastFlaggedIssue": None,
                "status": "safe",
                "location": "Unknown"
            }), 200

        total = len(transactions)
        rejected = 0
        accepted = 0
        in_progress = 0
        last_flagged = None
        last_flagged_date = None

        # Define rejection status values (case-insensitive)
        REJECTION_STATUSES = ["rejected", "cancelled", "documents rejected", "transaction cancelled"]

        for txn in transactions:
            status = (txn.get("status") or "").lower()
            
            if status in ["finalized", "completed"]:
                accepted += 1
            elif status in REJECTION_STATUSES:
                rejected += 1
                # Get rejection details from various sources
                timestamp = txn.get("updatedAt") or txn.get("cancelledAt") or txn.get("createdAt")
                
                # Check multiple rejection comment fields
                reason = (
                    txn.get("adminRejectionComment") or 
                    txn.get("buyer", {}).get("rejectionComment") or 
                    txn.get("seller", {}).get("rejectionComment") or 
                    "Transaction rejected"
                )
                
                # Track most recent rejection
                if timestamp and (last_flagged_date is None or timestamp > last_flagged_date):
                    last_flagged_date = timestamp
                    last_flagged = reason
            else:
                # Still in progress (initiated, awaiting signatures, under review, etc.)
                in_progress += 1

        # Calculate risk status based on rejection rate
        rejection_rate = (rejected / total * 100) if total > 0 else 0
        
        if rejection_rate > 40:
            risk_status = "critical"
        elif rejection_rate > 0:
            risk_status = "caution"
        else:
            risk_status = "safe"

        # Get location from property document
        location = "Unknown"
        try:
            prop_doc = db.collection("properties").document(property_id).get()
            if prop_doc.exists:
                location = prop_doc.to_dict().get("location", "Unknown")
        except:
            pass

        # Format last flagged issue with date
        last_issue_text = None
        if last_flagged:
            if last_flagged_date:
                try:
                    if hasattr(last_flagged_date, 'strftime'):
                        date_str = last_flagged_date.strftime("%b %Y")
                    else:
                        date_str = "Recent"
                    last_issue_text = f"{last_flagged} ({date_str})"
                except:
                    last_issue_text = last_flagged
            else:
                last_issue_text = last_flagged

        return jsonify({
            "totalTransactions": total,
            "rejected": rejected,
            "accepted": accepted,
            "inProgress": in_progress,
            "lastFlaggedIssue": last_issue_text,
            "status": risk_status,
            "location": location,
            "rejectionRate": round(rejection_rate, 1)
        }), 200

    except Exception as e:
        print(f"Error fetching property risk profile: {e}")
        return jsonify({"error": str(e)}), 500


# --- Run the Server ---
if __name__ == "__main__":
    app.run(debug=True, port=5000)