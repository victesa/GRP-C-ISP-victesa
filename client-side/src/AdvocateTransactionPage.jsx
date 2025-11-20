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
        
        // --- 1. NEW LOG: WHAT IS SNAPSHOT GETTING? ---
        console.log("ONSNAPSHOT FIRED: New status is", docSnap.data().status);
        // ------------------------------------------------
        
        setTransaction({ id: docSnap.id, ...docSnap.data() });
      } else {
        
        // --- 2. NEW LOG: IS THE DOC NOT FOUND? ---
        console.error("ONSNAPSHOT FIRED: Transaction doc not found!");
        // ------------------------------------------

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
    
    // --- 3. NEW LOG: IS THIS FUNCTION RUNNING? ---
    console.log("DEBUG: renderStageContent() is running.");
    // ------------------------------------------------

    if (!transaction) {
      console.log("DEBUG: Returning null because transaction is falsy.");
      return null;
    }

    // This log should now appear
    console.log("DEBUG: Current transaction status is:", transaction.status);

    switch (transaction.status) {
      
      case 'Awaiting Signatures': 
        return <StageMultiSignature transaction={transaction} />;
        
      case 'Docs Shared':
        return <AdvocateStageDocsShared transaction={transaction} />;

      // This is the case that should be matching
      case 'Awaiting Verification':
        return <AdvocateStageAwaitingVerification transaction={transaction} />;

      case 'Verified':
        return null; 

      case 'Under Review':
        return null; 

      case 'Finalized':
        return null; 
        
      case 'Initiated':
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