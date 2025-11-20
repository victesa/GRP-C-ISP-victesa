import React from 'react';
import { useAuth } from '../hooks/useAuth'; // Make sure this path is correct
import { Navigate, Outlet } from 'react-router-dom';

const AdminRoute = () => {
  const { currentUser, userData, isLoading } = useAuth();

  // --- ADD THIS CONSOLE LOG ---
  console.log('--- AdminRoute Check ---');
  console.log('isLoading:', isLoading);
  console.log('currentUser:', currentUser?.email);
  console.log('userData:', userData);
  // --------------------------

  // 1. If we're still loading the user's data, show nothing
  if (isLoading) {
    console.log('Result: STILL LOADING...');
    return null; // Or a loading spinner
  }

  // 2. Check if user is logged in AND is an admin
  if (currentUser && userData?.isAdmin === true) {
    console.log('Result: ACCESS GRANTED (Admin)');
    return <Outlet />; // User is an admin, show the admin page
  }
  
  // 3. If they are logged in but NOT an admin, send to user dashboard
  if (currentUser) {
    console.log('Result: ACCESS DENIED (Non-admin user, redirecting to /dashboard)');
    return <Navigate to="/dashboard" replace />;
  }

  // 4. If they aren't logged in at all, send to login
  console.log('Result: ACCESS DENIED (Not logged in, redirecting to /login)');
  return <Navigate to="/login" replace />;
};

export default AdminRoute;