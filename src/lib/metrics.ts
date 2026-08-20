export type MetricStage = 'preprocess' | 'inference' | 'pipeline';

export interface MetricEntry {
  stage: MetricStage;
  durationMs: number;
  /** First run of the session: includes one-off model loading, so it is an outlier. */
  cold?: boolean;
  /** The measured work threw; the duration is up to the failure. */
  failed?: boolean;
  timestamp: number;
}

export interface StageSummary {
  count: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  coldCount: number;
}

const MAX_ENTRIES = 200;
const entries: MetricEntry[] = [];

/**
 * Records one timing measurement.
 *
 * Writes straight to `console.log` rather than `logger`, whose `warn`/`error` are
 * gated on `__DEV__`: these numbers must stay readable via `adb logcat` in a
 * release build, which is the only place real device timings are meaningful.
 *
 * @param {Omit<MetricEntry, 'timestamp'>} entry Stage, duration and optional flags.
 * @returns {void}
 */
export function recordMetric(entry: Omit<MetricEntry, 'timestamp'>): void {
  const full: MetricEntry = { ...entry, timestamp: Date.now() };
  entries.push(full);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  const flags = [full.cold ? 'cold' : null, full.failed ? 'failed' : null]
    .filter(Boolean)
    .join(',');
  console.log(
    `[metrics] stage=${full.stage} ms=${full.durationMs.toFixed(1)}${flags ? ` flags=${flags}` : ''}`
  );
}

/**
 * Times an async operation, recording the result even when it throws.
 *
 * @param {MetricStage} stage Stage being measured.
 * @param {() => Promise<T>} work Operation to time.
 * @param {{cold?: boolean}} [options] Extra context for the entry.
 * @returns {Promise<T>} Whatever `work` resolves to.
 */
export async function measure<T>(
  stage: MetricStage,
  work: () => Promise<T>,
  options?: { cold?: boolean }
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await work();
    recordMetric({ stage, durationMs: Date.now() - startedAt, cold: options?.cold });
    return result;
  } catch (error) {
    recordMetric({
      stage,
      durationMs: Date.now() - startedAt,
      cold: options?.cold,
      failed: true,
    });
    throw error;
  }
}

/**
 * @returns {MetricEntry[]} Copy of the retained measurements, oldest first.
 */
export function getMetrics(): MetricEntry[] {
  return [...entries];
}

/**
 * Discards every retained measurement.
 *
 * @returns {void}
 */
export function clearMetrics(): void {
  entries.length = 0;
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[Math.max(0, index)];
}

/**
 * Aggregates the retained measurements per stage.
 *
 * Cold runs are counted but excluded from the statistics: the first scan carries
 * one-off model loading and would skew a device-to-device comparison.
 *
 * @returns {Record<string, StageSummary>} Summary keyed by stage.
 */
export function summarizeMetrics(): Record<string, StageSummary> {
  const summary: Record<string, StageSummary> = {};

  for (const entry of entries) {
    const bucket = (summary[entry.stage] ??= {
      count: 0,
      meanMs: 0,
      minMs: 0,
      maxMs: 0,
      p95Ms: 0,
      coldCount: 0,
    });
    if (entry.cold) bucket.coldCount += 1;
  }

  for (const stage of Object.keys(summary)) {
    const warm = entries
      .filter((e) => e.stage === stage && !e.cold)
      .map((e) => e.durationMs)
      .sort((a, b) => a - b);

    const bucket = summary[stage];
    bucket.count = warm.length;
    if (warm.length > 0) {
      bucket.meanMs = Math.round((warm.reduce((a, b) => a + b, 0) / warm.length) * 10) / 10;
      bucket.minMs = warm[0];
      bucket.maxMs = warm[warm.length - 1];
      bucket.p95Ms = percentile(warm, 0.95);
    }
  }

  return summary;
}

/**
 * Prints the per-stage summary as one line per stage.
 *
 * Kept greppable (`adb logcat | grep metrics-summary`) so timings from several
 * devices can be compared without parsing individual measurements.
 *
 * @returns {void}
 */
export function dumpMetrics(): void {
  const summary = summarizeMetrics();
  const stages = Object.keys(summary);

  if (stages.length === 0) {
    console.log('[metrics-summary] no measurements recorded');
    return;
  }

  for (const stage of stages) {
    const s = summary[stage];
    console.log(
      `[metrics-summary] stage=${stage} count=${s.count} mean=${s.meanMs} ` +
        `min=${s.minMs} max=${s.maxMs} p95=${s.p95Ms} cold=${s.coldCount}`
    );
  }
}
