import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { useAuth } from './hooks/useAuth';

// Reusable components
import DealHeader from './components/DealHeader';
import TransactionDetails from './components/TransactionDetails';
import AdvocateDealSidebar from './components/AdvocateDealSidebar'; // Re-using this

// Admin-specific stage component
import AdminStageUnderReview from './components/AdminStageUnderReview';

import './TransactionDetailPage.css'; // Re-using this CSS

const AdminTransactionDetailPage = () => {
  const { transactionId } = useParams();
  const { currentUser } = useAuth();
  
  const [transaction, setTransaction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!transactionId || !currentUser) return;

    setIsLoading(true);
    const docRef = doc(db, "transactions", transactionId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setTransaction({ id: docSnap.id, ...docSnap.data() });
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

  const renderStageContent = () => {
    if (!transaction) return null;

    switch (transaction.status) {
      
      case 'Under Review':
        // This is the component with Approve/Reject buttons
        return <AdminStageUnderReview transaction={transaction} />;
      
      case 'Finalized':
        // You can create a component to show the transfer is complete
        return <div style={{padding: '20px'}}>Transaction Finalized.</div>; 
        
      case 'Rejected':
        return <div style={{padding: '20px'}}>Transaction Rejected.</div>;

      default:
        // Shows nothing for 'Verified', 'Docs Shared', etc.
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
      
      {/* --- Left Column --- */}
      <div className="detail-main-content">
        <DealHeader currentStage={transaction.status} />
        
        {/* Card 1: Details */}
        <div className="tab-content-container">
          <TransactionDetails transaction={transaction} />
        </div>
        
        {/* Card 2: Admin Actions */}
        {stageComponent && (
          <div className="tab-content-container">
            {stageComponent}
          </div>
        )}
      </div>

      {/* --- Right Column --- */}
      <aside className="detail-sidebar-content">
        {/* Re-using the sidebar that shows Buyer/Seller */}
        <AdvocateDealSidebar transaction={transaction} />
      </aside>

    </div>
  );
};

export default AdminTransactionDetailPage;