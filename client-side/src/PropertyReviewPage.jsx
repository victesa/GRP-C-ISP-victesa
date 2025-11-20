import React, { useState, useEffect } from 'react';
import './PropertyReviewPage.css'; // New CSS file
import { useParams, useNavigate } from 'react-router-dom';
import { db } from './firebaseConfig';
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from './hooks/useAuth'; // To get admin auth token

import { ethers } from 'ethers'; // --- 1. Import Ethers ---
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './constants'; // --- 2. Import Contract Constants ---

// --- IMPORT YOUR ICONS HERE ---
import docIcon from './assets/icons/file-check.png'; // A generic document icon

// --- Helper components ---
const DetailItem = ({ label, value }) => (
  <div className="detail-item">
    <span className="detail-label">{label}</span>
    <span className="detail-value">{value || 'N/A'}</span>
  </div>
);

const DocumentItem = ({ label, fileUrl }) => (
  <div className="detail-item">
    <span className="detail-label">{label}</span>
    {fileUrl ? (
      <a 
        href={fileUrl}
        target="_blank" 
        rel="noopener noreferrer" 
        className="document-link"
      >
        <img src={docIcon} alt="doc" />
        View Document
      </a>
    ) : (
      <span className="detail-value">Not provided</span>
    )}
  </div>
);
// --- End Helper Components ---


