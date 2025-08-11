import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import DroneDeployLogo from '../assets/dronedeploylogo.svg';
import AuthContext from '../contexts/AuthContext';
import '../styles/Login.css';

// Import Icons
import { HiOutlineMail } from 'react-icons/hi';
import { RiLockPasswordLine } from 'react-icons/ri';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err) {
      // Errors are now handled by toast notifications in the context.
      // We can log for debugging but no need to set a local error state.
      console.error("Login attempt failed:", err);
    }
  };

  return (
    <div className="login-page">
      <div className="auth-container">
        <img src={DroneDeployLogo} alt="DroneDeploy Logo" className="auth-logo" />
        <div className="auth-card">
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-wrapper">
              <HiOutlineMail className="input-icon" />
              <input 
                name="email" 
                type="email" 
                required 
                className="auth-input has-icon" 
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="input-wrapper">
              <RiLockPasswordLine className="input-icon" />
              <input 
                name="password" 
                type={showPassword ? "text" : "password"}
                required 
                className="auth-input has-icon" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span onClick={() => setShowPassword(!showPassword)} className="password-toggle-icon">
                {showPassword ? <AiOutlineEye /> : <AiOutlineEyeInvisible />}
              </span>
            </div>
            <button type="submit" className="btn btn-primary">Log In</button>
          </form>
        </div>
        <div className="auth-footer">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;