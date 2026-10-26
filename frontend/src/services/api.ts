// PromptShield — API service layer

import type {
  AnalysisResult,
  BatchAnalyzeResponse,
  RulesResponse,
  ModelInfo,
  HealthResponse,
} from '../types/api';

const BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE}/health`);
  return handleResponse<HealthResponse>(res);
}

export async function analyzeText(text: string): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return handleResponse<AnalysisResult>(res);
}

export async function batchAnalyzeTexts(texts: string[]): Promise<BatchAnalyzeResponse> {
  const res = await fetch(`${BASE}/batch-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  });
  return handleResponse<BatchAnalyzeResponse>(res);
}

export async function uploadBatchFile(file: File): Promise<BatchAnalyzeResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/batch-upload`, {
    method: 'POST',
    body: form,
  });
  return handleResponse<BatchAnalyzeResponse>(res);
}

export async function getRules(): Promise<RulesResponse> {
  const res = await fetch(`${BASE}/rules`);
  return handleResponse<RulesResponse>(res);
}

export async function getModelInfo(): Promise<ModelInfo> {
  const res = await fetch(`${BASE}/model-info`);
  return handleResponse<ModelInfo>(res);
}
