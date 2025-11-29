import React, { useState } from 'react';
import './StageDocsShared.css'; 
import { useAuth } from '../hooks/useAuth';
import { ethers } from 'ethers'; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants';
import { parseContractError } from '../utils/errorParser';


// --- ICONS ---
import docIcon from '../assets/icons/file.png'; 
import checkIcon from '../assets/icons/check-square.png';
import rejectIcon from '../assets/icons/reject.png'; 
import pendingIcon from '../assets/icons/pending.png';


const VerificationStatusBox = ({ myStatus, otherPartyStatus, otherPartyRole }) => {
  const getStatus = (status) => {
    if (status === true) return { text: 'Verified', icon: checkIcon, className: 'verified' };
    if (status === false) return { text: 'Rejected', icon: rejectIcon, className: 'rejected' };
    return { text: 'Pending', icon: pendingIcon, className: 'pending' };
  };


  const myDisplayStatus = getStatus(myStatus);
  const otherDisplayStatus = getStatus(otherPartyStatus);


  return (
    <div className="verification-status-container">
      <div className="status-item">
        <img src={myDisplayStatus.icon} alt={myDisplayStatus.text} className="status-icon" />
        <div className="status-text">
          <span>Your Status</span>
          <strong className={myDisplayStatus.className}>{myDisplayStatus.text}</strong>
        </div>
      </div>
      <div className="status-item">
        <img src={otherDisplayStatus.icon} alt={otherDisplayStatus.text} className="status-icon" />
        <div className="status-text">
          <span>{otherPartyRole}'s Status</span>
          <strong className={otherDisplayStatus.className}>{otherDisplayStatus.text}</strong>
        </div>
      </div>
    </div>
  );
};


