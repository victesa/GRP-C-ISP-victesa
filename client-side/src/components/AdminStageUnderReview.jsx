import React, { useState } from 'react';
import './AdminStageUnderReview.css';
import { useAuth } from '../hooks/useAuth';
import { ethers } from 'ethers'; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants';
import { parseContractError } from '../utils/errorParser';

// Import your icons
import checkIcon from '../assets/icons/help.png';
import rejectIcon from '../assets/icons/help.png';
import docIcon from '../assets/icons/help.png';

const AdminStageUnderReview = ({ transaction }) => {
  const { currentUser } = useAuth(); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [showRejectConfirmation, setShowRejectConfirmation] = useState(false);
  const [statusText, setStatusText] = useState('');

  const docList = transaction.advocateDocuments || [];

  // --- REJECT ACTION (WITH BLOCKCHAIN CANCELLATION) ---
  const handleReject = async () => {
    if (!comment.trim()) {
      setError('A comment is required to reject this transaction.');
      return;
    }
    setIsLoading(true);
    setError('');
    setStatusText('Connecting to Wallet...');

    try {
      const token = await currentUser.getIdToken();
      
      // --- STEP 1: Call Smart Contract to Cancel Transaction ---
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed.");
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      
      const landContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      setStatusText('Please sign cancellation in MetaMask...');
      const tx = await landContract.cancelTransaction(transaction.onChainTxId);
      
      setStatusText('Recording cancellation on blockchain...');
      await tx.wait();
      console.log("Transaction cancelled on blockchain");
      
      // --- STEP 2: Update Backend ---
      setStatusText('Updating database...');
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
      
      alert("Transaction has been rejected and cancelled on-chain.");
      
    } catch (err) {
      console.error('Error rejecting:', err);
      const msg = err.reason ? parseContractError(err) : err.message;
      setError(msg);
    } finally {
      setIsLoading(false);
      setStatusText('');
    }
  };

  // --- APPROVE ACTION (Blockchain + Database Sync) ---
  const handleApprove = async () => {
    setIsLoading(true);
    setError('');
    setStatusText('Connecting to Wallet...');

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

      // Confirm with user before expensive transaction
      if (!window.confirm("Confirming this in MetaMask will transfer ownership of the property. This is irreversible. Continue?")) {
        setIsLoading(false);
        setStatusText('');
        return;
      }

      setStatusText('Please sign in MetaMask...');
      const tx = await landContract.finalAdminApproval(onChainTxId);
      
      setStatusText('Confirming ownership transfer on blockchain...');
      const receipt = await tx.wait();
      const finalTxHash = receipt.hash;
      
      console.log("Final transfer successful, txHash:", finalTxHash);

      // --- STEP 3: Call Backend to Finalize & Update Ownership ---
      setStatusText('Finalizing in database...');
      const finalizeResponse = await fetch('http://localhost:5000/finalize-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          txHash: finalTxHash,
          tokenId: transaction.tokenId,
          newOwnerUid: transaction.buyer.uid,
          newOwnerWallet: transaction.buyer.walletAddress
        })
      });

      if (!finalizeResponse.ok) {
        throw new Error("Blockchain transfer succeeded, but database sync failed. Please contact support.");
      }

      alert("Transaction Finalized. Ownership has been transferred.");

    } catch (err) {
      console.error('Error submitting review:', err);
      const msg = err.reason ? parseContractError(err) : err.message;
      setError(msg);
    } finally {
      setIsLoading(false);
      setStatusText('');
    }
  };

  // --- RENDER ---
  return (
    <div className="admin-review-container">
      <h4>Final Admin Review</h4>
      <p>
        Review all documents and transaction details. Approving this
        transaction will finalize the deal and <strong>transfer ownership of the property</strong>.
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
          {isLoading && statusText && (
            <p className="status-text">{statusText}</p>
          )}
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
              onClick={() => {
                setShowRejectConfirmation(false);
                setComment('');
                setError('');
              }}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              className="stage-button button-reject"
              onClick={handleReject}
              disabled={isLoading}
            >
              {isLoading ? (statusText || 'Rejecting...') : 'Confirm Rejection'}
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
              onClick={handleApprove}
              disabled={isLoading}
            >
              <img src={checkIcon} alt="Approve" />
              {isLoading ? (statusText || 'Processing...') : 'Approve & Transfer Ownership'}
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
      
      {!showRejectConfirmation && isLoading && statusText && (
        <p className="status-text" style={{textAlign: 'right', marginTop: '12px'}}>
          {statusText}
        </p>
      )}
    </div>
  );
};

export default AdminStageUnderReview;
