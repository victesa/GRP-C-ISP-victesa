import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import './PropertyRequests.css';


const PropertyRequests = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingProperties, setPendingProperties] = useState([]);
  const [allProperties, setAllProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [ownerDetails, setOwnerDetails] = useState(null);
  const [adminDetails, setAdminDetails] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const navigate = useNavigate();

  // Fetch Pending Properties
  useEffect(() => {
    setIsLoading(true);
    
    const propertiesQuery = query(
      collection(db, "pendingProperties"), 
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(propertiesQuery, (snapshot) => {
      setPendingProperties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching property requests:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch All Properties
  useEffect(() => {
    const allPropertiesQuery = query(collection(db, "properties"));

    const unsubscribe = onSnapshot(allPropertiesQuery, (snapshot) => {
      const props = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllProperties(props);
      setFilteredProperties(props);
    }, (error) => {
      console.error("Error fetching all properties:", error);
    });

    return () => unsubscribe();
  }, []);

  // Search Filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProperties(allProperties);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allProperties.filter(prop => 
      prop.parcelNumber?.toLowerCase().includes(query) ||
      prop.location?.toLowerCase().includes(query) ||
      prop.titleNumber?.toLowerCase().includes(query) ||
      prop.tokenId?.toString().includes(query)
    );
    setFilteredProperties(filtered);
  }, [searchQuery, allProperties]);

  const handleViewDetails = (id) => {
    navigate(`/admin/properties/${id}`);
  };

  // Open Modal with Property Details
  const handleOpenModal = async (property) => {
    setSelectedProperty(property);
    setShowModal(true);
    setLoadingOwner(true);
    setLoadingAdmin(true);
    setLoadingHistory(true);
    setOwnerDetails(null);
    setAdminDetails(null);
    setTransactionHistory([]);

    // Fetch current owner details
    try {
      const ownerUid = property.uid || property.ownerUid;
      if (ownerUid) {
        const userDoc = await getDoc(doc(db, "users", ownerUid));
        if (userDoc.exists()) {
          setOwnerDetails(userDoc.data());
        }
      }
    } catch (error) {
      console.error("Error fetching owner details:", error);
    } finally {
      setLoadingOwner(false);
    }

    // Fetch admin who minted the property
    try {
      const adminUid = property.reviewedBy || property.mintedBy;
      if (adminUid) {
        const adminDoc = await getDoc(doc(db, "users", adminUid));
        if (adminDoc.exists()) {
          setAdminDetails(adminDoc.data());
        }
      }
    } catch (error) {
      console.error("Error fetching admin details:", error);
    } finally {
      setLoadingAdmin(false);
    }

    // Fetch transaction history involving this property
    try {
      const propertyId = property.id;
      const txQuery = query(
        collection(db, "transactions"),
        where("propertyId", "==", propertyId)
      );
      
      const txSnapshot = await getDocs(txQuery);
      const txData = txSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by creation date (newest first)
      txData.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });
      
      setTransactionHistory(txData);
    } catch (error) {
      console.error("Error fetching transaction history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedProperty(null);
    setOwnerDetails(null);
    setAdminDetails(null);
    setTransactionHistory([]);
  };

  const listToRender = activeTab === 'pending' ? pendingProperties : filteredProperties;

  return (
    <div className="property-requests-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Property Management</h1>
      </div>

      {/* TABS */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Verification ({pendingProperties.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Properties ({allProperties.length})
        </button>
      </div>

      <div className="admin-content-card">
        {/* Search Bar (Only for All Properties) */}
        {activeTab === 'all' && (
          <div className="search-bar-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search by Parcel Number, Location, Title Number, or Token ID..."
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
        )}

        {/* Title */}
        {activeTab === 'pending' ? (
          <>
            <h3 className="card-title">Pending Properties</h3>
            <p className="card-subtitle">These properties are awaiting verification from a Land Official.</p>
          </>
        ) : (
          <>
            <h3 className="card-title">All Properties</h3>
            <p className="card-subtitle">View all registered properties in the system. Click "View Details" to see ownership and transaction history.</p>
          </>
        )}
        
        <div className="admin-table-container">
          <table>
            <thead>
              <tr>
                <th>Parcel Number</th>
                <th>Location</th>
                {activeTab === 'all' && <th>Token ID</th>}
                <th>{activeTab === 'pending' ? 'Owner ID' : 'Current Owner'}</th>
                <th>Date {activeTab === 'pending' ? 'Submitted' : 'Registered'}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && activeTab === 'pending' && (
                <tr>
                  <td colSpan={activeTab === 'all' ? '6' : '5'} className="empty-table-cell">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && listToRender.length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'all' ? '6' : '5'} className="empty-table-cell">
                    {activeTab === 'pending' 
                      ? 'No pending property requests.' 
                      : (searchQuery ? 'No properties match your search.' : 'No properties found.')}
                  </td>
                </tr>
              )}
              {!isLoading && listToRender.map((prop) => (
                <tr key={prop.id}>
                  <td className="cell-name">{prop.parcelNumber}</td>
                  <td>{prop.location}</td>
                  {activeTab === 'all' && <td className="cell-token-id">#{prop.tokenId || 'N/A'}</td>}
                  <td className="cell-owner-id">
                    {activeTab === 'pending' 
                      ? prop.uid 
                      : (prop.ownerWallet?.substring(0, 10) + '...' || 'N/A')}
                  </td>
                  <td>
                    {activeTab === 'pending'
                      ? prop.submittedAt?.toDate().toLocaleDateString()
                      : prop.approvedAt?.toDate().toLocaleDateString() || 'N/A'}
                  </td>
                  <td className="actions-cell">
                    {activeTab === 'pending' ? (
                      <button 
                        className="action-btn view-details"
                        onClick={() => handleViewDetails(prop.id)}
                      >
                        Verify
                      </button>
                    ) : (
                      <button 
                        className="action-btn view-details"
                        onClick={() => handleOpenModal(prop)}
                      >
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {showModal && selectedProperty && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseModal}>✕</button>
            
            <h2 className="modal-title">Property Details</h2>
            
            <div className="modal-section">
              <h3>Property Information</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Parcel Number:</span>
                  <span className="detail-value">{selectedProperty.parcelNumber}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Location:</span>
                  <span className="detail-value">{selectedProperty.location}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Token ID:</span>
                  <span className="detail-value">#{selectedProperty.tokenId || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Blockchain Hash:</span>
                  <span className="detail-value monospace">
                    {selectedProperty.txHash?.substring(0, 20) + '...' || 'N/A'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Registered:</span>
                  <span className="detail-value">
                    {selectedProperty.approvedAt?.toDate().toLocaleString() || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-section">
              <h3>Minted By (Admin)</h3>
              {loadingAdmin ? (
                <p className="loading-text">Loading admin details...</p>
              ) : adminDetails ? (
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">
                      {adminDetails.firstName} 
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{adminDetails.email}</span>
                  </div>

                </div>
              ) : (
                <p className="no-data-text">Admin information not available</p>
              )}
            </div>

            <div className="modal-section">
              <h3>Current Owner</h3>
              {loadingOwner ? (
                <p className="loading-text">Loading owner details...</p>
              ) : ownerDetails ? (
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">
                      {ownerDetails.firstName} {ownerDetails.lastName || ''}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{ownerDetails.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">National ID:</span>
                    <span className="detail-value">{ownerDetails.idNumber || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Wallet Address:</span>
                    <span className="detail-value monospace">
                      {selectedProperty.ownerWallet || ownerDetails.walletAddress || 'N/A'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="no-data-text">Owner information not available</p>
              )}
            </div>

            {/* Transaction History */}
            <div className="modal-section">
              <h3>Transaction History</h3>
              {loadingHistory ? (
                <p className="loading-text">Loading transaction history...</p>
              ) : transactionHistory.length > 0 ? (
                <div className="history-list">
                  {transactionHistory.map((tx, index) => (
                    <div key={tx.id} className="history-item">
                      <div className="history-header">
                        <span className="history-number">#{index + 1}</span>
                        <span className="history-status">
                          <span className={`status-badge-small status-${tx.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                            {tx.status}
                          </span>
                        </span>
                      </div>
                      <div className="history-details">
                        <div className="history-detail-item">
                          <span className="history-label">Transaction ID:</span>
                          <span className="history-value monospace">{tx.id}</span>
                        </div>
                        <div className="history-detail-item">
                          <span className="history-label">From:</span>
                          <span className="history-value">{tx.seller?.name || 'N/A'}</span>
                        </div>
                        <div className="history-detail-item">
                          <span className="history-label">To:</span>
                          <span className="history-value">{tx.buyer?.name || 'N/A'}</span>
                        </div>
                        <div className="history-detail-item">
                          <span className="history-label">Date:</span>
                          <span className="history-value">
                            {tx.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                          </span>
                        </div>
                        {tx.txHash && (
                          <div className="history-detail-item">
                            <span className="history-label">Blockchain Hash:</span>
                            <span className="history-value monospace">
                              {tx.txHash.substring(0, 20)}...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data-text">No transaction history available for this property.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyRequests;
