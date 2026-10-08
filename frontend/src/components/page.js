import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useFinance } from '../data/FinanceContext';
import { currentMonthKey, shiftMonth, monthLabel } from '../finance';

export function MonthSwitch() {
  const { month, setMonth } = useFinance();
  const isCurrent = month === currentMonthKey();
  return (
    <div className="month-switch">
      <button className="fb-icon-btn" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month"><FiChevronLeft /></button>
      <span className="label">{monthLabel(month)}</span>
      <button className="fb-icon-btn" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={isCurrent}
        style={{ opacity: isCurrent ? 0.3 : 1 }} aria-label="Next month"><FiChevronRight /></button>
    </div>
  );
}

export function PageHead({ eyebrow, title, children }) {
  return (
    <div className="dash-head fb-fade-in">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="serif dash-hello">{title}</h1>
      </div>
      <div className="d-flex gap-2 flex-wrap align-items-center">{children}</div>
    </div>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="section-title">
      <h2 className="serif">{children}</h2>
      {action}
    </div>
  );
}
