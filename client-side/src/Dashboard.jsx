import React from 'react';
import './Dashboard.css';
import TrafficLineGraph from './components/TrafficLineGraph'; // New import
import ReviewTasksCard from './components/ReviewTasksCard';   // New import

// Placeholder for icons. In a real app, you'd use a library like react-icons.
const DashboardIcon = ({ children }) => (
  <div className="dashboard-icon-placeholder">{children}</div>
);

const Dashboard = () => {
  return (
    <div className="dashboard-page-container">
      <header className="dashboard-header">
        <h1>Good Morning, Alexa!</h1>
        <div className="header-controls">
          <select className="control-select">
            <option>All Sites</option>
            <option>Site A</option>
            <option>Site B</option>
          </select>
          <button className="control-button">Last 30 Days</button>
        </div>
      </header>

      
      
      <div className="dashboard-cards-grid">
        <div className="dashboard-card">
          <div className="card-header">
            <span className="card-metric">24</span>
            <DashboardIcon>🌐</DashboardIcon>
          </div>
          <h2 className="card-title">Total Sites Monitored</h2>
          <p className="card-description">
            How many users are visiting the website
          </p>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <span className="card-metric">54</span>
            <DashboardIcon>🔄</DashboardIcon> 
          </div>
          <h2 className="card-title">Total Issues Detected</h2>
          <p className="card-description">
            Number of issues impacting site performance.
          </p>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <span className="card-metric">120</span>
            <DashboardIcon>?</DashboardIcon>
          </div>
          <h2 className="card-title">Total Keywords Tracked</h2>
          <p className="card-description">
            Total keywords currently being monitored.
          </p>
        </div>
      </div>

      {/* NEW SECTION: Line Graph and Review Tasks */}
      <div className="dashboard-secondary-grid">
        <TrafficLineGraph />
        <ReviewTasksCard />
      </div>
    </div>
  );
};

export default Dashboard;