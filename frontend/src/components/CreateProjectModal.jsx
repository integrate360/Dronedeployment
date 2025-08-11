// frontend/src/components/CreateProjectModal.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
// --- Add LayersControl to the import ---
import { MapContainer, TileLayer, Marker, useMap, Tooltip, LayersControl } from 'react-leaflet';
import { FiSearch } from 'react-icons/fi';
import L from 'leaflet';
import api from '../apis/config';

import 'leaflet/dist/leaflet.css';
import '../styles/Modal.css';

// We no longer need the separate Points of Interest file or custom icons for this implementation.
// All hooks and helper components remain the same.

const ChangeView = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom); }, [center, zoom, map]);
  return null;
};

const CreateProjectModal = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimeout = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setName(''); setSelectedLocation(null); setSearchQuery(''); setSearchResults([]);
    }
  }, [isOpen]);

  const searchLocations = useCallback((query) => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    if (!query || query.length < 3) { setSearchResults([]); return; }
    debounceTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/geocode?search=${query}`);
        setSearchResults(res.data);
      } catch (error) {
        console.error("Failed to fetch locations", error); setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  if (!isOpen) return null;

  const handleQueryChange = (e) => {
    const query = e.target.value; setSearchQuery(query); searchLocations(query);
  };
  
  const handleSelectResult = (location) => {
    setSelectedLocation(location); setSearchQuery(''); setSearchResults([]);
  };

  const handleCreate = () => {
    if (name.trim() && selectedLocation) {
      onCreate({ name: name.trim(), latitude: selectedLocation.lat, longitude: selectedLocation.lng });
      onClose();
    }
  };

  const isCreateDisabled = !name.trim() || !selectedLocation;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Project</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-section">
            <label htmlFor="projectName">Project Name</label>
            <input id="projectName" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter project name" autoFocus />
            <label style={{marginTop: '1.5rem', display: 'block'}}>Search for a Location</label>
            <div className="search-input-wrapper">
                <FiSearch className="search-input-icon" />
                <input type="text" placeholder="Address, city, or place..." value={searchQuery} onChange={handleQueryChange} />
            </div>
            {(isSearching || searchResults.length > 0) && (
                <div className="search-results-panel">
                    {isSearching ? (<div className="search-result-item">Searching...</div>) 
                    : (searchResults.map((loc, index) => (<div key={`${loc.lat}-${loc.lng}-${index}`} className="search-result-item" onClick={() => handleSelectResult(loc)}>{loc.label}</div>))
                    )}
                </div>
            )}
            {selectedLocation && (<div className="location-display"><strong>Selected Location:</strong><p>{selectedLocation.label}</p></div>)}
          </div>
          <div className="map-section">
            <MapContainer center={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : [20, 0]} zoom={selectedLocation ? 13 : 2} style={{ height: '100%', width: '100%' }}>
              {selectedLocation && <ChangeView center={[selectedLocation.lat, selectedLocation.lng]} zoom={13} />}
              
              {/* --- MODIFICATION START --- */}
              <LayersControl position="topright">
                <LayersControl.BaseLayer name="Standard Map">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer checked name="Satellite & Labels">
                  <TileLayer
                    url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                    subdomains={['mt0','mt1','mt2','mt3']}
                    attribution="&copy; Google Maps"
                  />
                </LayersControl.BaseLayer>
                 <LayersControl.BaseLayer name="Terrain">
                  <TileLayer
                    url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                    attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                  />
                </LayersControl.BaseLayer>
              </LayersControl>
              {/* --- MODIFICATION END --- */}
              
              {selectedLocation && (
                <Marker position={[selectedLocation.lat, selectedLocation.lng]}>
                  <Tooltip permanent direction="top" offset={[0, -10]}>
                    {selectedLocation.label}
                  </Tooltip>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={isCreateDisabled}>Create Project</button>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectModal;