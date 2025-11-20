import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext'; // 1. IMPORT

// Assuming your other CSS files are imported in App.js or similar
// import './index.css'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* 2. WRAP YOUR APP */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);