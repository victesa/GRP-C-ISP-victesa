import React, { useState } from 'react';
import './CreateTransaction.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; 

import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants'; 

// --- InputGroup Component (Unchanged) ---
const InputGroup = ({ label, type = 'text', placeholder, id, name, value, onChange }) => (
  <div className="input-group">
    <label htmlFor={id}>{label}</label>
    <input 
      type={type} 
      id={id} 
      name={name}
      placeholder={placeholder} 
      value={value}
      onChange={onChange}
      required
    />
  </div>
);

// --- Main CreateTransaction Component ---
const CreateTransaction = () => {
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth(); 
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    'parcelNumber': '', // Switched back to parcelNumber
    'location': '',
    'seller-id': '',
    'seller-name': '',
    'seller-email': '',
    'seller-phone': '',
    'buyer-name': '',
    'buyer-id': '',
    'buyer-email': '',
    'buyer-phone': '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleInitiate = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentUser || !userData || !userData.walletAddress) {
      setError("You must be logged in with a connected wallet.");
      return;
    }
    if (!window.ethereum) {
      setError("MetaMask is not installed.");
      return;
    }

    setIsLoading(true);

    try {
      // --- 1. CONNECT & GET ID TOKEN ---
      setLoadingStatus('Connecting to wallet...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      
      const advocateAddress = await signer.getAddress();
      if (advocateAddress.toLowerCase() !== userData.walletAddress.toLowerCase()) {
        throw new Error("MetaMask wallet does not match your profile's advocate wallet.");
      }
      
      const idToken = await currentUser.getIdToken();

      // --- 2. BACKEND LOOKUP ---
      setLoadingStatus('Finding user wallets and Token ID...');
      
      const lookupResponse = await fetch('http://localhost:5000/get-transaction-prereqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          sellerNationalId: formData['seller-id'],
          buyerNationalId: formData['buyer-id'],
          parcelNumber: formData['parcelNumber']
        })
      });

      const prereqData = await lookupResponse.json();
      if (!lookupResponse.ok) {
        throw new Error(prereqData.error || "Could not find wallets or Token ID.");
      }

      const { sellerWalletAddress, buyerWalletAddress, tokenId } = prereqData;

      // --- 3. CALL ON-CHAIN FUNCTION ---
      setLoadingStatus('Waiting for blockchain confirmation...');
      const landContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      alert("Prerequisites found. Please confirm the transaction in MetaMask.");

      const tx = await landContract.initiateTransaction(
        sellerWalletAddress, 
        buyerWalletAddress,
        tokenId
      );
      
      const receipt = await tx.wait();
      const txHash = receipt.hash;
      
      // ---
      // --- *** THIS IS THE NEW LOGIC *** ---
      // ---
      // Parse the logs to find the on-chain transactionId
      let onChainTxId = null;
      for (const log of receipt.logs) {
        try {
          const parsedLog = landContract.interface.parseLog(log);
          if (parsedLog && parsedLog.name === "TransactionInitiated") {
            // Found the event! Get the bytes32 transactionId
            onChainTxId = parsedLog.args.transactionId;
            break; 
          }
        } catch (e) { /* Not our contract's log */ }
      }

      if (!onChainTxId) {
        throw new Error("Transaction succeeded but failed to parse the on-chain transactionId from events.");
      }
      
      console.log(`Transaction mined: ${txHash}, On-Chain ID: ${onChainTxId}`);
      // --- *** END OF NEW LOGIC *** ---


      // --- 4. PREPARE PAYLOAD FOR FIREBASE ---
      setLoadingStatus('Saving data to database...');
      
      const payload = {
        ...formData,
        txHash: txHash,
        onChainTxId: onChainTxId, // --- SEND THE NEW ID TO THE BACKEND ---
        tokenId: tokenId,
        advocateAddress: advocateAddress,
        sellerWalletAddress: sellerWalletAddress,
        buyerWalletAddress: buyerWalletAddress,
        status: "Awaiting Signatures" // <-- Set initial status
      };

      // --- 5. SEND TO BACKEND TO BE SAVED ---
      const createResponse = await fetch('http://localhost:5000/create-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await createResponse.json();

      if (createResponse.ok) {
        alert('Transaction successfully initiated and saved!');
        navigate(`/advocate/transactions/${result.transactionId}`); 
      } else {
        throw new Error(result.error || 'On-chain transaction succeeded, but saving to database failed.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError(err.reason || err.message); 
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  return (
    <div className="create-transaction-page">
      <div className="page-header">
        <h1>Create New Transaction</h1>
        <p className="page-subtitle">
          Fill in the details below to initiate a new land transaction file.
        </p>
      </div>

      <form className="transaction-form-card" onSubmit={handleInitiate}>

        {/* --- Section 1: Property Details --- */}
        <section className="form-section">
          <h3 className="section-title">1. Property Details</h3>
          <div className="form-grid">
            <InputGroup
              label="Land Parcel Number"
              id="parcelNumber"
              name="parcelNumber"
              placeholder="e.g., KAJIADO/KITENGELA/12345"
              value={formData['parcelNumber']}
              onChange={handleChange}
            />
            <InputGroup
              label="Location (for reference)"
              id="location"
              name="location"
              placeholder="e.g., Lang'ata, Nairobi"
              value={formData['location']}
              onChange={handleChange}
            />
          </div>
        </section>

        {/* --- Section 2: Seller's Details --- */}
        <section className="form-section">
          <h3 className="section-title">2. Seller's Details</h3>
          <div className="form-grid">
            <InputGroup
              label="Seller's National ID Number"
              id="seller-id"
              name="seller-id"
              placeholder="e.g., 12345678"
              value={formData['seller-id']}
              onChange={handleChange}
            />
            <InputGroup
              label="Seller's Full Legal Name"
              id="seller-name"
              name="seller-name"
              placeholder="As on National ID"
              value={formData['seller-name']}
              onChange={handleChange}
            />
            <InputGroup
              label="Seller's Email Address"
              id="seller-email"
              name="seller-email"
              type="email"
              placeholder="For system notifications"
              value={formData['seller-email']}
              onChange={handleChange}
            />
            <InputGroup
              label="Seller's Phone Number"
              id="seller-phone"
              name="seller-phone"
              type="tel"
              placeholder="e.g., +254 7XX XXX XXX"
              value={formData['seller-phone']}
              onChange={handleChange}
            />
          </div>
        </section>

        {/* --- Section 3: Buyer's Details --- */}
        <section className="form-section">
          <h3 className="section-title">3. Buyer's Details</h3>
          <div className="form-grid">
             <InputGroup
              label="Buyer's National ID Number"
              id="buyer-id"
              name="buyer-id"
              placeholder="e.g., 87654321"
              value={formData['buyer-id']}
              onChange={handleChange}
            />
            <InputGroup
              label="Buyer's Full Legal Name"
              id="buyer-name"
              name="buyer-name"
              placeholder="As on National ID"
              value={formData['buyer-name']}
              onChange={handleChange}
            />
            <InputGroup
              label="Buyer's Email Address"
              id="buyer-email"
              name="buyer-email"
              type="email"
              placeholder="For system notifications"
              value={formData['buyer-email']}
              onChange={handleChange}
            />
            <InputGroup
              label="Buyer's Phone Number"
              id="buyer-phone"
              name="buyer-phone"
              type="tel"
              placeholder="e.g., +254 7XX XXX XXX"
              value={formData['buyer-phone']}
              onChange={handleChange}
            />
          </div>
        </section>

        {/* --- Form Submission --- */}
        <div className="form-actions">
          {error && <p className="form-error-message">{error}</p>}
          <button 
            type="submit" 
            className="submit-transaction-btn"
            disabled={isLoading}
          >
            {isLoading ? (loadingStatus || 'Processing...') : 'Initiate Transaction'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateTransaction;