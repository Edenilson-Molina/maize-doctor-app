import { DIAGNOSIS_CLASSES, type DiagnosisClass } from '@/content/diagnosis';

export interface MockScan {
  id: string;
  imageUri: string;
  label: DiagnosisClass;
  confidence: number;
  distribution: Record<string, number>;
  lat: number;
  lon: number;
  temperature: number;
  humidity: number;
  synced: boolean;
  createdAt: number;
}

function randomConfidence(): number {
  return 0.6 + Math.random() * 0.35;
}

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000 + Math.random() * 12 * 60 * 60 * 1000;
}

function randomDistribution(primary: DiagnosisClass): Record<string, number> {
  const dist: Record<string, number> = {};
  let remaining = 1;
  const primaryConf = randomConfidence();
  dist[primary] = primaryConf;
  remaining -= primaryConf;
  const others = DIAGNOSIS_CLASSES.filter((c) => c !== primary);
  others.forEach((cls, i) => {
    if (i === others.length - 1) {
      dist[cls] = Math.max(0, remaining);
    } else {
      const val = Math.random() * remaining * 0.5;
      dist[cls] = val;
      remaining -= val;
    }
  });
  return dist;
}

const SEEDS: Array<{ label: DiagnosisClass; daysBack: number; lat: number; lon: number; temperature: number; humidity: number }> = [
  { label: 'healthy', daysBack: 1, lat: 13.7, lon: -89.2, temperature: 28, humidity: 65 },
  { label: 'healthy', daysBack: 3, lat: 13.69, lon: -89.19, temperature: 27, humidity: 70 },
  { label: 'healthy', daysBack: 7, lat: 13.71, lon: -89.21, temperature: 29, humidity: 60 },
  { label: 'common_rust', daysBack: 2, lat: 13.68, lon: -89.18, temperature: 26, humidity: 80 },
  { label: 'common_rust', daysBack: 5, lat: 13.72, lon: -89.22, temperature: 25, humidity: 85 },
  { label: 'northern_corn_leaf_blight', daysBack: 1, lat: 13.67, lon: -89.17, temperature: 24, humidity: 90 },
  { label: 'northern_corn_leaf_blight', daysBack: 4, lat: 13.73, lon: -89.23, temperature: 23, humidity: 88 },
  { label: 'gray_leaf_spot', daysBack: 2, lat: 13.66, lon: -89.16, temperature: 27, humidity: 75 },
  { label: 'gray_leaf_spot', daysBack: 6, lat: 13.74, lon: -89.24, temperature: 26, humidity: 78 },
  { label: 'lethal_necrosis', daysBack: 3, lat: 13.65, lon: -89.15, temperature: 30, humidity: 55 },
  { label: 'fall_armyworm', daysBack: 1, lat: 13.64, lon: -89.14, temperature: 29, humidity: 60 },
  { label: 'fall_armyworm', daysBack: 8, lat: 13.75, lon: -89.25, temperature: 28, humidity: 62 },
  { label: 'nitrogen_deficiency', daysBack: 4, lat: 13.63, lon: -89.13, temperature: 31, humidity: 50 },
  { label: 'nitrogen_deficiency', daysBack: 9, lat: 13.76, lon: -89.26, temperature: 30, humidity: 52 },
  { label: 'phosphorus_deficiency', daysBack: 5, lat: 13.62, lon: -89.12, temperature: 28, humidity: 58 },
  { label: 'potassium_deficiency', daysBack: 6, lat: 13.61, lon: -89.11, temperature: 27, humidity: 63 },
  { label: 'potassium_deficiency', daysBack: 10, lat: 13.77, lon: -89.27, temperature: 26, humidity: 66 },
  { label: 'healthy', daysBack: 12, lat: 13.7, lon: -89.2, temperature: 28, humidity: 64 },
  { label: 'common_rust', daysBack: 14, lat: 13.69, lon: -89.19, temperature: 25, humidity: 82 },
  { label: 'fall_armyworm', daysBack: 15, lat: 13.68, lon: -89.18, temperature: 29, humidity: 59 },
];

let _mockScans: MockScan[] | null = null;

export function getMockScans(): MockScan[] {
  if (!_mockScans) {
    _mockScans = SEEDS.map((seed, i) => ({
      id: `mock-${i}`,
      imageUri: `dev://seed/${seed.label}_${seed.daysBack}`,
      label: seed.label,
      confidence: randomConfidence(),
      distribution: randomDistribution(seed.label),
      lat: seed.lat,
      lon: seed.lon,
      temperature: seed.temperature,
      humidity: seed.humidity,
      synced: false,
      createdAt: daysAgo(seed.daysBack),
    }));
    _mockScans.sort((a, b) => b.createdAt - a.createdAt);
  }
  return _mockScans;
}
