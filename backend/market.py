"""Live market data from free, key-less sources.

- Stocks & ETFs (NSE/BSE/US...): Yahoo Finance chart + search endpoints
- Indian mutual funds (incl. SIPs): mfapi.in (official AMFI NAVs)
- Crypto: CoinGecko (priced directly in INR)

Everything is cached in memory so a dashboard refresh doesn't hammer the providers.
"""
import asyncio
import logging
import time
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

import httpx
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_active_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/market", tags=["Market data"])

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126 Safari/537.36"}
YAHOO = "https://query1.finance.yahoo.com"
MFAPI = "https://api.mfapi.in"
GECKO = "https://api.coingecko.com/api/v3"

ASSET_TYPES = ("stock", "etf", "mf", "crypto")
RANGES = {"1m": 30, "6m": 182, "1y": 365, "5y": 1825}

_cache: Dict[str, Tuple[float, object]] = {}


def _cached(key: str):
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    return None


def _store(key: str, value, ttl: float):
    if len(_cache) > 5000:  # crude bound on memory
        _cache.clear()
    _cache[key] = (time.time() + ttl, value)
    return value


async def _get_json(url: str, params: Optional[dict] = None, timeout: float = 12.0):
    async with httpx.AsyncClient(headers=UA, timeout=timeout, follow_redirects=True) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


# ---------------------------------------------------------------- search
async def search(q: str, kind: str) -> List[dict]:
    q = q.strip()
    if len(q) < 2:
        return []
    key = f"search:{kind}:{q.lower()}"
    if (hit := _cached(key)) is not None:
        return hit

    results: List[dict] = []
    if kind in ("stock", "etf"):
        data = await _get_json(f"{YAHOO}/v1/finance/search",
                               {"q": q, "quotesCount": 12, "newsCount": 0, "listsCount": 0})
        for item in data.get("quotes", []):
            qt = item.get("quoteType")
            if qt not in ("EQUITY", "ETF"):
                continue
            results.append({
                "asset_type": "etf" if qt == "ETF" else "stock",
                "symbol": item["symbol"],
                "name": item.get("longname") or item.get("shortname") or item["symbol"],
                "exchange": item.get("exchDisp") or item.get("exchange") or "",
            })
        # Indian investors first: NSE, then BSE, then everything else
        order = {"NSE": 0, "Bombay": 1, "BSE": 1}
        results.sort(key=lambda r: order.get(r["exchange"], 2))
    elif kind == "mf":
        data = await _get_json(f"{MFAPI}/mf/search", {"q": q})
        for item in data[:25]:
            results.append({
                "asset_type": "mf",
                "symbol": str(item["schemeCode"]),
                "name": item["schemeName"],
                "exchange": "AMFI",
            })
        # Growth plans are what most people hold; float them up
        results.sort(key=lambda r: (("growth" not in r["name"].lower()), ("direct" not in r["name"].lower())))
    elif kind == "crypto":
        data = await _get_json(f"{GECKO}/search", {"query": q})
        for item in data.get("coins", [])[:12]:
            results.append({
                "asset_type": "crypto",
                "symbol": item["id"],
                "name": f"{item['name']} ({item['symbol'].upper()})",
                "exchange": f"Rank #{item['market_cap_rank']}" if item.get("market_cap_rank") else "Crypto",
            })
    return _store(key, results, 600)


# ---------------------------------------------------------------- quotes
async def _fx_to_inr(currency: str) -> float:
    if not currency or currency.upper() == "INR":
        return 1.0
    key = f"fx:{currency}"
    if (hit := _cached(key)) is not None:
        return hit
    data = await _get_json(f"{YAHOO}/v8/finance/chart/{currency.upper()}INR=X", {"range": "1d", "interval": "1d"})
    rate = data["chart"]["result"][0]["meta"]["regularMarketPrice"]
    return _store(key, float(rate), 1800)


async def _yahoo_quote(symbol: str) -> dict:
    data = await _get_json(f"{YAHOO}/v8/finance/chart/{symbol}", {"range": "1d", "interval": "1d"})
    meta = data["chart"]["result"][0]["meta"]
    price = float(meta["regularMarketPrice"])
    prev = float(meta.get("chartPreviousClose") or meta.get("previousClose") or price)
    currency = meta.get("currency") or "INR"
    fx = await _fx_to_inr(currency)
    return {"price": price * fx, "prev_close": prev * fx, "currency": currency,
            "native_price": price, "as_of": meta.get("regularMarketTime")}


async def _mf_quote(code: str) -> dict:
    data = await _get_json(f"{MFAPI}/mf/{code}", {})
    navs = data.get("data", [])
    if not navs:
        raise ValueError("no NAV data")
    price = float(navs[0]["nav"])
    prev = float(navs[1]["nav"]) if len(navs) > 1 else price
    as_of = datetime.strptime(navs[0]["date"], "%d-%m-%Y").timestamp()
    # Full history is in hand already; keep it for SIP and chart lookups
    _store(f"hist:mf:{code}", _mf_history(navs), 3 * 3600)
    return {"price": price, "prev_close": prev, "currency": "INR", "native_price": price, "as_of": as_of}


async def _crypto_quotes(ids: List[str]) -> Dict[str, dict]:
    data = await _get_json(f"{GECKO}/simple/price", {
        "ids": ",".join(ids), "vs_currencies": "inr", "include_24hr_change": "true",
        "include_last_updated_at": "true"})
    out = {}
    for cid, v in data.items():
        price = float(v["inr"])
        change = float(v.get("inr_24h_change") or 0)
        out[cid] = {"price": price, "prev_close": price / (1 + change / 100) if change > -100 else price,
                    "currency": "INR", "native_price": price, "as_of": v.get("last_updated_at")}
    return out


