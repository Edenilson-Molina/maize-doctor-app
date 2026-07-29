import { schema } from './schema';

describe('WatermelonDB schema', () => {
  it('is version 1', () => {
    expect(schema.version).toBe(1);
  });

  it('defines exactly 3 tables', () => {
    expect(Object.keys(schema.tables)).toHaveLength(3);
  });

  it('has scans table with required columns', () => {
    const scans = schema.tables.scans;
    expect(scans).toBeDefined();
    const colNames = Object.keys(scans.columns);
    expect(colNames).toContain('image_uri');
    expect(colNames).toContain('label');
    expect(colNames).toContain('confidence');
    expect(colNames).toContain('distribution_json');
    expect(colNames).toContain('lat');
    expect(colNames).toContain('lon');
    expect(colNames).toContain('temperature');
    expect(colNames).toContain('humidity');
    expect(colNames).toContain('synced');
    expect(colNames).toContain('created_at');
  });

  it('has corrections table with scan_id indexed', () => {
    const corrections = schema.tables.corrections;
    expect(corrections).toBeDefined();
    const colNames = Object.keys(corrections.columns);
    expect(colNames).toContain('scan_id');
    expect(colNames).toContain('observed_label');
    expect(colNames).toContain('note');
    expect(colNames).toContain('status');
    expect(colNames).toContain('synced');
    expect(corrections.columns.scan_id.isIndexed).toBe(true);
  });

  it('has dataset_contributions table', () => {
    const contributions = schema.tables.dataset_contributions;
    expect(contributions).toBeDefined();
    const colNames = Object.keys(contributions.columns);
    expect(colNames).toContain('image_uri');
    expect(colNames).toContain('label');
    expect(colNames).toContain('note');
    expect(colNames).toContain('synced');
    expect(colNames).toContain('created_at');
  });

  it('marks optional columns correctly on scans', () => {
    const scans = schema.tables.scans;
    expect(scans.columns.label.isOptional).toBe(true);
    expect(scans.columns.confidence.isOptional).toBe(true);
    expect(scans.columns.lat.isOptional).toBe(true);
    expect(scans.columns.image_uri.isOptional).toBeFalsy();
    expect(scans.columns.synced.isOptional).toBeFalsy();
  });
});
