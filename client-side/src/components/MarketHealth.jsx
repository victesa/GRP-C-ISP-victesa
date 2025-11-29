import React, { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import './MarketHealth.css';

const MarketHealth = () => {
  const [stats, setStats] = useState({
    total: 0,
    safe: 0,
    risky: 0,
    safePercent: 0,
    riskyPercent: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchMarketHealth() {
      setLoading(true);
      setError("");
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          throw new Error("User not logged in. Please refresh or sign in.");
        }
        const idToken = await user.getIdToken();

        const resp = await fetch("http://localhost:5000/market-health-stats", {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || "Failed to fetch market health.");
        }

        setStats({
          total: data.total || 0,
          safe: data.safe || 0,
          risky: data.risky || 0,
          safePercent: data.safePercent || 0,
          riskyPercent: data.riskyPercent || 0
        });

      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load market health.");
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchMarketHealth, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="dashboard-card health-card">
      <div className="card-header">
        <h3>🛡️ Market Health</h3>
        <span className="subtitle">Transaction Safety Overview</span>
      </div>

      {loading && <div style={{padding: '20px', textAlign: 'center'}}>Loading...</div>}
      {error && <div style={{padding: '20px', color: '#EF4444'}}>{error}</div>}

      {!loading && !error && (
        <div className="chart-container">
          {/* CSS Conic Gradient Donut Chart */}
          <div 
            className="donut-chart" 
            style={{
              background: `conic-gradient(
                #10B981 0% ${stats.safePercent}%, 
                #EF4444 ${stats.safePercent}% 100%
              )`
            }}
          >
            <div className="inner-circle">
              <span className="total-number">{stats.total}</span>
              <span className="total-label">Total Txns</span>
            </div>
          </div>

          <div className="chart-legend">
            <div className="legend-item">
              <span className="dot safe"></span>
              <div className="legend-text">
                <span className="label">Verified Safe</span>
                <span className="value">{stats.safePercent}%</span>
              </div>
            </div>
            <div className="legend-item">
              <span className="dot risky"></span>
              <div className="legend-text">
                <span className="label">Flagged/Rejected</span>
                <span className="value">{stats.riskyPercent}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketHealth;
