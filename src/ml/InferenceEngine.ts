import type { DiagnosisClass } from '@/content/diagnosis';

export interface InferenceResult {
  label: DiagnosisClass;
  confidence: number;
  distribution: Record<DiagnosisClass, number>;
  isUnrecognized: boolean;
}

export interface InferenceEngine {
  predict(imageUri: string): Promise<InferenceResult>;
}
