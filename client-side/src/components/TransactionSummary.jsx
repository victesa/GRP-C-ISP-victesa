import React, { useState, useEffect } from 'react';
import './TransactionSummary.css';
import { useAuth } from '../hooks/useAuth'; // To get the advocate's ID
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';

// Placeholder for the small icons.
const CardIcon = ({ type }) => {
  let iconContent = 'i'; // Default info icon
  if (type === 'arrow') {
    iconContent = '↑';
  }
  return <span className="summary-card-icon">{iconContent}</span>;
};

const TransactionSummary = () => {
  const { currentUser } = useAuth();
  
  // State for our 3 metrics
  const [activeCount, setActiveCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [negotiatingCount, setNegotiatingCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return; // Don't run if not logged in

    const advocateId = currentUser.uid;

    // --- 1. Query for Active Transactions ---
    // (This query requires a composite index: advocateId + status)
    const activeQuery = query(
      collection(db, "transactions"),
      where("advocateId", "==", advocateId),
      where("status", "not-in", ["Finalized", "Rejected"])
    );
    
    const unsubActive = onSnapshot(activeQuery, (snapshot) => {
      setActiveCount(snapshot.size);
    });

    // --- 2. Query for Transactions in Negotiation ---
    const negotiatingQuery = query(
      collection(db, "transactions"),
      where("advocateId", "==", advocateId),
      where("status", "==", "Negotiating") // Assuming this is your "Under Contact"
    );
    
    const unsubNegotiating = onSnapshot(negotiatingQuery, (snapshot) => {
      setNegotiatingCount(snapshot.size);
    });

    // --- 3. Query for Total Clients (a one-time fetch) ---
    // This gets all transactions, finds unique client IDs, and counts them.
    const fetchClients = async () => {
      const allTxQuery = query(
        collection(db, "transactions"),
        where("advocateId", "==", advocateId)
      );
      
      const snapshot = await getDocs(allTxQuery);
      const clientIds = new Set(); // A Set automatically handles duplicates
      snapshot.forEach(doc => {
        clientIds.add(doc.data().buyerId);
        clientIds.add(doc.data().sellerId);
      });
      setClientCount(clientIds.size);
    };

    fetchClients();

    // Clean up listeners
    return () => {
      unsubActive();
      unsubNegotiating();
    };
  }, [currentUser]);


  return (
    <div className="summary-card-container">
      {/* Card 1: Active Transactions */}
      <div className="summary-card">
        <div className="card-header">
          <h4 className="card-title">Active Transactions</h4>
          <CardIcon type="info" />
        </div>
        <p className="card-value">{activeCount}</p>
        <p className="card-subtitle">Properties in pipeline</p>
      </div>

      {/* Card 2: Total Clients (Replaced Total Investment) */}
      <div className="summary-card">
        <div className="card-header">
          <h4 className="card-title">Total Clients</h4>
          <CardIcon type="info" />
        </div>
        <p className="card-value">{clientCount}</p>
        <p className="card-subtitle">All active clients</p>
      </div>

      {/* Card 3: Under Contact (Negotiating) */}
      <div className="summary-card">
        <div className="card-header">
          <h4 className="card-title">Under Contact</h4>
          <CardIcon type="arrow" />
        </div>
        <p className="card-value">{negotiatingCount}</p>
        <p className="card-subtitle">Close to closing</p>
      </div>
    </div>
  );
};

export default TransactionSummary;