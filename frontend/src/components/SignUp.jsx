// frontend/src/components/SignUp.jsx
import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import DroneDeployLogo from '../assets/dronedeploylogo.svg';
import AuthContext from '../contexts/AuthContext';
import '../styles/SignUp.css';

// Import Icons
import { HiOutlineMail } from 'react-icons/hi';
import { RiLockPasswordLine } from 'react-icons/ri';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';

const Signup = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signup } = useContext(AuthContext);

  const { email, password, confirmPassword } = formData;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Password: 6+ chars, 1 uppercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;

    if (!emailRegex.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!passwordRegex.test(password)) {
      errors.password = 'Password must be 6+ characters with one uppercase, one number, and one special character.';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    setFormErrors(errors);

    // If there are no client-side validation errors, proceed to signup
    if (Object.keys(errors).length === 0) {
      try {
        await signup(email, password);
      } catch (err) {
        // Server-side errors (like "User already exists") are handled by toast
        console.error("Signup attempt failed:", err);
      }
    }
  };

  return (
    <div className="signup-page">
      <div className="auth-container">
        <img src={DroneDeployLogo} alt="DroneDeploy Logo" className="auth-logo" />
        <div className="auth-card">
          <h2 className="auth-title">Create account</h2>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-wrapper">
              <HiOutlineMail className="input-icon" />
              <input name="email" type="email" required className="auth-input has-icon" placeholder="Business email" value={email} onChange={handleChange} />
            </div>
            {formErrors.email && <p className="validation-error">{formErrors.email}</p>}

            <div className="input-wrapper">
              <RiLockPasswordLine className="input-icon" />
              <input name="password" type={showPassword ? "text" : "password"} required className="auth-input has-icon" placeholder="Password" value={password} onChange={handleChange} />
              <span onClick={() => setShowPassword(!showPassword)} className="password-toggle-icon">{showPassword ? <AiOutlineEye /> : <AiOutlineEyeInvisible />}</span>
            </div>
            {formErrors.password && <p className="validation-error">{formErrors.password}</p>}

            <div className="input-wrapper">
              <RiLockPasswordLine className="input-icon" />
              <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} required className="auth-input has-icon" placeholder="Confirm password" value={confirmPassword} onChange={handleChange} />
              <span onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="password-toggle-icon">{showConfirmPassword ? <AiOutlineEye /> : <AiOutlineEyeInvisible />}</span>
            </div>
            {formErrors.confirmPassword && <p className="validation-error">{formErrors.confirmPassword}</p>}

            <button type="submit" className="btn btn-primary">Create account</button>
          </form>
        </div>
        <div className="auth-footer">
          Have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;