import { DIAGNOSIS_CLASSES, type DiagnosisClass } from '@/content/diagnosis';
import type { InferenceEngine, InferenceResult } from './InferenceEngine';

const MIN_LATENCY_MS = 600;
const MAX_LATENCY_MS = 1500;
const MIN_TOP_CONFIDENCE = 0.55;
const MAX_TOP_CONFIDENCE = 0.97;

let cycleIndex = 0;

function buildDistribution(
  label: DiagnosisClass,
  confidence: number,
): Record<DiagnosisClass, number> {
  const others = DIAGNOSIS_CLASSES.filter((c) => c !== label);
  const weights = others.map(() => Math.random());
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const remaining = 1 - confidence;

  const distribution = { [label]: confidence } as Record<DiagnosisClass, number>;
  others.forEach((c, i) => {
    distribution[c] =
      weightSum > 0 ? (weights[i] / weightSum) * remaining : remaining / others.length;
  });
  return distribution;
}

export class MockInferenceEngine implements InferenceEngine {
  async predict(_imageUri: string): Promise<InferenceResult> {
    const latency = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
    await new Promise((resolve) => setTimeout(resolve, latency));

    const label = DIAGNOSIS_CLASSES[cycleIndex % DIAGNOSIS_CLASSES.length];
    cycleIndex += 1;

    const confidence =
      MIN_TOP_CONFIDENCE + Math.random() * (MAX_TOP_CONFIDENCE - MIN_TOP_CONFIDENCE);
    const distribution = buildDistribution(label, confidence);

    return { label, confidence, distribution };
  }
}
