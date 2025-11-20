import React, { useState } from 'react';
import './AdvocateRegistration.css';
import { useNavigate } from 'react-router-dom';
// Import auth from your firebase config
import { auth } from '../firebaseConfig'; 

// --- IMPORT YOUR ICONS HERE ---
import uploadIcon from '../assets/icons/upload-cloud.png'; // Use your real path
import checkIcon from '../assets/icons/check-white.png'; // Use your real path
import fileCheckIcon from '../assets/icons/file-check.png'; // You'll need an icon like this

// Reusable sub-component for a standard text input
const InputGroup = ({ label, type, placeholder, id, value, onChange }) => (
  <div className="input-group">
    <label htmlFor={id}>{label}</label>
    <input 
      type={type} 
      id={id} 
      name={id}
      placeholder={placeholder} 
      value={value}
      onChange={onChange}
      required
    />
  </div>
);

// Reusable sub-component for a text area
const TextAreaGroup = ({ label, placeholder, id, value, onChange }) => (
  <div className="input-group full-width">
    <label htmlFor={id}>{label}</label>
    <textarea 
      id={id} 
      name={id}
      placeholder={placeholder} 
      rows="3" 
      value={value}
      onChange={onChange}
      required
    />
  </div>
);

// Reusable sub-component for file upload
const FileUploadGroup = ({ label, id, accept, onChange, fileName }) => (
  <div className="file-upload-group">
    <label htmlFor={id}>{label}</label>
    <div className={`file-upload-box ${fileName ? 'has-file' : ''}`}>
      {fileName ? (
        <>
          <img src={fileCheckIcon} alt="File Selected" className="upload-icon" />
          <span className="file-name-display">{fileName}</span>
        </>
      ) : (
        <>
          <img src={uploadIcon} alt="Upload" className="upload-icon" />
          <span>Drag & drop or click to upload</span>
        </>
      )}
      <input 
        type="file" 
        id={id} 
        name={id}
        accept={accept} 
        onChange={onChange}
        required 
      />
    </div>
  </div>
);


// The main page component
const AdvocateRegistration = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    'cert-number': '',
    'full-name': '',
    'firm-name': '',
    'firm-reg': '',
    'email': '',
    'phone': '',
    'address': '',
  });
  
  const [fileData, setFileData] = useState({
    'cert-file': null,
    'lsk-id-file': null,
    'national-id-file': null,
    'profile-photo-file': null,
  });

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (files[0]) {
      setFileData(prev => ({ ...prev, [name]: files[0] }));
    }
  };

  //
  // --- THIS IS THE UPDATED SUBMIT HANDLER ---
  //
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Get the currently logged-in user
    const currentUser = auth.currentUser;
    if (!currentUser) {
        alert("You must be logged in to apply.");
        navigate('/login');
        return;
    }

    setIsLoading(true);

    // 2. Get the user's ID Token (for backend security)
    let idToken;
    try {
        idToken = await currentUser.getIdToken();
    } catch (error) {
        alert("Could not verify your session. Please log in again.");
        setIsLoading(false);
        return;
    }
    
    // 3. Create the FormData (this is correct)
    const data = new FormData();
    for (const key in formData) {
      data.append(key, formData[key]);
    }
    for (const key in fileData) {
      if (fileData[key]) {
        data.append(key, fileData[key]);
      }
    }

    try {
      // 4. Send the request to your NEW PYTHON BACKEND
      const response = await fetch('http://localhost:5000/submit-advocate-application', {
        method: 'POST',
        headers: {
            // 5. Add the Authorization header
            'Authorization': `Bearer ${idToken}`
        },
        body: data, 
      });

      const result = await response.json();

      if (response.ok) {
        alert('Application submitted successfully! You will be notified upon review.');
        navigate('/dashboard'); 
      } else {
        throw new Error(result.error || 'Failed to submit application.');
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="advocate-reg-page">
      <div className="page-header">
        <h1>Advocate Verification</h1>
        <p className="page-subtitle">
          Please provide your credentials for verification by the admin.
        </p>
      </div>

      <form className="reg-form-card" onSubmit={handleSubmit}>
        
        {/* --- Section 1: Professional Credentials --- */}
        <section className="form-section">
          <h3>Professional Credentials</h3>
          <div className="form-grid">
            <InputGroup
              label="Practicing Certificate Number"
              id="cert-number"
              placeholder="e.g., LSK/2025/12345"
              value={formData['cert-number']}
              onChange={handleTextChange}
            />
            <FileUploadGroup
              label="Copy of Practicing Certificate"
              id="cert-file"
              accept=".pdf,.jpg,.png"
              onChange={handleFileChange}
              fileName={fileData['cert-file']?.name}
            />
            <FileUploadGroup
              label="Copy of Law Society ID Card"
              id="lsk-id-file"
              accept=".pdf,.jpg,.png"
              onChange={handleFileChange}
              fileName={fileData['lsk-id-file']?.name}
            />
          </div>
        </section>

        {/* --- Section 2: Practice & Contact Information --- */}
        <section className="form-section">
          <h3>Practice & Contact Information</h3>
          <div className="form-grid">
            <InputGroup
              label="Full Legal Name"
              id="full-name"
              placeholder="e.g., Jane W. Doe"
              value={formData['full-name']}
              onChange={handleTextChange}
            />
            <InputGroup
              label="Name of Law Firm"
              id="firm-name"
              placeholder="e.g., Doe & Associates"
              value={formData['firm-name']}
              onChange={handleTextChange}
            />
            <InputGroup
              label="Law Firm Registration Number (Optional)"
              id="firm-reg"
              placeholder="e.g., BN/2025/54321"
              value={formData['firm-reg']}
              onChange={handleTextChange}
            />
            <InputGroup
              label="Professional Email Address"
              type="email"
              id="email"
              placeholder="e.g., j.doe@doelaw.com"
              value={formData['email']}
              onChange={handleTextChange}
            />
            <InputGroup
              label="Phone Number"
              type="tel"
              id="phone"
              placeholder="e.g., +254 700 000 000"
              value={formData['phone']}
              onChange={handleTextChange}
            />
            <TextAreaGroup
              label="Physical Office Address"
              id="address"
              placeholder="e.g., 123 Equity Towers, 5th Floor, Nairobi"
              value={formData['address']}
              onChange={handleTextChange}
            />
          </div>
        </section>

        {/* --- Section 3: Identity Verification --- */}
        <section className="form-section">
          <h3>Identity Verification</h3>
          <div className="form-grid">
            <FileUploadGroup
              label="National ID or Passport"
              id="national-id-file"
              accept=".pdf,.jpg,.png"
              onChange={handleFileChange}
              fileName={fileData['national-id-file']?.name}
            />
            <FileUploadGroup
              label="Profile Photo (Headshot)"
              id="profile-photo-file"
              accept="image/*"
              onChange={handleFileChange}
              fileName={fileData['profile-photo-file']?.name}
            />
          </div>
        </section>

        {/* --- Form Submission --- */}
        <div className="form-actions">
          <button 
            type="submit" 
            className="submit-application-btn" 
            disabled={isLoading}
          >
            <img src={checkIcon} alt="Submit" className="btn-icon" />
            {isLoading ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>

      </form>
    </div>
  );
};

export default AdvocateRegistration;