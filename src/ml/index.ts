import type { InferenceEngine } from './InferenceEngine';
import { MockInferenceEngine } from './MockInferenceEngine';
import { TFLiteInferenceEngine } from './TFLiteInferenceEngine';

export type { InferenceEngine, InferenceResult } from './InferenceEngine';

/**
 * Resolves the inference engine for the current build.
 *
 * @returns {InferenceEngine} TFLite engine, or the mock engine in development.
 * @throws {Error} In a production build when the mock engine would be selected.
 */
export const getInferenceEngine = (): InferenceEngine => {
  const useMock = process.env.EXPO_PUBLIC_USE_MOCK_MODEL !== 'false';

  if (useMock && !__DEV__) {
    throw new Error(
      'EXPO_PUBLIC_USE_MOCK_MODEL must be "false" in a production build - refusing to ship ' +
        'MockInferenceEngine (random fake predictions) to end users.'
    );
  }

  return useMock ? new MockInferenceEngine() : new TFLiteInferenceEngine();
};
