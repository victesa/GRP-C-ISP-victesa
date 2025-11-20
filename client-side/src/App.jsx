import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// --- Auth Guards ---
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import AdminRoute from './components/AdminRoute'; 

// --- Auth Pages ---
import SignInForm from './SignInForm';
import SignUpForm from './SignUpForm';
import AuthenticatorSetup from './AuthenticatorSetup';

// --- User Layout and Pages ---
import Layout from './Layout';
import Dashboard from './Dashboard';
import TransactionsPage from './TransactionsPage';
import AdvocateDashboard from './AdvocateDashboard';
import TransactionDetailPage from './TransactionDetailPage';
import AdvocateTransactionDetailPage from './AdvocateTransactionDetailPage'; // <-- 1. IMPORT IT
import AdvocateRegistration from './components/AdvocateRegistration';
import CreateTransaction from './components/CreateTransaction';
import PropertiesPage from './PropertiesPage';
import AddPropertyPage from './AddPropertyPage';

// --- Admin Layout and Pages ---
import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard'; 
import AdvocateManagement from './AdvocateManagement';
import AdvocateApplicationDetails from './AdvocateApplicationDetails';
import PropertyRequests from './PropertyRequests';
import PropertyReviewPage from './PropertyReviewPage';
import AdminTransactionRequests from './AdminTransactionRequests';
import AdminTransactionDetailPage from './AdminTransactionDetailPage';
import LogViewer from './components/LogViewer';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* --- Public Routes (Login, Register) --- */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<SignInForm />} />
          <Route path="/register" element={<SignUpForm />} />
        </Route>

        {/* --- Protected User Routes --- */}
        <Route element={<ProtectedRoute />}>
          
          <Route path="setup-authenticator" element={<AuthenticatorSetup />} />

          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<LogViewer />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="advocate-transactions" element={<AdvocateDashboard />} />
            <Route path="transactions/:transactionId" element={<TransactionDetailPage />} />
            
            {/* --- 2. ADD THE NEW ADVOCATE DETAIL ROUTE --- */}
            <Route path="advocate/transactions/:transactionId" element={<AdvocateTransactionDetailPage />} />
            
            <Route path="be-an-advocate" element={<AdvocateRegistration />} />
            <Route path="create-transaction" element={<CreateTransaction />} />
            <Route path="properties" element={<PropertiesPage />} />
            <Route path="add-property" element={<AddPropertyPage />} />
            <Route path="help" element={<div style={{padding: '30px'}}><h1>Help</h1></div>} />
            <Route path="settings" element={<div style={{padding: '30px'}}><h1>Settings</h1></div>} />
          </Route>
        
        </Route>

        {/* --- Protected Admin Routes --- */}
        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminLayout />}> 
            <Route index element={<Navigate to="dashboard" replace />} /> 
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="advocates" element={<AdvocateManagement />} />
            <Route path="advocates/:applicationId" element={<AdvocateApplicationDetails />} />
            <Route path="properties" element={<PropertyRequests />} />
            <Route path="properties/:propertyId" element={<PropertyReviewPage />} />
            <Route path="transactions" element={<AdminTransactionRequests />} />
            <Route path="transactions/:transactionId" element={<AdminTransactionDetailPage />} />
            <Route path="users" element={<div style={{padding: '30px'}}><h1>User Management</h1></div>} />
            <Route path="help" element={<div style={{padding: '30px'}}><h1>Admin Help</h1></div>} />
            <Route path="settings" element={<div style={{padding: '30px'}}><h1>Admin Settings</h1></div>} />
          </Route>
        </Route>
        
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;