import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const API_BASE = 'https://finbuddy-api-python.onrender.com'; // Your backend URL

  useEffect(() => {
    console.log('AuthProvider useEffect - token:', token);
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('Fetching user with token...');
      axios.get(`${API_BASE}/users/me`)
        .then(res => {
          console.log('User fetched:', res.data);
          setUser(res.data);
        })
        .catch(err => {
          console.error('Failed to fetch user:', err);
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    console.log('Login attempt:', email);
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    try {
      const res = await axios.post(`${API_BASE}/token`, formData);
      console.log('Login response:', res.data);
      const { access_token } = res.data;
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setToken(access_token);
      // Fetch user immediately
      const userRes = await axios.get(`${API_BASE}/users/me`);
      console.log('User after login:', userRes.data);
      setUser(userRes.data);
      return userRes.data;
    } catch (err) {
      console.error('Login error:', err.response?.status, err.response?.data);
      throw err;
    }
  };

  const register = async (email, password, fullName) => {
    console.log('Register attempt:', email);
    try {
      await axios.post(`${API_BASE}/register`, {
        email,
        password,
        full_name: fullName
      });
      console.log('Registration successful, logging in...');
      // Automatically log in after registration
      return login(email, password);
    } catch (err) {
      console.error('Registration error:', err.response?.status, err.response?.data);
      throw err;
    }
  };

  const logout = () => {
    console.log('Logout');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);