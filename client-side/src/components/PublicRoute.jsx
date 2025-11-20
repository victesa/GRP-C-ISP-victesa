import React from 'react';
// --- 1. FIX: Update the import path ---
import { useAuth } from '../hooks/useAuth'; 
import { Navigate, Outlet } from 'react-router-dom';

const PublicRoute = () => {
  const { currentUser } = useAuth();

  // 2. This redirect logic is commented out,
  // as we discussed, to allow the /setup-authenticator page
  // to work correctly after registration.
  /*
  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }
  */

  // This correctly shows the public page (Login or Register)
  return <Outlet />;
};

export default PublicRoute;