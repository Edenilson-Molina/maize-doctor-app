import { DIAGNOSIS_CLASSES, type DiagnosisClass } from './diagnosis';
import { SEVERITY_DISCLAIMER, SEVERITY_GUIDE, type SeverityLevelKey } from './severity';

const DISEASE_CLASSES = DIAGNOSIS_CLASSES.filter((c) => c !== 'healthy');

describe('SEVERITY_DISCLAIMER', () => {
  it('states that the level is not measured by the model', () => {
    expect(SEVERITY_DISCLAIMER.toLowerCase()).toContain('no mide');
  });
});

describe('SEVERITY_GUIDE', () => {
  it('has an entry for every diagnosis class', () => {
    for (const cls of DIAGNOSIS_CLASSES) {
      expect(SEVERITY_GUIDE[cls]).toBeDefined();
    }
  });

  it.each(DIAGNOSIS_CLASSES)('entry "%s" has fully populated levels', (cls) => {
    const guide = SEVERITY_GUIDE[cls];
    expect(guide.levels.length).toBeGreaterThanOrEqual(2);

    for (const level of guide.levels) {
      expect(level.title.length).toBeGreaterThan(0);
      expect(level.extent.length).toBeGreaterThan(0);
      expect(level.scientificScale.length).toBeGreaterThan(0);
      expect(level.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(level.signs.length).toBeGreaterThan(0);
      expect(level.actions.length).toBeGreaterThan(0);
    }
  });

  it.each(DIAGNOSIS_CLASSES)('entry "%s" has unique level keys and titles', (cls) => {
    const guide = SEVERITY_GUIDE[cls];
    const keys = guide.levels.map((level) => level.key);
    const titles = guide.levels.map((level) => level.title);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(DISEASE_CLASSES)('entry "%s" orders levels from mild to critical', (cls) => {
    const expected: SeverityLevelKey[] = ['mild', 'moderate', 'critical'];
    expect(SEVERITY_GUIDE[cls].levels.map((level) => level.key)).toEqual(expected);
  });

  it('describes the healthy class as two monitoring states instead of damage levels', () => {
    const expected: SeverityLevelKey[] = ['optimal', 'watch'];
    expect(SEVERITY_GUIDE.healthy.levels.map((level) => level.key)).toEqual(expected);
  });

  it.each(DISEASE_CLASSES)('entry "%s" escalates the accent color', (cls) => {
    const colors = SEVERITY_GUIDE[cls].levels.map((level) => level.accentColor);
    expect(colors).toEqual(['#2d6a4f', '#d4a373', '#ba1a1a']);
  });

  it('keeps plain wording free of the latin binomial used in the technical catalogue', () => {
    const binomials = [
      'Puccinia',
      'Exserohilum',
      'Cercospora',
      'Spodoptera',
      'MCMV',
      'AFA',
      'coalescen',
    ];

    for (const cls of DIAGNOSIS_CLASSES as DiagnosisClass[]) {
      for (const level of SEVERITY_GUIDE[cls].levels) {
        const prose = [level.title, level.extent, ...level.signs].join(' ');
        for (const binomial of binomials) {
          expect(prose).not.toContain(binomial);
        }
      }
    }
  });
});
