import type { InferenceEngine } from './InferenceEngine';
import { MockInferenceEngine } from './MockInferenceEngine';

export type { InferenceEngine, InferenceResult } from './InferenceEngine';

export const getInferenceEngine = (): InferenceEngine => {
  if (process.env.EXPO_PUBLIC_USE_MOCK_MODEL === 'false') {
    throw new Error('TFLiteInferenceEngine aún no implementado (Fase 8b)');
  }
  return new MockInferenceEngine();
};
