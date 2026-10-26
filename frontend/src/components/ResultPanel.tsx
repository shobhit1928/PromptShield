import React from 'react';
import type { AnalysisResult } from '../types/api';
import { ScoreGauge } from './ScoreGauge';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

interface ResultPanelProps {
  result: AnalysisResult;
}

const CATEGORY_LABELS: Record<string, string> = {
  benign: 'Benign',
  direct_prompt_injection: 'Direct Injection',
  indirect_prompt_injection: 'Indirect Injection',
  jailbreak: 'Jailbreak',
  system_prompt_extraction: 'System Prompt Extraction',
  data_exfiltration: 'Data Exfiltration',
  tool_misuse: 'Tool Misuse',
};

export const ResultPanel: React.FC<ResultPanelProps> = ({ result }) => {
  const [showRecs, setShowRecs] = React.useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Score + Level */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '24px', alignItems: 'center' }}>
        <ScoreGauge score={result.risk_score} riskLevel={result.risk_level} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span className={`risk-badge ${result.risk_level}`}>{result.risk_level} Risk</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {result.detection_components_used.join(' + ')}
            </span>
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Detected Categories
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {result.detected_categories.map(cat => (
              <span key={cat} className={`cat-chip ${cat}`}>
                {CATEGORY_LABELS[cat] || cat}
              </span>
            ))}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {result.explanation}
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="disclaimer">
        <Info size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{result.score_disclaimer}</span>
      </div>

      {/* Rule Evidence */}
      {result.rule_matches.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: '16px' }}>
            Rule Evidence ({result.rule_matches.length} match{result.rule_matches.length !== 1 ? 'es' : ''})
          </div>
          {result.rule_matches.map((m) => (
            <div key={m.rule_id} className="evidence-block">
              <div className="evidence-header">
                <span className="evidence-rule-id">{m.rule_id}</span>
                <span className={`cat-chip ${m.category}`} style={{ fontSize: '0.68rem' }}>
                  {CATEGORY_LABELS[m.category]}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  confidence: {(m.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{m.description}</p>
              <div className="evidence-snippet">
                &ldquo;{m.matched_snippet}&rdquo;
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ML Prediction */}
      {result.model_prediction && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: '16px' }}>
            ML Classifier Prediction <span style={{ color: 'var(--accent-blue)', fontStyle: 'normal' }}>(experimental)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span className={`cat-chip ${result.model_prediction.predicted_class}`}>
              {CATEGORY_LABELS[result.model_prediction.predicted_class]}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {(result.model_prediction.confidence * 100).toFixed(1)}% confidence
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              v{result.model_prediction.model_version}
            </span>
          </div>

          {/* Top-5 class probabilities */}
          {Object.entries(result.model_prediction.class_probabilities)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([cls, prob]) => (
              <div key={cls} className="confidence-bar-wrap">
                <div className="confidence-bar-label">
                  <span>{CATEGORY_LABELS[cls] || cls}</span>
                  <span>{(prob * 100).toFixed(1)}%</span>
                </div>
                <div className="confidence-bar-track">
                  <div
                    className="confidence-bar-fill"
                    style={{
                      width: `${prob * 100}%`,
                      background: cls === result.model_prediction!.predicted_class
                        ? 'linear-gradient(90deg, #3b82f6, #6366f1)'
                        : 'rgba(255,255,255,0.15)',
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Recommendations */}
      {result.recommended_actions.length > 0 && (
        <div className="card">
          <button
            onClick={() => setShowRecs(!showRecs)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div className="card-title" style={{ margin: 0 }}>
              Recommended Actions ({result.recommended_actions.length})
            </div>
            {showRecs ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
          </button>

          {showRecs && (
            <div style={{ marginTop: '16px' }}>
              {result.recommended_actions.map((rec, i) => (
                <div key={i} className="rec-item">
                  <span className="rec-bullet">▶</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
