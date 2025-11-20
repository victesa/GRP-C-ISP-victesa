import React, { useState, useCallback } from 'react';
import './SignUpForm.css';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth"; 
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from './firebaseConfig'; 
import { ethers } from 'ethers';

const RegisterPage = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [walletAddress, setWalletAddress] = useState('');
    const [formData, setFormData] = useState({
      idNumber: '',
      firstName: '',
      yearOfBirth: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: ''
    });

    const [errors, setErrors] = useState({});
    const [firebaseError, setFirebaseError] = useState('');
    const [isLoading, setIsLoading] = useState(false); 
    const [showInstall, setShowInstall] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
      if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: null }));
      }
    };

    const connectWallet = async () => {
        setFirebaseError('');
        setShowInstall(false);

        if (!window.ethereum) {
            setFirebaseError("Please install MetaMask to use this platform.");
            setShowInstall(true); // Show the install button
            return;
        }
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            setWalletAddress(address); 
            setFirebaseError(''); 
            setShowInstall(false);
        } catch (err) {
            console.error(err);
            setFirebaseError("Failed to connect wallet. Please try again.");
        }
    };

    const validateStep = useCallback(() => {
        setErrors({});
        let newErrors = {};
        let isValid = true;
        
        if (currentStep === 1) {
            if (!walletAddress) {
                setFirebaseError("Please connect your MetaMask wallet to proceed.");
                isValid = false;
            }
            if (!formData.idNumber) {
                newErrors.idNumber = "ID Number is required.";
                isValid = false;
            }
            if (!formData.firstName) {
                newErrors.firstName = "First Name is required.";
                isValid = false;
            }
            if (!formData.yearOfBirth) {
                newErrors.yearOfBirth = "Year of Birth is required.";
                isValid = false;
            }
        } else if (currentStep === 2) {
            if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
                newErrors.email = "A valid email is required.";
                isValid = false;
            }
            if (!formData.phoneNumber) {
                newErrors.phoneNumber = "Phone number is required.";
                isValid = false;
            }
        } else if (currentStep === 3) {
            if (!formData.password || formData.password.length < 6) {
                newErrors.password = "Password must be at least 6 characters.";
                isValid = false;
            }
            if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = "Passwords do not match.";
                isValid = false;
            }
        }
        setErrors(newErrors);
        return isValid;
    }, [currentStep, formData, walletAddress]);
    
    const handleNext = async (e) => {
      e.preventDefault();
      setFirebaseError('');
      
      if (!validateStep()) {
        return; 
      }
      
      if (currentStep === 3) {
        setIsLoading(true);
        let userCredential; 
        try {
          userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          const user = userCredential.user;
          
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            idNumber: formData.idNumber,
            firstName: formData.firstName,
            yearOfBirth: formData.yearOfBirth,
            email: formData.email,
            phoneNumber: formData.phoneNumber,
            createdAt: serverTimestamp(),
            isAdvocate: false,
            isAdmin: false,
            walletAddress: walletAddress 
          });

          navigate('/dashboard'); 
          
        } catch (error) {
          console.error("Registration Error:", error.code, error.message);
          if (userCredential) {
            await deleteUser(userCredential.user);
            console.log("Rolled back: Deleted Firebase Auth user.");
          }
          if (error.code === 'auth/email-already-in-use') {
            setErrors({ email: "This email is already taken." });
            setCurrentStep(2);
          } else {
            setFirebaseError(error.message);
          }
        } finally {
          setIsLoading(false);
        }
        return;
      }
      
      if (currentStep < 3) { 
        setCurrentStep(currentStep + 1);
      }
    };

    const handleBack = (e) => {
        e.preventDefault();
        if (currentStep > 1) {
          setCurrentStep(currentStep - 1);
        }
    };

    const steps = ['Validate', 'Contact', 'Password'];

    const generateYearOptions = () => {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 18;
        const endYear = 1900;
        const years = [];
        for (let year = startYear; year >= endYear; year--) {
          years.push(<option key={year} value={year}>{year}</option>);
        }
        return years;
    };

    return (
        <div className="register-page">
            <header className="header">
                <div className="header-logo-container">
                    <div className="logo-ecitizen">Nexus</div>
                </div>
            </header>

            <main className="main-content">
                <div className="registration-container">
                    <h2 className="title">Register</h2>
                    <p className="subtitle">Kenyan Citizen</p>

                    <div className="progress-stepper">
                        {steps.map((stepName, index) => (
                            <React.Fragment key={index}>
                                <div className={`step ${currentStep === index + 1 ? 'active' : ''}`}>
                                    <div className="circle"></div>
                                    <span className="label">{stepName}</span>
                                </div>
                                {index < steps.length - 1 && <div className="line"></div>}
                            </React.Fragment>
                        ))}
                    </div>

                    {firebaseError && <p className="firebase-error">{firebaseError}</p>}
                    
                    {showInstall && (
                        <div className="form-group">
                            <a 
                                href="https://metamask.io/download/" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="btn btn-install"
                            >
                                Click Here to Install MetaMask
                            </a>
                        </div>
                    )}
                    
                    <form className="registration-form" onSubmit={handleNext}>
                        {currentStep === 1 && (
                            <>
                                <div className="form-group">
                                    <label>Wallet Address <span className="required">*</span></label>
                                    <button 
                                        type="button" 
                                        className={`btn btn-wallet ${walletAddress ? 'connected' : ''}`} 
                                        onClick={connectWallet}
                                    >
                                        {walletAddress 
                                            ? `Connected: ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` 
                                            : 'Connect MetaMask Wallet'
                                        }
                                    </button>
                                </div>
                                
                                <div className="form-group">
                                    <label htmlFor="id-number">ID Number <span className="required">*</span></label>
                                    <input type="text" id="id-number" name="idNumber" required 
                                      value={formData.idNumber} onChange={handleChange} />
                                    {errors.idNumber && <p className="error-message">{errors.idNumber}</p>}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="first-name">First Name as per your ID <span className="required">*</span></label>
                                    <input type="text" id="first-name" name="firstName" required 
                                      value={formData.firstName} onChange={handleChange} />
                                    {errors.firstName && <p className="error-message">{errors.firstName}</p>}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="year-of-birth">Year of Birth <span className="required">*</span></label>
                                    <select id="year-of-birth" name="yearOfBirth" required 
                                      value={formData.yearOfBirth} onChange={handleChange}>
                                        <option value="" disabled>Year of Birth</option>
                                        {generateYearOptions()} 
                                    </select>
                                    {errors.yearOfBirth && <p className="error-message">{errors.yearOfBirth}</p>}
                                </div>
                            </>
                        )}
                        {currentStep === 2 && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="email">Email Address <span className="required">*</span></label>
                                    <input type="email" id="email" name="email" required 
                                      placeholder="e.g., yourname@example.com"
                                      value={formData.email} onChange={handleChange} />
                                    {errors.email && <p className="error-message">{errors.email}</p>}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="phone-number">Phone Number <span className="required">*</span></label>
                                    <input type="tel" id="phone-number" name="phoneNumber" required 
                                      placeholder="e.g., +2547XXXXXXXX"
                                      value={formData.phoneNumber} onChange={handleChange} />
                                    {errors.phoneNumber && <p className="error-message">{errors.phoneNumber}</p>}
                                </div>
                            </>
                        )}
                        {currentStep === 3 && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="password">Password <span className="required">*</span></label>
                                    <input type="password" id="password" name="password" required 
                                      placeholder="Enter your password"
                                      value={formData.password} onChange={handleChange} />
                                    {errors.password && <p className="error-message">{errors.password}</p>}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="confirm-password">Confirm Password <span className="required">*</span></label>
                                    <input type="password" id="confirm-password" name="confirmPassword" required 
                                      placeholder="Confirm your password"
                                      value={formData.confirmPassword} onChange={handleChange} />
                                    {errors.confirmPassword && <p className="error-message">{errors.confirmPassword}</p>}
                                </div>
                            </>
                        )}
                        
                        <div className="form-actions">
                            {currentStep > 1 && (
                                <button type="button" className="btn btn-back" onClick={handleBack}>
                                    Back
                                </button>
                            )}
                            {currentStep < 3 && (
                                <button type="submit" className="btn btn-next" disabled={isLoading}>
                                    Next
                                </button>
                            )}
                            {currentStep === 3 && (
                                <button type="submit" className="btn btn-submit" disabled={isLoading}>
                                    {isLoading ? 'Registering...' : 'Register'}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default RegisterPage;