const PropertyReviewPage = () => {
  const [property, setProperty] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRejecting, setIsRejecting] = useState(false);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  const { propertyId } = useParams();
  const { currentUser, userData } = useAuth(); // Get admin data for logging
  const navigate = useNavigate();
  
  // Fetch property data on component mount
  useEffect(() => {
    if (!propertyId) return;

    const fetchProperty = async () => {
      setIsLoading(true);
      try {
        // Fetch from 'pendingProperties' collection
        const docRef = doc(db, "pendingProperties", propertyId); 
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setProperty({ id: docSnap.id, ...docSnap.data() });
        } else {
          // NEW: Check if it's already approved (for refresh)
          const approvedDocRef = doc(db, "properties", propertyId);
          const approvedDocSnap = await getDoc(approvedDocRef);
          if (approvedDocSnap.exists()) {
             // It's already approved, just show the details
             setProperty({ id: approvedDocSnap.id, ...approvedDocSnap.data() });
          } else {
             console.error("No such property found in pending or approved!");
             setProperty(null);
          }
        }
      } catch (error) {
        console.error("Error fetching property:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProperty();
  }, [propertyId]);

  
  // --- UPDATED handleApprove ---
  const handleApprove = async () => {
    if (!currentUser || !property) {
      alert("You are not logged in or property data is missing.");
      return;
    }
    
    if (property.txHash) {
        alert("This property has already been minted.");
        return;
    }

    if (!window.confirm("This will approve the property in the database and then request you to mint it on the blockchain. Continue?")) {
        return;
    }

    setActionLoading(true);
    let idToken;
    try {
      idToken = await currentUser.getIdToken();
    } catch (authError) {
      alert("Session expired. Please log in again.");
      setActionLoading(false);
      return;
    }

    try {
      // --- STEP 1: Call Backend to approve/move in DB ---
      const payload = { propertyId: property.id, action: 'approve' };
      const response = await fetch('http://localhost:5000/review-property', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to approve property in database.`);
      }

      const { ownerWalletAddress, parcelNumber } = result.onChainData;
      if (!ownerWalletAddress || !parcelNumber) {
        throw new Error("Backend did not return valid on-chain data.");
      }

      // --- STEP 2: Call Smart Contract (On-Chain Minting) ---
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed. Please install it to mint properties.");
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const landContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      alert(result.message + "\nPlease confirm the on-chain minting transaction in MetaMask.");

      // We use the parcelNumber as the tokenURI
      const tx = await landContract.registerProperty(ownerWalletAddress, parcelNumber);
      
      // --- *** NEW: WAIT FOR RECEIPT AND PARSE LOGS *** ---
      const receipt = await tx.wait(); 
      const txHash = receipt.hash;
      
      let tokenId = null;
      // Parse the logs from the receipt to find the PropertyRegistered event
      // This uses the ABI to understand the event data
      for (const log of receipt.logs) {
        try {
          const parsedLog = landContract.interface.parseLog(log);
          if (parsedLog && parsedLog.name === "PropertyRegistered") {
            // Found the event! Get the tokenId.
            // ABI: event PropertyRegistered(uint256 indexed tokenId, ...)
            tokenId = parsedLog.args.tokenId.toString();
            break; // Stop looping
          }
        } catch (e) {
          // This log wasn't from our contract, ignore
        }
      }

      if (tokenId === null) {
        // This is a critical error
        throw new Error("Minting succeeded but could not parse the tokenId from the event. Please check the contract ABI and event name (PropertyRegistered).");
      }

      console.log(`Transaction mined, hash: ${txHash}, tokenId: ${tokenId}`);

      // --- STEP 3: Update the 'properties' doc with txHash AND tokenId ---
      const propDocRef = doc(db, "properties", property.id);
      await updateDoc(propDocRef, {
        txHash: txHash,
        tokenId: tokenId // --- SAVE THE NEW TOKEN ID ---
      });

      // --- STEP 4: Create the log entry (for auditing) ---
      const adminName = userData?.firstName || currentUser.email;
      await addDoc(collection(db, "logs"), {
        message: `Property ${parcelNumber} (Token ID: ${tokenId}) was verified and minted by Admin ${adminName}.`,
        timestamp: serverTimestamp(),
        txHash: txHash,
        propertyId: property.id
      });

      alert(`Property successfully minted on the blockchain! New Token ID: ${tokenId}`);
      navigate('/admin/properties'); // Go back to the list

    } catch (error) {
      console.error("Action failed:", error);
      alert(`Error: ${error.reason || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };


  // --- handleReject (No changes) ---
  const handleReject = async () => {
    if (!currentUser || !property) {
      alert("You are not logged in or property data is missing.");
      return;
    }

    if (comment.trim() === '') {
      alert('A comment is required for rejection.');
      return;
    }
    
    setActionLoading(true);
    let idToken;
    try {
      idToken = await currentUser.getIdToken();
    } catch (authError) {
      alert("Session expired. Please log in again.");
      setActionLoading(false);
      return;
    }

    try {
      const payload = { 
        propertyId: property.id, 
        action: 'reject', 
        comment: comment 
      };

      const response = await fetch('http://localhost:5000/review-property', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to reject property.`);
      }

      // --- Log the rejection action ---
      const adminName = userData?.firstName || currentUser.email;
      await addDoc(collection(db, "logs"), {
        message: `Property ${property.parcelNumber} was rejected by Admin ${adminName}. Reason: ${comment}`,
        timestamp: serverTimestamp(),
        txHash: null,
        propertyId: property.id
      });

      alert('Property rejected successfully.');
      navigate('/admin/properties');

    } catch (error) {
      console.error("Action failed:", error);
      alert(error.message);
    } finally {
      setActionLoading(false);
    }
  };
  
  // --- Render Function ---
  if (isLoading) {
    return (
      <div className="property-review-page">
        <div className="page-header"><h1>Loading Property...</h1></div>
      </div>
    );
  }
  if (!property) {
    return (
      <div className="property-review-page">
        <div className="page-header"><h1>Property Not Found</h1></div>
        <p>This property may have been rejected or the ID is incorrect.</p>
      </div>
    );
  }

  const isMinted = !!property.txHash;
  const isApproved = property.status === 'approved';
  
  return (
    <div className="property-review-page">
      <div className="page-header">
        <h1>Review Property</h1>
        <p className="page-subtitle">
          Verify the details for parcel: <strong>{property.parcelNumber}</strong>
        </p>
      </div>

      <div className="transaction-detail-container">
        
        <div className="detail-main-content">
          <div className="admin-card">
            <h3 className="admin-card-title">Property Details</h3>
            <div className="detail-grid">
              <DetailItem label="Parcel Number" value={property.parcelNumber} />
              <DetailItem label="Location" value={property.location} />
              <DetailItem label="Submitted by (User ID)" value={property.uid} /> 
              <DetailItem label="Owner's Wallet" value={property.ownerWalletAddress} />
              {/* NEW: Show Token ID if it's available */}
              {property.tokenId && <DetailItem label="Token ID" value={property.tokenId} />}
            </div>
          </div>
          
          <div className="admin-card">
            <h3 className="admin-card-title">Submitted Documents</h3>
            <div className="detail-grid">
              <DocumentItem label="Copy of Title Deed" fileUrl={property.fileUrls?.titleDeedFile} />
              <DocumentItem label="Copy of Survey Map" fileUrl={property.fileUrls?.surveyMapFile} />
            </div>
          </div>
        </div>

        <aside className="detail-sidebar-content">
          <div className="admin-card action-card">
            <h3 className="admin-card-title">Verification Actions</h3>
            <span className={`status-badge ${property.status}`}>
                {isMinted ? "MINTED" : property.status}
            </span>
            
            {!isRejecting ? (
              <div className="action-buttons">
                {(!isApproved && !isMinted) && (
                  <button 
                    className="action-btn reject" 
                    onClick={() => setIsRejecting(true)}
                    disabled={actionLoading}
                  >
                    Reject
                  </button>
                )}
                
                <button 
                  className="action-btn approve" 
                  onClick={handleApprove}
                  disabled={actionLoading || isMinted} 
                >
                  {actionLoading ? 'Processing...' : (isMinted ? 'Minted' : (isApproved ? 'Retry Mint' : 'Approve & Mint'))}
                </button>
              </div>
            ) : (
              <div className="rejection-form">
                <label htmlFor="rejection-comment">Reason for Rejection</label>
                <textarea
                  id="rejection-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g., Title deed is unclear..."
                  rows="4"
                />
                <div className="action-buttons">
                  <button 
                    className="action-btn view-details" 
                    onClick={() => setIsRejecting(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    className="action-btn reject" 
                    onClick={handleReject}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Rejecting...' : 'Submit Rejection'}
                  </button>
                </div>
              </div>
            )}
            {isMinted && (
                <div className="mint-info">
                    <strong>Tx Hash:</strong>
                    <span>{property.txHash.substring(0, 10)}...{property.txHash.substring(property.txHash.length - 10)}</span>
                </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PropertyReviewPage;