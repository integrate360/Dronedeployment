// frontend/src/components/DrawingControls.jsx
import React from 'react';
import { Button } from 'antd';
import { FiEdit, FiTrash2, FiCheckCircle } from 'react-icons/fi';
import '../styles/ProjectDetailPage.css'; // We'll reuse styles from here

const DrawingControls = ({
  isDrawing,
  onToggleDrawing,
  onClear,
  hasFlightPath,
}) => {
  return (
    <div className="panel-section drawing-controls">
      <div className="section-title">
        <h4>Flight Path</h4>
      </div>
      <p className="section-sub-text">
        {isDrawing
          ? 'Click on the map to add points. Click the first point to finish.'
          : 'Use the controls below to draw a flight area.'}
      </p>
      <div className="drawing-buttons">
        <Button
          type={isDrawing ? 'default' : 'primary'}
          icon={isDrawing ? <FiCheckCircle /> : <FiEdit />}
          onClick={() => onToggleDrawing(!isDrawing)}
        >
          {isDrawing ? 'Finish Drawing' : 'Draw Area'}
        </Button>
        <Button
          danger
          type="text"
          icon={<FiTrash2 />}
          onClick={onClear}
          disabled={!hasFlightPath && !isDrawing}
        >
          Clear Area
        </Button>
      </div>
    </div>
  );
};

export default DrawingControls;