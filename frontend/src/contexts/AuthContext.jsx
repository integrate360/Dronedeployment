// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../apis/config';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            // On initial load, verify the token and fetch user data
            api.get('/auth/me').then(res => {
                setUser(res.data);
            }).catch(() => {
                // If token is invalid/expired, remove it
                localStorage.removeItem('token');
            }).finally(() => {
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, []);

    const handleAuthResponse = (response) => {
        const { token, user } = response.data;
        localStorage.setItem('token', token);
        setUser(user);
        navigate('/projects'); // <-- CHANGE HERE
    };

    const handleError = (error, type) => {
        let message;
        if (!error.response) {
            message = 'Network Error: Cannot connect to the server.';
        } else {
            // Use the specific error message from the backend
            message = error.response.data.msg || `An unknown ${type} error occurred.`;
        }
        toast.error(message);
        throw new Error(message); // Still throw for component to handle its state
    };

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            handleAuthResponse(response);
            toast.success('Logged in successfully!');
        } catch (error) {
            handleError(error, 'login');
        }
    };

    const signup = async (email, password) => {
        try {
            const response = await api.post('/auth/signup', { email, password });
            handleAuthResponse(response);
            toast.success('Account created successfully!');
        } catch (error) {
            handleError(error, 'signup');
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/login');
        toast.info('You have been logged out.');
    };

    const value = { user, login, signup, logout, loading };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export default AuthContext;