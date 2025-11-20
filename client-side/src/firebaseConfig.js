// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // <-- 1. IMPORT getStorage

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBNotlNPJ-b1k3aFLQV6szrNkcN9Cq2kws",
  authDomain: "blockchain-a9608.firebaseapp.com",
  projectId: "blockchain-a9608",
  storageBucket: "blockchain-a9608.appspot.com", // Make sure this is the correct bucket
  messagingSenderId: "926736664925",
  appId: "1:926736664925:web:a7703cdde017349a47c0b4",
  measurementId: "G-8KGPH7SJV8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize all the services your app needs
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // <-- 2. INITIALIZE storage

// Export all the services you need
export { auth, db, storage }; // <-- 3. ADD storage TO THE EXPORT