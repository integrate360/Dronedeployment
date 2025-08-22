import React from 'react';
import { Button } from 'antd';
import { FiMove, FiRefreshCw, FiMousePointer } from 'react-icons/fi';
import '../styles/ProjectDetailPage.css'; // Reuse the styles

const MapHelpGuide = ({ onDismiss }) => {
  return (
    <div className="map-help-overlay">
      <div className="map-help-content">
        <h3>Flight Path Controls</h3>
        <ul>
          <li>
            <FiMousePointer className="help-icon" />
            <strong>Click on the map</strong> to start drawing a flight path.
          </li>
          <li>
            <FiMousePointer className="help-icon" />
            <strong>Click the first point</strong> to complete the area.
          </li>
          <li>
            <FiMove className="help-icon" />
            Use the <strong>center handle</strong> to move the entire area.
          </li>
          <li>
            <FiRefreshCw className="help-icon" />
            Use the <strong>top handle</strong> to rotate the flight path.
          </li>
        </ul>
        <Button type="primary" onClick={onDismiss}>
          Got It
        </Button>
      </div>
    </div>
  );
};

export default MapHelpGuide;