import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig'; 
import { useAuth } from './hooks/useAuth';

import DealHeader from './components/DealHeader';
import TransactionDetails from './components/TransactionDetails';
import AdvocateDealSidebar from './components/AdvocateDealSidebar';

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
    if (!transaction) {
      return null;
    }

    // ---
    // --- THIS IS THE FIX: Convert status to lowercase for matching ---
    // ---
    switch (transaction.status.toLowerCase()) {
      
      case 'awaiting signatures': 
        return <StageMultiSignature transaction={transaction} />;
        
      case 'docs shared':
        return <AdvocateStageDocsShared transaction={transaction} />;

      case 'awaiting verification':
        return <AdvocateStageAwaitingVerification transaction={transaction} />;

      case 'verified':
        return null; // Placeholder

      case 'under review':
        return null; // Placeholder

      case 'finalized':
        return null; // Placeholder
        
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

  return (
    <div className="transaction-detail-container">
      
      <div className="detail-main-content">
        <DealHeader currentStage={transaction.status} />
        
        <div className="tab-content-container">
          <TransactionDetails transaction={transaction} />
        </div>
        
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