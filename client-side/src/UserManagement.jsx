import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, query, onSnapshot, where, getDocs } from 'firebase/firestore';
import './UserManagement.css';


const UserManagement = () => {
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [userProperties, setUserProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Fetch All Users
  useEffect(() => {
    setIsLoading(true);
    
    const usersQuery = query(collection(db, "users"));

    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(users);
      setFilteredUsers(users);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Search Filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(allUsers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allUsers.filter(user => 
      user.firstName?.toLowerCase().includes(query) ||
      user.lastName?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.idNumber?.toLowerCase().includes(query) ||
      user.nationalId?.toLowerCase().includes(query) ||
      user.walletAddress?.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  }, [searchQuery, allUsers]);

  // Open Modal with User Details
  const handleOpenModal = async (user) => {
    setSelectedUser(user);
    setShowModal(true);
    setLoadingProperties(true);
    setUserProperties([]);

    // Fetch properties owned by this user
    try {
      const userId = user.id;
      const propsQuery = query(
        collection(db, "properties"),
        where("uid", "==", userId)
      );
      
      const propsSnapshot = await getDocs(propsQuery);
      const props = propsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setUserProperties(props);
    } catch (error) {
      console.error("Error fetching user properties:", error);
    } finally {
      setLoadingProperties(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setUserProperties([]);
  };

  // Helper to get user role badges
  const getUserRoles = (user) => {
    const roles = [];
    if (user.isAdmin) roles.push('Admin');
    if (user.isAdvocate) roles.push('Advocate');
    if (!user.isAdmin && !user.isAdvocate) roles.push('User');
    return roles;
  };

  return (
    <div className="user-management-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>User Management</h1>
        <p className="page-subtitle">View all registered users in the system</p>
      </div>

      <div className="admin-content-card">
        {/* Search Bar */}
        <div className="search-bar-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search by Name, Email, National ID, or Wallet Address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="users-stats">
          <div className="stat-item">
            <span className="stat-number">{allUsers.length}</span>
            <span className="stat-label">Total Users</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{allUsers.filter(u => u.isAdmin).length}</span>
            <span className="stat-label">Admins</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{allUsers.filter(u => u.isAdvocate).length}</span>
            <span className="stat-label">Advocates</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{filteredUsers.length}</span>
            <span className="stat-label">Showing</span>
          </div>
        </div>

        <div className="admin-table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>National ID</th>
                <th>Role</th>
                <th>Wallet Address</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="7" className="empty-table-cell">
                    Loading users...
                  </td>
                </tr>
              )}
              {!isLoading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-table-cell">
                    {searchQuery ? 'No users match your search.' : 'No users found.'}
                  </td>
                </tr>
              )}
              {!isLoading && filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className="cell-name">
                    {user.firstName} {user.lastName || ''}
                  </td>
                  <td>{user.email}</td>
                  <td className="cell-id">{user.idNumber || user.nationalId || 'N/A'}</td>
                  <td>
                    <div className="role-badges">
                      {getUserRoles(user).map((role, idx) => (
                        <span key={idx} className={`role-badge role-${role.toLowerCase()}`}>
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="cell-wallet">
                    {user.walletAddress 
                      ? user.walletAddress.substring(0, 10) + '...'
                      : 'Not connected'}
                  </td>
                  <td>
                    {user.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                  </td>
                  <td className="actions-cell">
                    <button 
                      className="action-btn view-details"
                      onClick={() => handleOpenModal(user)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* USER DETAILS MODAL */}
      {showModal && selectedUser && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseModal}>✕</button>
            
            <h2 className="modal-title">User Details</h2>

            {/* Personal Information */}
            <div className="modal-section">
              <h3>Personal Information</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Full Name:</span>
                  <span className="detail-value">
                    {selectedUser.firstName} {selectedUser.lastName || ''}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{selectedUser.email}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">National ID:</span>
                  <span className="detail-value">
                    {selectedUser.idNumber || selectedUser.nationalId || 'N/A'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Phone:</span>
                  <span className="detail-value">
                    {selectedUser.phoneNumber || 'N/A'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Wallet Address:</span>
                  <span className="detail-value monospace">
                    {selectedUser.walletAddress || 'Not connected'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Registered:</span>
                  <span className="detail-value">
                    {selectedUser.createdAt?.toDate().toLocaleString() || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Roles */}
            <div className="modal-section">
              <h3>System Roles</h3>
              <div className="role-badges-large">
                {getUserRoles(selectedUser).map((role, idx) => (
                  <span key={idx} className={`role-badge-large role-${role.toLowerCase()}`}>
                    {role}
                  </span>
                ))}
              </div>
            </div>

            {/* Properties Owned */}
            <div className="modal-section">
              <h3>Properties Owned</h3>
              {loadingProperties ? (
                <p className="loading-text">Loading properties...</p>
              ) : userProperties.length > 0 ? (
                <div className="properties-list">
                  {userProperties.map((property, index) => (
                    <div key={property.id} className="property-card">
                      <div className="property-header">
                        <span className="property-number">#{index + 1}</span>
                        <span className="property-token">Token #{property.tokenId}</span>
                      </div>
                      <div className="property-details">
                        <div className="property-detail-item">
                          <span className="property-label">Parcel Number:</span>
                          <span className="property-value">{property.parcelNumber}</span>
                        </div>
                        <div className="property-detail-item">
                          <span className="property-label">Location:</span>
                          <span className="property-value">{property.location}</span>
                        </div>
                        {property.approvedAt && (
                          <div className="property-detail-item">
                            <span className="property-label">Registered:</span>
                            <span className="property-value">
                              {property.approvedAt.toDate().toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data-text">This user does not own any properties yet.</p>
              )}
              {userProperties.length > 0 && (
                <p className="properties-summary">
                  Total properties owned: <strong>{userProperties.length}</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
