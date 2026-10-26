import React, { useEffect, useState } from 'react';
import { getHealth } from '../services/api';
import type { HistoryEntry, HealthResponse } from '../types/api';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Shield, Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface OverviewPageProps {
  history: HistoryEntry[];
}

const RISK_COLORS: Record<string, string> = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#ef4444',
  Critical: '#dc2626',
};

const CAT_COLORS: Record<string, string> = {
  benign: '#10b981',
  direct_prompt_injection: '#ef4444',
  indirect_prompt_injection: '#f97316',
  jailbreak: '#8b5cf6',
  system_prompt_extraction: '#3b82f6',
  data_exfiltration: '#ec4899',
  tool_misuse: '#f59e0b',
};

const CAT_LABELS: Record<string, string> = {
  benign: 'Benign',
  direct_prompt_injection: 'Direct Injection',
  indirect_prompt_injection: 'Indirect Injection',
  jailbreak: 'Jailbreak',
  system_prompt_extraction: 'System Prompt Extr.',
  data_exfiltration: 'Data Exfiltration',
  tool_misuse: 'Tool Misuse',
};

export const OverviewPage: React.FC<OverviewPageProps> = ({ history }) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    getHealth()
      .then(h => setHealth(h))
      .catch(() => setHealth(null));
  }, []);

  // Compute stats from history
  const riskCounts = history.reduce<Record<string, number>>((acc, e) => {
    acc[e.result.risk_level] = (acc[e.result.risk_level] || 0) + 1;
    return acc;
  }, {});

  const catCounts = history.reduce<Record<string, number>>((acc, e) => {
    e.result.detected_categories.forEach(c => {
      acc[c] = (acc[c] || 0) + 1;
    });
    return acc;
  }, {});

  const riskPieData = Object.entries(riskCounts).map(([name, value]) => ({ name, value }));
  const catBarData = Object.entries(catCounts)
    .map(([name, value]) => ({ name: CAT_LABELS[name] || name, value, key: name }))
    .sort((a, b) => b.value - a.value);

  const avgScore = history.length
    ? (history.reduce((s, e) => s + e.result.risk_score, 0) / history.length).toFixed(1)
    : '—';

  const criticalHigh = (riskCounts['Critical'] || 0) + (riskCounts['High'] || 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Overview</h1>
        <p className="page-subtitle">Session statistics and detector status. Stats reset on page refresh.</p>
      </div>

      {/* Detector status */}
      {health && (
        <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="var(--accent-blue)" />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>PromptShield v{health.version}</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span className={`status-chip ${health.rule_based_detector ? 'online' : 'offline'}`}>
              <span className={`dot ${health.rule_based_detector ? 'green' : 'red'}`} />
              Rule Detector
            </span>
            <span className={`status-chip ${health.ml_classifier ? 'online' : 'offline'}`}>
              <span className={`dot ${health.ml_classifier ? 'green' : 'red'}`} />
              ML Classifier {!health.ml_classifier && '(not trained)'}
            </span>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        {[
          { label: 'Total Scans', value: history.length, icon: <Activity size={20} color="var(--accent-blue)" /> },
          { label: 'Avg Risk Score', value: avgScore, icon: <AlertTriangle size={20} color="var(--risk-medium)" /> },
          { label: 'Critical / High', value: criticalHigh, icon: <AlertTriangle size={20} color="var(--risk-high)" /> },
          { label: 'Clean (Low)', value: riskCounts['Low'] || 0, icon: <CheckCircle size={20} color="var(--risk-low)" /> },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ padding: '10px', background: 'var(--bg-elevated)', borderRadius: '10px', flexShrink: 0 }}>
              {stat.icon}
            </div>
            <div>
              <div className="card-title" style={{ marginBottom: '2px' }}>{stat.label}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {history.length === 0 ? (
        <div className="card empty-state">
          <Shield size={48} />
          <h3>No scans this session</h3>
          <p>Go to Analyze Prompt and submit text to start seeing statistics here.</p>
        </div>
      ) : (
        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Risk distribution pie */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '16px' }}>Risk Level Distribution</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={riskPieData}
                  cx="50%" cy="50%"
                  outerRadius={80} innerRadius={45}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {riskPieData.map(entry => (
                    <Cell key={entry.name} fill={RISK_COLORS[entry.name] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category bar chart */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '16px' }}>Category Frequency</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={catBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {catBarData.map(entry => (
                    <Cell key={entry.key} fill={CAT_COLORS[entry.key] || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent scans */}
      {history.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: '16px' }}>
            <Clock size={13} style={{ display: 'inline', marginRight: '6px' }} />
            Recent Scans
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...history].reverse().slice(0, 5).map(entry => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span className={`risk-badge ${entry.result.risk_level}`} style={{ flexShrink: 0 }}>{entry.result.risk_level}</span>
                <span className="truncate font-mono" style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {entry.input_preview}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {entry.result.risk_score.toFixed(1)}/100
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {entry.timestamp.toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
