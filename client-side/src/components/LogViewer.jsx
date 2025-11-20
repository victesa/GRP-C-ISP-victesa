import React, { useState, useEffect } from 'react';
import './LogViewer.css';

// 1. IMPORT NECESSARY FIRESTORE FUNCTIONS
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

// 2. ASSUME 'db' IS EXPORTED FROM YOUR FIREBASE INITIALIZATION FILE
// Make sure this path is correct for your project structure
import { db } from '../firebaseConfig'; 

// Utility function to censor the Property ID (e.g., 'PROP-4235A' -> 'PR****5A')
const censorPropertyId = (id, visibleChars = 2) => {
    if (!id || id.length <= visibleChars * 2) {
        return id; // Or return '****' if you prefer to hide short IDs entirely
    }
    const start = id.substring(0, visibleChars);
    const end = id.substring(id.length - visibleChars);
    const middle = '*'.repeat(id.length - (visibleChars * 2));
    
    return `${start}${middle}${end}`;
};

const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [copiedHash, setCopiedHash] = useState(null);
  const [loading, setLoading] = useState(true); // State for loading indicator
  const [error, setError] = useState(null);   // State for error handling
  
  // --- Data Fetching Logic ---
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Create a query to the 'logs' collection, ordering by timestamp descending
        const logsCollectionRef = collection(db, 'logs');
        const q = query(logsCollectionRef, orderBy('timestamp', 'desc'));

        const querySnapshot = await getDocs(q);
        
        const fetchedLogs = querySnapshot.docs.map(doc => {
          const data = doc.data();
          
          // Data consistency: Ensure required fields exist, and handle timestamp
          return {
            // Firestore document ID is useful as the React key
            id: doc.id,
            
            // Assume the log fields are directly present
            message: data.message || 'No Message',
            propertyId: data.propertyId || 'N/A',
            txHash: data.txHash || 'N/A',
            
            // Convert Firebase Timestamp object to a readable string (if needed)
            timestamp: data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : 'N/A',
            
            // Use the isCensored field from Firestore, defaulting to false
            isCensored: data.isCensored || false,
          };
        });

        setLogs(fetchedLogs);
        
      } catch (e) {
        console.error("Error fetching documents: ", e);
        setError("Failed to fetch logs. Please check console for details.");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []); // Empty dependency array means this runs once on mount
  
  // --- Utility Functions ---
  const truncateTxHash = (hash) => {
    if (!hash || hash.length < 16) return hash;
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };
  
  const handleCopy = (hash) => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopiedHash(hash);
      
      setTimeout(() => {
        setCopiedHash(null);
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  // --- Render Logic ---
  return (
    <div className="log-viewer-container">
      <div className="log-viewer-header">
        <h1>Blockchain Logs 📜</h1>
        <p>Monitor real-time events and transactions.</p>
      </div>
      
      {loading && <p className="status-message loading-message">Fetching logs from Firestore...</p>}
      {error && <p className="status-message error-message">Error: {error}</p>}

      {(!loading && !error) && (
        <div className="log-list">
          {logs.map((log) => (
            <div key={log.id} className="log-item">
              <div className="log-message-section">
                {/* Message */}
                <div className="log-message">
                  **{log.message}**
                </div>
                
                {/* Timestamp and TxHash */}
                <div className="log-details">
                  <span className="detail-item">
                    **Timestamp:** {log.timestamp}
                  </span>
                  
                  <span 
                    className="detail-item tx-hash-display"
                    style={{display: "flex", flexDirection: "row"}}
                    title={log.txHash}
                  >
                    <span className="tx-hash-value">
                      **TxHash:** {truncateTxHash(log.txHash)} 
                    </span>
                    
                    <span 
                      className={`copy-icon ${copiedHash === log.txHash ? 'copied' : ''}`}
                      onClick={() => handleCopy(log.txHash)}
                      title={copiedHash === log.txHash ? 'Copied!' : 'Copy to Clipboard'}
                    >
                      {copiedHash === log.txHash ? '✅' : '📋'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Property ID / Censored Status */}
              <div className="log-property-section">
                {log.isCensored ? (
                  <span className="property-tag censored">
                    Censored
                  </span>
                ) : (
                  <span className="property-tag uncensored" title={log.propertyId}>
                    ID: {censorPropertyId(log.propertyId)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {logs.length === 0 && !loading && !error && (
        <p className="no-logs">No logs found in the 'logs' collection.</p>
      )}
    </div>
  );
};

export default LogViewer;