jest.mock('./MockInferenceEngine', () => ({ MockInferenceEngine: jest.fn() }));
jest.mock('./TFLiteInferenceEngine', () => ({ TFLiteInferenceEngine: jest.fn() }));

import { MockInferenceEngine } from './MockInferenceEngine';
import { TFLiteInferenceEngine } from './TFLiteInferenceEngine';
import { getInferenceEngine } from './index';

describe('getInferenceEngine', () => {
  const originalEnv = process.env.EXPO_PUBLIC_USE_MOCK_MODEL;
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_USE_MOCK_MODEL = originalEnv;
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it('devuelve TFLiteInferenceEngine cuando EXPO_PUBLIC_USE_MOCK_MODEL es exactamente "false"', () => {
    process.env.EXPO_PUBLIC_USE_MOCK_MODEL = 'false';
    (global as { __DEV__?: boolean }).__DEV__ = true;
    getInferenceEngine();
    expect(TFLiteInferenceEngine).toHaveBeenCalled();
    expect(MockInferenceEngine).not.toHaveBeenCalled();
  });

  it('devuelve MockInferenceEngine por defecto en desarrollo (variable sin definir)', () => {
    delete process.env.EXPO_PUBLIC_USE_MOCK_MODEL;
    (global as { __DEV__?: boolean }).__DEV__ = true;
    getInferenceEngine();
    expect(MockInferenceEngine).toHaveBeenCalled();
    expect(TFLiteInferenceEngine).not.toHaveBeenCalled();
  });

  it('lanza un error si un build de produccion sigue usando el modelo mock', () => {
    delete process.env.EXPO_PUBLIC_USE_MOCK_MODEL;
    (global as { __DEV__?: boolean }).__DEV__ = false;

    expect(() => getInferenceEngine()).toThrow(/EXPO_PUBLIC_USE_MOCK_MODEL/);
    expect(MockInferenceEngine).not.toHaveBeenCalled();
  });

  it('no lanza error en produccion cuando EXPO_PUBLIC_USE_MOCK_MODEL es "false"', () => {
    process.env.EXPO_PUBLIC_USE_MOCK_MODEL = 'false';
    (global as { __DEV__?: boolean }).__DEV__ = false;

    expect(() => getInferenceEngine()).not.toThrow();
    expect(TFLiteInferenceEngine).toHaveBeenCalled();
  });
});
