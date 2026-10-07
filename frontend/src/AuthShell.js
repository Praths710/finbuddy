import React from 'react';
import { FiTrendingUp, FiShield, FiZap } from 'react-icons/fi';
import { Brand } from './components/ui';
import './AuthShell.css';

// Split-screen frame shared by the login and register pages.
function AuthShell({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <aside className="auth-art" aria-hidden="true">
        <div className="auth-art-inner">
          <Brand />
          <div>
            <h2 className="serif auth-art-title">
              Your money,<br /><em className="grad-text">beautifully</em> in control.
            </h2>
            <div className="auth-float fb-card">
              <div className="eyebrow">Net this month</div>
              <div className="serif auth-float-num num">₹48,250</div>
              <div className="fb-progress mt-2"><div style={{ width: '62%' }} /></div>
              <div className="d-flex justify-content-between mt-2 small muted">
                <span>62% of income spent</span><span className="pos">+12% vs last month</span>
              </div>
            </div>
            <ul className="auth-points">
              <li><FiZap /> AI answers about your own spending</li>
              <li><FiTrendingUp /> Monthly cash flow, EMIs and savings rate</li>
              <li><FiShield /> Private by design — your data is only yours</li>
            </ul>
          </div>
          <div className="faint small">© {new Date().getFullYear()} FinBuddy</div>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-form fb-fade-in">
          <div className="eyebrow mb-2">{eyebrow}</div>
          <h1 className="serif auth-title">{title}</h1>
          <p className="muted mb-4">{subtitle}</p>
          {children}
          <div className="text-center mt-4 muted small">{footer}</div>
        </div>
      </main>
    </div>
  );
}

export default AuthShell;
