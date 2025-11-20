import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { useAuth } from './hooks/useAuth';

// Reusable components
import DealHeader from './components/DealHeader';
import DealSidebar from './components/DealSidebar'; 
import TransactionDetails from './components/TransactionDetails'; 

// Interactive Stage Components
import StageMultiSignature from './components/StageMultiSignature';
import StageDocsShared from './components/StageDocsShared'; 
import StageWaitingForDocs from './components/StageWaitingForDocs'; 

// --- NEW COMPONENT IMPORT ---
import SellerApprovalCard from './components/SellerApprovalCard'; 

// --- Final Stages (Placeholders) ---
import StageVerified from './components/StageVerified'; 
import StageUnderReview from './components/StageUnderReview'; 
import StageFinalized from './components/StageFinalized'; 

import './TransactionDetailPage.css';

const TransactionDetailPage = () => {
  const { transactionId } = useParams();
  const { currentUser } = useAuth();
  
  const [transaction, setTransaction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the transaction data from Firestore in real-time
  useEffect(() => {
    if (!transactionId || !currentUser) {
      return;
    }

    setIsLoading(true);
    const docRef = doc(db, "transactions", transactionId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setTransaction(data);
        
        // --- *** FIX: Corrected console.log() to print the entire object *** ---
        console.log("Transaction Data:", data);
        // ---
        
      } else {
        console.error("Transaction not found!");
        setTransaction(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error in onSnapshot listener:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
    
  }, [transactionId, currentUser]); 

  // --- This function now ONLY renders the *interactive* part of a stage ---
  const renderStageContent = () => {
    if (!transaction || !currentUser) return null;

    const currentStatus = (transaction.status || '').toLowerCase();
    const isUserSeller = currentUser.uid === transaction.seller?.uid;
    const isUserBuyer = currentUser.uid === transaction.buyer?.uid;

    switch (currentStatus) {
      
      case 'awaiting signatures': 
        return <StageMultiSignature transaction={transaction} />;
        
      case 'docs shared':
        // User is waiting for the advocate to upload files
        return <StageWaitingForDocs transaction={transaction} />; 

      case 'awaiting verification':
        // User must verify the docs shared by the advocate
        return <StageDocsShared transaction={transaction} />; 
      
      // --- FINAL APPROVAL LOGIC ---
      case 'under review':
        // If the status is "Under Review" AND the user is the Seller, show the final approval button.
        if (isUserSeller) {
            return <SellerApprovalCard transaction={transaction} />;
        }
        // If the status is "Under Review" AND the user is the Buyer, they wait.
        if (isUserBuyer) {
            return <div className="stage-card"><h3>Awaiting Final Transfer</h3><p>The Land Official is reviewing the documents and awaiting final transfer approval from the Seller.</p></div>;
        }
        // Fallback for anyone else
        return <StageUnderReview transaction={transaction} />;


      case 'verified':
        return <StageVerified transaction={transaction} />;

      case 'finalized':
        return <StageFinalized transaction={transaction} />;

      case 'initiated': 
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="page-header" style={{padding: '30px'}}>
        <h1>Loading Transaction...</h1>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="page-header" style={{padding: '30px'}}>
        <h1>Transaction Not Found</h1>
        <p>This may be because you don't have permission to view it.</p>
      </div>
    );
  }
  
  const stageComponent = renderStageContent();

  return (
    <div className="transaction-detail-container">
      
      {/* --- Left Column --- */}
      <div className="detail-main-content">
        <DealHeader currentStage={transaction.status} />
        
        {/* --- Card 1 contains ONLY TransactionDetails --- */}
        <div className="tab-content-container">
          <TransactionDetails transaction={transaction} />
        </div>
        
        {/* --- Conditionally render Card 2 (for the stage) BELOW Card 1 --- */}
        {stageComponent && (
          <div className="tab-content-container">
            {stageComponent}
          </div>
        )}
      </div>

      {/* --- Right Column --- */}
      <aside className="detail-sidebar-content">
        <DealSidebar transaction={transaction} />
      </aside>

    </div>
  );
};

export default TransactionDetailPage;