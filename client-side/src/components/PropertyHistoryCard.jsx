import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { AlertTriangle, CheckCircle, Clock, ShieldAlert } from 'lucide-react'; 
import "./PropertyHistoryCard.css";

const PropertyHistoryCard = ({ propertyId, parcelNumber, location }) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPropertyHistory() {
      if (!propertyId) {
        setError("Property ID not provided");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          throw new Error("User not logged in. Please refresh or sign in.");
        }
        const idToken = await user.getIdToken();

        const resp = await fetch(`http://localhost:5000/property-risk-profile/${propertyId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || "Failed to fetch property history.");
        }

        setHistory({
          totalTransactions: data.totalTransactions || 0,
          rejected: data.rejected || 0,
          accepted: data.accepted || 0,
          failed: data.failed || 0,
          lastFlaggedIssue: data.lastFlaggedIssue,
          status: data.status || "safe",
          location: data.location || location || "Unknown"
        });

      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load property history.");
      } finally {
        setLoading(false);
      }
    }

    fetchPropertyHistory();
  }, [propertyId]);

  if (loading) {
    return (
      <div className="dashboard-card history-card loading">
        Checking property records...
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card history-card" style={{ padding: '20px' }}>
        <div style={{ color: '#EF4444' }}>{error}</div>
      </div>
    );
  }

  if (!history) return null;

  // Logic to determine UI colors based on risk
  const getRiskUI = () => {
    const rate = history.totalTransactions > 0 
      ? ((history.rejected + history.failed) / history.totalTransactions) * 100 
      : 0;
    
    if (rate > 40 || history.status === 'critical') {
      return {
        color: "#EF4444",
        bg: "#FEF2F2",
        icon: <ShieldAlert size={24} />,
        title: "High Risk Detected",
        desc: "Multiple flagged transactions found. Due diligence mandatory."
      };
    } else if (rate > 0 || history.status === 'caution') {
      return {
        color: "#F59E0B",
        bg: "#FFFBEB",
        icon: <AlertTriangle size={24} />,
        title: "Caution Advised",
        desc: "This property has a history of rejected transactions."
      };
    } else {
      return {
        color: "#10B981",
        bg: "#ECFDF5",
        icon: <CheckCircle size={24} />,
        title: "Good Standing",
        desc: "No significant issues found in transaction history."
      };
    }
  };

  const ui = getRiskUI();

  return (
    <div className="dashboard-card history-card" style={{ marginTop: '20px' }}>
      <div className="card-header">
        <h3>Property Risk Profile</h3>
        <span className="subtitle">
          Historical analysis for {parcelNumber || propertyId}
        </span>
      </div>

      <div className="history-content">
        {/* Verdict Banner */}
        <div 
          className="verdict-banner" 
          style={{ 
            backgroundColor: ui.bg, 
            borderLeft: `4px solid ${ui.color}` 
          }}
        >
          <div className="verdict-icon" style={{ color: ui.color }}>
            {ui.icon}
          </div>
          <div className="verdict-text">
            <h4 style={{ color: ui.color, margin: 0 }}>{ui.title}</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>
              {ui.desc}
            </p>
          </div>
        </div>

        {/* Stats Grid */}

        <div className="history-stats-grid">
        <div className="stat-box">
            <span className="stat-label">Total Deals</span>
            <span className="stat-value">{history.totalTransactions}</span>
            <span className="stat-sub">Transactions</span>
        </div>
        
        <div className="stat-box">
            <span className="stat-label">Completed</span>
            <span className="stat-value success">{history.accepted}</span>
            <span className="stat-sub">Finalized</span>
        </div>

        <div className="stat-box">
            <span className="stat-label">Failed</span>
            <span className="stat-value danger">{history.rejected}</span>
            <span className="stat-sub">Rejected</span>
        </div>

        {history.inProgress > 0 && (
            <div className="stat-box">
            <span className="stat-label">Active</span>
            <span className="stat-value" style={{color: '#F59E0B'}}>
                {history.inProgress}
            </span>
            <span className="stat-sub">In Progress</span>
            </div>
        )}
        </div>


        {/* Rejection Context (Only show if there are rejections) */}
        {(history.rejected > 0 || history.failed > 0) && history.lastFlaggedIssue && (
          <div className="issue-log">
            <span className="log-title">
              <Clock size={14}/> Most Recent Issue:
            </span>
            <span className="log-msg">{history.lastFlaggedIssue}</span>
          </div>
        )}

        {/* No issues message */}
        {history.totalTransactions === 0 && (
          <div style={{ 
            padding: '15px', 
            textAlign: 'center', 
            color: '#6B7280',
            fontStyle: 'italic' 
          }}>
            No transaction history available for this property yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyHistoryCard;
