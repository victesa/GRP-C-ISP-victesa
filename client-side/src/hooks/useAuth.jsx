import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext'; // Import the context

// Create and export the hook
export function useAuth() {
  return useContext(AuthContext);
}