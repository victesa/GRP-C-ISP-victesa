import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { getAuth } from 'firebase/auth';
import './HotspotRadar.css';

const RISK_COLORS = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};
const getRiskColor = (risk) => RISK_COLORS[(risk || "").toLowerCase()] || "#10B981";

const HotspotRadar = () => {
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate(); // Initialize navigation

  useEffect(() => {
    async function fetchHotspots() {
      setLoading(true);
      setError("");
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          throw new Error("User not logged in. Please refresh or sign in.");
        }
        const idToken = await user.getIdToken();

        const resp = await fetch("http://localhost:5000/hotspot-radar-report", {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || "Failed to fetch hotspots.");
        }

        if (Array.isArray(data.hotspots)) {
          setHotspots(data.hotspots);
        } else {
          setHotspots([]);
        }

      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load hotspots.");
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchHotspots, 500);
    return () => clearTimeout(timer);
  }, []);

  // Only show top 5 (sorted by count descending)
  const topHotspots = [...hotspots]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxCount = topHotspots.reduce((max, h) => Math.max(max, h.count), 1);

  return (
    <div className="dashboard-card hotspot-card">
      <div className="card-header">
        <div className="header-content">
          <div>
            <h3>Risk Hotspots</h3>
            <span className="subtitle">Highest rejection rates (Last 30 Days)</span>
          </div>
          {/* View Map Button */}
          <button 
            className="view-map-btn"
            onClick={() => navigate('/hotspots-map')}
          >
            🗺️ View Map
          </button>
        </div>
      </div>
      <div className="hotspot-list">
        {loading && <div className="hotspot-loading">Loading...</div>}
        {error && <div className="hotspot-error">{error}</div>}

        {!loading && !error && topHotspots.length === 0 &&
          <div className="hotspot-empty">No hotspot data found!</div>}

        {!loading && !error && topHotspots.map((spot, idx) => (
          <div key={idx} className="hotspot-item">
            <div className="hotspot-info">
              <span className="hotspot-name">{spot.location}</span>
              <span className="hotspot-count">
                {spot.count} flags • {spot.rate}%
              </span>
            </div>
            <div className="risk-bar-container">
              <div
                className="risk-bar"
                style={{
                  width: `${Math.max(10, (spot.count / maxCount) * 100)}%`,
                  backgroundColor: getRiskColor(spot.risk)
                }}
              />
              <span className="risk-label" style={{ color: getRiskColor(spot.risk) }}>
                {spot.risk}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HotspotRadar;
