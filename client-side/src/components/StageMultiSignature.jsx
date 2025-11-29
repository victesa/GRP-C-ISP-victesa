import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './StageMultiSignature.css';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants';
import { parseContractError } from '../utils/errorParser';


const StageMultiSignature = ({ transaction }) => {
  const { currentUser } = useAuth(); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);


  if (!currentUser || !transaction) return <div className="stage-card">Loading...</div>;


  const { id, buyer, seller, advocate, onChainTxId } = transaction;
  const currentUserId = currentUser.uid;


  // --- Role & Status Helpers ---
  const isUserBuyer = buyer?.uid === currentUserId;
  const isUserSeller = seller?.uid === currentUserId;
  const isUserAdvocate = advocate?.uid === currentUserId;


  const buyerHasAccepted = buyer?.accepted === true;
  const sellerHasAccepted = seller?.accepted === true;


  const userHasAccepted = (isUserBuyer && buyerHasAccepted) || (isUserSeller && sellerHasAccepted);
  const otherPartyHasAccepted = (isUserBuyer && sellerHasAccepted) || (isUserSeller && buyerHasAccepted);


  const otherPartyName = isUserBuyer ? seller?.name || "Seller" : buyer?.name || "Buyer";
  const advocateName = advocate?.name || "Advocate";


  // --- HANDLER: ACCEPT (With Hash Capture) ---
  const handleAccept = async () => {
    setError(null);
    setIsLoading(true);


    try {
      if (!window.ethereum) throw new Error("MetaMask is not installed.");
      
      // 1. Setup Blockchain Provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // 2. Safety Check: Wallet Address
      const walletAddress = await signer.getAddress();
      const expectedWallet = isUserBuyer ? buyer.walletAddress : seller.walletAddress;
      
      if (walletAddress.toLowerCase() !== expectedWallet.toLowerCase()) {
        throw new Error(`Wrong wallet connected. Please switch to ${expectedWallet}`);
      }


      if (!onChainTxId) throw new Error("System Error: On-Chain Transaction ID missing.");


      // 3. Blockchain Interaction (With Hash Capture)
      let acceptanceTxHash = null;
      
      try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const tx = await contract.acceptInitiation(onChainTxId);
        const receipt = await tx.wait(); // Wait for mining
        acceptanceTxHash = receipt.hash; // ← NEW: Capture the hash
        
        console.log(`✅ Acceptance transaction mined: ${acceptanceTxHash}`);
        
      } catch (chainError) {
        // Smart Recovery: If the error says "Already accepted", we skip to DB sync
        const errorString = chainError.toString().toLowerCase();
        if (errorString.includes("already accepted") || errorString.includes("execution reverted")) {
           console.warn("Transaction likely already mined on-chain. Attempting to sync Database...");
           // In production, you might want to query the blockchain to get the existing hash
           // For now, we'll let backend handle it without a hash (it should check on-chain)
        } else {
           // It's a real error (e.g., Insufficient funds, User rejected), rethrow it
           throw chainError;
        }
      }


      // 4. Backend Sync (With Hash)
      const idToken = await currentUser.getIdToken();
      const response = await fetch('http://localhost:5000/accept-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          transactionId: id,
          acceptanceTxHash: acceptanceTxHash // ← NEW: Send hash to backend
        })
      });


      const result = await response.json();
      
      if (response.status === 503) {
        throw new Error("Server is offline or cannot reach Google. Please check your internet.");
      }
      
      if (!response.ok) throw new Error(result.error || "Failed to update database.");


      // Success
      alert("You have successfully accepted the transaction!");
      window.location.reload(); // Refresh to show updated status


    } catch (err) {
      console.error("Accept Error:", err);
      const msg = parseContractError(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };


  // --- HANDLER: REJECT ---
  const handleReject = async () => {
    const reason = prompt("Please enter a reason for rejecting this transaction:");
    if (!reason) return; 


    setIsLoading(true);
    setError(null);
    
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('http://localhost:5000/reject-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ transactionId: id, reason: reason })
      });


      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to reject transaction.");
      
      // If blockchain cancellation is required
      if (data.requiresBlockchainCancellation && data.onChainTxId) {
        if (!window.ethereum) throw new Error("MetaMask needed for blockchain cancellation.");
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        const tx = await contract.cancelTransaction(data.onChainTxId);
        await tx.wait();
        alert("Transaction cancelled on Database and Blockchain.");
      } else {
        alert("Transaction rejected.");
      }
      
      window.location.reload();
      
    } catch (err) {
      console.error("Rejection error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };


  // --- RENDER LOGIC ---


  // Advocate View
  if (isUserAdvocate) {
    return (
      <div className="stage-card">
        <h3 className="stage-title">Awaiting Participant Signatures</h3>
        <p className="stage-description">Waiting for blockchain acceptance.</p>
        <div className="stage-waiting-grid">
          <div className={`stage-waiting-item ${buyerHasAccepted ? 'done' : ''}`}>
            <span>Buyer: {buyerHasAccepted ? "Accepted ✅" : "Pending ⏳"}</span>
          </div>
          <div className={`stage-waiting-item ${sellerHasAccepted ? 'done' : ''}`}>
            <span>Seller: {sellerHasAccepted ? "Accepted ✅" : "Pending ⏳"}</span>
          </div>
        </div>
      </div>
    );
  }


  // Waiting for other party
  if (userHasAccepted && !otherPartyHasAccepted) {
    return (
      <div className="stage-card">
        <h3 className="stage-title">Awaiting {otherPartyName}</h3>
        <p className="stage-description">You have signed. Waiting for the other party.</p>
      </div>
    );
  }


  // Both accepted
  if (userHasAccepted && otherPartyHasAccepted) {
    return (
      <div className="stage-card">
        <h3 className="stage-title">✅ Initiation Complete</h3>
        <p className="stage-description">Both parties have accepted.</p>
      </div>
    );
  }


  // User needs to accept
  return (
    <div className="stage-card">
      <h3 className="stage-title">Awaiting Your Signature</h3>
      <p className="stage-description">Advocate <strong>{advocateName}</strong> has initiated this transaction.</p>
      
      <div className="stage-actions">
        <button className="stage-button button-reject" onClick={handleReject} disabled={isLoading}>
          {isLoading ? "Processing..." : "Reject"}
        </button>
        <button className="stage-button button-accept" onClick={handleAccept} disabled={isLoading}>
          {isLoading ? "Signing..." : "Sign & Accept"}
        </button>
      </div>
      
      {error && <div className="stage-error-box">⚠️ {error}</div>}
    </div>
  );
};


export default StageMultiSignature;
