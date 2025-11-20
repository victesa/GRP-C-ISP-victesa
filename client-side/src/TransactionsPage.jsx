import React from 'react';
import './TransactionsPage.css';
import UserTransactionSummary from './UserTransactionSummary'; // <-- 1. IMPORT NEW SUMMARY
import UserTransactionList from './UserTransactionList'; // <-- 2. IMPORT NEW LIST

const TransactionsPage = () => {
  return (
    <div className="transactions-page-container">
      {/* Page Header */}
      <div className="page-header">
        <h1>Transactions</h1>
        <div className="page-actions">
          {/* No buttons here for a normal user */}
        </div>
      </div>

      {/* --- 3. USE NEW SUMMARY --- */}
      <UserTransactionSummary />

      {/* --- 4. USE NEW LIST --- */}
      <UserTransactionList />
      
    </div>
  );
};

export default TransactionsPage;