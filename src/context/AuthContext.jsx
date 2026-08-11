import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async () => {
    const currentToken = localStorage.getItem('token') || token;
    if (!currentToken) return;
    try {
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        // Token expired/invalid
        logout();
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (credential) => {
    const response = await fetch(`/api/auth/google?credential=${credential}`, {
      method: 'POST'
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Google login failed');
    }
    
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchProfile();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, googleLogin, logout, refreshProfile, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
