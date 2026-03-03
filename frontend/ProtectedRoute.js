import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    // You can replace this with a spinner component if desired
    return <div className="text-center mt-5">Loading...</div>;
  }

  if (!user) {
    // Not logged in – redirect to login page
    return <Navigate to="/login" replace />;
  }

  // Logged in – render the protected component
  return children;
}

export default ProtectedRoute;