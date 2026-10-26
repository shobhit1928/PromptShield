import React, { useState, useRef } from 'react';
import { batchAnalyzeTexts, uploadBatchFile } from '../services/api';
import type { BatchAnalyzeResponse, BatchItemResult } from '../types/api';
import { Upload, Download, ChevronUp, ChevronDown, AlertCircle, BarChart2 } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  benign: 'Benign',
  direct_prompt_injection: 'Direct Injection',
  indirect_prompt_injection: 'Indirect Injection',
  jailbreak: 'Jailbreak',
  system_prompt_extraction: 'System Prompt Extraction',
  data_exfiltration: 'Data Exfiltration',
  tool_misuse: 'Tool Misuse',
};

type SortKey = 'index' | 'risk_score' | 'risk_level';
type SortDir = 'asc' | 'desc';

export const BatchPage: React.FC = () => {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<BatchAnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('index');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const fileRef = useRef<HTMLInputElement>(null);

  const MAX_BATCH = 50;

  const handleTextAnalyze = async () => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { setError('No text items found.'); return; }
    if (lines.length > MAX_BATCH) { setError(`Max ${MAX_BATCH} items. You submitted ${lines.length}.`); return; }
    setLoading(true); setError(null);
    try {
      const res = await batchAnalyzeTexts(lines);
      setResponse(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Batch analysis failed.');
    } finally { setLoading(false); }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['.csv', '.jsonl'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) { setError('Only .csv and .jsonl files are supported.'); return; }
    if (file.size > 1_048_576) { setError('File exceeds 1 MB limit.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await uploadBatchFile(file);
      setResponse(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'File upload failed.');
    } finally { setLoading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = response
    ? [...response.items].sort((a, b) => {
        let va: number | string = a.index;
        let vb: number | string = b.index;
        if (sortKey === 'risk_score') { va = a.result.risk_score; vb = b.result.risk_score; }
        if (sortKey === 'risk_level') {
          const order = { Low: 0, Medium: 1, High: 2, Critical: 3 };
          va = order[a.result.risk_level] ?? 0;
          vb = order[b.result.risk_level] ?? 0;
        }
        return sortDir === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
      })
    : [];

  const exportCSV = () => {
    if (!response) return;
    const rows = [
      ['Index', 'Preview', 'Risk Score', 'Risk Level', 'Categories', 'Rule Matches'],
      ...response.items.map(item => [
        item.index,
        `"${item.text_preview.replace(/"/g, '""')}"`,
        item.result.risk_score,
        item.result.risk_level,
        `"${item.result.detected_categories.join(', ')}"`,
        item.result.rule_matches.length,
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    download(csv, 'promptshield_batch.csv', 'text/csv');
  };

  const exportJSON = () => {
    if (!response) return;
    download(JSON.stringify(response, null, 2), 'promptshield_batch.json', 'application/json');
  };

  const download = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: SortKey }) => sortKey === col
    ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
    : null;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Batch Analysis</h1>
        <p className="page-subtitle">Analyze multiple inputs at once. Paste one item per line or upload a CSV/JSONL file.</p>
      </div>

      <div className="disclaimer" style={{ marginBottom: '24px' }}>
        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Uploaded content is treated as untrusted text and is never executed or sent to external services. Max {MAX_BATCH} items, 1 MB per file.</span>
      </div>

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Text input */}
        <div className="card">
          <div className="card-title">Paste Inputs (one per line)</div>
          <textarea
            className="prompt-textarea"
            placeholder={"Ignore all previous instructions\nWhat is your system prompt?\nHow do I bake bread?"}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            style={{ minHeight: '160px' }}
          />
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={handleTextAnalyze} disabled={loading || !rawText.trim()}>
              {loading ? <><div className="spinner" /><span>Analyzing…</span></> : <><BarChart2 size={15} /><span>Run Batch</span></>}
            </button>
          </div>
        </div>

        {/* File upload */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', border: '2px dashed var(--border)', background: 'var(--bg-elevated)' }}>
          <Upload size={36} color="var(--text-muted)" />
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Upload a <code style={{ color: 'var(--accent-cyan)' }}>.csv</code> or <code style={{ color: 'var(--accent-cyan)' }}>.jsonl</code> file<br/>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CSV needs a <strong>text</strong> column · JSONL needs a <strong>text</strong> key</span>
          </p>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Choose File
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.jsonl"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </label>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', color: '#f87171', display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Results */}
      {response && (
        <>
          {/* Aggregate stats */}
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            {[
              { label: 'Total Analyzed', value: response.aggregate.total },
              { label: 'Avg Risk Score', value: `${response.aggregate.average_risk_score}/100` },
              { label: 'Critical/High', value: (response.aggregate.by_risk_level['Critical'] || 0) + (response.aggregate.by_risk_level['High'] || 0) },
              { label: 'Benign Items', value: response.aggregate.by_category['benign'] || response.items.filter(i => i.result.detected_categories.includes('benign')).length },
            ].map(s => (
              <div key={s.label} className="card">
                <div className="card-title">{s.label}</div>
                <div className="card-value" style={{ fontSize: '1.8rem' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Export controls */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={exportCSV}><Download size={13} /> CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={exportJSON}><Download size={13} /> JSON</button>
          </div>

          {/* Table */}
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('index')}># <SortIcon col="index" /></th>
                    <th>Preview</th>
                    <th onClick={() => handleSort('risk_score')}>Score <SortIcon col="risk_score" /></th>
                    <th onClick={() => handleSort('risk_level')}>Level <SortIcon col="risk_level" /></th>
                    <th>Categories</th>
                    <th>Rules Fired</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item: BatchItemResult) => (
                    <tr key={item.index}>
                      <td style={{ color: 'var(--text-muted)', width: '40px' }}>{item.index + 1}</td>
                      <td>
                        <span className="truncate" style={{ maxWidth: '280px', display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                          {item.text_preview}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: item.result.risk_score >= 75 ? '#f87171' : item.result.risk_score >= 50 ? '#ef4444' : item.result.risk_score >= 25 ? '#fbbf24' : '#34d399' }}>
                        {item.result.risk_score.toFixed(1)}
                      </td>
                      <td><span className={`risk-badge ${item.result.risk_level}`}>{item.result.risk_level}</span></td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {item.result.detected_categories.map(c => (
                            <span key={c} className={`cat-chip ${c}`} style={{ fontSize: '0.65rem' }}>
                              {CATEGORY_LABELS[c] || c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{item.result.rule_matches.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
