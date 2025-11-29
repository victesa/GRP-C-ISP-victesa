import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig'; 
import { useAuth } from './hooks/useAuth';

import DealHeader from './components/DealHeader';
import TransactionDetails from './components/TransactionDetails';
import AdvocateDealSidebar from './components/AdvocateDealSidebar';

// --- NEW COMPONENT IMPORT ---
import PropertyHistoryCard from './components/PropertyHistoryCard';

import StageMultiSignature from './components/StageMultiSignature';
import AdvocateStageDocsShared from './components/AdvocateStageDocsShared';
import AdvocateStageAwaitingVerification from './components/AdvocateStageAwaitingVerification';

import './TransactionDetailPage.css'; 

const AdvocateTransactionDetailPage = () => {
  const { transactionId } = useParams();
  const { currentUser } = useAuth();
   
  const [transaction, setTransaction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!transactionId || !currentUser) {
      return; 
    }
    setIsLoading(true);
    const docRef = doc(db, "transactions", transactionId);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setTransaction({ id: docSnap.id, ...docSnap.data() });
      } else {
        console.error("Transaction doc not found!");
        setTransaction(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error in onSnapshot listener:", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [transactionId, currentUser]); 

  const renderStageContent = () => {
    if (!transaction) return null;

    // Safe lowercasing
    const status = (transaction.status || '').toLowerCase();

    switch (status) {
       
      case 'awaiting signatures': 
        return <StageMultiSignature transaction={transaction} />;
        
      case 'docs shared':
        return <AdvocateStageDocsShared transaction={transaction} />;

      case 'awaiting verification':
        return <AdvocateStageAwaitingVerification transaction={transaction} />;

      case 'verified':
      case 'under review':
      case 'finalized':
        return null; // Placeholder for now, or add specific Advocate view components here
        
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
      </div>
    );
  }
   
  const stageComponent = renderStageContent();
  const currentStatus = (transaction.status || '').toLowerCase();

  // --- LOGIC: Define which stages allow the history card ---
  const stagesWithHistory = [
    'docs shared', 
    'awaiting verification', 
    'under review', 
    'verified', 
    'finalized'
  ];
  const showHistory = stagesWithHistory.includes(currentStatus);

  console.log(transaction)

  return (
    <div className="transaction-detail-container">
       
      <div className="detail-main-content">
        <DealHeader currentStage={transaction.status} />
        
        {/* --- Card 1: Transaction Details --- */}
        <div className="tab-content-container">
          <TransactionDetails transaction={transaction} />
        </div>
        
        {/* --- Card 2: Property History (Conditional) --- */}
        {showHistory && (
           <PropertyHistoryCard 
              // Pass the data safely
              parcelNumber={transaction.parcelNumber || "Unknown Parcel"}
              location={transaction.location || "Unknown Location"}
              propertyId={transaction.propertyId}
           />
        )}
        
        {/* --- Card 3: Interactive Stage Component --- */}
        {stageComponent && (
          <div className="tab-content-container">
            {stageComponent}
          </div>
        )}
      </div>

      <aside className="detail-sidebar-content">
        <AdvocateDealSidebar transaction={transaction} />
      </aside>

    </div>
  );
};

export default AdvocateTransactionDetailPage;