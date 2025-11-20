import React from 'react';
import './AdvocateStageAwaitingVerification.css'; // We'll create this
import checkIcon from '../assets/icons/help.png'; // Example icon
import pendingIcon from '../assets/icons/help.png'; // Example icon

const AdvocateStageAwaitingVerification = ({ transaction }) => {

  // Check the verification status of buyer and seller
  // This assumes you add 'verifiedDocs' to the buyer/seller objects in Firestore
  const buyerVerified = transaction.buyer?.verifiedDocs || false;
  const sellerVerified = transaction.seller?.verifiedDocs || false;

  const VerificationStatus = ({ name, verified }) => (
    <div className="verification-item">
      <img 
        src={verified ? checkIcon : pendingIcon} 
        alt={verified ? 'Verified' : 'Pending'} 
        className="verification-icon"
      />
      <div className="verification-info">
        <span className="party-name">{name}</span>
        <span className={`party-status ${verified ? 'verified' : 'pending'}`}>
          {verified ? 'Has Verified Documents' : 'Awaiting Verification'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="awaiting-verification-container">
      <h4>Awaiting Client Verification</h4>
      <p>
        The uploaded documents have been sent to the Buyer and Seller.
        The transaction will move to the next stage once both parties have
        verified the documents.
      </p>
      
      <div className="verification-status-list">
        <VerificationStatus name={transaction.buyer.name} verified={buyerVerified} />
        <VerificationStatus name={transaction.seller.name} verified={sellerVerified} />
      </div>

    </div>
  );
};

export default AdvocateStageAwaitingVerification;