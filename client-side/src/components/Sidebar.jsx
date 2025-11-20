import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

// --- IMPORT YOUR ICONS HERE ---
import logoIcon from '../assets/icons/dashboard.png';
import dashboardIcon from '../assets/icons/dashboard.png';
import transactionsIcon from '../assets/icons/transactions.png';
import settingsIcon from '../assets/icons/settings.png';
import propertiesIcon from "../assets/icons/land.png";
import helpIcon from "../assets/icons/help.png";
import advocateIcon from '../assets/icons/help.png';

// --- This component now renders an <img> tag ---
const Icon = ({ src, alt }) => (
  <img src={src} alt={alt} className="sidebar-icon" />
);

// --- Accept the 'isAdvocate' prop ---
const Sidebar = ({ isAdvocate }) => {
  return (
    <nav className="sidebar">
      {/* --- Main navigation area --- */}
      <div className="sidebar-main">
        
        <div className="sidebar-logo-section">
          <div className="sidebar-logo-icon">
            <img src={logoIcon} alt="Nexus Logo" />
          </div>
          <h3>Nexus</h3>
        </div>
        
        <ul className="sidebar-nav-list">
          <li className="sidebar-nav-item">
            <NavLink to="/dashboard">
              <Icon src={dashboardIcon} alt="Dashboard" /> Dashboard
            </NavLink>
          </li>
          <li className="sidebar-nav-item">
            <NavLink to="/transactions">
              <Icon src={transactionsIcon} alt="Transactions" /> Transactions
              <span className="nav-notification-badge">1</span>
            </NavLink>
          </li>
          <li className="sidebar-nav-item">
            <NavLink to="/properties">
              <Icon src={propertiesIcon} alt="Properties" /> Properties
            </NavLink>
          </li>
        </ul>

        <hr className="sidebar-divider" />

        {/* --- FIX: Advocate link moved to its own section --- */}
        {isAdvocate && (
          <ul className="sidebar-nav-list">
            <li className="sidebar-nav-item">
              <NavLink to="/advocate-transactions">
                <Icon src={advocateIcon} alt="Advocate" /> Advocate Panel
              </NavLink>
            </li>
          </ul>
        )}

      </div>

      {/* --- Bottom utility area --- */}
      <div className="sidebar-bottom">
        <hr className="sidebar-divider" />
        <ul className="sidebar-nav-list">
          <li className="sidebar-nav-item">
            <NavLink to="/help">
              <Icon src={helpIcon} alt="Help and Support" /> Help and Support
            </NavLink>
          </li>
          <li className="sidebar-nav-item">
            <NavLink to="/settings">
              <Icon src={settingsIcon} alt="Settings" /> Settings
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Sidebar;