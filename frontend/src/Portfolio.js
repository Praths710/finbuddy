import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  FiPlus, FiRefreshCw, FiX, FiTrash2, FiTrendingUp, FiTrendingDown, FiRepeat, FiPause, FiPlay,
  FiEye, FiArrowLeft, FiBriefcase, FiStar,
} from 'react-icons/fi';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { API_BASE } from './config';
import { useFinance } from './data/FinanceContext';
import { useCountUp } from './components/ui';
import { PageHead } from './components/page';
import {
  TYPES, fmtDate, signed, pct, tone, fmtUnits, priceFmt, AssetMark, TradeModal, SipModal,
} from './components/invest';
import { money, apiError } from './finance';
import './Portfolio.css';

function Portfolio() {
  const { portfolio: data, portfolioUpdated: updatedAt, reloadPortfolio, openInvest, toast, askConfirm } = useFinance();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('value');
  const [openId, setOpenId] = useState(null);
  const [trade, setTrade] = useState(null); // { holding, side }
  const [sipFor, setSipFor] = useState(null);

  const refresh = () => { setRefreshing(true); reloadPortfolio().finally(() => setRefreshing(false)); };

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

  const afterChange = (msg) => { reloadPortfolio(); if (msg) toast(msg); };

  return (
    <div className="dash pf">
      <PageHead
        eyebrow={<span className="d-inline-flex align-items-center gap-2"><span className="live-dot" /> Live markets{updatedAt && <> · updated {updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>}</span>}
        title={<>Your <em className="grad-text">portfolio</em></>}>
        <button className="fb-btn fb-btn-ghost" onClick={refresh} disabled={refreshing} aria-label="Refresh prices">
          <FiRefreshCw className={refreshing ? 'spin' : ''} />
        </button>
        <button className="fb-btn" onClick={openInvest}><FiPlus /> Add investment</button>
      </PageHead>

      {!data ? <PfSkeleton /> : (
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
                <button className="fb-btn fb-btn-sm mt-3" onClick={openInvest}><FiPlus /> Add your first investment</button>
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

      <HoldingDrawer h={open} onClose={() => setOpenId(null)}
        onTrade={(side) => setTrade({ holding: open, side })}
        onSip={() => setSipFor(open)}
        onChanged={afterChange} toast={toast}
        askConfirm={askConfirm} />

      {trade && <TradeModal holding={trade.holding} initialSide={trade.side} onClose={() => setTrade(null)} toast={toast}
        onDone={(msg) => { setTrade(null); afterChange(msg); }} />}
      {sipFor && <SipModal holding={sipFor} onClose={() => setSipFor(null)} toast={toast}
        onDone={(msg) => { setSipFor(null); afterChange(msg); }} />}
    </div>
  );
}

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

export default Portfolio;
