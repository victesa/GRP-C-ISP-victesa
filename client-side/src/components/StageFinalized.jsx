import React from 'react';
import './StageFinalized.css'; // New CSS file

// --- IMPORT YOUR ICONS HERE ---
import completeIcon from '../assets/icons/help.png'; // A large success icon

const StageFinalized = ({ transactionId = 'TX-10234' }) => {
  return (
    <div className="stage-card stage-finalized-card">
      <img src={completeIcon} alt="Complete" className="finalized-icon" />
      <h3 className="stage-title">Transaction Finalized</h3>
      <p className="stage-description">
        Congratulations! Transaction <strong>{transactionId}</strong> has been
        successfully finalized and recorded.
      </p>
      <div className="stage-actions">
        <button className="stage-button button-accept">
          View Final Documents
        </button>
      </div>
    </div>
  );
};

export default StageFinalized;