import React, { createContext, useState, useEffect, useContext } from 'react';
import { apiFetch } from '../config/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

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
      const data = await apiFetch('/api/profile', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setUser(data);
      setAuthError(null);
    } catch (error) {
      // Distinguish "token invalid" (safe to log out) from
      // "server/network issue" (don't wipe the session over a hiccup).
      console.error('Error fetching profile:', error.message);
      if (error.status === 401 || error.status === 403) {
        logout();
      } else {
        setAuthError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (credential) => {
    const data = await apiFetch(
      `/api/auth/google?credential=${encodeURIComponent(credential)}`,
      { method: 'POST' }
    );
    // apiFetch already throws with data.detail on !res.ok, so if we're here it succeeded
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    setAuthError(null);
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
    <AuthContext.Provider
      value={{ user, token, loading, authError, googleLogin, logout, refreshProfile, fetchProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);