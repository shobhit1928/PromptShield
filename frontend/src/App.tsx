import React, { useState } from 'react';
import './index.css';
import {
  Shield, LayoutDashboard, Search, Layers, BookOpen, Brain,
  Clock, Menu, X
} from 'lucide-react';
import { OverviewPage } from './pages/OverviewPage';
import { AnalyzePage } from './pages/AnalyzePage';
import { BatchPage } from './pages/BatchPage';
import { RulesPage } from './pages/RulesPage';
import { ModelPage } from './pages/ModelPage';
import { HistoryPage } from './pages/HistoryPage';
import type { HistoryEntry } from './types/api';

type Page = 'overview' | 'analyze' | 'batch' | 'rules' | 'model' | 'history';

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
  { id: 'analyze', label: 'Analyze Prompt', icon: <Search size={16} /> },
  { id: 'batch', label: 'Batch Analysis', icon: <Layers size={16} /> },
  { id: 'rules', label: 'Rules Explorer', icon: <BookOpen size={16} /> },
  { id: 'model', label: 'Model Evaluation', icon: <Brain size={16} /> },
  { id: 'history', label: 'Scan History', icon: <Clock size={16} /> },
];

const PAGE_SUBTITLES: Record<Page, string> = {
  overview: 'Session Dashboard',
  analyze: 'Single Text Analysis',
  batch: 'Multi-Input Analysis',
  rules: 'Detection Rule Browser',
  model: 'ML Classifier Metrics',
  history: 'Session Scan Log',
};

function App() {
  const [page, setPage] = useState<Page>('overview');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const addHistory = (entry: HistoryEntry) => {
    setHistory(prev => [...prev, entry]);
  };

  const handleHistorySelect = (_entry: HistoryEntry) => {
    setPage('history');
  };

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <Shield size={24} />
          <div>
            <div className="sidebar-logo-text">PromptShield</div>
            <div className="sidebar-logo-sub">LLM Security Platform</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Detection</div>
            {NAV_ITEMS.slice(0, 3).map(item => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Intelligence</div>
            {NAV_ITEMS.slice(3).map(item => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              >
                {item.icon}
                {item.label}
                {item.id === 'history' && history.length > 0 && (
                  <span style={{
                    marginLeft: 'auto', background: 'rgba(59,130,246,0.2)',
                    color: 'var(--accent-blue)', borderRadius: '100px',
                    fontSize: '0.65rem', padding: '1px 7px', fontWeight: 700,
                  }}>
                    {history.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            ⚠ Experimental tool.<br />
            Results are heuristic estimates only.<br />
            Detection ≠ exploitability.
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn btn-ghost"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ display: 'none', padding: '6px' }}
              aria-label="Toggle sidebar"
              id="sidebar-toggle"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <div className="topbar-title">
                {NAV_ITEMS.find(n => n.id === page)?.label}
              </div>
              <div className="topbar-subtitle">{PAGE_SUBTITLES[page]}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {history.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {history.length} scan{history.length !== 1 ? 's' : ''} this session
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="page">
          {page === 'overview' && <OverviewPage history={history} />}
          {page === 'analyze' && (
            <AnalyzePage onResult={addHistory} />
          )}
          {page === 'batch' && <BatchPage />}
          {page === 'rules' && <RulesPage />}
          {page === 'model' && <ModelPage />}
          {page === 'history' && (
            <HistoryPage
              history={history}
              onClear={() => setHistory([])}
              onSelect={handleHistorySelect}
            />
          )}
        </div>
      </main>

      {/* Mobile sidebar toggle CSS hack */}
      <style>{`
        @media (max-width: 900px) {
          #sidebar-toggle { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

export default App;
