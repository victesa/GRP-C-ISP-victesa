import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import './PropertyRequests.css'; // New CSS file

const PropertyRequests = () => {
  const [pendingProperties, setPendingProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoading(true);
    
    // --- FIX 1: Query the correct collection "pendingProperties" ---
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

  const handleViewDetails = (id) => {
    // This will now navigate to the correct admin details page
    navigate(`/admin/properties/${id}`);
  };

  return (
    <div className="property-requests-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Property Verification Requests</h1>
      </div>

      <div className="admin-content-card">
        <h3 className="card-title">Pending Properties</h3>
        <p className="card-subtitle">These properties are awaiting verification from a Land Official.</p>
        
        <div className="admin-table-container">
          <table>
            <thead>
              <tr>
                <th>Parcel Number</th>
                <th>Location</th>
                <th>Owner ID</th>
                <th>Date Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="5" className="empty-table-cell">Loading...</td>
                </tr>
              )}
              {!isLoading && pendingProperties.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-table-cell">No pending property requests.</td>
                </tr>
              )}
              {!isLoading && pendingProperties.map((prop) => (
                <tr key={prop.id}>
                  <td className="cell-name">{prop.parcelNumber}</td>
                  <td>{prop.location}</td>
                  {/* --- FIX 2: Use 'uid' instead of 'ownerId' --- */}
                  <td className="cell-owner-id">{prop.uid}</td>
                  {/* --- FIX 3: Use 'submittedAt' instead of 'createdAt' --- */}
                  <td>{prop.submittedAt?.toDate().toLocaleDateString()}</td>
                  <td className="actions-cell">
                    <button 
                      className="action-btn view-details"
                      onClick={() => handleViewDetails(prop.id)}
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
    </div>
  );
};

export default PropertyRequests;