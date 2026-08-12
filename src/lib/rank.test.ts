import { computeRankProgress } from './rank';

describe('computeRankProgress', () => {
  it('starts at Nuevo with 0 activity', () => {
    const result = computeRankProgress(0);
    expect(result.currentRank).toBe('Nuevo');
    expect(result.nextRank).toBe('Contribuidor');
    expect(result.progressPercent).toBe(0);
    expect(result.remainingToNextRank).toBe(10);
  });

  it('stays at Nuevo just below the Contribuidor threshold', () => {
    const result = computeRankProgress(9);
    expect(result.currentRank).toBe('Nuevo');
    expect(result.remainingToNextRank).toBe(1);
  });

  it('advances to Contribuidor exactly at the threshold', () => {
    const result = computeRankProgress(10);
    expect(result.currentRank).toBe('Contribuidor');
    expect(result.nextRank).toBe('Experto de Campo');
  });

  it('computes progress percentage partway between two tiers', () => {
    // Contribuidor spans 10-49 (range 40); at 30 that's 20/40 = 50%
    const result = computeRankProgress(30);
    expect(result.currentRank).toBe('Contribuidor');
    expect(result.progressPercent).toBe(50);
  });

  it('advances to Experto de Campo at 50', () => {
    const result = computeRankProgress(50);
    expect(result.currentRank).toBe('Experto de Campo');
    expect(result.nextRank).toBe('Master Field');
  });

  it('reaches the maximum rank at 200 with no next rank', () => {
    const result = computeRankProgress(200);
    expect(result.currentRank).toBe('Master Field');
    expect(result.nextRank).toBeNull();
    expect(result.progressPercent).toBe(100);
    expect(result.remainingToNextRank).toBe(0);
  });

  it('stays at the maximum rank well beyond the threshold', () => {
    const result = computeRankProgress(5000);
    expect(result.currentRank).toBe('Master Field');
    expect(result.nextRank).toBeNull();
  });
});
