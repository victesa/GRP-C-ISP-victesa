import React from 'react';
import './StageMultiSignature.css'; // Reusing CSS

// --- IMPORT YOUR ICONS HERE ---
import loadingIcon from '../assets/icons/help.png'; 

const StageUnderReview = ({ officialName = 'the Assigned Land Official' }) => {
  return (
    <div className="stage-card">
      <h3 className="stage-title">Under Review</h3>
      <p className="stage-description">
        The transaction is now being reviewed by <strong>{officialName}</strong>.
        You will be notified once the review is complete.
      </p>
      <div className="stage-waiting">
        <img src={loadingIcon} alt="Waiting" className="loading-icon" />
        <span>Pending official review...</span>
      </div>
    </div>
  );
};

export default StageUnderReview;// Updated Oct 21
