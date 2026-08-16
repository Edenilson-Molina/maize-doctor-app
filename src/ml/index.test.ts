jest.mock('./MockInferenceEngine', () => ({ MockInferenceEngine: jest.fn() }));
jest.mock('./TFLiteInferenceEngine', () => ({ TFLiteInferenceEngine: jest.fn() }));

import { MockInferenceEngine } from './MockInferenceEngine';
import { TFLiteInferenceEngine } from './TFLiteInferenceEngine';
import { getInferenceEngine } from './index';

describe('getInferenceEngine', () => {
  const originalEnv = process.env.EXPO_PUBLIC_USE_MOCK_MODEL;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_USE_MOCK_MODEL = originalEnv;
  });

  it('devuelve TFLiteInferenceEngine cuando EXPO_PUBLIC_USE_MOCK_MODEL es exactamente "false"', () => {
    process.env.EXPO_PUBLIC_USE_MOCK_MODEL = 'false';
    getInferenceEngine();
    expect(TFLiteInferenceEngine).toHaveBeenCalled();
    expect(MockInferenceEngine).not.toHaveBeenCalled();
  });

  it('devuelve MockInferenceEngine por defecto (variable sin definir)', () => {
    delete process.env.EXPO_PUBLIC_USE_MOCK_MODEL;
    getInferenceEngine();
    expect(MockInferenceEngine).toHaveBeenCalled();
    expect(TFLiteInferenceEngine).not.toHaveBeenCalled();
  });
});
