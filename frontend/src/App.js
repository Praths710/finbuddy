import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { API_BASE } from './config';
import { AuthProvider } from './AuthContext';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import About from './About';
import ProtectedRoute from './ProtectedRoute';

function App() {
  // Wake the API the moment anyone opens the site, so it's ready by the time they sign in.
  useEffect(() => {
    fetch(`${API_BASE}/health`).catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
