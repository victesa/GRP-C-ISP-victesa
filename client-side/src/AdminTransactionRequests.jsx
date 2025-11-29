import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebaseConfig';
import { useAuth } from './hooks/useAuth';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import './AdminTransactionRequests.css';


const AdminTransactionRequests = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'mine', or 'all'
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [myTransactions, setMyTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const navigate = useNavigate();
  const { currentUser } = useAuth();


  // Effect for Pending Transactions
  useEffect(() => {
    setIsLoading(true);
    const transactionsQuery = query(
      collection(db, "transactions"),
      where("status", "==", "Under Review"),
      where("assignedAdmin", "==", null)
    );
    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      setPendingTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching pending transactions:", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);


  // Effect for My Transactions
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
  }, [currentUser]);


  // Effect for All Transactions (NEW)
  useEffect(() => {
    const allTransactionsQuery = query(
      collection(db, "transactions"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(allTransactionsQuery, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllTransactions(txData);
      setFilteredTransactions(txData);
    }, (error) => {
      console.error("Error fetching all transactions:", error);
    });
    return () => unsubscribe();
  }, []);


  // Search Filter (NEW)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTransactions(allTransactions);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allTransactions.filter(tx => 
      tx.id.toLowerCase().includes(query) ||
      tx.parcelNumber?.toLowerCase().includes(query) ||
      tx.location?.toLowerCase().includes(query) ||
      tx.advocate?.name?.toLowerCase().includes(query) ||
      tx.buyer?.name?.toLowerCase().includes(query) ||
      tx.seller?.name?.toLowerCase().includes(query) ||
      tx.status?.toLowerCase().includes(query)
    );
    setFilteredTransactions(filtered);
  }, [searchQuery, allTransactions]);


  const handleAssignAndReview = async (id) => {
    if (!currentUser) {
      console.error("No admin user found!");
      return;
    }
    try {
      const txDocRef = doc(db, "transactions", id);
      await updateDoc(txDocRef, {
        assignedAdmin: currentUser.uid
      });
      navigate(`/admin/transactions/${id}`);
    } catch (err) {
      console.error("Error assigning transaction:", err);
    }
  };


  const handleViewDetails = (id) => {
    navigate(`/admin/transactions/${id}`);
  };


  // Determine which list to render
  const getListToRender = () => {
    if (activeTab === 'pending') return pendingTransactions;
    if (activeTab === 'mine') return myTransactions;
    return filteredTransactions;
  };


  const listToRender = getListToRender();


  // Status Badge Component (NEW)
  const StatusBadge = ({ status }) => {
    const getStatusClass = () => {
      switch(status) {
        case 'Awaiting Signatures': return 'status-awaiting';
        case 'Docs Shared': return 'status-docs-shared';
        case 'Awaiting Verification': return 'status-verification';
        case 'Under Review': return 'status-review';
        case 'Finalized': return 'status-finalized';
        case 'Rejected': return 'status-rejected';
        case 'Documents Rejected': return 'status-rejected';
        default: return 'status-default';
      }
    };

    return (
      <span className={`status-badge ${getStatusClass()}`}>
        {status || 'Unknown'}
      </span>
    );
  };


  return (
    <div className="admin-transactions-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Transaction Verification Requests</h1>
      </div>


      {/* TABS */}
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
        <button
          className={`admin-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Transactions ({allTransactions.length})
        </button>
      </div>


      <div className="admin-content-card">
        {/* Search Bar (Only show on "All Transactions" tab) */}
        {activeTab === 'all' && (
          <div className="search-bar-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search by Transaction ID, Parcel Number, Location, Names, or Status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Title and subtitle change based on tab */}
        {activeTab === 'pending' && (
          <>
            <h3 className="card-title">Pending Transactions</h3>
            <p className="card-subtitle">
              These transactions are verified by all parties and are waiting to be assigned.
            </p>
          </>
        )}
        {activeTab === 'mine' && (
          <>
            <h3 className="card-title">My Queue</h3>
            <p className="card-subtitle">
              These transactions are assigned to you for final review and ownership transfer.
            </p>
          </>
        )}
        {activeTab === 'all' && (
          <>
            <h3 className="card-title">All Transactions</h3>
            <p className="card-subtitle">
              View all transactions in the system. Use the search bar to find specific transactions.
            </p>
          </>
        )}
        
        <div className="admin-table-container">
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Parcel Number</th>
                <th>Location</th>
                {activeTab === 'all' && <th>Status</th>}
                <th>Advocate</th>
                <th>Date Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && activeTab === 'pending' && (
                <tr>
                  <td colSpan={activeTab === 'all' ? '7' : '6'} className="empty-table-cell">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && listToRender.length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'all' ? '7' : '6'} className="empty-table-cell">
                    {activeTab === 'pending' && 'No pending transactions.'}
                    {activeTab === 'mine' && 'Your queue is empty.'}
                    {activeTab === 'all' && (searchQuery ? 'No transactions match your search.' : 'No transactions found.')}
                  </td>
                </tr>
              )}
              {!isLoading && listToRender.map((tx) => (
                <tr key={tx.id}>
                  <td className="cell-id">{tx.id.substring(0, 8)}...</td>
                  <td className="cell-name">{tx.parcelNumber}</td>
                  <td>{tx.location || 'N/A'}</td>
                  {activeTab === 'all' && (
                    <td>
                      <StatusBadge status={tx.status} />
                    </td>
                  )}
                  <td>{tx.advocate?.name || 'N/A'}</td>
                  <td>{tx.createdAt?.toDate().toLocaleDateString() || 'N/A'}</td>
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


export default AdminTransactionRequests;
