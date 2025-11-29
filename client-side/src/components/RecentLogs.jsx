// RecentLogs.js
import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import './RecentLogs.css';

const RecentLogs = ({ onLogClick }) => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const logsQuery = query(
      collection(db, "transactionLogs"),
      orderBy("timestamp", "desc"),
      limit(15)
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => {
        const data = doc.data();

        let timeStr = "Unknown";
        if (data.timestamp && data.timestamp.toDate) {
          timeStr = data.timestamp.toDate().toLocaleString();
        }

        let reference = data.propertyId || data.tokenNo || data.txHash?.slice(0, 10) || "N/A";
        let status = data.status ? data.status.charAt(0).toUpperCase() + data.status.slice(1) : "Pending";

        return {
          id: doc.id,
          status,
          operation: data.operation || 'Unknown',
          reference,
          time: timeStr,
          txHash: data.txHash,
          advocateUid: data.advocateUID,
          adminUid: data.adminUID,
          buyerUid: data.buyerUID,
          sellerUid: data.sellerUID,
          blockNumber: data.blockNumber || null,
          ...data
        };
      });
      setLogs(fetchedLogs);
    });

    return () => unsubscribe();
  }, []);

  // Filter logs based on search term
  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.operation.toLowerCase().includes(term) ||
      log.reference.toLowerCase().includes(term) ||
      log.status.toLowerCase().includes(term) ||
      log.time.toLowerCase().includes(term)
    );
  });

  return (
    <div className="dashboard-card logs-card">
      <div className="card-header">
        <div className="header-content">
          <h3>Recent Activity Logs</h3>
          <div className="search-container">
            <input
              type="text"
              className="logs-search-input"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                className="clear-search-btn"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="logs-table-container">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Operation</th>
              <th>Reference ID</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="4" className="no-results">
                  {searchTerm ? 'No logs match your search' : 'No logs available'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => onLogClick && onLogClick(log)}
                  className="log-row"
                >
                  <td>
                    <span className={`status-dot ${log.status.toLowerCase()}`}></span>
                  </td>
                  <td className="operation-cell">{log.operation}</td>
                  <td className="ref-cell">{log.reference}</td>
                  <td className="time-cell">{log.time}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentLogs;
