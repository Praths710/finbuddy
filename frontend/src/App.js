import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { API_BASE } from './config';
import { AuthProvider } from './AuthContext';
import Login from './Login';
import Register from './Register';
import About from './About';
import ProtectedRoute from './ProtectedRoute';
import { FinanceProvider } from './data/FinanceContext';
import Shell from './components/Shell';
import Home from './pages/Home';
import Spending from './pages/Spending';
import Plan from './pages/Plan';
import Portfolio from './Portfolio';

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
          <Route element={<ProtectedRoute><FinanceProvider><Shell /></FinanceProvider></ProtectedRoute>}>
            <Route path="/home" element={<Home />} />
            <Route path="/spending" element={<Spending />} />
            <Route path="/invest" element={<Portfolio />} />
            <Route path="/plan" element={<Plan />} />
          </Route>
          {/* old URLs */}
          <Route path="/dashboard" element={<Navigate to="/home" replace />} />
          <Route path="/portfolio" element={<Navigate to="/invest" replace />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
