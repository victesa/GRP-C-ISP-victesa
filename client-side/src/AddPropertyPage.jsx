import React, { useState } from 'react';
import './AddPropertyPage.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// --- IMPORT YOUR ICONS HERE ---
import uploadIcon from './assets/icons/upload-cloud.png';
import checkIcon from './assets/icons/check-white.png';
import fileCheckIcon from './assets/icons/file-check.png'; 

// --- Kenya Counties List (All 47 official counties) ---
const KENYA_COUNTIES = [
  "Mombasa", "Kwale", "Kilifi", "Tana River", "Lamu", "Taita-Taveta", "Taita/Taveta",
  "Garissa", "Wajir", "Mandera", "Marsabit", "Isiolo", "Meru", "Tharaka-Nithi", 
  "Tharaka Nithi", "Embu", "Kitui", "Machakos", "Makueni", "Nyandarua", "Nyeri", 
  "Kirinyaga", "Murang'a", "Muranga", "Kiambu", "Turkana", "West Pokot", "Samburu", 
  "Trans Nzoia", "Uasin Gishu", "Elgeyo-Marakwet", "Elgeyo/Marakwet", "Elgeyo Marakwet",
  "Nandi", "Baringo", "Laikipia", "Nakuru", "Narok", "Kajiado", "Kericho", "Bomet", 
  "Kakamega", "Vihiga", "Bungoma", "Busia", "Siaya", "Kisumu", "Homa Bay", "Migori", 
  "Kisii", "Nyamira", "Nairobi"
];

// --- Reusable Input Components ---
const InputGroup = ({ label, type, placeholder, id, value, onChange }) => (
  <div className="input-group">
    <label htmlFor={id}>{label}</label>
    <input 
      type={type} id={id} name={id} placeholder={placeholder} 
      value={value} onChange={onChange} required 
    />
  </div>
);

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
        type="file" id={id} name={id} accept={accept} 
        onChange={onChange} required 
      />
    </div>
  </div>
);
// --- End of Reusable Components ---

const AddPropertyPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    'parcelNumber': '',
    'location': '',
  });
  
  const [fileData, setFileData] = useState({
    'titleDeedFile': null,
    'surveyMapFile': null,
  });

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFileData(prev => ({ ...prev, [name]: files[0] }));
  };

  // --- Validation Function to Check for Kenya Counties ---
  const validateKenyanLocation = (location) => {
    if (!location || location.trim().length === 0) {
      return false;
    }

    const locationLower = location.toLowerCase();
    
    // Check if any Kenyan county is mentioned in the location
    const hasKenyanCounty = KENYA_COUNTIES.some(county => 
      locationLower.includes(county.toLowerCase())
    );

    return hasKenyanCounty;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError("You must be logged in to add a property.");
      return;
    }

    // --- Validate Kenya Location ---
    if (!validateKenyanLocation(formData.location)) {
      setError("Invalid location. Please enter a valid Kenyan location with a county name (e.g., Kitengela, Kajiado County).");
      return;
    }

    setIsLoading(true);
    setError('');

    // --- Get the user's auth token ---
    let idToken;
    try {
      idToken = await currentUser.getIdToken();
    } catch (authError) {
      setError("Session expired. Please log in again.");
      setIsLoading(false);
      return;
    }

    const data = new FormData();
    data.append('parcelNumber', formData.parcelNumber);
    data.append('location', formData.location);
    data.append('titleDeedFile', fileData.titleDeedFile);
    data.append('surveyMapFile', fileData.surveyMapFile);

    try {
      const response = await fetch('http://localhost:5000/add-property', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: data, 
      });

      const result = await response.json();

      if (response.ok) {
        alert('Property submitted for verification!');
        navigate('/properties');
      } else {
        throw new Error(result.error || 'Failed to submit property.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="add-property-page">
      <div className="page-header">
        <h1>Add a New Property</h1>
        <p className="page-subtitle">
          Submit your property details for verification by a Land Official.
        </p>
      </div>

      <form className="reg-form-card" onSubmit={handleSubmit}>
        
        {/* --- Section 1: Property Details --- */}
        <section className="form-section">
          <h3>Property Details</h3>
          <div className="form-grid">
            <InputGroup
              label="Land Parcel Number (Title No.)"
              id="parcelNumber"
              type="text"
              placeholder="e.g., KAJIADO/KITENGELA/12345"
              value={formData['parcelNumber']}
              onChange={handleTextChange}
            />
            <InputGroup
              label="Location"
              id="location"
              type="text"
              placeholder="e.g., Kitengela, Kajiado County"
              value={formData['location']}
              onChange={handleTextChange}
            />
          </div>
        </section>

        {/* --- Section 2: Documents --- */}
        <section className="form-section">
          <h3>Verification Documents</h3>
          <div className="form-grid">
            <FileUploadGroup
              label="Copy of Title Deed"
              id="titleDeedFile"
              accept=".pdf"
              onChange={handleFileChange}
              fileName={fileData['titleDeedFile']?.name}
            />
            <FileUploadGroup
              label="Copy of Survey Map"
              id="surveyMapFile"
              accept=".pdf,.jpg,.png"
              onChange={handleFileChange}
              fileName={fileData['surveyMapFile']?.name}
            />
          </div>
        </section>

        {/* --- Form Submission --- */}
        <div className="form-actions">
          {error && <p className="form-error-message">{error}</p>}
          <button 
            type="submit" 
            className="submit-application-btn" 
            disabled={isLoading}
          >
            {isLoading ? 'Submitting...' : 'Submit for Verification'}
          </button>
        </div>

      </form>
    </div>
  );
};

export default AddPropertyPage;
