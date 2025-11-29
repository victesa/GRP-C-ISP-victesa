import React, { useState } from 'react';
import './Dashboard.css';

// Import components
import MarketHealth from './components/MarketHealth';
import RecentLogs from './components/RecentLogs';
import LogDetailsModal from './components/LogDetailsModal'; // New Import
import HotspotRadar from './components/HotspotRadar';

const Dashboard = () => {
  // State for Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const recentLogs = [
    { id: 1, status: "Success", operation: "Property Minting", reference: "NBO/BLK/82", time: "2 mins ago" },
    { id: 2, status: "Pending", operation: "Doc Verification", reference: "Tx: 0x4a...9c", time: "15 mins ago" },
    { id: 3, status: "Failed", operation: "Transaction Init", reference: "NBO/BLK/99", time: "1 hour ago" },
    { id: 4, status: "Success", operation: "Admin Approval", reference: "User: Adv_01", time: "3 hours ago" },
    { id: 5, status: "Success", operation: "Property Minting", reference: "KAJ/KIT/05", time: "5 hours ago" },
  ];

  return (
    <div className="dashboard-page-container">
      
      <header className="dashboard-header">
        <h1>Dashboard</h1>
      </header>

      <div className="dashboard-top-section">
        <div className="hotspot-container">
          <HotspotRadar />
        </div>
        <div className="health-container">
          <MarketHealth />
        </div>
      </div>

      <div className="dashboard-bottom-section">
        {/* Pass the setter function to RecentLogs */}
        <RecentLogs 
          logs={recentLogs} 
          onLogClick={(log) => setSelectedLog(log)} 
        />
      </div>

      {/* Render Modal if a log is selected */}
      {selectedLog && (
        <LogDetailsModal 
          log={selectedLog} 
          onClose={() => setSelectedLog(null)} 
        />
      )}

    </div>
  );
};

export default Dashboard;