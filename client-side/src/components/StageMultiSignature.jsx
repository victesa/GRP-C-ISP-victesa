import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore'; 
import { db } from '../firebaseConfig'; 
import { useAuth } from '../hooks/useAuth';

import './StageMultiSignature.css';

// ICONS
import checkIcon from '../assets/icons/help.png';
import loadingIcon from '../assets/icons/help.png';

const StageMultiSignature = ({ transaction }) => {
  const { currentUser } = useAuth(); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!currentUser || !transaction) {
    return <div className="stage-card">Loading...</div>;
  }

  const { id, buyer, seller, advocate } = transaction;
  const currentUserId = currentUser.uid;

  const isUserBuyer = buyer?.uid === currentUserId;
  const isUserSeller = seller?.uid === currentUserId;
  // ---
  // --- THIS IS THE FIX ---
  // ---
  const isUserAdvocate = advocate?.uid === currentUserId;
  // ---

  // Get the most up-to-date acceptance status
  const buyerHasAccepted = buyer?.accepted === true;
  const sellerHasAccepted = seller?.accepted === true;

  const userHasAccepted =
    (isUserBuyer && buyerHasAccepted) ||
    (isUserSeller && sellerHasAccepted);

  const otherPartyHasAccepted =
    (isUserBuyer && sellerHasAccepted) ||
    (isUserSeller && buyerHasAccepted);

  // Identify names
  const otherPartyName = isUserBuyer
    ? seller?.name || "Seller"
    : buyer?.name || "Buyer";
  
  const advocateName = advocate?.name || "Advocate";

  // Firestore update
  const handleAccept = async () => {
    setIsLoading(true);
    setError(null);
    
    const txRef = doc(db, "transactions", id);

    try {
      // ---
      // --- THIS IS THE FIX for the "Move to Next Stage" logic ---
      // ---
      // We read the *other* party's status *before* we make our update.
      let otherPartyAlreadyAccepted = false; 

      if (isUserBuyer) {
        otherPartyAlreadyAccepted = sellerHasAccepted; // Check seller's status
        await updateDoc(txRef, { "buyer.accepted": true });
      } else if (isUserSeller) {
        otherPartyAlreadyAccepted = buyerHasAccepted; // Check buyer's status
        await updateDoc(txRef, { "seller.accepted": true });
      } else {
        setError("You are not a participant in this transaction.");
        return;
      }

      // Now, if the other party had *already* accepted, we move the stage.
      if (otherPartyAlreadyAccepted) {
        await updateDoc(txRef, { status: "Docs Shared" });
      }
    } catch (err) {
      console.error("Error accepting transaction:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = () => {
    setError("Reject functionality not implemented yet.");
  };

  // --- UI Rendering ---

  // ---
  // --- NEW BLOCK FOR ADVOCATE VIEW ---
  // ---
  if (isUserAdvocate) {
    return (
      <div className="stage-card">
        <h3 className="stage-title">Awaiting Participant Signatures</h3>
        <p className="stage-description">
          The transaction has been sent to the buyer and seller. Waiting for both parties to accept.
        </p>
        <div className="stage-waiting-grid">
          <div className="stage-waiting-item">
            <img src={buyerHasAccepted ? checkIcon : loadingIcon} alt="Status" className={buyerHasAccepted ? "" : "loading-icon"} />
            <span>{buyer?.name || "Buyer"} {buyerHasAccepted ? "has accepted" : "is pending"}</span>
          </div>
          <div className="stage-waiting-item">
            <img src={sellerHasAccepted ? checkIcon : loadingIcon} alt="Status" className={sellerHasAccepted ? "" : "loading-icon"} />
            <span>{seller?.name || "Seller"} {sellerHasAccepted ? "has accepted" : "is pending"}</span>
          </div>
        </div>
      </div>
    );
  }
  // --- END NEW BLOCK ---


  // User (Buyer/Seller) needs to accept
  if (!userHasAccepted && (isUserBuyer || isUserSeller)) {
    return (
      <div className="stage-card">
        <h3 className="stage-title">Awaiting Your Acceptance</h3>
        <p className="stage-description">
          Advocate <strong>{advocateName}</strong> has initiated this transaction.
          Do you accept?
        </p>

        <div className="stage-actions">
          <button className="stage-button button-reject" onClick={handleReject}>
            Reject
          </button>

          <button className="stage-button button-accept" onClick={handleAccept} disabled={isLoading}>
            <img src={checkIcon} alt="Accept" />
            {isLoading ? "Accepting..." : "Accept"}
          </button>
        </div>

        {error && <p className="stage-error">{error}</p>}
      </div>
    );
  }

  // User accepted, other party has not
  if (userHasAccepted && !otherPartyHasAccepted) {
    return (
      <div className="stage-card">
        <h3 className="stage-title">Awaiting Other Party</h3>
        <p className="stage-description">
          You have accepted. Waiting for <strong>{otherPartyName}</strong> to accept.
        </p>
        <div className="stage-waiting">
          <img src={loadingIcon} alt="Waiting" className="loading-icon" />
          <span>Awaiting response...</span>
        </div>
      </div>
    );
  }

  // Both accepted
  if (userHasAccepted && otherPartyHasAccepted) {
     // This state is very temporary as the status will change to "Docs Shared"
    return (
      <div className="stage-card">
        <h3 className="stage-title">Both Parties Accepted</h3>
        <p className="stage-description">
          Moving to the next step...
        </p>
      </div>
    );
  }

  // Failsafe for any other state
  return <div className="stage-card">Checking status...</div>;
};

export default StageMultiSignature;// Updated Oct 22
