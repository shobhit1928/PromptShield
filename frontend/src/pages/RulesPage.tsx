import React, { useState, useEffect } from 'react';
import { getRules } from '../services/api';
import type { RuleInfo } from '../types/api';
import { BookOpen, AlertTriangle } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  benign: 'Benign',
  direct_prompt_injection: 'Direct Injection',
  indirect_prompt_injection: 'Indirect Injection',
  jailbreak: 'Jailbreak',
  system_prompt_extraction: 'System Prompt Extraction',
  data_exfiltration: 'Data Exfiltration',
  tool_misuse: 'Tool Misuse',
};

export const RulesPage: React.FC = () => {
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getRules().then(r => { setRules(r.rules); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = rules.filter(r =>
    !filter ||
    r.rule_id.toLowerCase().includes(filter.toLowerCase()) ||
    r.category.includes(filter.toLowerCase()) ||
    r.description.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rules Explorer</h1>
        <p className="page-subtitle">Browse all detection rules, categories, examples, and known limitations.</p>
      </div>

      <div className="disclaimer" style={{ marginBottom: '24px' }}>
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Rules use heuristic pattern matching. They produce false positives on educational and security-research content. A rule match does NOT prove exploitability.</span>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Filter by rule ID, category, or description…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.map(rule => (
            <div key={rule.rule_id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span className="evidence-rule-id">{rule.rule_id}</span>
                <span className={`cat-chip ${rule.category}`}>{CATEGORY_LABELS[rule.category]}</span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '12px' }}>
                {rule.description}
              </p>

              {rule.examples.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                    Example trigger
                  </div>
                  {rule.examples.map((ex, i) => (
                    <div key={i} className="evidence-snippet" style={{ marginBottom: '4px' }}>
                      {ex}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.78rem', color: '#d97706', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '6px', padding: '6px 10px' }}>
                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                <span><strong>Known false positives:</strong> {rule.known_false_positives}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state">
              <BookOpen size={40} />
              <h3>No rules match your filter</h3>
              <p>Try a different search term.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
