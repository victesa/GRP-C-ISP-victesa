import React from 'react';
import './StageWaitingForDocs.css'; // We will create this CSS
import loadingIcon from '../assets/icons/help.png'; // Use your loading icon

const StageWaitingForDocs = ({ transaction }) => {
  // Get the advocate's name from the transaction object
  const advocateName = transaction?.advocate?.name || "the advocate";

  return (
    <div className="stage-card">
      <h3 className="stage-title">Awaiting Documents</h3>
      <p className="stage-description">
        The transaction is now in the document sharing stage. 
        Waiting for <strong>{advocateName}</strong> to upload the required documents for your review.
      </p>
      <div className="stage-waiting">
        <img src={loadingIcon} alt="Waiting" className="loading-icon" />
        <span>Waiting for advocate...</span>
      </div>
    </div>
  );
};

export default StageWaitingForDocs;