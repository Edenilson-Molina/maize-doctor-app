import { render } from '@testing-library/react-native';
import { ScanResult } from './ScanResult';
import { DIAGNOSIS_CLASSES, DIAGNOSIS_MAP, type DiagnosisClass } from '@/content/diagnosis';
import type { ScanStackParamList } from '@/navigation/types';

type ScanResultParams = ScanStackParamList['ScanResult'];

function buildParams(label: DiagnosisClass, confidence = 0.9): ScanResultParams {
  const remaining = (1 - confidence) / (DIAGNOSIS_CLASSES.length - 1);
  const distribution = Object.fromEntries(
    DIAGNOSIS_CLASSES.map((c) => [c, c === label ? confidence : remaining]),
  ) as Record<DiagnosisClass, number>;

  return {
    imageUri: 'file:///document/scans/scan_test.jpg',
    label,
    confidence,
    distribution,
    temperature: 24,
    humidity: 65,
    createdAt: Date.now(),
  };
}

async function renderResult(params: ScanResultParams) {
  const navigation = { goBack: jest.fn() } as unknown as never;
  const route = { key: 'ScanResult', name: 'ScanResult' as const, params };
  return render(<ScanResult route={route} navigation={navigation} />);
}

describe('ScanResult', () => {
  it.each(DIAGNOSIS_CLASSES)(
    'renders the diagnosis and recommendations for "%s"',
    async (label) => {
      const info = DIAGNOSIS_MAP[label];
      const { findByText } = await renderResult(buildParams(label));

      expect(await findByText(info.label)).toBeTruthy();
      expect(await findByText(info.description)).toBeTruthy();
      for (const recommendation of info.recommendations) {
        expect(await findByText(recommendation)).toBeTruthy();
      }
    },
  );

  it('shows the second most likely class when confidence is low', async () => {
    const distribution: Record<DiagnosisClass, number> = {
      healthy: 0.4,
      common_rust: 0.35,
      northern_corn_leaf_blight: 0.05,
      gray_leaf_spot: 0.05,
      lethal_necrosis: 0.05,
      fall_armyworm: 0.03,
      nitrogen_deficiency: 0.03,
      phosphorus_deficiency: 0.02,
      potassium_deficiency: 0.02,
    };
    const params: ScanResultParams = {
      imageUri: 'file:///document/scans/scan_test.jpg',
      label: 'healthy',
      confidence: 0.4,
      distribution,
      temperature: 24,
      humidity: 65,
      createdAt: Date.now(),
    };

    const { findByText } = await renderResult(params);

    expect(await findByText(/Podría tratarse también de: Roya Comun/)).toBeTruthy();
  });

  it('does not show a second likely class when confidence is high', async () => {
    const { queryByText } = await renderResult(buildParams('healthy', 0.95));

    expect(queryByText(/Podría tratarse también de/)).toBeNull();
  });

  it('shows N/D for missing environmental readings', async () => {
    const params = { ...buildParams('healthy'), temperature: null, humidity: null };
    const { findAllByText } = await renderResult(params);

    expect(await findAllByText('N/D')).toHaveLength(2);
  });
});
