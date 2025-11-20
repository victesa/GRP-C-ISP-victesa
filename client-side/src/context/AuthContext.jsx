import React, { useContext, useState, useEffect, createContext } from 'react';
import { auth, db } from '../firebaseConfig';
// 1. Import signOut
import { onAuthStateChanged, signOut } from 'firebase/auth';
// Import all necessary firestore functions
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"; 

// Create the context
const AuthContext = createContext();

// EXPORT THE CONTEXT so the hook can use it
export { AuthContext };

// Create a hook (must be in a separate 'hooks/useAuth.js' file)
export function useAuth() {
  return useContext(AuthContext);
}

// Create the provider component
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [advocateStatus, setAdvocateStatus] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // 1. Get the user's document
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setUserData(data);

          if (data.isAdvocate === true) {
            setAdvocateStatus('approved');
          } else {
            
            // 2. Check for pending applications
            const appQuery = query(
              collection(db, "advocateApplications"), 
              where("email", "==", user.email)
            );
            
            const appSnapshot = await getDocs(appQuery);
            
            const pendingApp = appSnapshot.docs.find(
              (doc) => doc.data().status === 'pending'
            );

            if (pendingApp) {
              setAdvocateStatus('pending'); // They have a pending application
            } else {
              setAdvocateStatus('none'); // Not an advocate, no pending app
            }
          }
        } else {
          setUserData(null);
          setAdvocateStatus('none');
        }
      } else {
        setUserData(null);
        setAdvocateStatus(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // 2. Create the logout function
  function logout() {
    return signOut(auth);
  }

  const value = {
    currentUser,
    userData,
    advocateStatus,
    isLoading,
    logout // 3. Add the logout function to the value
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}