import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { useAuth } from './hooks/useAuth';

// Reusable components
import DealHeader from './components/DealHeader';
import DealSidebar from './components/DealSidebar'; 
import TransactionDetails from './components/TransactionDetails'; 
import PropertyHistoryCard from './components/PropertyHistoryCard'; 

// Interactive Stage Components
import StageMultiSignature from './components/StageMultiSignature';
import StageDocsShared from './components/StageDocsShared'; 
import StageWaitingForDocs from './components/StageWaitingForDocs'; 
import SellerApprovalCard from './components/SellerApprovalCard'; 

// Final Stages
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
        console.log("Transaction Data:", data);
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

  // --- Stage Logic ---
  const renderStageContent = () => {
    if (!transaction || !currentUser) return null;

    const currentStatus = (transaction.status || '').toLowerCase();
    const isUserSeller = currentUser.uid === transaction.seller?.uid;
    const isUserBuyer = currentUser.uid === transaction.buyer?.uid;

    switch (currentStatus) {
      case 'awaiting signatures': 
        return <StageMultiSignature transaction={transaction} />;
        
      case 'docs shared':
        return <StageWaitingForDocs transaction={transaction} />; 

      case 'awaiting verification':
        return <StageDocsShared transaction={transaction} />; 
      
      case 'under review':
        
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
  const currentStatus = (transaction.status || '').toLowerCase();

  // Define which stages allow the history card
  const stagesWithHistory = [
    'docs shared', 
    'awaiting verification', 
    'under review', 
    'verified', 
    'finalized'
  ];
  const showHistory = stagesWithHistory.includes(currentStatus);

  return (
    <div className="transaction-detail-container">
      
      {/* --- Left Column --- */}
      <div className="detail-main-content">
        <DealHeader currentStage={transaction.status} />
        
        {/* --- Card 1: Transaction Details --- */}
        <div className="tab-content-container">
          <TransactionDetails transaction={transaction} />
        </div>

        {/* --- Card 2: Property History (Conditional) --- */}
        {showHistory && (
           <PropertyHistoryCard 
              propertyId={transaction.propertyId || transaction.id}
              parcelNumber={transaction.parcelNumber || transaction.titleNumber || "Unknown Parcel"}
              location={transaction.location || "Unknown Location"}
           />
        )}
        
        {/* --- Card 3: Interactive Stage Component --- */}
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
