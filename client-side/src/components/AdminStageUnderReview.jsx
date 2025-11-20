import React, { useState } from 'react';
import './AdminStageUnderReview.css';
import { useAuth } from '../hooks/useAuth';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'; // Import firestore functions
import { db } from '../firebaseConfig'; // Import db
import { ethers } from 'ethers'; // Import ethers
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants'; // Import contract details

// Import your icons
import checkIcon from '../assets/icons/help.png';
import rejectIcon from '../assets/icons/help.png';
import docIcon from '../assets/icons/help.png';

const AdminStageUnderReview = ({ transaction }) => {
  const { currentUser, userData } = useAuth(); // Get admin's name from userData
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [showRejectConfirmation, setShowRejectConfirmation] = useState(false);

  const docList = transaction.advocateDocuments || [];

  // ---
  // --- *** THIS IS THE NEW LOGIC *** ---
  // ---

  // REJECT Action
  const handleReject = async () => {
    if (!comment.trim()) {
      setError('A comment is required to reject this transaction.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const token = await currentUser.getIdToken();
      
      const response = await fetch('http://localhost:5000/admin-review-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          action: 'reject',
          comment: comment
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject transaction.');
      }
      
      // Success. The onSnapshot listener on the page will see the status change.
      
    } catch (err) {
      console.error('Error rejecting:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // APPROVE Action
  const handleApprove = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = await currentUser.getIdToken();
      
      // --- STEP 1: Call Backend to get On-Chain Data ---
      const response = await fetch('http://localhost:5000/admin-review-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          action: 'approve'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get on-chain data from backend.');
      }
      
      const { onChainTxId } = data.onChainData;
      if (!onChainTxId) {
        throw new Error("Backend did not return the onChainTxId.");
      }

      // --- STEP 2: Call Smart Contract ---
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed.");
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const landContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      alert("Please confirm the final approval in MetaMask to transfer ownership.");

      const tx = await landContract.finalAdminApproval(onChainTxId);
      const receipt = await tx.wait();
      const finalTxHash = receipt.hash;
      
      console.log("Final transfer successful, txHash:", finalTxHash);

      // --- STEP 3: Update Firestore with Final Status & Log ---
      const txDocRef = doc(db, "transactions", transaction.id);
      await updateDoc(txDocRef, {
        status: "Finalized",
        finalTxHash: finalTxHash,
        finalizedAt: serverTimestamp()
      });
      
      const adminName = userData?.firstName || currentUser.email;
      await addDoc(collection(db, "logs"), {
        message: `Admin ${adminName} finalized transaction for ${transaction.parcelNumber}.`,
        timestamp: serverTimestamp(),
        txHash: finalTxHash,
        relatedTransaction: transaction.id
      });
      
      // Success! Component will unmount.

    } catch (err) {
      console.error('Error submitting review:', err);
      setError(err.reason || err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // ---
  // --- *** END OF NEW LOGIC *** ---
  // ---

  return (
    <div className="admin-review-container">
      <h4>Final Admin Review</h4>
      <p>
        Review all documents and transaction details. Approving this
        transaction will finalize the deal and **transfer ownership of the property**.
        This action is irreversible.
      </p>

      {/* --- Rejection Confirmation --- */}
      {showRejectConfirmation ? (
        <div className="rejection-form">
          <label htmlFor="rejection-comment">
            Please provide a reason for rejection:
          </label>
          <textarea
            id="rejection-comment"
            className="rejection-textarea"
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g., Discrepancy found in title deed..."
          ></textarea>
          {error && <p className="error-message">{error}</p>}
        </div>
      ) : (
        // --- DISPLAY THE DOCUMENT LIST ---
        <div className="review-docs-summary">
          <h5>Documents for Review</h5>
          <div className="doc-list">
            {docList.length > 0 ? (
              docList.map((doc, index) => (
                <a 
                  key={index} 
                  href={doc.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="doc-item"
                >
                  <img src={docIcon} alt="Document" className="doc-icon" />
                  <div className="doc-info">
                    <span className="doc-name">{doc.name}</span>
                    <span className="doc-timestamp">
                      Uploaded by {doc.uploadedBy?.name || 'Advocate'}
                    </span>
                  </div>
                </a>
              ))
            ) : (
              <p className="empty-list-text">No documents were uploaded for this transaction.</p>
            )}
          </div>
        </div>
      )}

      {/* --- Action Buttons --- */}
      <div className="stage-actions">
        {showRejectConfirmation ? (
          <>
            <button
              className="stage-button button-secondary"
              onClick={() => setShowRejectConfirmation(false)}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              className="stage-button button-reject"
              onClick={handleReject} // --- Use new handler ---
              disabled={isLoading}
            >
              {isLoading ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </>
        ) : (
          <>
            <button
              className="stage-button button-reject"
              onClick={() => setShowRejectConfirmation(true)}
              disabled={isLoading}
            >
              <img src={rejectIcon} alt="Reject" />
              Reject Transaction
            </button>
            <button
              className="stage-button button-accept"
              onClick={handleApprove} // --- Use new handler ---
              disabled={isLoading}
            >
              <img src={checkIcon} alt="Approve" />
              {isLoading ? 'Processing...' : 'Approve & Transfer Ownership'}
            </button>
          </>
        )}
      </div>
      
      {/* Show top-level error if not showing comment box */}
      {!showRejectConfirmation && error && (
        <p className="error-message" style={{textAlign: 'right', marginTop: '12px'}}>
          {error}
        </p>
      )}
    </div>
  );
};

export default AdminStageUnderReview;