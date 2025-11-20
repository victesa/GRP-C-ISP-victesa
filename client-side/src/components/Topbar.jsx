import React, { useState, useEffect } from 'react';
import './Topbar.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // 1. Get logout from here
import { db } from '../firebaseConfig'; 
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore'; 

// --- IMPORT YOUR ICONS HERE ---
import bellIcon from '../assets/icons/notifications.png';
import avatarIcon from '../assets/icons/profile.png'; 

const Topbar = ({ isAdvocate, advocateStatus }) => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth(); // 1. Destructure logout
  
  const [notifications, setNotifications] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false); // 2. Add profile dropdown state

  // useEffect to listen for new notifications
  useEffect(() => {
    if (!currentUser) return;

    const notifQuery = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(notifQuery, (snapshot) => {
      const unreadNotifs = [];
      snapshot.forEach(doc => {
        if (doc.data().read === false) {
          unreadNotifs.push({ id: doc.id, ...doc.data() });
        }
      });
      setNotifications(unreadNotifs);
    });

    return () => unsubscribe();
    
  }, [currentUser]); 

  const handleNavigateToAdvocate = () => {
    navigate('/be-an-advocate');
  };

  const handleNotificationClick = async (notification) => {
    const notifRef = doc(db, "notifications", notification.id);
    
    try {
      await updateDoc(notifRef, {
        read: true
      });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }

    setIsDropdownOpen(false);
    
    if (notification.link) {
      navigate(notification.link);
    }
  };

  // 3. Add handler for signing out
  const handleSignOut = async () => {
    setIsProfileDropdownOpen(false); // Close dropdown
    try {
      await logout(); // Call the logout function from your hook
      navigate('/login'); // Redirect to login page
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-spacer"></div>

      <div className="topbar-actions">
        
        {/* Advocate Button */}
        {!isAdvocate && advocateStatus !== 'pending' && (
          <button 
            className="topbar-advocate-btn" 
            onClick={handleNavigateToAdvocate}
          >
            Be an Advocate
          </button>
        )}
        {advocateStatus === 'pending' && (
          <button className="topbar-advocate-btn pending" disabled>
            Application Pending
          </button>
        )}

        {/* --- Notification Wrapper --- */}
        <div className="topbar-notification-wrapper">
          <button 
            className="topbar-icon-button"
            // 3. Update click handler to close profile dropdown
            onClick={() => {
              setIsDropdownOpen(!isDropdownOpen);
              setIsProfileDropdownOpen(false); 
            }} 
          >
            <img src={bellIcon} alt="Notifications" className="topbar-icon" />
            
            {notifications.length > 0 && (
              <span className="topbar-notification-badge">{notifications.length}</span>
            )}
          </button>

          {/* Notification Dropdown */}
          {isDropdownOpen && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <h3>Notifications</h3>
              </div>
              <div className="notification-list">
                {notifications.length > 0 ? (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className="notification-item"
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <p dangerouslySetInnerHTML={{ __html: notif.message }} />
                      <span className="notification-time">
                        {notif.createdAt?.toDate().toLocaleDateString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="notification-item empty">
                    <p>You're all caught up!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* --- 4. NEW: Profile Wrapper & Dropdown --- */}
        <div className="topbar-profile-wrapper">
          <img 
            src={currentUser.photoURL || avatarIcon} // Use user's photo if available
            alt="Profile" 
            className="topbar-avatar" 
            // 3. Update click handler to close notification dropdown
            onClick={() => {
              setIsProfileDropdownOpen(!isProfileDropdownOpen);
              setIsDropdownOpen(false);
            }}
          />

          {/* Profile Dropdown */}
          {isProfileDropdownOpen && (
            <div className="notification-dropdown"> {/* Re-using same style */}
              <div className="notification-list">
                <div 
                  className="notification-item sign-out-item" // Added a new class
                  onClick={handleSignOut}
                >
                  Sign Out
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;