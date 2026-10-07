import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Splash } from './components/ui';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Splash label="Signing you in" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
