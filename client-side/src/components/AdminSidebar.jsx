import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css'; // Reusing the same CSS file

// --- IMPORT YOUR ICONS HERE ---
import logoIcon from '../assets/icons/dashboard.png';
import dashboardIcon from '../assets/icons/dashboard.png';
import advocateIcon from '../assets/icons/law.png'; 
import transactionsIcon from '../assets/icons/transactions.png';
import usersIcon from '../assets/icons/profile.png'; 
import settingsIcon from '../assets/icons/settings.png';
import helpIcon from '../assets/icons/help.png';
import propertiesIcon from '../assets/icons/land.png'; // <-- 1. ADDED NEW ICON

const Icon = ({ src, alt }) => (
  <img src={src} alt={alt} className="sidebar-icon" />
);

const AdminSidebar = () => {
  return (
    <nav className="sidebar">
      {/* --- Main navigation area --- */}
      <div className="sidebar-main">
        
        {/* --- Updated Logo Section --- */}
        <div className="sidebar-logo-section">
          <div className="sidebar-logo-icon">
            <img src={logoIcon} alt="Admin Logo" />
          </div>
          <h3>Admin Panel</h3>
        </div>
        
        {/* --- Updated Nav Links --- */}
        <ul className="sidebar-nav-list">
          <li className="sidebar-nav-item">
            <NavLink to="/admin/dashboard">
              <Icon src={dashboardIcon} alt="Dashboard" /> Dashboard
            </NavLink>
          </li>
          <li className="sidebar-nav-item">
            <NavLink to="/admin/advocates">
              <Icon src={advocateIcon} alt="Advocates" /> Advocate Management
            </NavLink>
          </li>
          {/* --- 2. NEW "PROPERTY REQUESTS" LINK --- */}
          <li className="sidebar-nav-item">
            <NavLink to="/admin/properties">
              <Icon src={propertiesIcon} alt="Properties" /> Property Requests
            </NavLink>
          </li>
          <li className="sidebar-nav-item">
            <NavLink to="/admin/transactions">
              <Icon src={transactionsIcon} alt="Transactions" /> Transaction Oversight
            </NavLink>
          </li>
        </ul>

        <hr className="sidebar-divider" />
      </div>

      {/* --- Bottom utility area --- */}
      <div className="sidebar-bottom">
        <hr className="sidebar-divider" />
        <ul className="sidebar-nav-list">
          <li className="sidebar-nav-item">
            <NavLink to="/admin/help">
              <Icon src={helpIcon} alt="Help" /> Help
            </NavLink>
          </li>
          <li className="sidebar-nav-item">
            <NavLink to="/admin/settings">
              <Icon src={settingsIcon} alt="Settings" /> Settings
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default AdminSidebar;