async def get_quotes(items: List[Tuple[str, str]]) -> Dict[Tuple[str, str], Optional[dict]]:
    """Quotes for (asset_type, symbol) pairs, all prices in INR. Missing/failed -> None."""
    result: Dict[Tuple[str, str], Optional[dict]] = {}
    todo_yahoo, todo_mf, todo_crypto = [], [], []
    for kind, sym in set(items):
        ttl_key = f"quote:{kind}:{sym}"
        if (hit := _cached(ttl_key)) is not None:
            result[(kind, sym)] = hit
        elif kind == "mf":
            todo_mf.append(sym)
        elif kind == "crypto":
            todo_crypto.append(sym)
        else:
            todo_yahoo.append((kind, sym))

    async def one(kind, sym, coro, ttl):
        try:
            result[(kind, sym)] = _store(f"quote:{kind}:{sym}", await coro, ttl)
        except Exception as e:  # provider hiccup: show the holding without a live price
            logger.warning(f"quote failed for {kind}:{sym}: {e}")
            result[(kind, sym)] = None

    tasks = [one(k, s, _yahoo_quote(s), 60) for k, s in todo_yahoo]
    tasks += [one("mf", s, _mf_quote(s), 1800) for s in todo_mf]
    if todo_crypto:
        async def crypto_batch():
            try:
                quotes = await _crypto_quotes(todo_crypto)
            except Exception as e:
                logger.warning(f"crypto quotes failed: {e}")
                quotes = {}
            for s in todo_crypto:
                q = quotes.get(s)
                result[("crypto", s)] = _store(f"quote:crypto:{s}", q, 60) if q else None
        tasks.append(crypto_batch())
    await asyncio.gather(*tasks)
    return result


# ---------------------------------------------------------------- history
def _mf_history(navs: List[dict]) -> List[Tuple[date, float]]:
    pts = [(datetime.strptime(n["date"], "%d-%m-%Y").date(), float(n["nav"])) for n in navs]
    return sorted(pts)


async def get_history(kind: str, symbol: str) -> List[Tuple[date, float]]:
    """Daily closes in INR, oldest first (up to ~5 years)."""
    key = f"hist:{kind}:{symbol}"
    if (hit := _cached(key)) is not None:
        return hit
    if kind == "mf":
        data = await _get_json(f"{MFAPI}/mf/{symbol}", {})
        return _store(key, _mf_history(data.get("data", [])), 3 * 3600)
    if kind == "crypto":
        data = await _get_json(f"{GECKO}/coins/{symbol}/market_chart", {"vs_currency": "inr", "days": 365})
        pts = {}
        for ts, price in data.get("prices", []):
            pts[datetime.utcfromtimestamp(ts / 1000).date()] = float(price)
        return _store(key, sorted(pts.items()), 3 * 3600)
    data = await _get_json(f"{YAHOO}/v8/finance/chart/{symbol}", {"range": "5y", "interval": "1d"})
    res = data["chart"]["result"][0]
    fx = await _fx_to_inr(res["meta"].get("currency") or "INR")
    closes = res["indicators"]["quote"][0].get("close") or []
    pts = [(datetime.utcfromtimestamp(ts).date(), float(c) * fx)
           for ts, c in zip(res.get("timestamp") or [], closes) if c is not None]
    return _store(key, pts, 3 * 3600)


async def price_on(kind: str, symbol: str, day: date) -> Optional[float]:
    """Closing price (INR) on `day`, or the last trading day before it."""
    hist = await get_history(kind, symbol)
    best = None
    for d, p in hist:
        if d > day:
            break
        best = p
    return best if best is not None else (hist[0][1] if hist else None)


# ---------------------------------------------------------------- routes
def _check_kind(kind: str):
    if kind not in ASSET_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of {', '.join(ASSET_TYPES)}")


@router.get("/search")
async def search_route(q: str, type: str = "stock", _user=Depends(get_current_active_user)):
    _check_kind(type)
    try:
        return await search(q, "stock" if type == "etf" else type)
    except Exception as e:
        logger.warning(f"search failed: {e}")
        raise HTTPException(status_code=502, detail="Market search is unavailable right now. Try again shortly.")


@router.get("/quote")
async def quote_route(symbol: str, type: str, _user=Depends(get_current_active_user)):
    _check_kind(type)
    q = (await get_quotes([(type, symbol)])).get((type, symbol))
    if not q:
        raise HTTPException(status_code=502, detail="Live price unavailable right now.")
    return q


@router.get("/price-on")
async def price_on_route(symbol: str, type: str, on: date, _user=Depends(get_current_active_user)):
    _check_kind(type)
    try:
        p = await price_on(type, symbol, on)
    except Exception as e:
        logger.warning(f"price-on failed: {e}")
        p = None
    if p is None:
        raise HTTPException(status_code=404, detail="No price found for that date.")
    return {"price": p, "date": on.isoformat()}


@router.get("/history")
async def history_route(symbol: str, type: str, range: str = "1y", _user=Depends(get_current_active_user)):
    _check_kind(type)
    if range not in RANGES:
        raise HTTPException(status_code=400, detail="range must be 1m, 6m, 1y or 5y")
    try:
        hist = await get_history(type, symbol)
    except Exception as e:
        logger.warning(f"history failed: {e}")
        raise HTTPException(status_code=502, detail="Price history unavailable right now.")
    since = date.today() - timedelta(days=RANGES[range])
    pts = [(d, p) for d, p in hist if d >= since]
    # Keep payloads small: at most ~260 points
    step = max(1, len(pts) // 260)
    sampled = pts[::step]
    if pts and sampled[-1] != pts[-1]:
        sampled.append(pts[-1])
    return [{"date": d.isoformat(), "price": round(p, 4)} for d, p in sampled]
