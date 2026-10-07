"""Investment portfolio: holdings, buy/sell lots, SIPs, live valuation and returns."""
import logging
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import market
import models
import schemas
from auth import get_current_active_user
from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


# ---------------------------------------------------------------- maths
def xirr(flows: List[Tuple[date, float]]) -> Optional[float]:
    """Annualised internal rate of return for dated cash flows (bisection; robust)."""
    if len(flows) < 2 or not any(a < 0 for _, a in flows) or not any(a > 0 for _, a in flows):
        return None
    t0 = min(d for d, _ in flows)
    years = [((d - t0).days / 365.0, a) for d, a in flows]
    if max(y for y, _ in years) < 1 / 365:
        return None

    def npv(rate):
        return sum(a / (1 + rate) ** y for y, a in years)

    lo, hi = -0.9999, 100.0
    f_lo, f_hi = npv(lo), npv(hi)
    if f_lo * f_hi > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2
        f_mid = npv(mid)
        if abs(f_mid) < 1e-7:
            break
        if f_lo * f_mid < 0:
            hi, f_hi = mid, f_mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2


def position(lots: List[models.Lot]) -> Dict[str, float]:
    """Average-cost position from a holding's lots."""
    units = cost = realized = 0.0
    for lot in sorted(lots, key=lambda l: (l.date, l.id or 0)):
        if lot.side == "buy":
            units += lot.units
            cost += lot.units * lot.price
        else:
            sell = min(lot.units, units)
            avg = cost / units if units else 0.0
            cost -= avg * sell
            units -= sell
            realized += (lot.price - avg) * sell
    if units < 1e-9:
        units, cost = 0.0, 0.0
    return {"units": units, "invested": cost, "realized": realized}


# ---------------------------------------------------------------- helpers
def own_holding(db: Session, holding_id: int, user: models.User) -> models.Holding:
    h = db.query(models.Holding).filter(models.Holding.id == holding_id, models.Holding.user_id == user.id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Investment not found")
    return h


def sip_dates(sip: models.Sip, until: date) -> List[date]:
    out = []
    d = sip.start_date.date()
    y, m = d.year, d.month
    if d.day > sip.day:  # first installment is next month
        m += 1
    while True:
        y2, m2 = y + (m - 1) // 12, (m - 1) % 12 + 1
        day = date(y2, m2, sip.day)
        if day > until:
            return out
        out.append(day)
        m += 1


async def materialise_sips(db: Session, holdings: List[models.Holding]) -> None:
    """Create a lot for every SIP installment that has fallen due and doesn't exist yet."""
    today = date.today()
    changed = False
    for h in holdings:
        for sip in h.sips:
            if not sip.active:
                continue
            done = {l.date.date() for l in h.lots if l.sip_id == sip.id}
            for day in sip_dates(sip, today):
                if day in done:
                    continue
                try:
                    price = await market.price_on(h.asset_type, h.symbol, day)
                except Exception as e:
                    logger.warning(f"SIP price lookup failed for {h.symbol} {day}: {e}")
                    break  # try again on the next load
                if not price:
                    continue
                db.add(models.Lot(holding_id=h.id, side="buy", units=sip.amount / price, price=price,
                                  date=datetime(day.year, day.month, day.day, 12), sip_id=sip.id))
                changed = True
    if changed:
        db.commit()
        for h in holdings:
            db.refresh(h)


def lot_out(l: models.Lot) -> dict:
    return {"id": l.id, "side": l.side, "units": l.units, "price": l.price,
            "amount": l.units * l.price, "date": l.date.isoformat(), "sip": l.sip_id is not None}


def sip_out(s: models.Sip) -> dict:
    return {"id": s.id, "amount": s.amount, "day": s.day, "start_date": s.start_date.isoformat(), "active": bool(s.active)}


# ---------------------------------------------------------------- routes
@router.get("")
async def get_portfolio(db: Session = Depends(get_db), user: models.User = Depends(get_current_active_user)):
    holdings = db.query(models.Holding).filter(models.Holding.user_id == user.id).order_by(models.Holding.created_at).all()
    await materialise_sips(db, holdings)
    quotes = await market.get_quotes([(h.asset_type, h.symbol) for h in holdings])

    today = date.today()
    out, all_flows = [], []
    totals = {"invested": 0.0, "value": 0.0, "day_change": 0.0, "realized": 0.0, "priced": True}
    allocation: Dict[str, float] = {}

    for h in holdings:
        pos = position(h.lots)
        q = quotes.get((h.asset_type, h.symbol))
        price = q["price"] if q else None
        value = pos["units"] * price if price is not None else None
        day_change = pos["units"] * (q["price"] - q["prev_close"]) if q else None
        flows = [(l.date.date(), -l.units * l.price if l.side == "buy" else l.units * l.price) for l in h.lots]
        h_xirr = None
        if value is not None and flows:
            h_xirr = xirr(flows + [(today, value)])
            all_flows += flows

        if pos["units"] > 0:
            totals["invested"] += pos["invested"]
            if value is None:
                totals["priced"] = False
                value_for_totals = pos["invested"]  # fall back to cost so totals stay sane
            else:
                value_for_totals = value
                totals["day_change"] += day_change or 0
            totals["value"] += value_for_totals
            allocation[h.asset_type] = allocation.get(h.asset_type, 0) + value_for_totals
        totals["realized"] += pos["realized"]

        out.append({
            "id": h.id, "asset_type": h.asset_type, "symbol": h.symbol, "name": h.name, "exchange": h.exchange,
            "units": pos["units"], "invested": pos["invested"], "realized": pos["realized"],
            "avg_price": pos["invested"] / pos["units"] if pos["units"] else None,
            "price": price, "prev_close": q["prev_close"] if q else None,
            "currency": q["currency"] if q else None, "native_price": q["native_price"] if q else None,
            "as_of": q["as_of"] if q else None,
            "value": value, "pnl": (value - pos["invested"]) if value is not None and pos["units"] else None,
            "day_change": day_change, "xirr": h_xirr,
            "lots": [lot_out(l) for l in sorted(h.lots, key=lambda l: l.date, reverse=True)],
            "sips": [sip_out(s) for s in h.sips],
        })

    totals["pnl"] = totals["value"] - totals["invested"]
    totals["xirr"] = xirr(all_flows + [(today, totals["value"])]) if all_flows else None
    totals["monthly_sip"] = sum(s.amount for h in holdings for s in h.sips if s.active)
    return {"holdings": out, "totals": totals, "allocation": allocation}


@router.post("/holdings")
def add_holding(body: schemas.HoldingCreate, db: Session = Depends(get_db),
                user: models.User = Depends(get_current_active_user)):
    existing = db.query(models.Holding).filter(
        models.Holding.user_id == user.id, models.Holding.asset_type == body.asset_type,
        models.Holding.symbol == body.symbol).first()
    if existing:
        return {"id": existing.id, "existing": True}
    h = models.Holding(**body.dict(), user_id=user.id)
    db.add(h)
    db.commit()
    db.refresh(h)
    return {"id": h.id, "existing": False}


@router.delete("/holdings/{holding_id}")
def delete_holding(holding_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_active_user)):
    db.delete(own_holding(db, holding_id, user))
    db.commit()
    return {"message": "Investment removed"}


