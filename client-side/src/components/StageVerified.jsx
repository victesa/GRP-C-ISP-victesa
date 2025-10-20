import React from 'react';
import './StageMultiSignature.css'; // Reusing CSS

// --- IMPORT YOUR ICONS HERE ---
import loadingIcon from '../assets/icons/help.png'; 

const StageVerified = () => {
  return (
    <div className="stage-card">
      <h3 className="stage-title">Documents Verified</h3>
      <p className="stage-description">
        All documents have been successfully verified. The transaction is now
        being passed to the land official for final review.
      </p>
      <div className="stage-waiting">
        <img src={loadingIcon} alt="Waiting" className="loading-icon" />
        <span>Awaiting 'Under Review' stage...</span>
      </div>
    </div>
  );
};

export default StageVerified;// Updated Oct 20
