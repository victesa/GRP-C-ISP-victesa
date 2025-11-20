import React, { useState, useEffect } from 'react';
import './AdvocateApplicationDetails.css';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from './firebaseConfig'; 
import { doc, getDoc } from 'firebase/firestore'; // Removed direct 'updateDoc'
import { useAuth } from './hooks/useAuth'; // Get current user
import { ethers } from 'ethers'; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './constants'; 

// --- IMPORT YOUR ICONS HERE ---
import docIcon from './assets/icons/file-check.png'; 

// --- Helper components (Unchanged) ---
const DetailItem = ({ label, value }) => (
  <div className="detail-item">
    <span className="detail-label">{label}</span>
    <span className="detail-value">{value || 'N/A'}</span>
  </div>
);

const DocumentItem = ({ label, fileUrl }) => (
  <div className="detail-item">
    <span className="detail-label">{label}</span>
    {fileUrl ? (
      <a 
        href={fileUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="document-link"
      >
        <img src={docIcon} alt="doc" />
        View Document
      </a>
    ) : (
      <span className="detail-value">Not provided</span>
    )}
  </div>
);

const InfoItem = ({ label, value }) => (
  <div className="info-item">
    <span className="info-label">{label}</span>
    <span className="info-value">{value || 'N/A'}</span>
  </div>
);

// --- The Action Card (Right Column) ---
const AdminActionsCard = ({ application }) => {
  const [isRejecting, setIsRejecting] = useState(false);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // Get the admin user

  // --- 1. NEW: handleApprove function ---
  // This now follows the 2-step process: Backend DB update, then Frontend on-chain
  const handleApprove = async () => {
    if (!currentUser) {
        alert("You are not logged in.");
        return;
    }
    if (!window.confirm("This will approve the advocate in the database and then request you to grant their role on the blockchain. Continue?")) {
        return;
    }

    setIsLoading(true);
    let idToken;
    try {
      idToken = await currentUser.getIdToken();
    } catch (authError) {
      alert("Session expired. Please log in again.");
      setIsLoading(false);
      return;
    }

    try {
      // --- STEP 1: Call Backend to approve in DB & get wallet address ---
      const payload = { applicationId: application.id, action: 'approve' };

      const response = await fetch('http://localhost:5000/review-advocate-application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to approve application in database.`);
      }

      const { advocateWalletAddress } = result.onChainData;
      if (!advocateWalletAddress) {
        throw new Error("Backend did not return the advocate's wallet address.");
      }

      // --- STEP 2: Call Smart Contract (On-Chain Role Grant) ---
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed. Please install it to grant roles.");
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []); // Request Admin's wallet
      const signer = await provider.getSigner();
      const landContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      alert("Database approved. Now please confirm the on-chain role grant in MetaMask.");

      const tx = await landContract.grantAdvocateRole(advocateWalletAddress);
      await tx.wait(); // Wait for the transaction to be mined

      alert('Advocate role successfully granted on the blockchain!');
      navigate('/admin/advocates'); 

    } catch (error) {
      console.error("Action failed:", error);
      alert(`Error: ${error.reason || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. NEW: handleReject function ---
  // This now calls the backend to handle rejection and notifications
  const handleReject = async () => {
    if (!currentUser) {
        alert("You are not logged in.");
        return;
    }
    if (comment.trim() === '') {
      alert('Please provide a reason for rejection.');
      return;
    }
    
    setIsLoading(true);
    let idToken;
    try {
      idToken = await currentUser.getIdToken();
    } catch (authError) {
      alert("Session expired. Please log in again.");
      setIsLoading(false);
      return;
    }

    try {
      const payload = { 
        applicationId: application.id, 
        action: 'reject', 
        comment: comment 
      };

      const response = await fetch('http://localhost:5000/review-advocate-application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to reject application.`);
      }

      alert('Application rejected successfully.');
      navigate('/admin/advocates'); 

    } catch (error) {
      console.error("Action failed:", error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- (Rest of the component is unchanged) ---
  return (
    <div className="admin-card action-card">
      <h3 className="admin-card-title">Application Status</h3>
      <span className="status-badge pending">Pending Review</span>
      
      {!isRejecting ? (
        <div className="action-buttons">
          <button 
            className="action-btn reject" 
            onClick={() => setIsRejecting(true)}
            disabled={isLoading}
          >
            Reject
          </button>
          <button 
            className="action-btn approve" 
            onClick={handleApprove} // <-- Use new function
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Approve'}
          </button>
        </div>
      ) : (
        <div className="rejection-form">
          <label htmlFor="rejection-comment">Reason for Rejection</label>
          <textarea
            id="rejection-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g., Practicing certificate is expired."
            rows="4"
          />
          <div className="action-buttons">
            <button 
              className="action-btn view-details" 
              onClick={() => setIsRejecting(false)}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              className="action-btn reject" 
              onClick={handleReject} // <-- Use new function
              disabled={isLoading}
            >
              {isLoading ? 'Rejecting...' : 'Submit Rejection'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


// --- The Main Page Component (Unchanged, but fetches from correct collection) ---
const AdvocateApplicationDetails = () => {
  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { applicationId } = useParams();
  
  useEffect(() => {
    if (!applicationId) return;

    const fetchApplication = async () => {
      setIsLoading(true);
      try {
        // --- 3. FIX: Fetch from 'advocateApplications' ---
        const docRef = doc(db, "advocateApplications", applicationId); 
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setApplication({ id: docSnap.id, ...docSnap.data() });
        } else {
          console.error("No such application found!");
          setApplication(null);
        }
      } catch (error) {
        console.error("Error fetching application:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplication();
  }, [applicationId]); 

  if (isLoading) {
    return (
      <div className="advocate-application-page">
        <div className="page-header">
          <h1>Loading Application...</h1>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="advocate-application-page">
        <div className="page-header">
          <h1>Application Not Found</h1>
          <p className="page-subtitle">
            No application found with ID: {applicationId}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="advocate-application-page">
      <div className="page-header">
        <h1>Advocate Application</h1>
        <p className="page-subtitle">
          Reviewing application for Try
          <strong>{application.fullName}</strong>
        </p>
      </div>

      <div className="transaction-detail-container">
        
        {/* --- Left Column --- */}
        <div className="detail-main-content">
          <div className="admin-card">
            <h3 className="admin-card-title">Professional Credentials</h3>
            <div className="detail-grid">
              <DetailItem label="Practicing Certificate Number" value={application.practicingCertNumber} />
              <DocumentItem label="Practicing Certificate" fileUrl={application.fileUrls['cert-file']} />
              <DocumentItem label="Law Society ID Card" fileUrl={application.fileUrls['lsk-id-file']} />
            </div>
          </div>
          
          <div className="admin-card">
            <h3 className="admin-card-title">Identity Verification</h3>
            <div className="detail-grid">
              <DocumentItem label="National ID or Passport" fileUrl={application.fileUrls['national-id-file']} />
              <DocumentItem label="Profile Photo" fileUrl={application.fileUrls['profile-photo-file']} />
            </div>
          </div>
        </div>

        {/* --- Right Column --- */}
        <aside className="detail-sidebar-content">
          <div className="admin-card">
            <h3 className="admin-card-title">Applicant Information</h3>
            <div className="info-list">
              <InfoItem label="Full Legal Name" value={application.fullName} />
              <InfoItem label="Email Address" value={application.email} />
              <InfoItem label="Phone Number" value={application.phone} />
              <InfoItem label="Law Firm" value={application.firmName} />
              <InfoItem label="Office Address" value={application.address} />
            </div>
          </div>
          
          <AdminActionsCard application={application} />
        </aside>
      </div>
    </div>
  );
};

export default AdvocateApplicationDetails;