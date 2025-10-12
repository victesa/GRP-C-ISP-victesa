import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  const { currentUser } = useAuth();

  // If user is not logged in, redirect to login page
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If user IS logged in, show the component
  // (e.g., <Layout />, <AdminLayout />, or <AuthenticatorSetup />)
  return <Outlet />; 
};

export default ProtectedRoute;// Updated Oct 12
