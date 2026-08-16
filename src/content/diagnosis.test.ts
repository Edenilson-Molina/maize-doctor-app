import {
  DIAGNOSIS_CLASSES,
  DIAGNOSIS_MAP,
  type DiagnosisClass,
} from './diagnosis';

describe('DIAGNOSIS_CLASSES', () => {
  it('contains exactly 9 classes', () => {
    expect(DIAGNOSIS_CLASSES).toHaveLength(9);
  });

  it('includes all expected classes', () => {
    const expected: DiagnosisClass[] = [
      'healthy',
      'common_rust',
      'northern_corn_leaf_blight',
      'gray_leaf_spot',
      'lethal_necrosis',
      'fall_armyworm',
      'nitrogen_deficiency',
      'phosphorus_deficiency',
      'potassium_deficiency',
    ];
    expect(DIAGNOSIS_CLASSES).toEqual(expected);
  });
});

describe('DIAGNOSIS_MAP', () => {
  it('has an entry for every class', () => {
    for (const cls of DIAGNOSIS_CLASSES) {
      expect(DIAGNOSIS_MAP[cls]).toBeDefined();
    }
  });

  it.each(DIAGNOSIS_CLASSES)('entry "%s" has required fields', (cls) => {
    const info = DIAGNOSIS_MAP[cls];
    expect(typeof info.label).toBe('string');
    expect(info.label.length).toBeGreaterThan(0);
    expect(typeof info.description).toBe('string');
    expect(['none', 'low', 'medium', 'high', 'critical']).toContain(info.severity);
    expect(info.statusColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(Array.isArray(info.recommendations)).toBe(true);
    expect(info.recommendations.length).toBeGreaterThan(0);
  });

  it('healthy class has severity "none"', () => {
    expect(DIAGNOSIS_MAP.healthy.severity).toBe('none');
  });

  it('healthy class uses the healthy status color', () => {
    expect(DIAGNOSIS_MAP.healthy.statusColor).toBe('#2d6a4f');
  });

  it('disease classes do not have severity "none"', () => {
    const diseases = DIAGNOSIS_CLASSES.filter((c) => c !== 'healthy');
    for (const cls of diseases) {
      expect(DIAGNOSIS_MAP[cls].severity).not.toBe('none');
    }
  });

  it('classes with few training images recommend specialist confirmation', () => {
    const lowDataClasses: DiagnosisClass[] = [
      'common_rust',
      'nitrogen_deficiency',
      'phosphorus_deficiency',
      'potassium_deficiency',
    ];
    for (const cls of lowDataClasses) {
      const hasSpecialist = DIAGNOSIS_MAP[cls].recommendations.some((r) =>
        r.toLowerCase().includes('especialista')
      );
      expect(hasSpecialist).toBe(true);
    }
  });
});