@router.post("/holdings/{holding_id}/lots")
async def add_lot(holding_id: int, body: schemas.LotCreate, db: Session = Depends(get_db),
                  user: models.User = Depends(get_current_active_user)):
    h = own_holding(db, holding_id, user)
    if body.date.date() > date.today():
        raise HTTPException(status_code=400, detail="Date can't be in the future")
    price = body.price
    if price is None:
        try:
            price = await market.price_on(h.asset_type, h.symbol, body.date.date())
        except Exception:
            price = None
        if not price:
            raise HTTPException(status_code=400, detail="Couldn't find the market price for that date — enter the price yourself.")
    if body.units:
        units = body.units
    elif body.amount:
        units = body.amount / price
    else:
        raise HTTPException(status_code=400, detail="Enter the amount invested or the number of units")
    if body.side == "sell":
        held = position(h.lots)["units"]
        if units > held + 1e-9:
            raise HTTPException(status_code=400, detail=f"You only hold {held:.4f} units")
    lot = models.Lot(holding_id=h.id, side=body.side, units=units, price=price,
                     date=body.date.replace(tzinfo=None))
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot_out(lot)


@router.delete("/lots/{lot_id}")
def delete_lot(lot_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_active_user)):
    lot = db.query(models.Lot).join(models.Holding).filter(
        models.Lot.id == lot_id, models.Holding.user_id == user.id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(lot)
    db.commit()
    return {"message": "Entry deleted"}


@router.post("/holdings/{holding_id}/sips")
def add_sip(holding_id: int, body: schemas.SipCreate, db: Session = Depends(get_db),
            user: models.User = Depends(get_current_active_user)):
    h = own_holding(db, holding_id, user)
    sip = models.Sip(holding_id=h.id, amount=body.amount, day=body.day,
                     start_date=body.start_date.replace(tzinfo=None), active=1)
    db.add(sip)
    db.commit()
    db.refresh(sip)
    return sip_out(sip)


@router.post("/sips/{sip_id}/toggle")
def toggle_sip(sip_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_active_user)):
    sip = db.query(models.Sip).join(models.Holding).filter(
        models.Sip.id == sip_id, models.Holding.user_id == user.id).first()
    if not sip:
        raise HTTPException(status_code=404, detail="SIP not found")
    sip.active = 0 if sip.active else 1
    if sip.active:
        sip.start_date = datetime.utcnow()  # resume from now — don't back-fill paused months
    db.commit()
    return sip_out(sip)


@router.delete("/sips/{sip_id}")
def delete_sip(sip_id: int, keep_history: bool = True, db: Session = Depends(get_db),
               user: models.User = Depends(get_current_active_user)):
    """Stop a SIP. Past installments stay as normal purchases unless keep_history=false."""
    sip = db.query(models.Sip).join(models.Holding).filter(
        models.Sip.id == sip_id, models.Holding.user_id == user.id).first()
    if not sip:
        raise HTTPException(status_code=404, detail="SIP not found")
    for lot in db.query(models.Lot).filter(models.Lot.sip_id == sip.id).all():
        if keep_history:
            lot.sip_id = None
        else:
            db.delete(lot)
    db.delete(sip)
    db.commit()
    return {"message": "SIP stopped"}
