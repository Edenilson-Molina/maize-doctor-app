import { DIAGNOSIS_CLASSES } from '@/content/diagnosis';
import type { MockInferenceEngine as MockInferenceEngineType } from './MockInferenceEngine';

let MockInferenceEngine: typeof MockInferenceEngineType;

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetModules();
  MockInferenceEngine = require('./MockInferenceEngine').MockInferenceEngine;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('MockInferenceEngine', () => {
  it('does not resolve before the minimum simulated latency', async () => {
    const engine = new MockInferenceEngine();
    const onResolved = jest.fn();

    engine.predict('file://leaf.jpg').then(onResolved);
    await jest.advanceTimersByTimeAsync(500);

    expect(onResolved).not.toHaveBeenCalled();
  });

  it('resolves once the maximum simulated latency has elapsed', async () => {
    const engine = new MockInferenceEngine();
    const onResolved = jest.fn();

    engine.predict('file://leaf.jpg').then(onResolved);
    await jest.advanceTimersByTimeAsync(1500);

    expect(onResolved).toHaveBeenCalled();
  });

  it('returns a result matching the InferenceResult contract', async () => {
    const engine = new MockInferenceEngine();
    const promise = engine.predict('file://leaf.jpg');
    jest.advanceTimersByTime(1500);
    const result = await promise;

    expect(DIAGNOSIS_CLASSES).toContain(result.label);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);

    const distributionKeys = Object.keys(result.distribution).sort();
    expect(distributionKeys).toEqual([...DIAGNOSIS_CLASSES].sort());

    const total = Object.values(result.distribution).reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('cycles through every DiagnosisClass across successive calls', async () => {
    const engine = new MockInferenceEngine();
    const labels: string[] = [];

    for (let i = 0; i < DIAGNOSIS_CLASSES.length; i++) {
      const promise = engine.predict('file://leaf.jpg');
      jest.advanceTimersByTime(1500);
      const result = await promise;
      labels.push(result.label);
    }

    expect(labels).toEqual(DIAGNOSIS_CLASSES);
  });
});
