import React, { useState, useEffect } from 'react';
import './DealSidebar.css';
import { useAuth } from '../hooks/useAuth';
// We no longer need to import db or getDoc

// --- IMPORT YOUR ICONS HERE ---
import menuIcon from '../assets/icons/help.png';
import emailIcon from '../assets/icons/help.png';
import phoneIcon from '../assets/icons/help.png';
// Using a placeholder icon for user avatars
import userAvatar from '../assets/icons/profile.png'; 

// A reusable sub-component for each contact card
const ContactCard = ({ role, user, isPrimary = false }) => {
  // This 'user' object is now coming from the transaction prop
  if (!user) {
    // This is a safety check in case the data is still loading
    return (
      <div className="contact-card">
        <span className="card-role-label">{role}</span>
        <div className="card-profile-section">
          <p>Contact not found.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`contact-card ${isPrimary ? 'primary' : ''}`}>
      <span className="card-role-label">{role}</span>
      
      <div className="card-profile-section">
        <img src={user.photoURL || userAvatar} alt={user.name} className="contact-avatar" />
        <div className="contact-info">
          <span className="contact-name">{user.name}</span>
          <span className="contact-title">{role}</span>
        </div>
        <button className="contact-menu-btn">
          <img src={menuIcon} alt="Menu" />
        </button>
      </div>
      
      <div className="contact-details">
        <div className="contact-detail-item">
          <img src={emailIcon} alt="Email" className="contact-icon" />
          <span>{user.email}</span>
        </div>
        <div className="contact-detail-item">
          <img src={phoneIcon} alt="Phone" className="contact-icon" />
          <span>{user.phone}</span>
        </div>
      </div>
    </div>
  );
};

// The main sidebar component
const DealSidebar = ({ transaction }) => {
  const { currentUser } = useAuth();

  // If the parent page is still loading the transaction, show a simple loader.
  if (!transaction || !currentUser) {
    return (
      <div className="deal-sidebar-wrapper">
        <div className="contacts-header">
          <h2>Key Contacts</h2>
        </div>
        <p>Loading...</p>
      </div>
    );
  }

  // --- THIS IS THE FIX ---
  // We get the contact data *directly* from the transaction object
  // that was passed down as a prop. No new database fetches are needed.
  
  // 1. Get the Advocate
  const advocate = transaction.advocate;
  
  // 2. Determine who the "other party" is
  const isUserTheBuyer = currentUser.uid === transaction.buyer?.uid;
  const otherParty = isUserTheBuyer ? transaction.seller : transaction.buyer;
  const otherPartyRole = isUserTheBuyer ? 'Seller' : 'Buyer';

  return (
    <div className="deal-sidebar-wrapper">
      <div className="contacts-header">
        <h2>Key Contacts</h2>
      </div>

      {/* Advocate Card */}
      <ContactCard
        role="Advocate"
        user={advocate}
        isPrimary={true}
      />
      
      {/* Other Party Card */}
      <ContactCard
        role={otherPartyRole}
        user={otherParty}
      />
    </div>
  );
};

export default DealSidebar;