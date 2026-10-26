import React from 'react';
import type { HistoryEntry } from '../types/api';
import { Clock, Trash2, AlertCircle } from 'lucide-react';

interface HistoryPageProps {
  history: HistoryEntry[];
  onClear: () => void;
  onSelect: (entry: HistoryEntry) => void;
}

const RISK_COLORS: Record<string, string> = {
  Low: 'var(--risk-low)',
  Medium: 'var(--risk-medium)',
  High: 'var(--risk-high)',
  Critical: 'var(--risk-critical)',
};

export const HistoryPage: React.FC<HistoryPageProps> = ({ history, onClear, onSelect }) => {
  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Scan History</h1>
          <p className="page-subtitle">Recent analyses from the current session. Not persisted between page refreshes.</p>
        </div>
        {history.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={onClear}>
            <Trash2 size={13} /> Clear History
          </button>
        )}
      </div>

      <div className="disclaimer" style={{ marginBottom: '24px' }}>
        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>History is stored in browser session state only. Raw prompts are not sent to or stored on the server.</span>
      </div>

      {history.length === 0 ? (
        <div className="card empty-state">
          <Clock size={40} />
          <h3>No scans yet</h3>
          <p>Run an analysis from the Analyze Prompt page to see history here.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Input Preview</th>
                  <th>Score</th>
                  <th>Level</th>
                  <th>Categories</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map(entry => (
                  <tr
                    key={entry.id}
                    onClick={() => onSelect(entry)}
                    style={{ cursor: 'pointer' }}
                    title="Click to view full result"
                  >
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                      {entry.timestamp.toLocaleTimeString()}
                    </td>
                    <td>
                      <span className="truncate font-mono" style={{ maxWidth: '320px', display: 'block', fontSize: '0.8rem' }}>
                        {entry.input_preview}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: RISK_COLORS[entry.result.risk_level] }}>
                      {entry.result.risk_score.toFixed(1)}
                    </td>
                    <td>
                      <span className={`risk-badge ${entry.result.risk_level}`}>{entry.result.risk_level}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {entry.result.detected_categories.slice(0, 2).map(c => (
                          <span key={c} className={`cat-chip ${c}`} style={{ fontSize: '0.65rem' }}>{c.replace(/_/g, ' ')}</span>
                        ))}
                        {entry.result.detected_categories.length > 2 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>+{entry.result.detected_categories.length - 2}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
