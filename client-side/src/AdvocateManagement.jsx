import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebaseConfig'; // Import your Firestore db
import { useAuth } from './hooks/useAuth'; // Import useAuth to get admin ID
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import './AdvocateManagement.css'; 

// --- IMPORT YOUR ICONS HERE ---
import searchIcon from './assets/icons/help.png';

const AdvocateManagement = () => {
  // State to manage which tab is active
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'queue', 'verified'
  
  // State to hold the live data from Firestore
  const [pendingApplications, setPendingApplications] = useState([]);
  const [myQueue, setMyQueue] = useState([]);
  const [verifiedAdvocates, setVerifiedAdvocates] = useState([]);
  const [loading, setLoading] = useState(true);

  const { currentUser } = useAuth(); // Get the currently logged-in admin
  const navigate = useNavigate(); // For navigation

  // --- useEffect to fetch all data ---
  useEffect(() => {
    if (!currentUser) return; // Don't run if admin isn't logged in

    setLoading(true);

    // 1. Listen for PENDING applications (the pool)
    const pendingQuery = query(
      collection(db, "advocateApplications"),
      where("status", "==", "pending"),
      where("assignedAdmin", "==", null)
    );
    const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      setPendingApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // 2. Listen for MY QUEUE applications
    const myQueueQuery = query(
      collection(db, "advocateApplications"),
      where("status", "==", "pending"),
      where("assignedAdmin", "==", currentUser.uid)
    );
    const unsubMyQueue = onSnapshot(myQueueQuery, (snapshot) => {
      setMyQueue(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // 3. Listen for VERIFIED advocates
    const verifiedQuery = query(
      collection(db, "users"),
      where("isAdvocate", "==", true)
    );
    const unsubVerified = onSnapshot(verifiedQuery, (snapshot) => {
      setVerifiedAdvocates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // Cleanup function to stop listening when component unmounts
    return () => {
      unsubPending();
      unsubMyQueue();
      unsubVerified();
    };
  }, [currentUser]); // Re-run if the user changes

  const handleSuspend = (id) => {
    // In a real app, you would update the user's doc here
    // await updateDoc(doc(db, "users", id), { isSuspended: true });
    console.log(`Suspending advocate ${id}`);
  };
  
  const handleViewDetails = (id) => {
    // This now navigates to the details page
    navigate(`/admin/advocates/${id}`);
  };

  const handleClaimAndReview = async (id) => {
    if (!currentUser) return;

    // 1. "Claim" the application by updating its doc in Firestore
    const appDocRef = doc(db, "advocateApplications", id);
    try {
      await updateDoc(appDocRef, {
        assignedAdmin: currentUser.uid
      });
      // 2. After successfully claiming, navigate to the details page
      navigate(`/admin/advocates/${id}`);
    } catch (error) {
      console.error("Error claiming application:", error);
      alert("Failed to claim application. Please try again.");
    }
  };

  return (
    <div className="advocate-management-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Advocate Management</h1>
      </div>

      {/* --- 1. Tab Navigation --- */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Applications ({pendingApplications.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          My Queue ({myQueue.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'verified' ? 'active' : ''}`}
          onClick={() => setActiveTab('verified')}
        >
          Verified Advocates ({verifiedAdvocates.length})
        </button>
      </div>

      {/* --- 2. Tab Content --- */}
      {loading && <p>Loading data...</p>}

      {/* --- Pending Applications Tab --- */}
      {!loading && activeTab === 'pending' && (
        <div className="admin-content-card">
          <h3 className="card-title">Pending Applications (Pool)</h3>
          <p className="card-subtitle">These applications are unassigned. Claim one to add it to your queue.</p>
          <div className="admin-table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Date Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingApplications.map((app) => (
                  <tr key={app.id}>
                    <td className="cell-name">{app.fullName}</td>
                    <td>{app.email}</td>
                    {/* Format timestamp if it exists */}
                    <td>{app.submittedAt?.toDate().toLocaleDateString()}</td>
                    <td className="actions-cell">
                      <button 
                        className="action-btn approve"
                        onClick={() => handleClaimAndReview(app.id)}
                      >
                        Claim & Review
                      </button>
                    </td>
                  </tr>
                ))}
                {pendingApplications.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-table-cell">No pending applications.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- My Queue Tab --- */}
      {!loading && activeTab === 'queue' && (
        <div className="admin-content-card">
          <h3 className="card-title">My Pending Queue</h3>
          <p className="card-subtitle">These applications are assigned to you. Please review them.</p>
          <div className="admin-table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Date Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myQueue.map((app) => (
                  <tr key={app.id}>
                    <td className="cell-name">{app.fullName}</td>
                    <td>{app.email}</td>
                    <td>{app.submittedAt?.toDate().toLocaleDateString()}</td>
                    <td className="actions-cell">
                      <button 
                        className="action-btn view-details"
                        onClick={() => handleViewDetails(app.id)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {myQueue.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-table-cell">Your queue is empty.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Verified Advocates Tab --- */}
      {!loading && activeTab === 'verified' && (
        <div className="admin-content-card">
          <div className="card-header-controls">
            <h3 className="card-title">Verified Advocates</h3>
            <div className="admin-search-bar">
              <img src={searchIcon} alt="Search" className="search-icon" />
              <input type="text" placeholder="Search advocates..." />
            </div>
          </div>
          <div className="admin-table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone Number</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {verifiedAdvocates.map((adv) => (
                  <tr key={adv.id}>
                    <td className="cell-name">{adv.firstName}</td>
                    <td>{adv.email}</td>
                    <td>{adv.phoneNumber}</td>
                    <td className="actions-cell">
                      <button 
                        className="action-btn suspend"
                        onClick={() => handleSuspend(adv.id)}
                      >
                        Suspend
                      </button>
                    </td>
                  </tr>
                ))}
                {verifiedAdvocates.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-table-cell">No verified advocates found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdvocateManagement;