import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  // The free server sleeps when idle; explain the wait instead of looking frozen.
  const slow = useSlowFlag(true, 4000);
  return (
    <div className="fb-splash">
      <div>
        <img src="/FinBuddy-new.png" alt="" />
        <div className="eyebrow mt-3">{label}</div>
        {slow && <div className="small faint mt-2" style={{ maxWidth: 280 }}>Waking up the server — this can take up to a minute after it's been idle.</div>}
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

// Adds `.in` to every `.reveal` element inside the returned ref once it scrolls into view.
export function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const els = root.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

// Indian digit grouping (1,00,000) for a raw numeric string; keeps any decimals as typed.
export const groupIN = (raw) => {
  if (raw === '' || raw == null) return '';
  const [i, d] = String(raw).split('.');
  const int = i.replace(/^0+(?=\d)/, '');
  const grouped = int ? Number(int).toLocaleString('en-IN') : '';
  return d !== undefined ? `${grouped || '0'}.${d}` : grouped;
};

// Number field that shows commas while typing. onChange receives { target: { value: '100000.5' } } (no commas),
// so it drops in wherever a plain <input type="number"> was used.
export function NumInput({ value, onChange, decimals = 6, ref: outerRef, ...rest }) {
  const ref = useRef(null);
  const setRef = (el) => {
    ref.current = el;
    if (typeof outerRef === 'function') outerRef(el);
    else if (outerRef) outerRef.current = el;
  };
  const caret = useRef(null); // count of digits/dots left of the caret, restored after formatting
  const display = groupIN(value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current == null || document.activeElement !== el) return;
    let seen = 0, pos = 0;
    while (pos < display.length && seen < caret.current) {
      if (/[\d.]/.test(display[pos])) seen += 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
    caret.current = null;
  }, [display]);

  const handle = (e) => {
    const typed = e.target.value;
    const left = typed.slice(0, e.target.selectionStart ?? typed.length);
    caret.current = left.replace(/[^\d.]/g, '').length;
    let raw = typed.replace(/[^\d.]/g, '');
    const dot = raw.indexOf('.');
    if (dot !== -1) raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, '').slice(0, decimals);
    if (raw.split('.')[0].length > 13) return; // keep within safe integer formatting
    onChange({ target: { value: raw } });
  };

  return <input {...rest} ref={setRef} type="text" inputMode="decimal" autoComplete="off" value={display} onChange={handle} />;
}
