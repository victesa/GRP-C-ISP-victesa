import React, { useState } from 'react';
import './AdvocateStageDocsShared.css'; // We'll add new styles
import { useAuth } from '../hooks/useAuth';

// --- IMPORT YOUR ICONS HERE ---
import fileIcon from '../assets/icons/help.png'; // Placeholder icon
import trashIcon from '../assets/icons/help.png'; // Add a trash/delete icon

const AdvocateStageDocsShared = ({ transaction }) => {
  const { currentUser } = useAuth();
  
  // State for the *current* file being added
  const [currentFile, setCurrentFile] = useState(null);
  const [currentDocName, setCurrentDocName] = useState('');
  
  // State for the *list* of files to be uploaded
  const [stagedFiles, setStagedFiles] = useState([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  // When a user selects a file
  const handleFileSelect = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setCurrentFile(file);
      // Auto-fill the name, but allow user to change it
      setCurrentDocName(file.name); 
    }
  };

  // When user clicks "Add Document"
  const handleStageFile = (e) => {
    e.preventDefault();
    if (!currentFile) {
      setError('Please select a file first.');
      return;
    }
    if (!currentDocName) {
      setError('Please provide a name for the document.');
      return;
    }
    
    // Add the file and its name to the stagedFiles array
    setStagedFiles(prevFiles => [
      ...prevFiles, 
      { file: currentFile, name: currentDocName }
    ]);
    
    // Reset the inputs
    setCurrentFile(null);
    setCurrentDocName('');
    setError('');
    
    // Clear the file input visually (optional but good UX)
    document.getElementById('fileUpload').value = null;
  };

  // To remove a file from the staged list
  const handleRemoveStagedFile = (indexToRemove) => {
    setStagedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  // When user clicks the main "Upload and Share" button
  const handleShareAll = async (e) => {
    e.preventDefault();
    if (stagedFiles.length === 0) {
      setError('Please add at least one document to share.');
      return;
    }
    if (!currentUser) {
      setError('You must be logged in.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const token = await currentUser.getIdToken();
      const formData = new FormData();
      
      formData.append('transactionId', transaction.id);
      
      // Append all files and their corresponding names
      stagedFiles.forEach(stagedFile => {
        formData.append('files', stagedFile.file);
        formData.append('docNames', stagedFile.name);
      });

      // ---
      // --- THIS IS THE FIX: Point to your Python backend on port 5000 ---
      // ---
      const response = await fetch('http://localhost:5000/advocate-upload-docs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}` 
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong on the server.');
      }
      
      // Success! The parent component's onSnapshot will see the status change
      // and this component will unmount.
      setStagedFiles([]); // Clear the staged files on success
      
    } catch (err) {
      console.error("Error in upload process: ", err);
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Get the list of *already uploaded* documents to display
  // ---
  // --- FIX: Read from the correct field ---
  // ---
  const uploadedDocuments = transaction.advocateDocuments || [];
  // Removed `sharedDocuments` as it seems redundant with `advocateDocuments`

  return (
    <div className="advocate-docs-container">
      <h4>Share Documents</h4>
      <p>Add one or more documents, then click "Share All" to send them to the Buyer and Seller for verification.</p>
      
      {/* --- Staging Form --- */}
      <form className="doc-staging-form" onSubmit={handleStageFile}>
        <div className="form-group">
          <label htmlFor="docName">Document Name</label>
          <input 
            type="text" 
            id="docName"
            className="doc-name-input"
            placeholder="e.g. 'Draft Sale Agreement'"
            value={currentDocName}
            onChange={(e) => setCurrentDocName(e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="fileUpload">File</label>
          <input 
            type="file" 
            id="fileUpload"
            className="doc-upload-input"
            onChange={handleFileSelect}
          />
        </div>
        
        <button type="submit" className="add-doc-btn">
          Add Document to List
        </button>
      </form>

      {/* --- Staged Files List (for upload) --- */}
      {stagedFiles.length > 0 && (
        <div className="staged-list-section">
          <h5>To Be Uploaded:</h5>
          <ul className="doc-list staged">
            {stagedFiles.map((staged, index) => (
              <li key={index} className="doc-list-item">
                <img src={fileIcon} alt="doc" className="doc-icon" />
                <div className="doc-info">
                  <span className="doc-name">{staged.name}</span>
                  <span className="doc-timestamp">File: {staged.file.name}</span>
                </div>
                <button 
                  className="doc-remove-btn"
                  onClick={() => handleRemoveStagedFile(index)}
                >
                  <img src={trashIcon} alt="Remove" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- Main "Share All" Button --- */}
      <form className="doc-upload-form" onSubmit={handleShareAll}>
        <button 
          type="submit" 
          className="upload-doc-btn" 
          disabled={isUploading || stagedFiles.length === 0}
        >
          {isUploading ? 'Sharing...' : `Share All ${stagedFiles.length} Document(s)`}
        </button>
        {error && <p className="error-message">{error}</p>}
      </form>

      {/* --- List of ALREADY Uploaded Documents --- */}
      <div className="doc-list-section">
        <h5>Already Shared Documents</h5>
        {uploadedDocuments.length === 0 ? (
          <p className="empty-list-text">No documents have been shared yet.</p>
        ) : (
          <ul className="doc-list">
            {uploadedDocuments.map((doc, index) => (
              <li key={index} className="doc-list-item">
                <img src={fileIcon} alt="doc" className="doc-icon" />
                <div className="doc-info">
                  <span className="doc-name">{doc.name}</span>
                  <span className="doc-timestamp">
                    {/* Check if uploadedAt exists before trying to format it */}
                    {doc.uploadedAt ? `Uploaded ${doc.uploadedAt.toDate().toLocaleDateString()}` : 'Uploaded recently'}
                    {doc.uploadedBy?.name && ` by ${doc.uploadedBy.name}`}
                  </span>
                </div>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="doc-view-btn">
                  View
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdvocateStageDocsShared;