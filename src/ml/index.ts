import type { InferenceEngine } from './InferenceEngine';
import { MockInferenceEngine } from './MockInferenceEngine';
import { TFLiteInferenceEngine } from './TFLiteInferenceEngine';

export type { InferenceEngine, InferenceResult } from './InferenceEngine';

export const getInferenceEngine = (): InferenceEngine => {
  if (process.env.EXPO_PUBLIC_USE_MOCK_MODEL === 'false') {
    return new TFLiteInferenceEngine();
  }
  return new MockInferenceEngine();
};
