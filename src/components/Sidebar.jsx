// frontend/src/components/Sidebar.jsx
import React, { useContext } from 'react';
import { FiX, FiBriefcase, FiMap, FiLink, FiZap, FiSettings, FiHelpCircle, FiLogOut } from 'react-icons/fi';
import AuthContext from '../contexts/AuthContext';
import '../styles/Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const { logout } = useContext(AuthContext);

  const menuItems = [
    { icon: <FiBriefcase />, text: 'Projects' },
    { icon: <FiMap />, text: 'Map' },
    { icon: <FiLink />, text: 'Links' },
    { icon: <FiZap />, text: 'DroneDeploy Academy' },
  ];

  const bottomItems = [
    { icon: <FiSettings />, text: 'Account preferences' },
    { icon: <FiHelpCircle />, text: 'Help' },
    { icon: <FiLogOut />, text: 'Log out', action: logout },
  ];

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'show' : ''}`} onClick={onClose}></div>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>DroneDeploy</h3>
          <button className="icon-btn" onClick={onClose}><FiX /></button>
        </div>
        <div className="sidebar-content">
          <nav className="main-nav">
            {menuItems.map((item, index) => (
              <a href="#" key={index} className="nav-item">
                {item.icon}<span>{item.text}</span>
              </a>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <nav>
            {bottomItems.map((item, index) => (
              <a href="#" key={index} className="nav-item" onClick={item.action}>
                {item.icon}<span>{item.text}</span>
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;