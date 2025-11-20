import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './components/AdminSidebar'; // Import Admin Sidebar
import AdminTopbar from './components/AdminTopbar';   // Import Admin Topbar
import './Layout.css'; // We can reuse the same CSS file!

const AdminLayout = () => {
  return (
    <div className="app-layout">
      
      <AdminSidebar /> {/* Use Admin Sidebar */}
      
      <div className="app-content-wrapper">
        <AdminTopbar /> {/* Use Admin Topbar */}
        <main className="app-content">
          <Outlet /> {/* This is where your admin pages will render */}
        </main>
      </div>
      
    </div>
  );
};

export default AdminLayout;