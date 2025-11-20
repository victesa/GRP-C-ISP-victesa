import React from 'react';
import './AdminDashboard.css'; // <-- 1. IMPORT THE NEW CSS FILE

const AdminDashboard = () => {
  return (
    // 2. USE A NEW, UNIQUE CLASS NAME
    <div className="admin-dashboard-container">
      {/* Page Header */}
      <div className="page-header">
        <h1>Admin Dashboard</h1>
      </div>

      {/* We will add the summary cards here later */}
      <div className="admin-placeholder-card">
        <p>Admin Dashboard content goes here.</p>
        <p>Our next step is to build the Advocate Management table.</p>
      </div>
    </div>
  );
};

export default AdminDashboard;