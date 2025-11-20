import React, { useState } from 'react';
import { ethers } from 'ethers';
// Use the same constants file as the rest of your app
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants'; 

const SellerApprovalCard = ({ transaction }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // --- Data needed for the contract call ---
  const tokenId = transaction.tokenId;
  // Use the assignedAdmin field directly as the operator address target
  const operatorAddress = transaction.assignedAdmin; 
  
  // Data for validation and display
  const requiredOwnerAddress = transaction.seller?.walletAddress;
  const adminName = "Land Official"; // Default fallback

  const handleApprove = async () => {
    if (!window.ethereum) {
      setMessage("Error: MetaMask is required to approve the transfer.");
      return;
    }
    if (!tokenId || !operatorAddress) {
      setMessage("Error: Missing required transfer details.");
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // Connects as the current user (which MUST be the Seller)
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const connectedAddress = await signer.getAddress();

      // **CRITICAL VALIDATION** - Ensure MetaMask is the Seller before sending TX
      if (connectedAddress.toLowerCase() !== requiredOwnerAddress.toLowerCase()) {
         throw new Error(`Wallet mismatch. Please connect the Seller's wallet (${requiredOwnerAddress}).`);
      }

      const landContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      alert(`Please confirm the transaction to approve the transfer of Token ID ${tokenId} to the Land Official.`);

      // The key function call: Seller approves the Admin/Operator to move the token
      const tx = await landContract.approve(operatorAddress, tokenId);
      await tx.wait();

      setMessage("✅ Success! Transfer approval granted. The Admin can now complete the final step.");
      
    } catch (err) {
      console.error("Approval failed:", err);
      // Display the most useful part of the error
      setMessage(`Error: Transfer approval failed. Reason: ${err.message.includes("Wallet mismatch") ? err.message : "Contract denied transfer. Check gas/ownership."}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if required data is present for the transaction to be executable
  if (!requiredOwnerAddress || !operatorAddress || !tokenId) {
      return (
          <div className="stage-card">
              <h3 className="stage-title">Cannot Finalize (Missing Data)</h3>
              <p className="stage-description">
                  The transaction record is incomplete. Ensure the Seller has a wallet and an Admin has been assigned.
              </p>
          </div>
      );
  }

  return (
    <div className="stage-card">
      <h3 className="stage-title">Final Transfer Approval</h3>
      <p className="stage-description">
        You are the **Seller** ({requiredOwnerAddress.substring(0, 8)}...). To finalize the transfer, you must grant the {adminName} permission to move your property (Token ID **{tokenId}**) on the blockchain.
      </p>
      
      {message && <p className={`message ${message.startsWith('Error') ? 'error-message' : 'success-message'}`}>{message}</p>}
      
      <div className="stage-actions">
        <button
          className="stage-button button-accept"
          onClick={handleApprove}
          disabled={isLoading}
        >
          {isLoading ? 'Waiting for Confirmation...' : 'Approve Transfer'}
        </button>
      </div>
    </div>
  );
};

export default SellerApprovalCard;