const StageDocsShared = ({ transaction }) => {
  const { currentUser } = useAuth();
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState(''); 


  const docList = transaction.advocateDocuments || [];
  const isBuyer = currentUser.uid === transaction.buyer.uid;
  
  const myStatus = isBuyer ? transaction.buyer.verifiedDocs : transaction.seller.verifiedDocs;
  const otherPartyStatus = isBuyer ? transaction.seller.verifiedDocs : transaction.buyer.verifiedDocs;
  const otherPartyRole = isBuyer ? 'Seller' : 'Buyer';


  // Handle document click - opens document URL
  const handleDocumentClick = (docUrl, docName) => {
    try {
      if (!docUrl) {
        alert('Document URL is missing or expired.');
        return;
      }
      
      // Open in new tab
      window.open(docUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Error opening document:', err);
      alert('Failed to open document. The link may have expired.');
    }
  };


  const handleSubmit = async (action) => {
    if (action === 'reject' && comment.trim() === '') {
      setErrorMessage('A comment is required to reject.');
      return;
    }


    setIsLoading(true);
    setErrorMessage('');
    setStatusText('Connecting to Wallet...');


    try {
      const token = await currentUser.getIdToken();


      // --- 1. BLOCKCHAIN INTERACTION (With Hash Capture) ---
      if (!window.ethereum) throw new Error("MetaMask is not installed.");
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();


      // Security: Ensure wallet matches user profile
      const walletAddress = await signer.getAddress();
      const myRegisteredWallet = isBuyer ? transaction.buyer.walletAddress : transaction.seller.walletAddress;
      
      if (walletAddress.toLowerCase() !== myRegisteredWallet.toLowerCase()) {
        throw new Error(`Wallet mismatch. Please switch to ${myRegisteredWallet}`);
      }


      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      let verificationTxHash = null; // ← NEW: Capture hash
      
      if (action === 'accept') {
        setStatusText('Please sign in MetaMask...');
        const tx = await contract.acceptDocuments(transaction.onChainTxId);
        setStatusText('Confirming on Chain...');
        const receipt = await tx.wait();
        verificationTxHash = receipt.hash; // ← NEW: Capture hash
        console.log(`✅ Document acceptance mined: ${verificationTxHash}`);
        
      } else if (action === 'reject') {
        setStatusText('Please sign cancellation in MetaMask...');
        const tx = await contract.cancelTransaction(transaction.onChainTxId);
        setStatusText('Recording cancellation on-chain...');
        const receipt = await tx.wait();
        verificationTxHash = receipt.hash; // ← NEW: Capture hash
        console.log(`✅ Document rejection mined: ${verificationTxHash}`);
      }


      // --- 2. BACKEND SYNC (With Hash) ---
      setStatusText('Updating Database...');
      const response = await fetch('http://localhost:5000/verify-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          action: action,
          comment: comment,
          verificationTxHash: verificationTxHash // ← NEW: Send hash
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit verification.');
      
      alert(`✅ Documents ${action}ed successfully!`);
      window.location.reload(); // Refresh to show updated status
      
      setShowCommentBox(false);
      setComment('');


    } catch (err) {
      console.error('Error submitting verification:', err);
      const msg = err.reason ? parseContractError(err) : err.message;
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
      setStatusText('');
    }
  };


  // --- RENDER HELPERS ---
  const renderActions = () => {
    if (myStatus === true) {
      return (
        <div className="action-message accepted">
          <img src={checkIcon} alt="Accepted" />
          You have accepted these documents. Awaiting the other party.
        </div>
      );
    }
    
    if (myStatus === false) {
      return (
        <div className="action-message rejected">
          <img src={rejectIcon} alt="Rejected" />
          You have rejected these documents. The transaction has been cancelled.
        </div>
      );
    }


    return (
      <>
        {showCommentBox && (
          <div className="rejection-form">
            <label htmlFor="rejection-comment">Please provide comments for rejection:</label>
            <textarea
              id="rejection-comment"
              className="rejection-textarea"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="e.g., The Land Title Deed is missing page 2..."
            ></textarea>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
          </div>
        )}


        <div className="stage-actions">
          {showCommentBox ? (
            <>
              <button
                className="stage-button button-secondary"
                onClick={() => {
                  setShowCommentBox(false);
                  setComment('');
                  setErrorMessage('');
                }}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="stage-button button-reject"
                onClick={() => handleSubmit('reject')}
                disabled={isLoading}
              >
                <img src={rejectIcon} alt="Reject" />
                {isLoading ? (statusText || 'Submitting...') : 'Submit Rejection'}
              </button>
            </>
          ) : (
            <>
              <button
                className="stage-button button-reject"
                onClick={() => setShowCommentBox(true)}
                disabled={isLoading}
              >
                <img src={rejectIcon} alt="Reject" />
                Reject
              </button>
              <button
                className="stage-button button-accept"
                onClick={() => handleSubmit('accept')}
                disabled={isLoading}
              >
                <img src={checkIcon} alt="Accept" />
                {isLoading ? (statusText || 'Accepting...') : 'Accept'}
              </button>
            </>
          )}
        </div>
      </>
    );
  };


  return (
    <div className="stage-card">
      <h3 className="stage-title">Review Documents</h3>
      <p className="stage-description">
        The Advocate has shared the following documents. Please
        review each one, then "Accept" to proceed or "Reject" with comments.
        Both parties must accept to move to the next stage.
      </p>


      <VerificationStatusBox
        myStatus={myStatus}
        otherPartyStatus={otherPartyStatus}
        otherPartyRole={otherPartyRole}
      />


      <div className="doc-list">
        {docList.map((doc, index) => (
          <button 
            key={index} 
            onClick={() => handleDocumentClick(doc.url, doc.name)}
            className="doc-item"
            type="button"
          >
            <img src={docIcon} alt="Document" className="doc-icon" />
            <span className="doc-name">{doc.name}</span>
            <span className="doc-view-hint">Click to view</span>
          </button>
        ))}
        {docList.length === 0 && (
          <p className="no-docs-message">
            The advocate has not uploaded any documents for this stage yet.
          </p>
        )}
      </div>
      
      {errorMessage && !showCommentBox && <p className="error-message">{errorMessage}</p>}
      {docList.length > 0 && renderActions()}
    </div>
  );
};


export default StageDocsShared;
