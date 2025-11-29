import React from 'react';
import './TransactionDetails.css';

// A reusable component for each metric
const DetailItem = ({ label, value }) => (
  <div className="detail-item">
    <span className="detail-label">{label}</span>
    <span className="detail-value">{value || 'N/A'}</span>
  </div>
);

const TransactionDetails = ({ transaction }) => {
  
  if (!transaction) {
    return (
      <div className="details-container">
        <p style={{ textAlign: 'center', color: '#6B7280', padding: '20px' }}>
          Loading transaction details...
        </p>
      </div>
    );
  }

  // Format data for display
  const startDate = transaction.createdAt?.toDate?.().toLocaleDateString() || 'N/A';

  return (
    <div className="details-container">
      
      {/* --- Transaction Overview --- */}
      <section className="details-section">
        <h3 className="details-title">📋 Transaction Overview</h3>
        <div className="details-grid">
          <DetailItem label="Reference Number" value={transaction.id} />
          <DetailItem label="Status" value={transaction.status} />
          <DetailItem label="Created Date" value={startDate} />
        </div>
      </section>

      {/* --- Property Details --- */}
      <section className="details-section">
        <h3 className="details-title">🏠 Property Information</h3>
        <div className="details-grid">
          <DetailItem label="Parcel Number" value={transaction.parcelNumber || transaction.titleNumber} />
          <DetailItem label="Location" value={transaction.location} />
        </div>
      </section>



      {/* --- Additional Notes --- */}
      {transaction.adminRejectionComment && (
        <section className="details-section">
          <h3 className="details-title">📝 Admin Comment</h3>
          <div className="details-grid">
            <div className="detail-item detail-full-width">
              <span className="detail-value rejection-comment">
                {transaction.adminRejectionComment}
              </span>
            </div>
          </div>
        </section>
      )}

    </div>
  );
};

export default TransactionDetails;
