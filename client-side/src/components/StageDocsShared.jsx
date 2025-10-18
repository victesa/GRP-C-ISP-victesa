import React, { useState } from 'react';
import './StageDocsShared.css'; // Using your provided CSS
import { useAuth } from '../hooks/useAuth'; // Import useAuth

// --- IMPORT YOUR ICONS HERE ---
import docIcon from '../assets/icons/help.png'; 
import checkIcon from '../assets/icons/help.png';
import rejectIcon from '../assets/icons/help.png'; 
import pendingIcon from '../assets/icons/help.png';

/**
 * A sub-component to show the verification status of both parties.
 */
const VerificationStatusBox = ({ myStatus, otherPartyStatus, otherPartyRole }) => {
  const getStatus = (status) => {
    // status can be true, false, or undefined/null
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


/**
 * The Main Component
 */
const StageDocsShared = ({ transaction }) => {
  const { currentUser } = useAuth();

  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- 1. Get Real Data ---
  const docList = transaction.advocateDocuments || [];
  
  // Determine user's role and verification status
  const isBuyer = currentUser.uid === transaction.buyer.uid;
  
  // myStatus can be true (accepted), false (rejected), or undefined/null (pending)
  const myStatus = isBuyer ? transaction.buyer.verifiedDocs : transaction.seller.verifiedDocs;
  
  // Get other party's info for the status box
  const otherPartyStatus = isBuyer ? transaction.seller.verifiedDocs : transaction.buyer.verifiedDocs;
  const otherPartyRole = isBuyer ? 'Seller' : 'Buyer';

  
  // --- 2. API Call Function ---
  const handleSubmit = async (action) => {
    if (action === 'reject' && comment.trim() === '') {
      setErrorMessage('A comment is required to reject.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const token = await currentUser.getIdToken();
      
      // ---
      // --- THIS IS THE FIX: Point to port 5000 ---
      // ---
      const response = await fetch('http://localhost:5000/verify-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          action: action, // 'accept' or 'reject'
          comment: comment
        })
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit verification.');
      }
      
      // Success! 
      // ---
      // --- THIS IS THE FIX: Logic removed from here ---
      // ---
      // The backend now handles advancing the stage.
      // The onSnapshot listener in TransactionDetailPage
      // will see the status change and update the UI automatically.
      setShowCommentBox(false);

    } catch (err) {
      console.error('Error submitting verification:', err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. Render Action Buttons (or status) ---
  const renderActions = () => {
    // Case 1: Already Accepted
    if (myStatus === true) {
      return (
        <div className="action-message accepted">
          <img src={checkIcon} alt="Accepted" />
          You have accepted these documents. Awaiting the other party.
        </div>
      );
    }
    
    // Case 2: Already Rejected
    if (myStatus === false) {
      return (
        <div className="action-message rejected">
          <img src={rejectIcon} alt="Rejected" />
          You have rejected these documents. The advocate has been notified.
        </div>
      );
    }

    // Case 3: Action is pending
    return (
      <>
        {/* --- Rejection Form (Conditional) --- */}
        {showCommentBox && (
          <div className="rejection-form">
            <label htmlFor="rejection-comment">
              Please provide comments for rejection:
            </label>
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

        {/* --- Action Buttons --- */}
        <div className="stage-actions">
          {showCommentBox ? (
            // --- Show these buttons when rejecting ---
            <>
              <button
                className="stage-button button-secondary"
                onClick={() => setShowCommentBox(false)}
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
                {isLoading ? 'Submitting...' : 'Submit Rejection'}
              </button>
            </>
          ) : (
            // --- Show these buttons by default ---
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
                {isLoading ? 'Accepting...' : 'Accept'}
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

      {/* --- Status Box --- */}
      <VerificationStatusBox
        myStatus={myStatus}
        otherPartyStatus={otherPartyStatus}
        otherPartyRole={otherPartyRole}
      />

      {/* --- List of Documents --- */}
      <div className="doc-list">
        {docList.map((doc, index) => (
          <a 
            key={index} // Using index as a fallback
            href={doc.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="doc-item"
          >
            <img src={docIcon} alt="Document" className="doc-icon" />
            <span className="doc-name">{doc.name}</span>
          </a>
        ))}
        {docList.length === 0 && (
          <p className="no-docs-message">The advocate has not uploaded any documents for this stage yet.</p>
        )}
      </div>
      
      {/* --- Render Buttons or Status Message --- */}
      {/* Don't show actions if there are no docs */}
      {docList.length > 0 && renderActions()}
    </div>
  );
};

export default StageDocsShared;// Updated Oct 18
