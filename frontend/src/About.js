import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight, FiCpu, FiTag, FiCalendar, FiActivity, FiLock, FiSmartphone, FiCheck,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { useAuth } from './AuthContext';
import { Brand } from './components/ui';
import './About.css';

const FEATURES = [
  [<FiCpu key="i" />, 'An assistant that knows your numbers', 'Ask “where did my money go?” and get an answer built from your own transactions, income and EMIs — not generic tips.'],
  [<FiTag key="i" />, 'Smart categorisation', 'Type “Uber to office” or “Netflix” and FinBuddy files it in the right category for you.'],
  [<FiCalendar key="i" />, 'Loans & EMIs, handled', 'Track every EMI with start and end dates, see months remaining, and watch them roll into your monthly budget.'],
  [<FiActivity key="i" />, 'A monthly health score', 'Savings rate, EMI load and spending distilled into one score — so you know at a glance how this month is going.'],
  [<FiLock key="i" />, 'Private by design', 'Passwords are hashed with bcrypt and every account only ever sees its own data.'],
  [<FiSmartphone key="i" />, 'Beautiful everywhere', 'A calm, focused interface that feels just as good on your phone as on a big screen.'],
];

function About() {
  const { user } = useAuth();
  const primary = user ? { to: '/dashboard', label: 'Open dashboard' } : { to: '/register', label: 'Start free' };

  return (
    <div className="lp">
      <div className="lp-wrap">
        <nav className="lp-nav">
          <Brand />
          <div className="links">
            {!user && <Link className="plain" to="/login">Sign in</Link>}
            <Link className="fb-btn fb-btn-sm" to={primary.to}>{primary.label}</Link>
          </div>
        </nav>

        {/* ---------------- Hero ---------------- */}
        <section className="lp-hero">
          <div className="fb-fade-in">
            <span className="fb-chip violet"><HiSparkles /> AI-powered personal finance</span>
            <h1 className="lp-title">Your money,<br /><em className="grad-text">beautifully</em><br />in control.</h1>
            <p className="lp-sub">
              FinBuddy brings your spending, income and EMIs into one calm dashboard — with an AI
              assistant that answers questions about your actual money.
            </p>
            <div className="lp-cta">
              <Link className="fb-btn fb-btn-lg" to={primary.to}>{primary.label} <FiArrowRight /></Link>
              {!user && <Link className="fb-btn fb-btn-ghost fb-btn-lg" to="/login">I have an account</Link>}
            </div>
            <div className="lp-trust">
              <span><FiCheck /> Free to use</span>
              <span><FiCheck /> No bank login needed</span>
              <span><FiCheck /> Set up in a minute</span>
            </div>
          </div>

          <div className="lp-preview fb-fade-in d2" aria-hidden="true">
            <div className="fb-card fb-card-hero lp-device">
              <div className="d-flex justify-content-between">
                <span className="eyebrow">Net · October</span>
                <span className="fb-chip violet">Health 84/100</span>
              </div>
              <div className="big num">₹48,250</div>
              <div className="small muted">62% of income spent · saving 38%</div>
              <div className="lp-bars">
                {[62, 48, 70, 52, 66, 44, 74, 50, 80, 46, 76, 40].map((h, i) => <div key={i} style={{ height: `${h}%` }} />)}
              </div>
              {[
                ['F', '#a78bfa', 'Food & Drink', '₹8,420'],
                ['T', '#38bdf8', 'Transport', '₹3,150'],
                ['L', '#fbbf24', 'Home loan EMI', '₹21,500'],
              ].map(([l, c, n, a]) => (
                <div key={n} className="lp-row">
                  <span className="dot" style={{ background: `${c}22`, color: c }}>{l}</span>
                  <span className="flex-grow-1">{n}</span>
                  <span className="num fw-semibold">{a}</span>
                </div>
              ))}
            </div>
            <div className="fb-card lp-chat">
              <div className="who"><HiSparkles /> FinBuddy AI</div>
              You spent <b>₹2,300 less on food</b> than last month. Keep this up and you'll save an extra <b>₹27,600</b> this year.
            </div>
          </div>
        </section>

        {/* ---------------- Features ---------------- */}
        <section className="lp-section">
          <div className="eyebrow">Why FinBuddy</div>
          <h2 className="lp-h2">Everything you need.<br /><span className="muted">Nothing you don't.</span></h2>
          <div className="lp-features">
            {FEATURES.map(([icon, title, text]) => (
              <div key={title} className="fb-card lp-feature">
                <div className="ico">{icon}</div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- How it works ---------------- */}
        <section className="lp-section">
          <div className="eyebrow">How it works</div>
          <h2 className="lp-h2">Three steps to clarity.</h2>
          <div className="lp-steps">
            <div className="lp-step"><div className="n">01</div><h3>Set your income</h3><p>Add your salary and any passive income once — it's counted every month.</p></div>
            <div className="lp-step"><div className="n">02</div><h3>Log what you spend</h3><p>Add expenses and EMIs in seconds. Categories are picked for you.</p></div>
            <div className="lp-step"><div className="n">03</div><h3>Ask, learn, improve</h3><p>See your monthly picture and ask the AI how to do better next month.</p></div>
          </div>
        </section>

        {/* ---------------- Final CTA ---------------- */}
        <section className="lp-final">
          <h2 className="lp-h2">Make this the month<br />you <em className="grad-text">take control</em>.</h2>
          <p className="muted mb-4">Free, private and ready in under a minute.</p>
          <Link className="fb-btn fb-btn-lg" to={primary.to}>{primary.label} <FiArrowRight /></Link>
        </section>

        <footer className="lp-foot">
          <span>© {new Date().getFullYear()} FinBuddy</span>
          <span>General guidance only — not licensed financial advice.</span>
        </footer>
      </div>
    </div>
  );
}

export default About;
