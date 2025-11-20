import React from 'react';
import './DealSidebar.css'; // You can reuse the same CSS
import { useAuth } from '../hooks/useAuth';

// --- IMPORT YOUR ICONS HERE ---
import menuIcon from '../assets/icons/help.png';
import emailIcon from '../assets/icons/help.png';
import phoneIcon from '../assets/icons/help.png';
import userAvatar from '../assets/icons/profile.png'; 

// A reusable sub-component for each contact card
const ContactCard = ({ role, user, isPrimary = false }) => {
  if (!user || !user.name) { // Check if user or user.name exists
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
          {/* Check for email */}
          <span>{user.email || 'N/A'}</span>
        </div>
        <div className="contact-detail-item">
          <img src={phoneIcon} alt="Phone" className="contact-icon" />
          {/* Check for phone */}
          <span>{user.phone || 'N/A'}</span>
        </div>
      </div>
    </div>
  );
};

// --- THE NEW ADVOCATE-SPECIFIC SIDEBAR ---
const AdvocateDealSidebar = ({ transaction }) => {
  const { currentUser } = useAuth(); // Still useful for the loading check

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

  // ---
  // --- THIS IS THE FIX ---
  // ---
  // This logic now works for BOTH old and new transactions.
  // 1. It checks for the new `transaction.buyer.name` first.
  // 2. If it's not there, it falls back to the old `transaction['buyer-name']`.
  // 3. It does the same for email and phone.
  const buyer = {
    name: transaction.buyer?.name || transaction['buyer-name'],
    email: transaction.buyer?.email || transaction['buyer-email'],
    phone: transaction.buyer?.phone || transaction['buyer-phone'],
    photoURL: transaction.buyer?.photoURL
  };
  
  const seller = {
    name: transaction.seller?.name || transaction['seller-name'],
    email: transaction.seller?.email || transaction['seller-email'],
    phone: transaction.seller?.phone || transaction['seller-phone'],
    photoURL: transaction.seller?.photoURL
  };
  // ---

  return (
    <div className="deal-sidebar-wrapper">
      <div className="contacts-header">
        <h2>Key Contacts</h2>
      </div>

      {/* --- Card 1: The Buyer --- */}
      <ContactCard
        role="Buyer"
        user={buyer}
      />
      
      {/* --- Card 2: The Seller --- */}
      <ContactCard
        role="Seller"
        user={seller}
      />
    </div>
  );
};

export default AdvocateDealSidebar;