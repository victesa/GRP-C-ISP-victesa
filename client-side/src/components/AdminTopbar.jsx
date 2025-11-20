import React from 'react';
import './Topbar.css'; // We can reuse the same CSS file!

// --- IMPORT YOUR ICONS HERE ---
import bellIcon from '../assets/icons/notifications.png';
import avatarIcon from '../assets/icons/profile.png'; // A user photo

const AdminTopbar = () => {
  return (
    <header className="topbar">
      
      {/* This spacer pushes actions to the right */}
      <div className="topbar-spacer"></div>

      {/* Right Section: Actions and Profile */}
      <div className="topbar-actions">
        {/* "Be an Advocate" button is removed */}

        <button className="topbar-icon-button">
          <img src={bellIcon} alt="Notifications" className="topbar-icon" />
        </button>
        <img src={avatarIcon} alt="Profile" className="topbar-avatar" />
      </div>
    </header>
  );
};

export default AdminTopbar;