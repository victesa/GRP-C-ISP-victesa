import React, { useState, useEffect } from 'react';
import './PropertiesPage.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { db } from './firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// --- A new component to show a single property ---
const PropertyCard = ({ property }) => {
  return (
    <div className="property-card">
      <div className="property-card-header">
        <h4>{property.parcelNumber}</h4>
        {/* This will show "pending", "approved", or "rejected" */}
        <span className={`status-pill ${property.status}`}>{property.status}</span>
      </div>
      <p className="property-card-location">{property.location}</p>
    </div>
  );
};


const PropertiesPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // --- FIX: We need state for each collection ---
  const [pendingProps, setPendingProps] = useState([]);
  const [approvedProps, setApprovedProps] = useState([]);
  const [rejectedProps, setRejectedProps] = useState([]);
  
  // --- This will hold the combined list ---
  const [properties, setProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the user's properties from Firestore
  useEffect(() => {
    if (!currentUser) return;
    
    setIsLoading(true);

    // Helper function to create a doc array
    const getDocsFromSnapshot = (snapshot) => {
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    // --- 1. Query "pendingProperties" ---
    const qPending = query(
      collection(db, "pendingProperties"),
      where("uid", "==", currentUser.uid)
    );

    // --- 2. Query "properties" (approved) ---
    const qApproved = query(
      collection(db, "properties"),
      where("uid", "==", currentUser.uid)
    );

    // --- 3. Query "rejectedProperties" ---
    const qRejected = query(
      collection(db, "rejectedProperties"),
      where("uid", "==", currentUser.uid)
    );

    // --- Subscribe to all three queries ---
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      setPendingProps(getDocsFromSnapshot(snapshot));
    }, (error) => console.error("Error fetching pending properties: ", error));

    const unsubApproved = onSnapshot(qApproved, (snapshot) => {
      setApprovedProps(getDocsFromSnapshot(snapshot));
    }, (error) => console.error("Error fetching approved properties: ", error));

    const unsubRejected = onSnapshot(qRejected, (snapshot) => {
      setRejectedProps(getDocsFromSnapshot(snapshot));
    }, (error) => console.error("Error fetching rejected properties: ", error));

    // --- Return a cleanup function to unsubscribe from all ---
    return () => {
      unsubPending();
      unsubApproved();
      unsubRejected();
    };
  }, [currentUser]);

  // --- NEW: A separate effect to combine the lists ---
  // This runs whenever one of the three lists changes.
  useEffect(() => {
    // Combine all properties into one array
    setProperties([
      ...pendingProps,
      ...approvedProps,
      ...rejectedProps
    ]);
    
    // We can stop loading now that all lists are combined
    setIsLoading(false);

  }, [pendingProps, approvedProps, rejectedProps]);


  return (
    <div className="properties-page-container">
      {/* Page Header */}
      <div className="page-header">
        <h1>My Properties</h1>
        <button 
          className="add-property-btn"
          onClick={() => navigate('/add-property')}
        >
          + Add New Property
        </button>
      </div>

      {/* List of properties */}
      <div className="properties-list">
        {isLoading && <p>Loading properties...</p>}
        {!isLoading && properties.length === 0 && (
          <p>You have not added any properties yet.</p>
        )}
        {!isLoading && properties.map(prop => (
          <PropertyCard key={prop.id} property={prop} />
        ))}
      </div>
    </div>
  );
};

export default PropertiesPage;