// frontend/src/components/DroneAnimation.jsx
import React from 'react';

const DroneAnimation = ({ status, altitude }) => {
  if (!status) return null;

  return (
    <div className="drone-animation-overlay">
      <div className="drone-animation">
        <div className="drone-icon">🚁</div>
        <div className="animation-status">
          {status === 'takeoff' ? 'Taking off...' : 'Landing...'}
        </div>
        <div className="altitude-display">
          Altitude: {altitude.toFixed(1)}m
        </div>
      </div>
    </div>
  );
};

export default DroneAnimation;