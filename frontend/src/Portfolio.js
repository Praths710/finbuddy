import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Modal } from 'react-bootstrap';
import {
  FiPlus, FiSearch, FiRefreshCw, FiX, FiTrash2, FiTrendingUp, FiTrendingDown, FiRepeat, FiPause, FiPlay,
  FiEye, FiArrowLeft, FiBriefcase, FiStar,
} from 'react-icons/fi';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { API_BASE } from './config';
import AppNav from './components/AppNav';
import { ConfirmModal } from './Dashboard';
import { Toasts, useToasts, useCountUp, Spinner } from './components/ui';
import { money, moneyExact, apiError } from './finance';
import './Portfolio.css';

const TYPES = {
  stock: { label: 'Stocks', one: 'Stock', color: '#d9b44a' },
  etf: { label: 'ETFs', one: 'ETF', color: '#e8cf8f' },
  mf: { label: 'Mutual funds', one: 'Mutual fund', color: '#74d6a8' },
  crypto: { label: 'Crypto', one: 'Crypto', color: '#8fb3d9' },
};
const SEARCH_TABS = [['stock', 'Stocks'], ['etf', 'ETFs'], ['mf', 'Mutual funds'], ['crypto', 'Crypto']];

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toApiDate = (d) => `${d}T12:00:00`;
const fmtDate = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', opts);
const signed = (n, f = money) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${f(Math.abs(n))}`;
const pct = (n) => (n == null || !isFinite(n) ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}%`);
const tone = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted');
const fmtUnits = (u, type) => {
  if (!u) return '0';
  const dp = type === 'crypto' ? 6 : type === 'mf' ? 3 : u % 1 === 0 ? 0 : 4;
  return Number(u.toFixed(dp)).toLocaleString('en-IN', { maximumFractionDigits: dp });
};
const priceFmt = (p) => (p == null ? '—' : p >= 100 ? moneyExact(p) : `₹${p.toLocaleString('en-IN', { maximumFractionDigits: 4 })}`);

/* =====================================================================
   Page
   ===================================================================== */
