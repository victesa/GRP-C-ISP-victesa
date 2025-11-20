import React, { useState, useEffect } from 'react';
import './AdvocateSummary.css';
import { useAuth } from '../hooks/useAuth'; // To get the advocate's ID
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// A reusable sub-component
const SummaryCard = ({ title, value, icon, iconBgColor }) => {
  return (
    <div className="adv-summary-card">
      <div 
        className="adv-summary-icon" 
        style={{ backgroundColor: iconBgColor }}
      >
        <span>{icon}</span>
      </div>
      <div className="adv-summary-text">
        <span className="adv-summary-value">{value}</span>
        <span className="adv-summary-title">{title}</span>
      </div>
    </div>
  );
};

const AdvocateSummary = () => {
  const { currentUser } = useAuth();
  
  // State for our 3 metrics
  const [activeCount, setActiveCount] = useState(0);
  const [attentionCount, setAttentionCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return; // Don't run if not logged in

    const advocateId = currentUser.uid;

    // --- 1. Query for ALL transactions managed by this advocate ---
    const allTxQuery = query(
      collection(db, "transactions"),
      //
      // --- THIS IS THE FIX ---
      // We look for the 'uid' field inside the 'advocate' object
      where("advocate.uid", "==", advocateId)
      //
    );

    const unsubscribe = onSnapshot(allTxQuery, (snapshot) => {
      let active = 0;
      let attention = 0;
      let history = 0;

      snapshot.forEach(doc => {
        const tx = doc.data();
        
        // --- 2. Logic to sort transactions ---
        if (tx.status === "Finalized" || tx.status === "Rejected") {
          // It's part of history
          history++;
        } else {
          // It's active
          active++;
          
          // Check if it needs this advocate's attention
          // (You would customize this logic)
          if (tx.status === "Docs Shared" || tx.status === "Initiated") {
            attention++;
          }
        }
      });
      
      setActiveCount(active);
      setAttentionCount(attention);
      setHistoryCount(history);
    });

    // Clean up listener
    return () => unsubscribe();
    
  }, [currentUser]);


  return (
    <div className="summary-card-container">
      <SummaryCard
        title="Active Transactions"
        value={activeCount}
        icon="📂"
        iconBgColor="#e0f8f3" // Light teal
      />
      <SummaryCard
        title="Needs Your Attention"
        value={attentionCount}
        icon="!"
        iconBgColor="#fff4e6" // Light orange
      />
      <SummaryCard
        title="Total Transactions (History)"
        value={historyCount}
        icon="📈"
        iconBgColor="#f4f3ff" // Light purple
      />
    </div>
  );
};

export default AdvocateSummary;