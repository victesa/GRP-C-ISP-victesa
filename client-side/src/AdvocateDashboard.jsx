import React from 'react';
import './AdvocateDashboard.css'; // New CSS file
import AdvocateSummary from './components/AdvocateSummary';
import ActiveTransactions from './components/ActiveTransactions';
import AdvocateActiveTransactions from './components/AdvocateActiveTransactions';

const AdvocateDashboard = () => {
  return (
    <div className="advocate-dashboard-container">
      {/* Page Header */}
      <div className="page-header">
        <h1>Advocate Panel</h1>
        <div className="page-actions">
          {/* Advocate-specific buttons can go here */}
        </div>
      </div>

      {/* Advocate Summary Cards */}
      <AdvocateSummary />
      
      {/* Reusable Active Transactions component with the create button enabled */}
      <AdvocateActiveTransactions showCreateButton={true} />
      
    </div>
  );
};

export default AdvocateDashboard;