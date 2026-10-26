import React from 'react';
import type { RiskLevel } from '../types/api';

interface ScoreGaugeProps {
  score: number;
  riskLevel: RiskLevel;
}

const RISK_COLORS: Record<RiskLevel, string> = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#ef4444',
  Critical: '#dc2626',
};

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, riskLevel }) => {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = score / 100;
  const dashOffset = circumference * (1 - progress);
  const color = RISK_COLORS[riskLevel];

  return (
    <div className="score-container">
      <div className="score-ring">
        <svg width="140" height="140" viewBox="0 0 120 120">
          <circle className="track" cx="60" cy="60" r={radius} />
          <circle
            className="indicator"
            cx="60" cy="60" r={radius}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
          />
        </svg>
        <div className="score-text">
          <span className="score-number" style={{ color }}>
            {Math.round(score)}
          </span>
          <span className="score-label">/ 100</span>
        </div>
      </div>
    </div>
  );
};
