import {
  clearMetrics,
  dumpMetrics,
  getMetrics,
  measure,
  recordMetric,
  summarizeMetrics,
} from './metrics';

describe('metrics', () => {
  beforeEach(() => {
    clearMetrics();
    jest.restoreAllMocks();
  });

  it('records a measurement with its stage and duration', () => {
    recordMetric({ stage: 'inference', durationMs: 42 });

    const [entry] = getMetrics();
    expect(entry.stage).toBe('inference');
    expect(entry.durationMs).toBe(42);
  });

  it('always writes to the console so release builds stay observable', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

    recordMetric({ stage: 'inference', durationMs: 42 });

    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0][0])).toContain('[metrics]');
  });

  it('tags extra context such as the cold first run', () => {
    recordMetric({ stage: 'inference', durationMs: 100, cold: true });

    expect(getMetrics()[0].cold).toBe(true);
  });

  it('measures an async function and returns its value', async () => {
    const result = await measure('preprocess', async () => 'done');

    expect(result).toBe('done');
    expect(getMetrics()[0].stage).toBe('preprocess');
  });

  it('still records a measurement when the measured function throws', async () => {
    await expect(
      measure('inference', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(getMetrics()[0].failed).toBe(true);
  });

  it('keeps only the most recent entries', () => {
    for (let i = 0; i < 250; i++) {
      recordMetric({ stage: 'inference', durationMs: i });
    }

    const entries = getMetrics();
    expect(entries.length).toBeLessThanOrEqual(200);
    expect(entries[entries.length - 1].durationMs).toBe(249);
  });

  it('summarizes count, mean, min, max and p95 per stage', () => {
    for (const ms of [10, 20, 30, 40]) {
      recordMetric({ stage: 'inference', durationMs: ms });
    }
    recordMetric({ stage: 'preprocess', durationMs: 100 });

    const summary = summarizeMetrics();

    expect(summary.inference.count).toBe(4);
    expect(summary.inference.meanMs).toBe(25);
    expect(summary.inference.minMs).toBe(10);
    expect(summary.inference.maxMs).toBe(40);
    expect(summary.preprocess.count).toBe(1);
  });

  it('excludes cold runs from the summary so warm numbers stay comparable', () => {
    recordMetric({ stage: 'inference', durationMs: 900, cold: true });
    recordMetric({ stage: 'inference', durationMs: 10 });

    expect(summarizeMetrics().inference.meanMs).toBe(10);
    expect(summarizeMetrics().inference.coldCount).toBe(1);
  });

  it('dumps a single parseable line per stage for adb logcat', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    recordMetric({ stage: 'inference', durationMs: 30 });
    spy.mockClear();

    dumpMetrics();

    const output = spy.mock.calls.map((c) => String(c[0])).join(' | ');
    expect(output).toContain('[metrics-summary]');
    expect(output).toContain('stage=inference');
    expect(output).toContain('count=1');
  });
});
