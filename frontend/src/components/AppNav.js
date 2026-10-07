import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff, FiLogOut, FiSettings, FiPieChart, FiTrendingUp } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { useAuth } from '../AuthContext';
import { initials } from '../finance';
import { Brand } from './ui';
import AIChat from './AIChat';

// Privacy mode blurs every `.num` on screen; shared by every page and remembered per browser.
function usePrivacy() {
  const [privacy, setPrivacy] = useState(() => {
    try { return localStorage.getItem('fb-privacy') === '1'; } catch { return false; }
  });
  useEffect(() => {
    document.body.classList.toggle('privacy-on', privacy);
    try { localStorage.setItem('fb-privacy', privacy ? '1' : '0'); } catch { /* storage unavailable */ }
    return () => document.body.classList.remove('privacy-on');
  }, [privacy]);
  return [privacy, setPrivacy];
}

function AppNav({ health, onSettings }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [privacy, setPrivacy] = usePrivacy();
  const [aiOpen, setAiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const signOut = () => { logout(); navigate('/login'); };

  return (
    <>
      <nav className="fb-nav">
        <div className="fb-nav-inner">
          <Brand to="/dashboard" />
          <div className="fb-seg app-switch">
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}><FiPieChart /> <span>Money</span></NavLink>
            <NavLink to="/portfolio" className={({ isActive }) => (isActive ? 'active' : '')}><FiTrendingUp /> <span>Invest</span></NavLink>
          </div>
          <div className="ms-auto d-flex align-items-center gap-2">
            <button className="fb-icon-btn" onClick={() => setPrivacy((p) => !p)}
              aria-label={privacy ? 'Show amounts' : 'Hide amounts'} title={privacy ? 'Show amounts' : 'Hide amounts (privacy mode)'}>
              {privacy ? <FiEyeOff /> : <FiEye />}
            </button>
            <button className="ai-trigger" onClick={() => setAiOpen(true)}>
              <HiSparkles className="spark" /> <span className="txt">Ask FinBuddy AI</span>
            </button>
            <div className="position-relative">
              <button className="fb-avatar" onClick={() => setMenuOpen((o) => !o)} aria-label="Account menu">
                {initials(user)}
              </button>
              {menuOpen && (
                <>
                  <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1025 }} onClick={() => setMenuOpen(false)} />
                  <div className="fb-menu">
                    <div className="fb-menu-head">
                      <div className="fw-semibold">{user?.full_name || 'Your account'}</div>
                      <div className="small muted fb-ellipsis">{user?.email}</div>
                    </div>
                    <button onClick={() => { setMenuOpen(false); if (onSettings) onSettings(); else navigate('/dashboard'); }}><FiSettings /> Settings</button>
                    <button onClick={signOut}><FiLogOut /> Sign out</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <AIChat open={aiOpen} onClose={() => setAiOpen(false)} user={user} health={health} />
    </>
  );
}

export default AppNav;
