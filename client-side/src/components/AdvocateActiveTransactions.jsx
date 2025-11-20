import React, { useState, useEffect, useMemo } from 'react';
import './ActiveTransactions.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// --- IMPORT YOUR ICONS HERE ---
import searchIcon from '../assets/icons/help.png';
import plusIcon from '../assets/icons/help.png';
import menuIcon from '../assets/icons/help.png';

// (Helper function to style status pills)
const getStatusClass = (status) => {
  switch (status) {
    case 'Offer Submitted': return 'status-submitted';
    case 'Due Diligence': return 'status-diligence';
    case 'Negotiating': return 'status-negotiating';
    case 'Verified': return 'status-verified';
    case 'Finalized': return 'status-finalized';
    case 'Rejected': return 'status-rejected';
    default: return 'status-default';
  }
};

const AdvocateActiveTransactions = ({ showCreateButton = false }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // --- State for Data ---
  const [allTransactions, setAllTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- State for UI & Filtering ---
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'history'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');

  // 1. Fetch ALL transactions for this advocate on mount
  useEffect(() => {
    if (!currentUser) return;
    
    setIsLoading(true);
    // This query finds all transactions where the advocate is involved
    const transactionsQuery = query(
      collection(db, "transactions"),
      //
      // --- THIS IS THE FIX ---
      // We look for the 'uid' field inside the 'advocate' object
      where("advocate.uid", "==", currentUser.uid)
      //
    );

    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllTransactions(txs);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching transactions: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 2. Filter the transactions based on UI state
  const filteredTransactions = useMemo(() => {
    let txs = allTransactions;

    // Filter by Active Tab
    if (activeTab === 'active') {
      txs = txs.filter(tx => tx.status !== 'Finalized' && tx.status !== 'Rejected');
    } else {
      txs = txs.filter(tx => tx.status === 'Finalized' || tx.status === 'Rejected');
    }

    // Filter by Status Dropdown
    if (statusFilter !== 'All Status') {
      txs = txs.filter(tx => tx.status === statusFilter);
    }

    // Filter by Search Term
    if (searchTerm) {
      txs = txs.filter(tx => 
        (tx.parcelNumber && tx.parcelNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.location && tx.location.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return txs;
  }, [allTransactions, activeTab, searchTerm, statusFilter]);

  return (
    <div className="active-transactions-card">
      
      {/* --- 3. TABS for Active vs History --- */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Transactions
        </button>
        <button
          className={`admin-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Transaction History
        </button>
      </div>

      {/* Header section with filters */}
      <div className="transactions-header">
        {/* Title now depends on the active tab */}
        <h3>{activeTab === 'active' ? 'Active Transactions' : 'Transaction History'}</h3>
        
        <div className="transactions-controls">
          <div className="table-search-bar">
            <img src={searchIcon} alt="Search" className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by parcel or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="table-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All Status</option>
            <option>Initiated</option>
            <option>Multi Signatures</option>
            <option>Docs Shared</option>
            <option>Verified</option>
            <option>Under Review</option>
            <option>Finalized</option>
            <option>Rejected</option>
          </select>
          
          {/* "Create Transactions" button (conditionally rendered) */}
          {showCreateButton && (
            <button 
              className="create-transaction-btn"
              onClick={() => navigate('/create-transaction')}
            >
              <img src={plusIcon} alt="Create" className="btn-icon" />
              Create Transactions
            </button>
          )}
        </div>
      </div>

      {/* Table section */}
      <div className="transactions-table-container">
        <table>
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Parcel / Land ID</th>
              <th>Date Initiated</th>
              <th>Location</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan="7" className="empty-table-cell">Loading transactions...</td>
              </tr>
            )}
            {!isLoading && filteredTransactions.length === 0 && (
              <tr>
                <td colSpan="7" className="empty-table-cell">No transactions found.</td>
              </tr>
            )}
            {!isLoading && filteredTransactions.map((tx) => (
              <tr key={tx.id}>
                <td className="tx-id-cell">{tx.id.substring(0, 8)}...</td>
                <td>{tx.parcelNumber}</td>
                <td>{tx.createdAt?.toDate().toLocaleDateString()}</td>
                <td>{tx.location}</td>
                <td>
                  <span className={`status-pill ${getStatusClass(tx.status)}`}>
                    {tx.status}
                  </span>
                </td>
                {/* Use a placeholder if lastUpdated doesn't exist */}
                <td>{tx.lastUpdated || tx.createdAt?.toDate().toLocaleDateString()}</td>
                <td>
                  
                  <button 
                    className="action-menu-btn"
                    onClick={() => navigate(`/advocate/transactions/${tx.id}`)}
                  >
                    <img src={menuIcon} alt="Menu" />
                  </button>

                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdvocateActiveTransactions;