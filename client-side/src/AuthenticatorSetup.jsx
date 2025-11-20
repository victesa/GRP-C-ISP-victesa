import React, { useState, useRef, useEffect } from 'react';
import './AuthenticatorSetup.css';
import { FaUserCircle } from 'react-icons/fa';
import QRCode from 'react-qr-code';
import { encode } from 'hi-base32';
import { useAuth } from './hooks/useAuth';
import { useNavigate } from 'react-router-dom';

// Original asset imports
import AppleStoreBadge from './assets/apple_logo.png';
import PlayStoreBadge from './assets/google_play_logo.png';
import AppleStoreQR from './assets/apple_store_qr.png';
import GooglePlayQR from './assets/google_play_qr.png';

// --- 1. FIX: Point to your LOCAL Python server ---
const API_BASE_URL = 'http://localhost:8080';

const AuthenticatorSetup = () => {
    const [code, setCode] = useState(Array(6).fill(''));
    const [selectedStore, setSelectedStore] = useState('google');
    const [otpAuthUri, setOtpAuthUri] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const inputRefs = useRef([]);
    const verifyButtonRef = useRef(null);

    const { currentUser } = useAuth();
    const navigate = useNavigate(); 

    useEffect(() => {
        if (!currentUser) return;

        const uriKey = `otpAuthUri_${currentUser.uid}`;
        const secretKeyStorage = `otpSecret_${currentUser.uid}`;
        
        const savedUri = localStorage.getItem(uriKey);
        const savedSecret = localStorage.getItem(secretKeyStorage);

        if (savedUri && savedSecret) {
            setOtpAuthUri(savedUri);
            setSecretKey(savedSecret);
        } else {
            const buffer = new Uint8Array(20);
            window.crypto.getRandomValues(buffer);
            const newSecretKey = encode(buffer, true).replace(/=/g, '');

            const issuer = 'NexusApp'; 
            const userEmail = currentUser.email; 
            
            const newUri = `otpauth://totp/${issuer}:${userEmail}?secret=${newSecretKey}&issuer=${issuer}`;

            localStorage.setItem(uriKey, newUri);
            localStorage.setItem(secretKeyStorage, newSecretKey);
            setOtpAuthUri(newUri);
            setSecretKey(newSecretKey);
        }
    }, [currentUser]); 


    useEffect(() => {
        if (inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, []);

    const handleVerify = async () => {
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            setError('Code must be 6 digits.');
            return;
        }
        
        setError('');
        setIsLoading(true);

        try {
            // --- 2. FIX: Call the local /verify-otp endpoint ---
            const response = await fetch(`${API_BASE_URL}/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: fullCode,
                    secret: secretKey,
                    userId: currentUser.uid 
                })
            });

            const data = await response.json();

            if (data.isValid) {
                // SUCCESS!
                alert('Authenticator activated successfully!');
                
                const uriKey = `otpAuthUri_${currentUser.uid}`;
                const secretKeyStorage = `otpSecret_${currentUser.uid}`;
                localStorage.removeItem(uriKey);
                localStorage.removeItem(secretKeyStorage);
                
                // Navigate to the dashboard
                navigate('/dashboard');

            } else {
                setError(data.error || 'Invalid code. Please try again.');
                setCode(Array(6).fill(''));
                inputRefs.current[0].focus();
            }

        } catch (err) {
            console.error(err);
            setError('Verification failed. Is your local server running?');
        } finally {
            setIsLoading(false);
        }
    };

    // --- (Event Handlers: handleChange, handleKeyDown, handlePaste) ---
    // (These are unchanged from your code)
    const handleChange = (e, index) => {
        const value = e.target.value;
        if (!/^\d?$/.test(value)) return;
        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);
        if (value && index < 5) {
            inputRefs.current[index + 1].focus();
        } else if (value && index === 5) {
            verifyButtonRef.current.focus();
        }
    };
    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            e.preventDefault();
            inputRefs.current[index - 1].focus();
        } else if (e.key === 'Backspace' && code[index]) {
            const newCode = [...code];
            newCode[index] = '';
            setCode(newCode);
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!isLoading) handleVerify();
        }
    };
    const handlePaste = (e) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text');
        if (/^\d{6}$/.test(pasteData)) {
            setCode(pasteData.split(''));
            verifyButtonRef.current.focus();
        }
    };
    // --- (End of Event Handlers) ---

    if (!currentUser || !otpAuthUri) {
        return (
            <div id="authenticator-setup-screen">
                <div className="authenticator-setup-container">
                    <p>Loading Security Setup...</p>
                </div>
            </div>
        );
    }

    return (
        <div id="authenticator-setup-screen">
          <div className="authenticator-setup-container">
            <header className="header">
               <div className="logo">
                 <span className="logo-dot"></span>
                 <span className="logo-text">Connect Account</span>
               </div>
               <div className="user-icon">
                 <FaUserCircle />
               </div>
            </header>

            <main className="main-content">
              
              <h1 className="main-title">Secure Your Account with Authenticator App</h1>
              <p className="subtitle">Follow these simple steps to add an extra layer to security.</p>

              <div className="steps-container">

                {/* --- Step 1 Column --- */}
                <div className="step-column">
                    <div className="step-number step-1-color">1</div>
                    <h2 className="step-title">Download the App</h2>
                    <div className="app-badges">
                        <img 
                          src={AppleStoreBadge} 
                          alt="App Store" 
                          className={`app-badge ${selectedStore === 'apple' ? 'active' : ''}`}
                          onClick={() => setSelectedStore('apple')}
                        />
                        <img 
                          src={PlayStoreBadge} 
                          alt="Google Play" 
                          className={`app-badge ${selectedStore === 'google' ? 'active' : ''}`}
                          onClick={() => setSelectedStore('google')}
                        />
                    </div>
                    
                    {!selectedStore && (
                      <p className="step-description">Select your app store to see the QR code.</p>
                    )}
                    {selectedStore === 'apple' && (
                      <>
                        <p className="step-description">Scan to download from the App Store.</p>
                        <img src={AppleStoreQR} alt="Apple Store QR Code" className="download-qr" />
                      </>
                    )}
                    {selectedStore === 'google' && (
                      <>
                        <p className="step-description">Scan to download from Google Play.</p>
                        <img src={GooglePlayQR} alt="Google Play QR Code" className="download-qr" />
                      </>
                    )}
                </div>

                {/* --- Step 2 Column --- */}
                <div className="step-column">
                  <div className="step-number step-2-color">2</div>
                  <h2 className="step-title">Scan QR Code</h2>
                  <div className="qr-scan-area">
                    {otpAuthUri ? (
                        <QRCode value={otpAuthUri} size={160} bgColor="#ffffff" fgColor="#000000" level="L" />
                    ) : (
                        <p>Loading QR Code...</p>
                    )}
                  </div>
                  <p className="step-description">Open your Authenticator app and scan this code.</p>
                </div>

                {/* --- Step 3 Column --- */}
                <div className="step-column">
                  <div className="step-number step-3-color">3</div>
                  <h2 className="step-title">Enter Code</h2>
                  <p className="step-description">Enter the 6-digit code</p>
                  
                  <div className="code-inputs" onPaste={handlePaste}>
                    {code.map((digit, index) => (
                      <input
                        type="tel"
                        maxLength="1"
                        className="code-input"
                        key={index}
                        value={digit}
                        ref={(el) => (inputRefs.current[index] = el)}
                        onChange={(e) => handleChange(e, index)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        disabled={isLoading}
                      />
                    ))}
                  </div>
                  
                  {error && <p className="otp-error-message">{error}</p>}
                  
                  <button
                    className="verify-button"
                    onClick={handleVerify}
                    ref={verifyButtonRef}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Verifying...' : 'Verify & Activate'}
                  </button>
                  <p className="button-hint">The app will generate a code. Enter it here.</p>
                </div>

              </div>
            </main>
          </div>
        </div>
    );
};

export default AuthenticatorSetup;