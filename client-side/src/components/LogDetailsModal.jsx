import React, { useState } from 'react';
import './LogDetailsModal.css';

import closeIcon from '../assets/icons/close.png'; 
import copyIcon from '../assets/icons/copy.png';
import checkCircle from '../assets/icons/check-circle.png'; 
import alertCircle from '../assets/icons/alert-circle.png'; 

const LogDetailsModal = ({ log, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  // Truncate helper
  const truncate = (str, n = 6) => {
    if (!str) return 'N/A';
    if (str.length <= n * 2) return str;
    return `${str.substring(0, n)}...${str.substring(str.length - n)}`;
  };

  // Copy helper
  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusClass = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'success': return 'badge-success';
      case 'failed': return 'badge-failed';
      case 'rejected': return 'badge-rejected';
      default: return 'badge-pending';
    }
  };

  // Format timestamp
  let formattedDate = "Unknown time";
  if (log.timestamp && typeof log.timestamp.toDate === 'function') {
    formattedDate = log.timestamp.toDate().toLocaleString();
  } else if (log.time) {
    formattedDate = log.time;
  }

  // Human-friendly status & summary logic
  const status = (log.status || '').toLowerCase();

  let statusHeading = '';
  let summaryLine = '';
  let detailsLine = '';

  // Operation context
  const op = (log.operation || '').toLowerCase();

  if (status === 'success') {
    if (op.includes('mint')) {
      statusHeading = 'Property Successfully Minted on Blockchain';
      summaryLine = 'This property was successfully registered and tokenized on-chain.';
    } else if (op.includes('accept')) {
      statusHeading = 'Transaction Accepted by Participant';
      summaryLine = 'A participant has approved this transaction, moving it forward.';
    } else if (op.includes('docs shared')) {
      statusHeading = 'Documents Shared with Participants';
      summaryLine = 'Advocate has uploaded and shared legal documents for review.';
    } else {
      statusHeading = 'Event Completed Successfully';
      summaryLine = 'This action in the transaction workflow finished as expected.';
    }
    detailsLine = '';
  } else if (status === 'rejected') {
    statusHeading = 'Transaction Rejected';
    summaryLine = log.role 
      ? `${log.role} rejected the transaction.` 
      : 'The transaction was rejected during due diligence.';
    detailsLine = log.rejectionReason ? `Reason: ${log.rejectionReason}` : '';
  } else if (status === 'failed') {
    statusHeading = 'Blockchain or System Failure';
    summaryLine = log.errorMsg
      ? `Error: ${log.errorMsg}` 
      : 'The transaction failed to execute properly.';
    detailsLine = '';
  } else {
    statusHeading = 'Pending or Unknown Status';
    summaryLine = 'The transaction or operation is waiting for additional steps.';
    detailsLine = '';
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* --- Header --- */}
        <div className="modal-header">
          <div className="header-left">
            <div className="icon-circle">TX</div>
            <div>
              <h2>{log.operation || 'Transaction Event'}</h2>
              <span className="header-sub">
                Reference: {log.reference || truncate(log.txHash, 8)}
              </span>
            </div>
          </div>
          <div className="header-right">
            <span className={`status-badge ${getStatusClass(log.status)}`}>
              {log.status ? log.status.charAt(0).toUpperCase() + log.status.slice(1) : 'Unknown'}
            </span>
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <img src={closeIcon} alt="" />
            </button>
          </div>
        </div>

        {/* --- Summary Section --- */}
        <div className="modal-section summary-section">
          <h3>{statusHeading}</h3>
          <p>
            {summaryLine}
            <br /><span style={{ color: '#555' }}>{detailsLine}</span>
          </p>
          <p style={{ fontSize: '0.95em', marginTop: 8 }}>
            <span style={{ fontWeight: 500 }}>Event Time:</span> {formattedDate}
          </p>
        </div>

        {/* --- Advanced Details --- */}
        <div className="modal-section details-section">
          <h3>Technical Details</h3>
          <div className="details-grid">
            {/* Column 1: Technical Info */}
            <div className="detail-column">
              <div className="detail-row">
                <span className="label">Operation</span>
                <span className="value">{log.operation || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Tx Hash</span>
                <div className="value-group">
                  <span className="value mono">
                    {truncate(log.txHash || log.reference, 8)}
                  </span>
                  {(log.txHash || log.reference) && (
                    <button 
                      className="copy-btn" 
                      onClick={() => handleCopy(log.txHash || log.reference)}
                      title="Copy Hash"
                    >
                      <img src={copyIcon} alt="Copy" />
                      {copied && <span className="copy-tooltip">Copied!</span>}
                    </button>
                  )}
                </div>
              </div>
              <div className="detail-row">
                <span className="label">Block No.</span>
                <span className="value">{log.blockNumber || 'Pending'}</span>
              </div>
            </div>
            {/* Column 2: Participant Info */}
            <div className="detail-column">
              <div className="detail-row">
                <span className="label">Advocate UID</span>
                <span className="value mono">{truncate(log.advocateUid || log.advocateUID, 6)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Admin UID</span>
                <span className="value mono">{truncate(log.adminUid || log.adminUID, 6)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Buyer UID</span>
                <span className="value mono">{truncate(log.buyerUid || log.buyerUID, 6)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Seller UID</span>
                <span className="value mono">{truncate(log.sellerUid || log.sellerUID, 6)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* --- Footer Health Box --- */}
        <div className="modal-footer">
          <div className={`health-box ${status === 'failed' || status === 'rejected' ? 'health-error' : ''}`}>
            <img 
              src={
                status === 'failed' || status === 'rejected'
                  ? alertCircle
                  : checkCircle
              } 
              alt="" 
              className="health-icon" 
            />
            <span className="health-text">
              {status === 'failed'
                ? 'A problem was encountered in this step.'
                : (status === 'rejected'
                  ? (log.rejectionReason
                      ? `Rejected: ${log.rejectionReason}`
                      : 'Rejected during checks.'
                    )
                  : 'No issues reported for this event.'
                )
              }
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LogDetailsModal;
