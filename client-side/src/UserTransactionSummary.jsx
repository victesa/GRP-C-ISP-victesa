import React, { useState, useEffect, useMemo } from 'react';
import './components/TransactionSummary.css'; 
import { useAuth } from './hooks/useAuth';
import { db } from './firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// Placeholder for the small icons
const CardIcon = ({ type }) => {
  let iconContent = 'i';
  if (type === 'arrow') {
    iconContent = '↑';
  }
  return <span className="summary-card-icon">{iconContent}</span>;
};

const UserTransactionSummary = () => {
  const { currentUser } = useAuth();
  const [buyerTxs, setBuyerTxs] = useState([]);
  const [sellerTxs, setSellerTxs] = useState([]);

  useEffect(() => {
    if (!currentUser) return;

    const { uid } = currentUser;

    // Query for buyer transactions
    const q1 = query(collection(db, "transactions"), where("buyer.uid", "==", uid));
    const q2 = query(collection(db, "transactions"), where("seller.uid", "==", uid));

    const unsub1 = onSnapshot(q1, (snap1) => {
      // FIX 1: Include the doc.id in the object
      setBuyerTxs(snap1.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error fetching buyer txs:", err));
    
    const unsub2 = onSnapshot(q2, (snap2) => {
      // FIX 1: Include the doc.id in the object
      setSellerTxs(snap2.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error fetching seller txs:", err));

    return () => {
      unsub1();
      unsub2();
    };
  }, [currentUser]);

  // Calculate counts only when data changes
  const [activeCount, historyCount] = useMemo(() => {
    // Combine results and use a Map to de-duplicate based on ID
    const allTransactionsMap = new Map();
    
    // FIX 2: Use tx.id as the unique key, NOT parcelNumber
    // This allows multiple transactions for the same land to be counted accurately
    buyerTxs.forEach(tx => allTransactionsMap.set(tx.id, tx)); 
    sellerTxs.forEach(tx => allTransactionsMap.set(tx.id, tx));

    const allTransactions = Array.from(allTransactionsMap.values());

    // Active: exclude Finalized, Rejected, and Cancelled
    const active = allTransactions.filter(
      tx => tx.status !== 'Finalized' && 
            tx.status !== 'Rejected' && 
            tx.status !== 'Cancelled' &&
            tx.status !== 'Documents Rejected'
    ).length;
    
    // History: include Finalized, Rejected, and Cancelled
    const history = allTransactions.filter(
      tx => tx.status === 'Finalized' || 
            tx.status === 'Rejected' || 
            tx.status === 'Cancelled' ||
            tx.status === 'Documents Rejected'
    ).length;

    return [active, history];
  }, [buyerTxs, sellerTxs]);

  return (
    <div className="summary-card-container">
      <div className="summary-card">
        <div className="card-header">
          <h4 className="card-title">Active Transactions</h4>
          <CardIcon type="info" />
        </div>
        <p className="card-value">{activeCount}</p>
        <p className="card-subtitle">As buyer or seller</p>
      </div>

      <div className="summary-card">
        <div className="card-header">
          <h4 className="card-title">Completed (History)</h4>
          <CardIcon type="info" />
        </div>
        <p className="card-value">{historyCount}</p>
        <p className="card-subtitle">Finalized, rejected, or cancelled</p>
      </div>
    </div>
  );
};

export default UserTransactionSummary;