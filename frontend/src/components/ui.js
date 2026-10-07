import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

export function Brand({ to = '/' }) {
  return (
    <Link to={to} className="fb-brand" aria-label="FinBuddy home">
      <img src="/FinBuddy-new.png" alt="" />
      <span>FinBuddy</span>
    </Link>
  );
}

export function Splash({ label = 'Loading' }) {
  return (
    <div className="fb-splash">
      <div>
        <img src="/FinBuddy-new.png" alt="" />
        <div className="eyebrow mt-3">{label}</div>
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className="fb-spinner" aria-hidden="true" />;
}

// Tiny toast system: const [toasts, toast] = useToasts(); toast('Saved') / toast('Oops', 'error')
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((text, kind = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return [toasts, push];
}

export function Toasts({ toasts }) {
  return (
    <div className="fb-toast-wrap" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`fb-toast ${t.kind}`}>
          {t.kind === 'error' ? <FiAlertCircle /> : <FiCheckCircle />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// True once `active` has been true for `ms` — used for "server is waking up" hints.
export function useSlowFlag(active, ms = 4000) {
  const [slow, setSlow] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    if (active) timer.current = setTimeout(() => setSlow(true), ms);
    else setSlow(false);
    return () => clearTimeout(timer.current);
  }, [active, ms]);
  return slow;
}

// Animated count-up for headline numbers.
export function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}
