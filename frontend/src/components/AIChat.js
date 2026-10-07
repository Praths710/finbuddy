import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FiX, FiArrowUp, FiTrendingDown, FiPieChart, FiTarget, FiCalendar, FiRotateCcw } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { API_BASE } from '../config';
import { apiError } from '../finance';
import './AIChat.css';

const SUGGESTIONS = [
  [<FiPieChart key="i" />, 'Where did most of my money go this month?'],
  [<FiTrendingDown key="i" />, 'How can I cut my spending by 10%?'],
  [<FiCalendar key="i" />, 'Compare this month with last month'],
  [<FiTarget key="i" />, 'How much can I safely save each month?'],
];

// Inline **bold** → <strong>
function inline(text, key) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>
      : <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>);
}

// Minimal markdown: paragraphs, bullet lists, numbered lists, bold, headings as bold.
function Markdown({ text }) {
  const blocks = [];
  let list = null;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      if (!list) { list = []; blocks.push({ type: 'ul', items: list }); }
      list.push(bullet[1]);
      return;
    }
    list = null;
    if (!line) return;
    blocks.push({ type: 'p', text: line.replace(/^#{1,6}\s+(.*)$/, '**$1**') });
  });
  return blocks.map((b, i) => b.type === 'ul'
    ? <ul key={i}>{b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}</ul>
    : <p key={i}>{inline(b.text, i)}</p>);
}

function AIChat({ open, onClose, user, health }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  const send = async (text) => {
    const query = (text ?? input).trim();
    if (!query || loading) return;
    setMessages((m) => [...m, { role: 'user', content: query }]);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/ai/chat`, { query });
      setMessages((m) => [...m, {
        role: 'ai',
        error: Boolean(res.data.error),
        content: res.data.message || "I couldn't come up with an answer — try rephrasing?",
      }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'ai', error: true, content: apiError(err, "I couldn't reach the assistant. Please try again.") }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const first = (user?.full_name || '').split(' ')[0];

  return (
    <>
      <div className={`ai-scrim ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`ai-drawer ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="FinBuddy AI assistant">
        <div className="ai-head">
          <div className="ai-orb"><HiSparkles /></div>
          <div className="flex-grow-1">
            <div className="ai-title">FinBuddy AI</div>
            <div className="ai-status">Reads your own numbers</div>
          </div>
          {health && <span className="fb-chip violet" title="Financial health score this month">{health.score}/100</span>}
          {messages.length > 0 && (
            <button className="fb-icon-btn" onClick={() => setMessages([])} aria-label="New conversation" title="New conversation"><FiRotateCcw /></button>
          )}
          <button className="fb-icon-btn" onClick={onClose} aria-label="Close"><FiX /></button>
        </div>

        <div className="ai-body" ref={bodyRef}>
          {messages.length === 0 && (
            <div className="ai-intro">
              <div className="ai-orb mx-auto" style={{ width: 52, height: 52, borderRadius: 16, fontSize: 22 }}><HiSparkles /></div>
              <h3>Hi{first ? ` ${first}` : ''}, ask me anything</h3>
              <div className="small muted">I read your own numbers to answer — spending, income, EMIs and trends.</div>
              <div className="ai-suggest">
                {SUGGESTIONS.map(([icon, q]) => (
                  <button key={q} onClick={() => send(q)}>{icon}{q}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`ai-msg ${m.role} ${m.error ? 'error' : ''}`}>
              {m.role === 'ai' && <div className="ai-mini"><HiSparkles /></div>}
              <div className="ai-bubble">{m.role === 'ai' ? <Markdown text={m.content} /> : m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="ai-msg ai">
              <div className="ai-mini"><HiSparkles /></div>
              <div className="ai-bubble"><span className="ai-typing"><span /><span /><span /></span></div>
            </div>
          )}
        </div>

        <div className="ai-foot">
          <form className="ai-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea ref={inputRef} rows={1} placeholder="Ask about your money…" value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} disabled={loading} maxLength={1000} />
            <button className="fb-btn ai-send" type="submit" disabled={loading || !input.trim()} aria-label="Send"><FiArrowUp /></button>
          </form>
          <div className="ai-disclaimer">AI can make mistakes. General guidance, not licensed financial advice.</div>
        </div>
      </aside>
    </>
  );
}

export default AIChat;
