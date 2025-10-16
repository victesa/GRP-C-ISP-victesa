import React from 'react';
import './TransactionDetails.css'; // Make sure this CSS file exists

// A reusable component for each metric
const DetailItem = ({ label, value }) => (
  <div className="detail-item">
    <span className="detail-label">{label}</span>
    <span className="detail-value">{value || 'N/A'}</span>
  </div>
);

// This component now receives 'transaction' as a prop
const TransactionDetails = ({ transaction }) => {
  
  // Don't render if data isn't loaded yet
  if (!transaction) {
    return null; 
  }

  // Format data for display
  const startDate = transaction.createdAt?.toDate().toLocaleDateString() || 'N/A';
  // ---
  // --- FIX: Removed 'assignedOfficial' as it wasn't being saved yet ---
  // ---

  return (
    <div className="details-container">
      
      {/* --- Opportunity Details Section --- */}
      <section className="details-section">
        <h3 className="details-title">Transaction Details</h3>
        <div className="details-grid">
          <DetailItem label="Transaction ID" value={transaction.id} />
          <DetailItem label="Location" value={transaction.location} />
          <DetailItem label="Start Date" value={startDate} />
          {/* --- FIX: Removed 'Deadline for Stage' --- */}
        </div>
      </section>

      
      <section className="details-section">
        <div className="details-grid">
          <DetailItem label="Land Parcel Number" value={transaction.parcelNumber} />
          {/* --- FIX: Removed 'Discount Offered' --- */}
          {/* --- FIX: Removed 'Subscription Details' --- */}
          {/* --- FIX: Removed 'Assigned Land Official' --- */}
        </div>
      </section>

    </div>
  );
};

export default TransactionDetails;// Updated Oct 16
