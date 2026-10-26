import React, { useEffect, useState } from 'react';
import { getModelInfo } from '../services/api';
import type { ModelInfo } from '../types/api';
import { Brain, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export const ModelPage: React.FC = () => {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getModelInfo().then(i => { setInfo(i); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!info) return <div className="empty-state"><Brain size={40} /><h3>Could not load model info</h3></div>;

  const metrics = info.evaluation_metrics;
  const cm = metrics?.confusion_matrix;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Model Evaluation</h1>
        <p className="page-subtitle">ML classifier status, training metadata, and evaluation metrics.</p>
      </div>

      <div className="disclaimer" style={{ marginBottom: '24px' }}>
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{info.disclaimer}</span>
      </div>

      {/* Status card */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {info.available
            ? <CheckCircle size={28} color="var(--risk-low)" />
            : <XCircle size={28} color="var(--risk-high)" />}
          <div>
            <div className="card-title" style={{ marginBottom: '2px' }}>Model Status</div>
            <div style={{ fontWeight: 600, color: info.available ? 'var(--risk-low)' : 'var(--risk-high)' }}>
              {info.available ? 'Available' : 'Not Trained'}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Model Type</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            {info.model_type || '—'}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Supported Classes</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {info.supported_classes.length || '—'}
          </div>
        </div>
      </div>

      {!info.available && (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <Brain size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Model Not Trained Yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '400px', margin: '0 auto 20px' }}>
            Run the training script to enable ML-assisted detection:
          </p>
          <code style={{ display: 'block', background: 'var(--bg-elevated)', padding: '12px 20px', borderRadius: '8px', color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', maxWidth: '400px', margin: '0 auto' }}>
            python scripts/train_model.py
          </code>
        </div>
      )}

      {info.available && metrics && (
        <>
          {/* CV metrics */}
          {metrics.cross_validation.mean_f1_macro !== null && (
            <div className="grid-3" style={{ marginBottom: '24px' }}>
              <div className="card">
                <div className="card-title">CV Macro F1 (mean)</div>
                <div className="card-value">{(metrics.cross_validation.mean_f1_macro! * 100).toFixed(1)}%</div>
                <div className="card-sub">{metrics.cross_validation.folds}-fold {metrics.cross_validation.strategy}</div>
              </div>
              <div className="card">
                <div className="card-title">Full-Dataset Macro F1</div>
                <div className="card-value">{(metrics.full_dataset_macro_f1 * 100).toFixed(1)}%</div>
                <div className="card-sub">Train set (optimistic)</div>
              </div>
              <div className="card">
                <div className="card-title">CV Std Dev</div>
                <div className="card-value">{((metrics.cross_validation.std_f1_macro ?? 0) * 100).toFixed(1)}%</div>
                <div className="card-sub">Lower is more stable</div>
              </div>
            </div>
          )}

          {/* Per-class metrics */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title" style={{ marginBottom: '16px' }}>Per-Class Metrics</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1-Score</th>
                    <th>Support</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(metrics.per_class_metrics).map(([cls, m]) => (
                    <tr key={cls}>
                      <td><span className={`cat-chip ${cls}`} style={{ fontSize: '0.72rem' }}>{cls.replace(/_/g, ' ')}</span></td>
                      <td>{(m.precision * 100).toFixed(1)}%</td>
                      <td>{(m.recall * 100).toFixed(1)}%</td>
                      <td style={{ fontWeight: 600, color: m.f1_score >= 0.8 ? 'var(--risk-low)' : m.f1_score >= 0.5 ? 'var(--risk-medium)' : 'var(--risk-high)' }}>
                        {(m.f1_score * 100).toFixed(1)}%
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{m.support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confusion matrix */}
          {cm && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card-title" style={{ marginBottom: '16px' }}>Confusion Matrix</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th style={{ color: 'var(--text-muted)' }}>True \ Pred</th>
                      {cm.classes.map(c => <th key={c} style={{ fontSize: '0.65rem' }}>{c.replace(/_/g, '_\n')}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {cm.matrix.map((row, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.7rem' }}>{cm.classes[i]}</td>
                        {row.map((val, j) => (
                          <td key={j} style={{
                            textAlign: 'center',
                            background: i === j
                              ? `rgba(59,130,246,${Math.min(val / 10, 0.5)})`
                              : val > 0 ? `rgba(239,68,68,${Math.min(val / 5, 0.3)})` : 'transparent',
                            color: i === j ? 'var(--accent-blue)' : val > 0 ? '#f87171' : 'var(--text-muted)',
                            fontWeight: i === j ? 700 : 400,
                          }}>
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Diagonal cells (blue) = correct predictions. Off-diagonal cells (red) = misclassifications.
              </p>
            </div>
          )}

          <div className="disclaimer">
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{metrics.disclaimer}</span>
          </div>
        </>
      )}
    </div>
  );
};
