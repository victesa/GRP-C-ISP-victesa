import React, { useState, useCallback } from 'react';
import './SignInForm.css';
import { signInWithEmailAndPassword } from "firebase/auth"; 
// --- 1. IMPORT FIRESTORE FUNCTIONS ---
import { auth, db } from './firebaseConfig.js'; 
import { getDoc, doc } from "firebase/firestore"; 
import { useNavigate, Link } from 'react-router-dom';

// SVG for the eye icon (show password)
const EyeIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="icon-eye" viewBox="0 0 20 20" fill="currentColor" {...props}>
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
);

// SVG for the loading spinner
const Spinner = (props) => (
    <svg className="icon-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}>
        <circle className="spinner-path-bg" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="spinner-path-fg" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export default function SignInForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [formError, setFormError] = useState(''); 
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    const navigate = useNavigate(); // For redirecting after login

    const validate = useCallback(() => {
        let isValid = true;
        setFormError(''); 

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            setEmailError('Please enter a valid email address.');
            isValid = false;
        } else {
            setEmailError('');
        }

        if (!password) {
            setPasswordError('Password is required.');
            isValid = false;
        } else {
            setPasswordError('');
        }

        return isValid;
    }, [email, password]);

    // --- 2. UPDATED handleSubmit FUNCTION ---
    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError(''); 

        if (validate()) {
            setIsLoading(true);
            try {
                // 1. Sign in the user
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // 2. Get the user's document from Firestore
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    
                    // 3. Check their role and redirect
                    if (userData.isAdmin) {
                        console.log("Admin user detected. Redirecting to admin dashboard.");
                        navigate('/admin/dashboard'); // Admin redirect
                    } else {
                        console.log("Regular user detected. Redirecting to user dashboard.");
                        navigate('/dashboard'); // Regular user redirect
                    }
                } else {
                    // This is a fallback in case the user exists in Auth but not Firestore
                    console.log("User doc not found, redirecting to user dashboard.");
                    navigate('/dashboard'); 
                }

            } catch (error) {
                console.error('Firebase Auth Error:', error.code, error.message);
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential':
                        setFormError('Invalid email or password.');
                        break;
                    case 'auth/invalid-email':
                        setEmailError('Please enter a valid email address.');
                        break;
                    case 'auth/user-disabled':
                        setFormError('Your account has been disabled.');
                        break;
                    default:
                        setFormError("An error occurred. Please try again.");
                }
            } finally {
                setIsLoading(false);
            }
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(prev => !prev);
    };

    const errorClass = (error) => error ? 'error-shake' : '';

    return (
        <div className="page-wrapper">
            <div className="form-container">
                
                <div className="form-header">
                    <h1 className="form-title">Welcome Back</h1>
                    <p className="form-subtitle">Please sign in to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="form-body" noValidate>
                    {/* General Form Error */}
                    {formError && <p className="error-message form-general-error">{formError}</p>}

                    {/* Email Input */}
                    <div className="input-group">
                        <label htmlFor="email" className="input-label">Email Address</label>
                        <input 
                            type="email" 
                            id="email" 
                            name="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`input-field ${emailError ? 'input-error' : ''} ${errorClass(emailError)}`}
                            placeholder="Enter your email" 
                            aria-label="Email Address"
                            aria-invalid={!!emailError}
                        />
                        {emailError && <p className="error-message">{emailError}</p>}
                    </div>

                    {/* Password Input */}
                    <div className="input-group">
                        <label htmlFor="password" className="input-label">Password</label>
                        <div className="password-input-wrapper">
                            <input 
                                type={showPassword ? 'text' : 'password'} 
                                id="password" 
                                name="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`input-field ${passwordError ? 'input-error' : ''} ${errorClass(passwordError)}`}
                                placeholder="Enter your password" 
                                aria-label="Password"
                                aria-invalid={!!passwordError}
                            />
                            <button 
                                type="button" 
                                className="password-toggle-btn" 
                                onClick={togglePasswordVisibility}
                            >
                                <EyeIcon /> 
                            </button>
                        </div>
                        {passwordError && <p className="error-message">{passwordError}</p>}
                    </div>

                    {/* "Remember me" checkbox is REMOVED */}
                    <div className="form-options">
                        <Link to="/forgot-password" className="link-forgot-password">Forgot password?</Link>
                    </div>

                    {/* Submit Button */}
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className={`btn-primary ${isLoading ? 'btn-loading' : ''} sign-in-button`}
                    >
                        <span id="buttonText">{isLoading ? 'Signing In...' : 'Sign In'}</span>
                        {isLoading && <Spinner />}
                    </button>

                    {/* "Sign up" link is now a React Router Link */}
                    <div className="signup-link-wrapper">
                        <p className="signup-text">
                            Don't have an account? 
                            <Link to="/register" className="link-signup">Sign up</Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}