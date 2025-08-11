// frontend/src/components/ActionModal.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import '../styles/Modal.css';

const ActionModal = ({ isOpen, onClose, actionType, project, onConfirm }) => {
  const [inputValue, setInputValue] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => {
    // Pre-fill input for renaming
    if (actionType === 'rename' && project) {
      setInputValue(project.name);
    } else {
      setInputValue('');
    }
    setFile(null); // Reset file on open
  }, [isOpen, actionType, project]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (actionType === 'delete') {
      onConfirm(project._id);
    } else if (actionType === 'rename') {
      if (!inputValue.trim()) return toast.warn('Project name cannot be empty.');
      onConfirm(project._id, inputValue);
    } else if (actionType === 'upload') {
      if (!file) return toast.warn('Please select a file to upload.');
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => onConfirm(project._id, reader.result);
      reader.onerror = () => toast.error('Failed to read file.');
    }
    // No need to call onClose here as it's handled in the page component finally block
  };

  const getTitle = () => {
    switch (actionType) {
      case 'rename': return 'Rename Project';
      case 'upload': return 'Upload Thumbnail';
      case 'delete': return 'Delete Project';
      default: return 'Confirm Action';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{getTitle()}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {actionType === 'rename' && (
            <>
              <label htmlFor="renameInput">New Project Name</label>
              <input id="renameInput" type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} autoFocus />
            </>
          )}
          {actionType === 'upload' && (
            <>
              <label htmlFor="uploadInput">Select Image File</label>
              <input id="uploadInput" type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
            </>
          )}
          {actionType === 'delete' && (
            <p>Are you sure you want to delete the project "<strong>{project?.name}</strong>"? This action cannot be undone.</p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className={`btn ${actionType === 'delete' ? 'btn-danger' : 'btn-primary'}`} onClick={handleConfirm}>
            {actionType === 'delete' ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionModal;