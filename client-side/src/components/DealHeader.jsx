import React from 'react';
import './DealHeader.css';

// --- IMPORT YOUR ICONS HERE ---
import checkIcon from '../assets/icons/check-white.png'; // A white checkmark

// This is the corrected stepper component
const DealStepper = ({ currentStage }) => {
  
  const stages = [
    'Initiated', 
    'Awaiting Signatures', 
    'Docs Shared', 
    'Awaiting Verification',
    'Verified', 
    'Under Review', 
    'Finalized'
  ];

  // ---
  // --- THIS IS THE FIX: Make the search case-insensitive ---
  // ---
  const currentIndex = stages.findIndex(stage => 
    stage.toLowerCase() === (currentStage || '').toLowerCase()
  );
  // ---

  const getAlignment = (index) => {
    if (index === stages.length - 1) {
      return 'end';
    }
    return 'start';
  };

  return (
    <div className="stepper-wrapper">
      
      {/* 1. Top Row: Icons and Labels */}
      <div className="stepper-stages-row">
        {stages.map((stage, index) => {
          
          let state = 'pending'; 
          if (index < currentIndex) {
            state = 'completed';
          } else if (index === currentIndex) {
            state = 'current';
          }

          return (
            <div 
              key={stage} 
              className="stage-item" 
              data-align={getAlignment(index)}
              data-state={state}
            >
              {(state === 'completed' || state === 'current') && (
                <div className="step-icon">
                  {state === 'completed' && <img src={checkIcon} alt="Completed" />}
                </div>
              )}
              <span className="step-label">{stage}</span>
            </div>
          );
        })}
      </div>

      {/* 2. Bottom Row: The Progress Bar */}
      <div className="stepper-bar-row">
        {stages.map((stage, index) => {
          let state = 'pending'; 
          if (index < currentIndex) {
            state = 'completed';
          } else if (index === currentIndex) {
            state = 'current';
          }
          
          return (
            <div key={stage} className="bar-segment" data-state={state}></div>
          );
        })}
      </div>
    </div>
  );
};


// --- 2. THE MAIN COMPONENT ---
const DealHeader = ({ currentStage }) => {
  const activeTab = 'Overview';

  return (
    <div className="deal-header-container">
      
      {/* 3. Stages Card */}
      <div className="stages-card">
        <div className="stages-header">
          <h3 className="stages-title">Stages</h3>
          <button className="move-stage-btn">Move to Next Stage</button>
        </div>
        {/* Pass the prop to the stepper */}
        <DealStepper currentStage={currentStage} />
      </div>
    </div>
  );
};

export default DealHeader;