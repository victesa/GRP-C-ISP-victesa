import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebaseConfig';
import { useAuth } from './hooks/useAuth';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import './AdminTransactionRequests.css'; // We'll add tab styles to this

const AdminTransactionRequests = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'mine'
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [myTransactions, setMyTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // ---
  // --- THIS IS THE FIX (Part 1) ---
  // ---
  // Effect for Pending Transactions (status == "Under Review" AND unassigned)
  useEffect(() => {
    setIsLoading(true);
    const transactionsQuery = query(
      collection(db, "transactions"),
      where("status", "==", "Under Review"), // <-- Look for the correct status
      where("assignedAdmin", "==", null)     // <-- Find unassigned ones
    );
    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      setPendingTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching pending transactions:", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []); // Run only once on mount

  // Effect for My Transactions (This query was already correct)
  useEffect(() => {
    if (!currentUser) return;
    
    const myTransactionsQuery = query(
      collection(db, "transactions"),
      where("status", "==", "Under Review"),
      where("assignedAdmin", "==", currentUser.uid)
    );
    const unsubscribe = onSnapshot(myTransactionsQuery, (snapshot) => {
      setMyTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching my transactions:", error);
    });
    return () => unsubscribe();
  }, [currentUser]); // Re-run if user changes

  // ---
  // --- THIS IS THE FIX (Part 2) ---
  // ---
  // This function is for the "Pending" tab
  const handleAssignAndReview = async (id) => {
    if (!currentUser) {
      console.error("No admin user found!");
      return;
    }
    try {
      const txDocRef = doc(db, "transactions", id);
      // The status is already "Under Review", so we just need to assign it.
      await updateDoc(txDocRef, {
        assignedAdmin: currentUser.uid
      });
      // The onSnapshot listeners will automatically move it from "Pending" to "My Queue"
      navigate(`/admin/transactions/${id}`);
    } catch (err) {
      console.error("Error assigning transaction:", err);
    }
  };

  // This function is for the "My Queue" tab
  const handleViewDetails = (id) => {
    navigate(`/admin/transactions/${id}`);
  };

  // Determine which list to render
  const listToRender = activeTab === 'pending' ? pendingTransactions : myTransactions;

  return (
    <div className="admin-transactions-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Transaction Verification Requests</h1>
      </div>

      {/* --- TABS --- */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({pendingTransactions.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'mine' ? 'active' : ''}`}
          onClick={() => setActiveTab('mine')}
        >
          My Queue ({myTransactions.length})
        </button>
      </div>

      <div className="admin-content-card">
        {/* Title and subtitle change based on tab */}
        {activeTab === 'pending' ? (
          <>
            <h3 className="card-title">Pending Transactions</h3>
            <p className="card-subtitle">
              These transactions are verified by all parties and are waiting to be assigned.
            </p>
          </>
        ) : (
          <>
            <h3 className="card-title">My Queue</h3>
            <p className="card-subtitle">
              These transactions are assigned to you for final review and ownership transfer.
            </p>
          </>
        )}
        
        <div className="admin-table-container">
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Parcel Number</th>
                <th>Advocate</th>
                <th>Date Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && activeTab === 'pending' && (
                <tr>
                  <td colSpan="5" className="empty-table-cell">Loading...</td>
                </tr>
              )}
              {!isLoading && listToRender.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-table-cell">
                    {activeTab === 'pending' ? 'No pending transactions.' : 'Your queue is empty.'}
                  </td>
                </tr>
              )}
              {!isLoading && listToRender.map((tx) => (
                <tr key={tx.id}>
                  <td className="cell-id">{tx.id.substring(0, 8)}...</td>
                  <td className="cell-name">{tx.parcelNumber}</td>
                  <td>{tx.advocate?.name || 'N/A'}</td>
                  {/* Use a fallback for the date */}
                  <td>{tx.createdAt?.toDate().toLocaleDateString()}</td>
                  <td className="actions-cell">
                    {activeTab === 'pending' ? (
                      <button 
                        className="action-btn view-details"
                        onClick={() => handleAssignAndReview(tx.id)}
                      >
                        Review & Assign
                      </button>
                    ) : (
                      <button 
                        className="action-btn view-details"
                        onClick={() => handleViewDetails(tx.id)}
                      >
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminTransactionRequests;// Updated Oct 27
