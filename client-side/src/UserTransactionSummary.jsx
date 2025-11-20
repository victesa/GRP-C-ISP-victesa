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

    // --- FIX: Updated queries to use the dot notation for the maps ---
    const q1 = query(collection(db, "transactions"), where("buyer.uid", "==", uid));
    const q2 = query(collection(db, "transactions"), where("seller.uid", "==", uid));

    const unsub1 = onSnapshot(q1, (snap1) => {
        console.error("ddd", q1)
      setBuyerTxs(snap1.docs.map(doc => doc.data()));
    }, (err) => console.error("Error fetching buyer txs:", err)); // Added error logging
    
    const unsub2 = onSnapshot(q2, (snap2) => {
      setSellerTxs(snap2.docs.map(doc => doc.data()));
    }, (err) => console.error("Error fetching seller txs:", err)); // Added error logging

    // Return a function that unsubscribes from both
    return () => {
      unsub1();
      unsub2();
    };
  }, [currentUser]);

  // Use useMemo to calculate counts only when data changes
  const [activeCount, historyCount] = useMemo(() => {
    // Combine results and use a Map to de-duplicate
    const allTransactionsMap = new Map();
    // We can use parcelNumber as a key assuming it's unique per transaction
    buyerTxs.forEach(tx => allTransactionsMap.set(tx.parcelNumber, tx)); 
    sellerTxs.forEach(tx => allTransactionsMap.set(tx.parcelNumber, tx));

    const allTransactions = Array.from(allTransactionsMap.values());

    // Filter them in JavaScript
    const active = allTransactions.filter(
      tx => tx.status !== 'Finalized' && tx.status !== 'Rejected'
    ).length;
    
    const history = allTransactions.filter(
      tx => tx.status === 'Finalized' || tx.status === 'Rejected'
    ).length;

    return [active, history];
  }, [buyerTxs, sellerTxs]); // Only recalculate when buyerTxs or sellerTxs changes

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
        <p className="card-subtitle">Total finalized deals</p>
      </div>
    </div>
  );
};

export default UserTransactionSummary;