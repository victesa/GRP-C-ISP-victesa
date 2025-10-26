import React, { useState, useEffect, useMemo } from 'react';
import './components/ActiveTransactions.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { db } from './firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// Status UI mapping
const getStatusClass = (status) => {
  switch (status) {
    case 'Awaiting Signatures':
      return 'status-negotiating';
    case 'Docs Shared':
      return 'status-diligence';
    case 'Verified':
      return 'status-diligence';
    case 'Under Review':
      return 'status-submitted';
    case 'Finalized':
      return 'status-finalized';
    case 'Rejected':
      return 'status-rejected';
    case 'Initiated':
    default:
      return 'status-default';
  }
};

const UserTransactionList = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [transactionsAsBuyer, setTransactionsAsBuyer] = useState([]);
  const [transactionsAsSeller, setTransactionsAsSeller] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    if (!currentUser) return;
    setIsLoading(true);

    // ✅ Correct nested Firestore paths
    const buyerQuery = query(
      collection(db, "transactions"),
      where("buyer.uid", "==", currentUser.uid)
    );

    const sellerQuery = query(
      collection(db, "transactions"),
      where("seller.uid", "==", currentUser.uid)
    );

    const unsubBuyer = onSnapshot(
      buyerQuery,
      (snapshot) => {
        setTransactionsAsBuyer(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setIsLoading(false);
      },
      (err) => {
        console.error("Error fetching buyer transactions:", err);
        setIsLoading(false);
      }
    );

    const unsubSeller = onSnapshot(
      sellerQuery,
      (snapshot) => {
        setTransactionsAsSeller(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setIsLoading(false);
      },
      (err) => {
        console.error("Error fetching seller transactions:", err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubBuyer();
      unsubSeller();
    };
  }, [currentUser]);

  // ✅ Merge buyer + seller and filter by tab
  const filteredTransactions = useMemo(() => {
    const map = new Map();
    transactionsAsBuyer.forEach(tx => map.set(tx.id, tx));
    transactionsAsSeller.forEach(tx => map.set(tx.id, tx));

    const arr = Array.from(map.values());

    return activeTab === 'active'
      ? arr.filter(tx => tx.status !== 'Finalized' && tx.status !== 'Rejected')
      : arr.filter(tx => tx.status === 'Finalized' || tx.status === 'Rejected');
  }, [transactionsAsBuyer, transactionsAsSeller, activeTab]);

  return (
    <div className="active-transactions-card">
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

      <div className="transactions-header">
        <h3>{activeTab === 'active' ? 'Active Transactions' : 'Transaction History'}</h3>
      </div>

      <div className="transactions-table-container">
        <table>
          <thead>
            <tr>
              <th>Parcel / Land ID</th>
              <th>Location</th>
              <th>Status</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td colSpan="5" className="empty-table-cell">Loading transactions...</td>
              </tr>
            )}

            {!isLoading && filteredTransactions.length === 0 && (
              <tr>
                <td colSpan="5" className="empty-table-cell">No transactions found.</td>
              </tr>
            )}

            {!isLoading && filteredTransactions.map((tx) => (
              <tr key={tx.id}>
                <td className="tx-id-cell">{tx?.parcelNumber || '--'}</td>
                <td>{tx?.location || '--'}</td>

                <td>
                  <span className={`status-pill ${getStatusClass(tx.status)}`}>
                    {tx.status}
                  </span>
                </td>

                <td>
                  {tx?.buyer?.uid === currentUser.uid ? 'Buyer' : 'Seller'}
                </td>

                <td>
                  <button
                    className="action-btn-view"
                    onClick={() => navigate(`/transactions/${tx.id}`)}
                  >
                    View
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

export default UserTransactionList;
// Updated Oct 26
