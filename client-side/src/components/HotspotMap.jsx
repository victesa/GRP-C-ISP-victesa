import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { getAuth } from 'firebase/auth';
import 'leaflet/dist/leaflet.css';
import './HotspotMap.css';

const HotspotMap = () => {
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Manually curated coordinates - placed in RESIDENTIAL/COMMERCIAL areas (NOT parks)
  const locationCoordinates = {
    // Nairobi - Residential areas (avoiding National Park)
    "Donholm, Nairobi": [-1.2921, 36.8219],
    "Donholm": [-1.2921, 36.8219],
    "Syokimau": [-1.3125, 36.9054],
    "Kitengela": [-1.4523, 36.9545],
    "Juja": [-1.1034, 37.0143],
    
    // FIXED: Langata - moved to residential area (NOT National Park)
    "Langata": [-1.3478, 36.7612],  // Langata residential estate
    "Langata, Nairobi": [-1.3478, 36.7612],
    
    // Kileleshwa - already in residential area
    "Kileleshwa": [-1.2883, 36.7847],
    "Kileleshwa, Nairobi": [-1.2883, 36.7847],
    
    "Kahawa West": [-1.1800, 36.9200],
    "Buruburu": [-1.2833, 36.8833],
    "Ruiru": [-1.1458, 36.9611],
    "Mlolongo": [-1.4058, 36.9542],
    "Kasarani": [-1.2206, 36.8989],
    "Embakasi": [-1.3194, 36.8967],
    "Westlands": [-1.2667, 36.8083],
    "Kikuyu": [-1.2467, 36.6667],
    "Thika": [-1.0332, 37.0698],
    
    // FIXED: Ngong - moved to town center (NOT Ngong Hills)
    "Ngong": [-1.3520, 36.6495],  // Ngong town
    
    "Rongai": [-1.3947, 36.7461],
    
    // FIXED: Karen - moved to Karen estate (NOT National Park edge)
    "Karen": [-1.3197, 36.7150],  // Karen residential
    "Karen, Nairobi": [-1.3197, 36.7150],
    
    "Runda": [-1.2167, 36.8167],
    
    // Additional common areas
    "South B": [-1.3072, 36.8228],
    "South C": [-1.3125, 36.8314],
    "Kilimani": [-1.2870, 36.7820],
    "Pipeline": [-1.3194, 36.8850],
    "Umoja": [-1.2800, 36.8900],
    "Kayole": [-1.2650, 36.9100],
    "Zimmerman": [-1.2050, 36.8850],
    "Githurai": [-1.1600, 36.8900],
    
    // Other towns
    "Mombasa": [-4.0435, 39.6682],
    "Kisumu": [-0.0917, 34.7680],
    "Nakuru": [-0.3031, 36.0800],
    "Eldoret": [0.5143, 35.2698]
  };

  useEffect(() => {
    async function fetchHotspots() {
      setLoading(true);
      setError("");
      
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          throw new Error("User not logged in");
        }
        
        const idToken = await user.getIdToken();
        const resp = await fetch("http://localhost:5000/hotspot-radar-report", {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Failed to fetch hotspots");
        
        if (Array.isArray(data.hotspots)) {
          setHotspots(data.hotspots);
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load hotspot data");
      } finally {
        setLoading(false);
      }
    }
    
    fetchHotspots();
  }, []);

  const getRiskColor = (risk) => {
    const riskLower = (risk || "").toLowerCase();
    if (riskLower === "high") return "#EF4444";
    if (riskLower === "medium") return "#F59E0B";
    return "#10B981";
  };

  const getRiskOpacity = (risk) => {
    const riskLower = (risk || "").toLowerCase();
    if (riskLower === "high") return 0.7;
    if (riskLower === "medium") return 0.5;
    return 0.3;
  };

  if (loading) {
    return (
      <div className="dashboard-card map-card">
        <div className="card-header">
          <h3>🗺️ Geographic Risk Map</h3>
        </div>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Loading map data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card map-card">
        <div className="card-header">
          <h3>🗺️ Geographic Risk Map</h3>
        </div>
        <div style={{ padding: '20px', color: '#EF4444' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card map-card">
      <div className="card-header">
        <h2>🗺️ Geographic Risk Map</h2>
        <span className="subtitle">Visual representation of general transaction risk zones in residential areas</span>
      </div>

      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#EF4444' }}></span>
          <span>High Risk</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#F59E0B' }}></span>
          <span>Medium Risk</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#10B981' }}></span>
          <span>Low Risk</span>
        </div>
      </div>

      <MapContainer
        center={[-1.286389, 36.817223]} // Nairobi center
        zoom={11}
        style={{ height: '500px', width: '100%', borderRadius: '8px' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hotspots.map((spot, idx) => {
          // Try to find coordinates for this location
          const coords = locationCoordinates[spot.location] || 
                        locationCoordinates[spot.location.split(',')[0]?.trim()];
          
          if (!coords) {
            console.warn(`No coordinates found for: ${spot.location}`);
            return null;
          }

          const color = getRiskColor(spot.risk);
          const radius = Math.min(Math.max(spot.count * 2, 8), 25);
          
          return (
            <CircleMarker
              key={idx}
              center={coords}
              radius={radius}
              pathOptions={{
                fillColor: color,
                color: color,
                weight: 2,
                opacity: 0.8,
                fillOpacity: getRiskOpacity(spot.risk)
              }}
            >
              <Popup>
                <div className="map-popup">
                  <h4>{spot.location}</h4>
                  <p><strong>Risk Level:</strong> <span style={{ color }}>{spot.risk}</span></p>
                  <p><strong>Flagged Transactions:</strong> {spot.count}</p>
                  <p><strong>Rejection Rate:</strong> {spot.rate}%</p>
                </div>
              </Popup>
              
              <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                <strong>{spot.location}</strong><br/>
                {spot.count} flags • {spot.rate}%
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {hotspots.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
          No hotspot data available yet
        </div>
      )}
    </div>
  );
};

export default HotspotMap;