function Portfolio() {
  const [toasts, toast] = useToasts();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('value');
  const [openId, setOpenId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [trade, setTrade] = useState(null); // { holding, side }
  const [sipFor, setSipFor] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback((quiet) => {
    if (quiet) setRefreshing(true);
    return axios.get(`${API_BASE}/portfolio`)
      .then((r) => { setData(r.data); setUpdatedAt(new Date()); })
      .catch((err) => { if (!quiet) toast(apiError(err, "Couldn't load your portfolio."), 'error'); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [toast]);

  useEffect(() => {
    load(false);
    const id = setInterval(() => { if (!document.hidden) load(true); }, 60000);
    return () => clearInterval(id);
  }, [load]);

  const holdings = useMemo(() => data?.holdings || [], [data]);
  const owned = holdings.filter((h) => h.units > 0);
  const watch = holdings.filter((h) => h.units <= 0);
  const t = data?.totals;

  const list = useMemo(() => {
    const base = filter === 'watch' ? watch : filter === 'all' ? owned : owned.filter((h) => h.asset_type === filter);
    const key = {
      value: (h) => -(h.value ?? h.invested),
      pnl: (h) => -((h.pnl ?? 0) / (h.invested || 1)),
      today: (h) => -((h.price && h.prev_close) ? (h.price - h.prev_close) / h.prev_close : 0),
      name: (h) => h.name.toLowerCase(),
    }[sort];
    return [...base].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  }, [owned, watch, filter, sort]);

  const open = holdings.find((h) => h.id === openId) || null;
  const counts = { all: owned.length, watch: watch.length };
  Object.keys(TYPES).forEach((k) => { counts[k] = owned.filter((h) => h.asset_type === k).length; });

  const afterChange = (msg) => { load(true); if (msg) toast(msg); };

  return (
    <>
      <AppNav />
      <div className="dash pf">
        <div className="dash-head fb-fade-in">
          <div>
            <div className="eyebrow d-flex align-items-center gap-2">
              <span className="live-dot" /> Live markets{updatedAt && <> · updated {updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>}
            </div>
            <h1 className="serif dash-hello">Your <em className="grad-text">portfolio</em></h1>
          </div>
          <div className="d-flex gap-2">
            <button className="fb-btn fb-btn-ghost" onClick={() => load(true)} disabled={refreshing} aria-label="Refresh prices">
              <FiRefreshCw className={refreshing ? 'spin' : ''} />
            </button>
            <button className="fb-btn" onClick={() => setAddOpen(true)}><FiPlus /> Add investment</button>
          </div>
        </div>

        {loading ? <PfSkeleton /> : (
          <>
            <div className="hero-grid">
              <ValueCard t={t} />
              <AllocationCard allocation={data.allocation} total={t.value} />
            </div>

            {holdings.length === 0 ? (
              <div className="fb-card fb-fade-in">
                <div className="fb-empty">
                  <div className="icon"><FiBriefcase /></div>
                  <div className="fw-semibold" style={{ color: 'var(--text)' }}>Start your portfolio</div>
                  <div className="small mt-1">Track stocks, ETFs, mutual fund SIPs and crypto with live prices — and see exactly what you've made.</div>
                  <button className="fb-btn fb-btn-sm mt-3" onClick={() => setAddOpen(true)}><FiPlus /> Add your first investment</button>
                </div>
              </div>
            ) : (
              <>
                <div className="tabs-bar">
                  <div className="fb-seg">
                    {[['all', 'All'], ...Object.entries(TYPES).map(([k, v]) => [k, v.label]), ['watch', 'Watchlist']]
                      .filter(([k]) => k === 'all' || counts[k] > 0)
                      .map(([k, label]) => (
                        <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
                          {k === 'watch' && <FiStar />}{label}<span className="count">{counts[k]}</span>
                        </button>
                      ))}
                  </div>
                  <select className="form-select pf-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort holdings">
                    <option value="value">Sort: Value</option>
                    <option value="pnl">Sort: Returns %</option>
                    <option value="today">Sort: Today</option>
                    <option value="name">Sort: Name</option>
                  </select>
                </div>

                <div className="fb-card pf-list fb-fade-in">
                  <div className="pf-head">
                    <span>Investment</span><span>Price</span><span>Holding</span><span>Value</span><span>Returns</span>
                  </div>
                  {list.length === 0 ? (
                    <div className="fb-empty"><div className="small">Nothing here yet.</div></div>
                  ) : list.map((h) => <HoldingRow key={h.id} h={h} onOpen={() => setOpenId(h.id)} />)}
                </div>
              </>
            )}
            <p className="small faint mt-3">
              Prices: Yahoo Finance (stocks, ETFs), AMFI via mfapi.in (mutual fund NAVs, updated daily), CoinGecko (crypto).
              Stock quotes may be delayed. Foreign stocks are converted to ₹ at the live rate.
            </p>
          </>
        )}
      </div>

      <HoldingDrawer h={open} onClose={() => setOpenId(null)}
        onTrade={(side) => setTrade({ holding: open, side })}
        onSip={() => setSipFor(open)}
        onChanged={afterChange} toast={toast}
        askConfirm={setConfirm} />

      {addOpen && <AddInvestmentModal onClose={() => setAddOpen(false)} toast={toast}
        onDone={(msg, id) => { setAddOpen(false); afterChange(msg); if (id) setOpenId(id); }} />}
      {trade && <TradeModal holding={trade.holding} initialSide={trade.side} onClose={() => setTrade(null)} toast={toast}
        onDone={(msg) => { setTrade(null); afterChange(msg); }} />}
      {sipFor && <SipModal holding={sipFor} onClose={() => setSipFor(null)} toast={toast}
        onDone={(msg) => { setSipFor(null); afterChange(msg); }} />}
      <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />
      <Toasts toasts={toasts} />
    </>
  );
}

/* =====================================================================
   Hero
   ===================================================================== */
function ValueCard({ t }) {
  const value = useCountUp(t.value);
  const pnlPct = t.invested > 0 ? (t.pnl / t.invested) * 100 : null;
  const prevValue = t.value - t.day_change;
  const dayPct = prevValue > 0 ? (t.day_change / prevValue) * 100 : null;
  return (
    <div className="fb-card fb-card-hero fb-fade-in d1">
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div className="eyebrow">Current value</div>
        {t.monthly_sip > 0 && <span className="fb-chip violet"><FiRepeat /> {money(t.monthly_sip)}/month in SIPs</span>}
      </div>
      <div className="serif hero-net num grad-text">{money(value)}</div>
      <div className={`pf-today ${tone(t.day_change)}`}>
        {t.day_change >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
        <span className="num">{signed(t.day_change)}</span> <span className="num">({pct(dayPct)})</span> <span className="muted">today</span>
      </div>
      <div className="hero-meta">
        <div><div className="k">Invested</div><div className="v num">{money(t.invested)}</div></div>
        <div><div className="k">Total returns</div><div className={`v num ${tone(t.pnl)}`}>{signed(t.pnl)} <small>{pct(pnlPct)}</small></div></div>
        <div><div className="k" title="Annualised return that accounts for when each rupee went in">XIRR</div><div className={`v num ${tone(t.xirr)}`}>{t.xirr == null ? '—' : pct(t.xirr * 100)}</div></div>
        {Math.abs(t.realized) > 0.5 && <div><div className="k">Booked P&amp;L</div><div className={`v num ${tone(t.realized)}`}>{signed(t.realized)}</div></div>}
      </div>
      {!t.priced && <div className="small faint mt-3">Some live prices are unavailable right now — those holdings are shown at cost.</div>}
    </div>
  );
}

function AllocationCard({ allocation, total }) {
  const rows = Object.entries(allocation).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <div className="fb-card fb-fade-in d2">
      <div className="fb-card-title"><span>Allocation</span></div>
      {rows.length === 0 ? <div className="small muted">Your mix of stocks, funds and crypto will appear here.</div> : (
        <>
          <div style={{ height: 150, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows.map(([k, v]) => ({ name: TYPES[k].label, value: v, k }))} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={2} stroke="none">
                  {rows.map(([k]) => <Cell key={k} fill={TYPES[k].color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="position-absolute top-50 start-50 translate-middle text-center" style={{ pointerEvents: 'none' }}>
              <div className="small faint">{rows.length} {rows.length === 1 ? 'class' : 'classes'}</div>
            </div>
          </div>
          {rows.map(([k, v]) => (
            <div key={k} className="legend-row">
              <span className="sw" style={{ background: TYPES[k].color }} />
              <span className="flex-grow-1">{TYPES[k].label}</span>
              <span className="muted small num">{((v / total) * 100).toFixed(1)}%</span>
              <span className="num" style={{ minWidth: 86, textAlign: 'right' }}>{money(v)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function PfSkeleton() {
  return (
    <>
      <div className="hero-grid">
        <div className="fb-skeleton" style={{ height: 250 }} />
        <div className="fb-skeleton" style={{ height: 250 }} />
      </div>
      <div className="fb-skeleton" style={{ height: 380 }} />
      <div className="small faint text-center mt-3">Fetching live prices…</div>
    </>
  );
}

/* =====================================================================
   Holdings
   ===================================================================== */
function AssetMark({ h, size = 40 }) {
  const c = TYPES[h.asset_type].color;
  return (
    <div className="fb-dot" style={{ background: `${c}1c`, color: c, width: size, height: size, border: `1px solid ${c}33` }}>
      {h.name.replace(/^the\s+/i, '')[0]?.toUpperCase()}
    </div>
  );
}

function HoldingRow({ h, onOpen }) {
  const dayPct = h.price && h.prev_close ? ((h.price - h.prev_close) / h.prev_close) * 100 : null;
  const pnlPct = h.invested > 0 && h.pnl != null ? (h.pnl / h.invested) * 100 : null;
  const watch = h.units <= 0;
  return (
    <button className="pf-row" onClick={onOpen}>
      <span className="pf-cell-name">
        <AssetMark h={h} />
        <span style={{ minWidth: 0 }}>
          <span className="fw-semibold fb-ellipsis d-block">{h.name}</span>
          <span className="small faint d-flex gap-2 align-items-center flex-wrap">
            <span>{TYPES[h.asset_type].one}{h.asset_type !== 'mf' && ` · ${h.symbol.replace(/\.(NS|BO)$/, '')}`}</span>
            {h.sips.some((s) => s.active) && <span className="pf-tag"><FiRepeat size={10} /> SIP</span>}
          </span>
        </span>
      </span>
      <span className="pf-cell">
        <span className="num">{priceFmt(h.price)}</span>
        <span className={`small num ${tone(dayPct)}`}>{pct(dayPct)}</span>
      </span>
      <span className="pf-cell">
        {watch ? <span className="small faint">Watching</span> : (
          <>
            <span className="num">{fmtUnits(h.units, h.asset_type)} <span className="faint small">units</span></span>
            <span className="small faint num">avg {priceFmt(h.avg_price)}</span>
          </>
        )}
      </span>
      <span className="pf-cell">
        {!watch && <><span className="num fw-semibold">{money(h.value ?? h.invested)}</span><span className="small faint num">{money(h.invested)} in</span></>}
      </span>
      <span className="pf-cell">
        {!watch && h.pnl != null && <><span className={`num fw-semibold ${tone(h.pnl)}`}>{signed(h.pnl)}</span><span className={`small num ${tone(h.pnl)}`}>{pct(pnlPct)}</span></>}
      </span>
    </button>
  );
}

/* =====================================================================
   Detail drawer
   ===================================================================== */
const RANGE_LABELS = [['1m', '1M'], ['6m', '6M'], ['1y', '1Y'], ['5y', '5Y']];

function HoldingDrawer({ h, onClose, onTrade, onSip, onChanged, toast, askConfirm }) {
  const [range, setRange] = useState('1y');
  const [hist, setHist] = useState(null);
  const shown = useRef(null);
  if (h) shown.current = h; // keep content during the slide-out
  const x = h || shown.current;

  useEffect(() => {
    if (!h) return undefined;
    let alive = true;
    setHist(null);
    axios.get(`${API_BASE}/market/history`, { params: { symbol: h.symbol, type: h.asset_type, range } })
      .then((r) => alive && setHist(r.data))
      .catch(() => alive && setHist([]));
    return () => { alive = false; };
  }, [h, range]);

  useEffect(() => {
    if (!h) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [h, onClose]);

  if (!x) return null;
  const dayPct = x.price && x.prev_close ? ((x.price - x.prev_close) / x.prev_close) * 100 : null;
  const first = hist?.[0]?.price, last = hist?.[hist.length - 1]?.price;
  const rangePct = first && last ? ((last - first) / first) * 100 : null;
  const up = rangePct == null || rangePct >= 0;
  const pnlPct = x.invested > 0 && x.pnl != null ? (x.pnl / x.invested) * 100 : null;

  const del = (title, body, url, done) => askConfirm({
    title, body,
    onYes: () => axios.delete(url).then(() => onChanged(done)).catch((err) => toast(apiError(err), 'error')),
  });

  return (
    <>
      <div className={`ai-scrim ${h ? 'open' : ''}`} onClick={onClose} />
      <aside className={`ai-drawer pf-drawer ${h ? 'open' : ''}`} aria-hidden={!h} aria-label={`${x.name} details`}>
        <div className="ai-head">
          <button className="fb-icon-btn" onClick={onClose} aria-label="Back"><FiArrowLeft /></button>
          <AssetMark h={x} size={38} />
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="fw-semibold fb-ellipsis">{x.name}</div>
            <div className="small faint">{TYPES[x.asset_type].one}{x.exchange ? ` · ${x.exchange}` : ''}{x.asset_type !== 'mf' ? ` · ${x.symbol}` : ''}</div>
          </div>
          <button className="fb-icon-btn" onClick={onClose} aria-label="Close"><FiX /></button>
        </div>

        <div className="ai-body">
          <div>
            <div className="serif num" style={{ fontSize: 40, lineHeight: 1 }}>{priceFmt(x.price)}</div>
            <div className="small mt-1">
              <span className={`num ${tone(dayPct)}`}>{pct(dayPct)} today</span>
              {x.currency && x.currency !== 'INR' && x.native_price != null && <span className="faint"> · {x.currency} {x.native_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>}
              {x.asset_type === 'mf' && x.as_of && <span className="faint"> · NAV of {new Date(x.as_of * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
            </div>
          </div>

          <div className="pf-chart">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className={`small num ${rangePct == null ? 'faint' : tone(rangePct)}`}>{rangePct == null ? ' ' : `${pct(rangePct)} in ${RANGE_LABELS.find(([k]) => k === range)[1]}`}</span>
              <div className="fb-seg pf-range">
                {RANGE_LABELS.filter(([k]) => x.asset_type !== 'crypto' || k !== '5y').map(([k, l]) => (
                  <button key={k} className={range === k ? 'active' : ''} onClick={() => setRange(k)}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ height: 190 }}>
              {hist == null ? <div className="fb-skeleton h-100" /> : hist.length < 2 ? (
                <div className="h-100 d-grid small faint" style={{ placeItems: 'center' }}>Chart unavailable right now</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hist} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pfArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={up ? '#d9b44a' : '#f19a8f'} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={up ? '#d9b44a' : '#f19a8f'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip cursor={{ stroke: 'rgba(232,207,143,0.35)' }} content={({ active, payload }) => active && payload?.length ? (
                      <div className="fb-tooltip"><div className="faint small">{fmtDate(payload[0].payload.date)}</div><b className="num">{priceFmt(payload[0].value)}</b></div>
                    ) : null} />
                    <Area type="monotone" dataKey="price" stroke={up ? '#e8c766' : '#f19a8f'} strokeWidth={2} fill="url(#pfArea)" animationDuration={700} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {x.units > 0 ? (
            <div className="pf-stats">
              <div><span>Units</span><b className="num">{fmtUnits(x.units, x.asset_type)}</b></div>
              <div><span>Avg. buy price</span><b className="num">{priceFmt(x.avg_price)}</b></div>
              <div><span>Invested</span><b className="num">{money(x.invested)}</b></div>
              <div><span>Current value</span><b className="num">{money(x.value ?? x.invested)}</b></div>
              <div><span>Returns</span><b className={`num ${tone(x.pnl)}`}>{x.pnl == null ? '—' : `${signed(x.pnl)} (${pct(pnlPct)})`}</b></div>
              <div><span>XIRR</span><b className={`num ${tone(x.xirr)}`}>{x.xirr == null ? '—' : pct(x.xirr * 100)}</b></div>
              <div><span>Today</span><b className={`num ${tone(x.day_change)}`}>{x.day_change == null ? '—' : signed(x.day_change)}</b></div>
              {Math.abs(x.realized) > 0.5 && <div><span>Booked P&amp;L</span><b className={`num ${tone(x.realized)}`}>{signed(x.realized)}</b></div>}
            </div>
          ) : (
            <div className="forecast"><FiEye /><span>You're watching this. Add a purchase or start a SIP to track returns.</span></div>
          )}

          <div className="d-flex gap-2">
            <button className="fb-btn flex-grow-1" onClick={() => onTrade('buy')}><FiPlus /> Buy</button>
            {x.units > 0 && <button className="fb-btn fb-btn-ghost flex-grow-1" onClick={() => onTrade('sell')}>Sell</button>}
            <button className="fb-btn fb-btn-ghost flex-grow-1" onClick={onSip}><FiRepeat /> SIP</button>
          </div>

          {x.sips.length > 0 && (
            <div>
              <div className="eyebrow mb-2">SIPs</div>
              {x.sips.map((s) => (
                <div key={s.id} className="pf-line">
                  <span className="pf-tag"><FiRepeat size={11} /></span>
                  <span className="flex-grow-1">
                    <b className="num">{money(s.amount)}</b> every month on day {s.day}
                    <span className="d-block small faint">{s.active ? `Since ${fmtDate(s.start_date)}` : 'Paused'}</span>
                  </span>
                  <button className="fb-icon-btn" title={s.active ? 'Pause' : 'Resume'} aria-label={s.active ? 'Pause SIP' : 'Resume SIP'}
                    onClick={() => axios.post(`${API_BASE}/portfolio/sips/${s.id}/toggle`).then(() => onChanged(s.active ? 'SIP paused' : 'SIP resumed')).catch((err) => toast(apiError(err), 'error'))}>
                    {s.active ? <FiPause /> : <FiPlay />}
                  </button>
                  <button className="fb-icon-btn danger" aria-label="Stop SIP"
                    onClick={() => del('Stop this SIP?', 'Future installments stop. Units already bought stay in your holding.', `${API_BASE}/portfolio/sips/${s.id}`, 'SIP stopped')}>
                    <FiTrash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {x.lots.length > 0 && (
            <div>
              <div className="eyebrow mb-2">History</div>
              {x.lots.map((l) => (
                <div key={l.id} className="pf-line">
                  <span className={`pf-side ${l.side}`}>{l.sip ? 'SIP' : l.side === 'buy' ? 'Buy' : 'Sell'}</span>
                  <span className="flex-grow-1">
                    <span className="num">{fmtUnits(l.units, x.asset_type)}</span> <span className="faint">@</span> <span className="num">{priceFmt(l.price)}</span>
                    <span className="d-block small faint">{fmtDate(l.date)}</span>
                  </span>
                  <b className="num">{money(l.amount)}</b>
                  <button className="fb-icon-btn danger" aria-label="Delete entry"
                    onClick={() => del('Delete this entry?', `${l.side === 'buy' ? 'Purchase' : 'Sale'} of ${money(l.amount)} on ${fmtDate(l.date)}.`, `${API_BASE}/portfolio/lots/${l.id}`, 'Entry deleted')}>
                    <FiTrash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button className="fb-btn fb-btn-ghost fb-btn-sm align-self-start mt-2" style={{ color: 'var(--neg)' }}
            onClick={() => del(`Remove ${x.name}?`, 'This removes it and all its history from your portfolio.', `${API_BASE}/portfolio/holdings/${x.id}`, 'Removed from portfolio')}>
            <FiTrash2 /> Remove from portfolio
          </button>
        </div>
      </aside>
    </>
  );
}

/* =====================================================================
   Add investment
   ===================================================================== */
function usePriceOn(asset, date) {
  const [state, setState] = useState({ loading: false, price: null });
  useEffect(() => {
    if (!asset || !date) return undefined;
    let alive = true;
    setState({ loading: true, price: null });
    axios.get(`${API_BASE}/market/price-on`, { params: { symbol: asset.symbol, type: asset.asset_type, on: date } })
      .then((r) => alive && setState({ loading: false, price: r.data.price }))
      .catch(() => alive && setState({ loading: false, price: null }));
    return () => { alive = false; };
  }, [asset, date]);
  return state;
}

function AddInvestmentModal({ onClose, onDone, toast }) {
  const [kind, setKind] = useState('stock');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [asset, setAsset] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); setSearching(false); return undefined; }
    setSearching(true);
    timer.current = setTimeout(() => {
      axios.get(`${API_BASE}/market/search`, { params: { q, type: kind } })
        .then((r) => setResults(kind === 'etf' ? r.data.filter((x) => x.asset_type === 'etf') : r.data.filter((x) => x.asset_type !== 'etf' || kind !== 'stock')))
        .catch((err) => { setResults([]); toast(apiError(err), 'error'); })
        .finally(() => setSearching(false));
    }, 320);
    return () => clearTimeout(timer.current);
  }, [q, kind, toast]);

  return (
    <Modal show onHide={onClose} centered size="lg" className="pf-modal">
      <Modal.Header closeButton>
        <Modal.Title>{asset ? 'Add to portfolio' : 'Add investment'}</Modal.Title>
      </Modal.Header>
      {!asset ? (
        <Modal.Body>
          <div className="fb-seg mb-3 w-100">
            {SEARCH_TABS.map(([k, l]) => (
              <button key={k} className={kind === k ? 'active' : ''} onClick={() => { setKind(k); setResults([]); }}>{l}</button>
            ))}
          </div>
          <div className="fb-input-wrap mb-2">
            <FiSearch className="prefix" />
            <input className="fb-input" style={{ paddingLeft: 40 }} autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={{ stock: 'Search e.g. Reliance, TCS, Apple', etf: 'Search e.g. Nifty BeES, Gold BeES', mf: 'Search e.g. Parag Parikh Flexi Cap', crypto: 'Search e.g. Bitcoin, Ethereum' }[kind]} />
          </div>
          <div className="pf-results">
            {searching && <div className="small faint p-3 d-flex align-items-center gap-2"><Spinner /> Searching markets…</div>}
            {!searching && q.trim().length >= 2 && results.length === 0 && <div className="small faint p-3">No matches. Try another name or symbol.</div>}
            {!searching && results.map((r) => (
              <button key={`${r.asset_type}-${r.symbol}`} className="pf-result" onClick={() => setAsset(r)}>
                <AssetMark h={r} size={36} />
                <span className="flex-grow-1 text-start" style={{ minWidth: 0 }}>
                  <span className="d-block fw-semibold fb-ellipsis">{r.name}</span>
                  <span className="small faint">{r.asset_type === 'mf' ? `Scheme ${r.symbol}` : r.symbol}{r.exchange ? ` · ${r.exchange}` : ''}</span>
                </span>
                <FiPlus />
              </button>
            ))}
            {q.trim().length < 2 && (
              <div className="small faint p-3">
                {kind === 'mf' ? 'Tip: pick the “Direct – Growth” plan if you invest through an app like Groww, Zerodha Coin or Kuvera.'
                  : kind === 'stock' ? 'Indian stocks show NSE first. US and global stocks are converted to ₹ automatically.'
                    : kind === 'crypto' ? 'Prices come straight in ₹ from CoinGecko.' : 'ETFs trade like stocks — search by fund name or ticker.'}
              </div>
            )}
          </div>
        </Modal.Body>
      ) : (
        <AddDetails asset={asset} onBack={() => setAsset(null)} onDone={onDone} toast={toast} />
      )}
    </Modal>
  );
}

function AddDetails({ asset, onBack, onDone, toast }) {
  const [mode, setMode] = useState(asset.asset_type === 'mf' ? 'sip' : 'amount');
  const [date, setDate] = useState(todayLocal());
  const [amount, setAmount] = useState('');
  const [units, setUnits] = useState('');
  const [price, setPrice] = useState('');
  const [sipDay, setSipDay] = useState(String(Math.min(28, new Date().getDate())));
  const [sipStart, setSipStart] = useState(todayLocal());
  const [saving, setSaving] = useState(false);
  const market = usePriceOn(asset, mode === 'sip' ? null : date);
  const effPrice = parseFloat(price) || market.price;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: h } = await axios.post(`${API_BASE}/portfolio/holdings`,
        { asset_type: asset.asset_type, symbol: asset.symbol, name: asset.name, exchange: asset.exchange || null });
      if (mode === 'amount' || mode === 'units') {
        const body = { side: 'buy', date: toApiDate(date) };
        if (mode === 'amount') body.amount = parseFloat(amount); else body.units = parseFloat(units);
        if (parseFloat(price) > 0) body.price = parseFloat(price);
        await axios.post(`${API_BASE}/portfolio/holdings/${h.id}/lots`, body);
      } else if (mode === 'sip') {
        await axios.post(`${API_BASE}/portfolio/holdings/${h.id}/sips`, { amount: parseFloat(amount), day: Number(sipDay), start_date: toApiDate(sipStart) });
      }
      onDone(mode === 'watch' ? `Watching ${asset.name}` : mode === 'sip' ? 'SIP added — past installments filled in at real NAVs' : 'Investment added', h.id);
    } catch (err) {
      toast(apiError(err), 'error');
      setSaving(false);
    }
  };

  const est = mode === 'amount' && effPrice && parseFloat(amount) > 0 ? parseFloat(amount) / effPrice : null;
  const cost = mode === 'units' && effPrice && parseFloat(units) > 0 ? parseFloat(units) * effPrice : null;

  return (
    <form onSubmit={submit}>
      <Modal.Body>
        <div className="pf-picked">
          <AssetMark h={asset} size={42} />
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="fw-semibold fb-ellipsis">{asset.name}</div>
            <div className="small faint">{TYPES[asset.asset_type].one} · {asset.asset_type === 'mf' ? `Scheme ${asset.symbol}` : asset.symbol}</div>
          </div>
          <button type="button" className="fb-btn fb-btn-ghost fb-btn-sm" onClick={onBack}>Change</button>
        </div>

        <div className="fb-seg w-100 my-3">
          {[['amount', 'I invested ₹'], ['units', 'Units & price'], ['sip', 'Monthly SIP'], ['watch', 'Just watch']].map(([k, l]) => (
            <button type="button" key={k} className={mode === k ? 'active' : ''} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>

        {mode === 'watch' && <div className="small muted">Adds it to your watchlist with a live price — no money involved.</div>}

        {(mode === 'amount' || mode === 'sip') && (
          <>
            <label className="fb-label">{mode === 'sip' ? 'Monthly SIP amount' : 'Amount invested'}</label>
            <div className="fb-input-wrap amount-wrap mb-3">
              <span className="prefix">₹</span>
              <input className="fb-input amount-input num" type="number" min="0" step="any" inputMode="decimal" placeholder="0"
                value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
            </div>
          </>
        )}

        {mode === 'units' && (
          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="fb-label">Units / quantity</label>
              <input className="fb-input num" type="number" min="0" step="any" inputMode="decimal" placeholder="0"
                value={units} onChange={(e) => setUnits(e.target.value)} required autoFocus />
            </div>
            <div className="col-6">
              <label className="fb-label">Buy price per unit <span className="faint">(₹)</span></label>
              <input className="fb-input num" type="number" min="0" step="any" inputMode="decimal"
                placeholder={market.price ? market.price.toFixed(2) : 'Market price'} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
        )}

        {(mode === 'amount' || mode === 'units') && (
          <>
            <div className="row g-3">
              <div className="col-6">
                <label className="fb-label">Date</label>
                <input className="fb-input" type="date" max={todayLocal()} value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              {mode === 'amount' && (
                <div className="col-6">
                  <label className="fb-label">Price <span className="faint">(optional)</span></label>
                  <input className="fb-input num" type="number" min="0" step="any" inputMode="decimal"
                    placeholder={market.price ? market.price.toFixed(2) : 'Market price'} value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
              )}
            </div>
            <div className="forecast mt-3">
              <FiTrendingUp />
              <span>
                {market.loading ? 'Looking up the market price…'
                  : effPrice ? <>Price on {fmtDate(date)}: <b className="num">{priceFmt(effPrice)}</b>
                    {est != null && <> → you get <b className="num">{fmtUnits(est, asset.asset_type)}</b> units</>}
                    {cost != null && <> → cost <b className="num">{money(cost)}</b></>}</>
                    : 'No market price for that date — enter your buy price.'}
              </span>
            </div>
          </>
        )}

        {mode === 'sip' && (
          <>
            <div className="row g-3">
              <div className="col-6">
                <label className="fb-label">SIP day each month</label>
                <select className="form-select" value={sipDay} onChange={(e) => setSipDay(e.target.value)}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="fb-label">Started on</label>
                <input className="fb-input" type="date" max={todayLocal()} value={sipStart} onChange={(e) => setSipStart(e.target.value)} required />
              </div>
            </div>
            <div className="forecast mt-3"><FiRepeat /><span>Started in the past? Every installment since then is added automatically at that day's real {asset.asset_type === 'mf' ? 'NAV' : 'price'}.</span></div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="fb-btn fb-btn-ghost" onClick={onBack}>Back</button>
        <button type="submit" className="fb-btn" disabled={saving || ((mode === 'amount' || mode === 'units') && !effPrice && !market.loading && !(parseFloat(price) > 0))}>
          {saving ? <Spinner /> : mode === 'watch' ? 'Add to watchlist' : mode === 'sip' ? 'Start SIP' : 'Add investment'}
        </button>
      </Modal.Footer>
    </form>
  );
}

/* =====================================================================
   Buy / sell and SIP for an existing holding
   ===================================================================== */
function TradeModal({ holding, initialSide, onClose, onDone, toast }) {
  const [side, setSide] = useState(initialSide);
  const [mode, setMode] = useState('amount');
  const [date, setDate] = useState(todayLocal());
  const [value, setValue] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const asset = useMemo(() => ({ symbol: holding.symbol, asset_type: holding.asset_type }), [holding.symbol, holding.asset_type]);
  const market = usePriceOn(asset, date);
  const effPrice = parseFloat(price) || market.price;
  const v = parseFloat(value);
  const unitsPreview = mode === 'amount' && effPrice && v > 0 ? v / effPrice : mode === 'units' ? v : null;

  const submit = (e) => {
    e.preventDefault();
    const body = { side, date: toApiDate(date), [mode]: v };
    if (parseFloat(price) > 0) body.price = parseFloat(price);
    setSaving(true);
    axios.post(`${API_BASE}/portfolio/holdings/${holding.id}/lots`, body)
      .then(() => onDone(side === 'buy' ? 'Purchase added' : 'Sale recorded'))
      .catch((err) => { toast(apiError(err), 'error'); setSaving(false); });
  };

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>{side === 'buy' ? 'Buy' : 'Sell'} · {holding.name.length > 26 ? `${holding.name.slice(0, 26)}…` : holding.name}</Modal.Title></Modal.Header>
      <form onSubmit={submit}>
        <Modal.Body>
          <div className="fb-seg income type-toggle mb-3">
            <button type="button" className={`is-income ${side === 'buy' ? 'active' : ''}`} onClick={() => setSide('buy')}>Buy</button>
            <button type="button" className={`is-expense ${side === 'sell' ? 'active' : ''}`} onClick={() => setSide('sell')} disabled={holding.units <= 0}>Sell</button>
          </div>
          <div className="fb-seg w-100 mb-3">
            <button type="button" className={mode === 'amount' ? 'active' : ''} onClick={() => setMode('amount')}>By amount (₹)</button>
            <button type="button" className={mode === 'units' ? 'active' : ''} onClick={() => setMode('units')}>By units</button>
          </div>
          <div className="fb-input-wrap amount-wrap mb-3">
            {mode === 'amount' && <span className="prefix">₹</span>}
            <input className={`fb-input amount-input num ${mode === 'units' ? 'ps-3' : ''}`} type="number" min="0" step="any" inputMode="decimal"
              placeholder={mode === 'units' ? 'Units' : '0'} value={value} onChange={(e) => setValue(e.target.value)} required autoFocus />
          </div>
          {side === 'sell' && (
            <div className="d-flex gap-2 mb-3 flex-wrap">
              {[0.25, 0.5, 1].map((f) => (
                <button key={f} type="button" className="fb-chip" onClick={() => { setMode('units'); setValue(String(+(holding.units * f).toFixed(6))); }}>
                  {f === 1 ? 'Sell all' : `${f * 100}%`}
                </button>
              ))}
              <span className="small faint align-self-center">You hold {fmtUnits(holding.units, holding.asset_type)} units</span>
            </div>
          )}
          <div className="row g-3">
            <div className="col-6">
              <label className="fb-label">Date</label>
              <input className="fb-input" type="date" max={todayLocal()} value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="col-6">
              <label className="fb-label">Price per unit <span className="faint">(optional)</span></label>
              <input className="fb-input num" type="number" min="0" step="any" inputMode="decimal"
                placeholder={market.price ? market.price.toFixed(2) : 'Market price'} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="forecast mt-3">
            <FiTrendingUp />
            <span>{market.loading ? 'Looking up the market price…' : effPrice
              ? <>At <b className="num">{priceFmt(effPrice)}</b>{unitsPreview > 0 && <> → <b className="num">{fmtUnits(unitsPreview, holding.asset_type)}</b> units = <b className="num">{money(unitsPreview * effPrice)}</b></>}</>
              : 'No market price for that date — enter the price yourself.'}</span>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="fb-btn fb-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="fb-btn" disabled={saving}>{saving ? <Spinner /> : side === 'buy' ? 'Add purchase' : 'Record sale'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

function SipModal({ holding, onClose, onDone, toast }) {
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(String(Math.min(28, new Date().getDate())));
  const [start, setStart] = useState(todayLocal());
  const [saving, setSaving] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    setSaving(true);
    axios.post(`${API_BASE}/portfolio/holdings/${holding.id}/sips`, { amount: parseFloat(amount), day: Number(day), start_date: toApiDate(start) })
      .then(() => onDone('SIP started'))
      .catch((err) => { toast(apiError(err), 'error'); setSaving(false); });
  };
  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>Monthly SIP</Modal.Title></Modal.Header>
      <form onSubmit={submit}>
        <Modal.Body>
          <div className="small muted mb-3">{holding.name}</div>
          <label className="fb-label">Amount every month</label>
          <div className="fb-input-wrap amount-wrap mb-3">
            <span className="prefix">₹</span>
            <input className="fb-input amount-input num" type="number" min="0" step="any" inputMode="decimal" placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
          </div>
          <div className="row g-3">
            <div className="col-6">
              <label className="fb-label">Day of month</label>
              <select className="form-select" value={day} onChange={(e) => setDay(e.target.value)}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-6">
              <label className="fb-label">Started on</label>
              <input className="fb-input" type="date" max={todayLocal()} value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
          </div>
          <div className="forecast mt-3"><FiRepeat /><span>Past installments are filled in automatically at each date's real price, and new ones appear every month.</span></div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="fb-btn fb-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="fb-btn" disabled={saving}>{saving ? <Spinner /> : 'Start SIP'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

export default Portfolio;
