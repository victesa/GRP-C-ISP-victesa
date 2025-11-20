import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import './Layout.css'; 
import { useAuth } from './context/AuthContext'; // 1. Import useAuth

const Layout = () => {
  
  // 2. Get the new status from the context
  const { userData, advocateStatus } = useAuth();

  return (
    <div className="app-layout">
      
      {/* 3. Pass isAdvocate (from userData) and advocateStatus */}
      <Sidebar isAdvocate={userData?.isAdvocate} />
      
      <div className="app-content-wrapper">
        <Topbar 
          isAdvocate={userData?.isAdvocate} 
          advocateStatus={advocateStatus} 
        />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      
    </div>
  );
};

export default Layout;