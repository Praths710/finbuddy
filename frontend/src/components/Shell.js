import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FiHome, FiCreditCard, FiTrendingUp, FiTarget, FiPlus, FiEye, FiEyeOff, FiSettings, FiLogOut } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { useFinance } from '../data/FinanceContext';
import { initials } from '../finance';
import { Brand } from './ui';
import '../layout.css';
import './Shell.css';

const NAV = [
  ['/home', 'Home', <FiHome key="i" />],
  ['/spending', 'Spending', <FiCreditCard key="i" />],
  ['/invest', 'Invest', <FiTrendingUp key="i" />],
  ['/plan', 'Plan', <FiTarget key="i" />],
];

// Privacy mode blurs every `.num` on screen; remembered per browser.
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

function Shell() {
  const { user, openQuickAdd, openAI, openSettings, signOut } = useFinance();
  const [privacy, setPrivacy] = usePrivacy();
  const [menu, setMenu] = useState(false);

  // "N" anywhere (outside a text field) opens Quick add.
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey
        && !['input', 'textarea', 'select'].includes(tag) && !document.querySelector('.modal.show')) {
        e.preventDefault();
        openQuickAdd('spent');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openQuickAdd]);

  const PrivacyBtn = (
    <button className="fb-icon-btn" onClick={() => setPrivacy((p) => !p)} title={privacy ? 'Show amounts' : 'Hide amounts'}
      aria-label={privacy ? 'Show amounts' : 'Hide amounts'}>
      {privacy ? <FiEyeOff /> : <FiEye />}
    </button>
  );

  const Account = (
    <div className="position-relative">
      <button className="shell-account" onClick={() => setMenu((m) => !m)} aria-label="Account menu">
        <span className="fb-avatar">{initials(user)}</span>
        <span className="who">
          <span className="fw-semibold fb-ellipsis d-block">{user?.full_name || 'Account'}</span>
          <span className="small faint fb-ellipsis d-block">{user?.email}</span>
        </span>
      </button>
      {menu && (
        <>
          <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1025 }} onClick={() => setMenu(false)} />
          <div className="fb-menu shell-menu">
            <button onClick={() => { setMenu(false); openSettings(); }}><FiSettings /> Settings & income</button>
            <button onClick={() => setPrivacy((p) => !p)}>{privacy ? <FiEye /> : <FiEyeOff />} {privacy ? 'Show amounts' : 'Hide amounts'}</button>
            <button onClick={signOut}><FiLogOut /> Sign out</button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="shell">
      {/* Desktop sidebar */}
      <aside className="shell-side">
        <div className="px-2 mb-4"><Brand to="/home" /></div>
        <button className="fb-btn fb-btn-lg w-100 mb-4" onClick={() => openQuickAdd('spent')}>
          <FiPlus /> Add <kbd>N</kbd>
        </button>
        <nav className="shell-nav">
          {NAV.map(([to, label, icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>{icon}<span>{label}</span></NavLink>
          ))}
        </nav>
        <button className="shell-ai" onClick={openAI}>
          <HiSparkles /> <span>Ask FinBuddy AI</span>
        </button>
        <div className="mt-auto d-flex align-items-center gap-1">
          <div className="flex-grow-1" style={{ minWidth: 0 }}>{Account}</div>
          {PrivacyBtn}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="shell-top">
        <Brand to="/home" />
        <div className="ms-auto d-flex align-items-center gap-1">
          {PrivacyBtn}
          <button className="fb-icon-btn" onClick={openAI} aria-label="Ask FinBuddy AI"><HiSparkles /></button>
          <button className="fb-avatar" onClick={openSettings} aria-label="Settings">{initials(user)}</button>
        </div>
      </header>

      <main className="shell-main">
        <Outlet />
      </main>

      {/* Mobile bottom bar */}
      <nav className="shell-bottom">
        {NAV.slice(0, 2).map(([to, label, icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>{icon}<span>{label}</span></NavLink>
        ))}
        <button className="shell-fab" onClick={() => openQuickAdd('spent')} aria-label="Add"><FiPlus /></button>
        {NAV.slice(2).map(([to, label, icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>{icon}<span>{label}</span></NavLink>
        ))}
      </nav>
    </div>
  );
}

export default Shell;
