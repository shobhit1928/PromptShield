// PromptShield — TypeScript types matching Pydantic backend schemas

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type DetectionCategory =
  | 'benign'
  | 'direct_prompt_injection'
  | 'indirect_prompt_injection'
  | 'jailbreak'
  | 'system_prompt_extraction'
  | 'data_exfiltration'
  | 'tool_misuse';

export interface RuleMatch {
  rule_id: string;
  category: DetectionCategory;
  description: string;
  matched_snippet: string;
  confidence: number;
}

export interface ModelPrediction {
  predicted_class: DetectionCategory;
  confidence: number;
  class_probabilities: Record<string, number>;
  model_version: string;
}

export interface AnalysisResult {
  input_length: number;
  risk_score: number;
  risk_level: RiskLevel;
  detected_categories: DetectionCategory[];
  rule_matches: RuleMatch[];
  model_prediction: ModelPrediction | null;
  explanation: string;
  recommended_actions: string[];
  detection_components_used: string[];
  score_disclaimer: string;
}

export interface BatchItemResult {
  index: number;
  text_preview: string;
  result: AnalysisResult;
}

export interface BatchAggregateStats {
  total: number;
  by_risk_level: Record<string, number>;
  by_category: Record<string, number>;
  average_risk_score: number;
}

export interface BatchAnalyzeResponse {
  items: BatchItemResult[];
  aggregate: BatchAggregateStats;
}

export interface RuleInfo {
  rule_id: string;
  category: DetectionCategory;
  description: string;
  examples: string[];
  known_false_positives: string;
}

export interface RulesResponse {
  rules: RuleInfo[];
  total: number;
}

export interface PerClassMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  support: number;
}

export interface ModelInfo {
  available: boolean;
  model_type: string | null;
  supported_classes: string[];
  training_metadata: Record<string, unknown> | null;
  evaluation_metrics: {
    disclaimer: string;
    full_dataset_macro_f1: number;
    cross_validation: {
      folds: number;
      strategy: string;
      scores: number[];
      mean_f1_macro: number | null;
      std_f1_macro: number | null;
    };
    per_class_metrics: Record<string, PerClassMetrics>;
    confusion_matrix: {
      classes: string[];
      matrix: number[][];
    };
  } | null;
  disclaimer: string;
}

export interface HealthResponse {
  status: string;
  rule_based_detector: boolean;
  ml_classifier: boolean;
  version: string;
}

// Session history entry
export interface HistoryEntry {
  id: string;
  timestamp: Date;
  input_preview: string;
  result: AnalysisResult;
}
