import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Modal } from 'react-bootstrap';
import { FiPlus, FiSearch, FiTrendingUp, FiRepeat } from 'react-icons/fi';
import { API_BASE } from '../config';
import { Spinner, NumInput } from './ui';
import { todayLocal, toApiDate } from './money';
import { money, moneyExact, apiError } from '../finance';

export const TYPES = {
  stock: { label: 'Stocks', one: 'Stock', color: '#d9b44a' },
  etf: { label: 'ETFs', one: 'ETF', color: '#e8cf8f' },
  mf: { label: 'Mutual funds', one: 'Mutual fund', color: '#74d6a8' },
  crypto: { label: 'Crypto', one: 'Crypto', color: '#8fb3d9' },
};

export const SEARCH_TABS = [['stock', 'Stocks'], ['etf', 'ETFs'], ['mf', 'Mutual funds'], ['crypto', 'Crypto']];

export const fmtDate = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', opts);

export const signed = (n, f = money) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${f(Math.abs(n))}`;

export const pct = (n) => (n == null || !isFinite(n) ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}%`);

export const tone = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted');

export const fmtUnits = (u, type) => {
  if (!u) return '0';
  const dp = type === 'crypto' ? 6 : type === 'mf' ? 3 : u % 1 === 0 ? 0 : 4;
  return Number(u.toFixed(dp)).toLocaleString('en-IN', { maximumFractionDigits: dp });
};

export const priceFmt = (p) => (p == null ? '—' : p >= 100 ? moneyExact(p) : `₹${p.toLocaleString('en-IN', { maximumFractionDigits: 4 })}`);


export function AssetMark({ h, size = 40 }) {
  const c = TYPES[h.asset_type].color;
  return (
    <div className="fb-dot" style={{ background: `${c}1c`, color: c, width: size, height: size, border: `1px solid ${c}33` }}>
      {h.name.replace(/^the\s+/i, '')[0]?.toUpperCase()}
    </div>
  );
}

export function usePriceOn(asset, date) {
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

export function AddInvestmentModal({ onClose, onDone, toast }) {
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

export function AddDetails({ asset, onBack, onDone, toast }) {
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
              <NumInput className="fb-input amount-input num" placeholder="0"
                value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
            </div>
          </>
        )}

        {mode === 'units' && (
          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="fb-label">Units / quantity</label>
              <NumInput className="fb-input num" placeholder="0"
                value={units} onChange={(e) => setUnits(e.target.value)} required autoFocus />
            </div>
            <div className="col-6">
              <label className="fb-label">Buy price per unit <span className="faint">(₹)</span></label>
              <NumInput className="fb-input num"
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
                  <NumInput className="fb-input num"
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


export function TradeModal({ holding, initialSide, onClose, onDone, toast }) {
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
            <NumInput className={`fb-input amount-input num ${mode === 'units' ? 'ps-3' : ''}`}
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
              <NumInput className="fb-input num"
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

export function SipModal({ holding, onClose, onDone, toast }) {
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
            <NumInput className="fb-input amount-input num" placeholder="0"
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

