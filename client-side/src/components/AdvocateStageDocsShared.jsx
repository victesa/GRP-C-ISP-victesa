import React, { useState } from 'react';
import './AdvocateStageDocsShared.css'; 
import { useAuth } from '../hooks/useAuth';
import { ethers } from 'ethers'; 
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants';
import { parseContractError } from '../utils/errorParser';


// --- IMPORT YOUR ICONS HERE ---
import fileIcon from '../assets/icons/file.png'; 
import trashIcon from '../assets/icons/trash.png'; 


const AdvocateStageDocsShared = ({ transaction }) => {
  const { currentUser } = useAuth();
  
  // State for the *current* file being added
  const [currentFile, setCurrentFile] = useState(null);
  const [currentDocName, setCurrentDocName] = useState('');
  
  // State for the *list* of files to be uploaded
  const [stagedFiles, setStagedFiles] = useState([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  
  // New state to update button text without changing styles
  const [statusText, setStatusText] = useState('Sharing...');


  // When a user selects a file
  const handleFileSelect = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setCurrentFile(file);
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
    
    setStagedFiles(prevFiles => [
      ...prevFiles, 
      { file: currentFile, name: currentDocName }
    ]);
    
    setCurrentFile(null);
    setCurrentDocName('');
    setError('');
    document.getElementById('fileUpload').value = null;
  };


  const handleRemoveStagedFile = (indexToRemove) => {
    setStagedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };


  // --- MODIFIED HANDLER: Uploads -> Signs on Blockchain -> Finalizes ---
  const handleShareAll = async (e) => {
    e.preventDefault();
    if (stagedFiles.length === 0) return setError('Please add at least one document to share.');
    if (!currentUser) return setError('You must be logged in.');


    setIsUploading(true);
    setError('');
    setStatusText('Uploading files...'); // Initial text


    try {
      const token = await currentUser.getIdToken();
      const formData = new FormData();
      
      formData.append('transactionId', transaction.id);
      stagedFiles.forEach(stagedFile => {
        formData.append('files', stagedFile.file);
        formData.append('docNames', stagedFile.name);
      });


      // --- STEP 1: Upload Files & Get Hash (Backend) ---
      const uploadResponse = await fetch('http://localhost:5000/stage-advocate-docs', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });


      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadData.error || 'Upload failed.');


      const { docHash, documents } = uploadData;
      console.log('✅ Documents uploaded, hash generated:', docHash);


      // --- STEP 2: Sign on Blockchain (Frontend) ---
      setStatusText('Waiting for Signature...'); // Update text
      
      if (!window.ethereum) throw new Error("MetaMask is not installed.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Verify wallet
      const walletAddress = await signer.getAddress();
      if (walletAddress.toLowerCase() !== transaction.advocate.walletAddress.toLowerCase()) {
        throw new Error("MetaMask wallet does not match the assigned Advocate.");
      }


      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      // Call Smart Contract
      const tx = await contract.uploadDocuments(transaction.onChainTxId, docHash);
      
      setStatusText('Confirming on Chain...'); // Update text
      const receipt = await tx.wait();
      const uploadTxHash = receipt.hash; // ← NEW: Capture hash
      
      console.log(`✅ Document upload transaction mined: ${uploadTxHash}`);


      // --- STEP 3: Finalize & Notify (Backend) ---
      setStatusText('Finalizing...');
      
      const finalizeResponse = await fetch('http://localhost:5000/finalize-advocate-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          documents: documents, // URLs returned from Step 1
          docHash: docHash,
          uploadTxHash: uploadTxHash // ← NEW: Send hash to backend
        })
      });


      const finalizeData = await finalizeResponse.json();
      if (!finalizeResponse.ok) throw new Error(finalizeData.error || "Failed to finalize upload.");


      alert('✅ Documents shared successfully!');
      setStagedFiles([]); // Clear form on success
      window.location.reload(); // Refresh to show new documents
      
    } catch (err) {
      console.error("Error in upload process: ", err);
      // Check for contract error or standard error
      const msg = err.reason ? parseContractError(err) : err.message;
      setError(msg);
    } finally {
      setIsUploading(false);
      setStatusText('Sharing...'); // Reset text
    }
  };


  const uploadedDocuments = transaction.advocateDocuments || [];


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
          {/* Dynamically show status text, but keep exact style */}
          {isUploading ? statusText : `Share All ${stagedFiles.length} Document(s)`}
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
                    {doc.uploadedAt ? `Uploaded ${new Date(doc.uploadedAt.seconds * 1000).toLocaleDateString()}` : 'Uploaded recently'}
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
