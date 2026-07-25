import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Configure axios defaults when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
      
      // Verify token and fetch profile
      axios.get('/api/auth/me')
        .then(res => {
          setUser(res.data);
        })
        .catch(err => {
          console.error("Session verification failed. Logging out...", err);
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password) => {
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      setToken(res.data.access_token);
      return { success: true, user: { username: res.data.username, role: res.data.role } };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.detail || "Invalid username or password" 
      };
    }
  };

  const register = async (username, email, password, role) => {
    try {
      await axios.post('/api/auth/register', { username, email, password, role });
      // Automatically log the user in after registration
      return await login(username, password);
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.detail || "Registration failed. Username or Email may be taken." 
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'Admin',
    isSeller: user?.role === 'Seller',
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
