export interface RankTier {
  label: string;
  minActivity: number;
}

export const RANK_TIERS: RankTier[] = [
  { label: 'Nuevo', minActivity: 0 },
  { label: 'Contribuidor', minActivity: 10 },
  { label: 'Experto de Campo', minActivity: 50 },
  { label: 'Master Field', minActivity: 200 },
];

export interface RankProgress {
  currentRank: string;
  nextRank: string | null;
  progressPercent: number;
  remainingToNextRank: number;
}

export function computeRankProgress(activityCount: number): RankProgress {
  let currentTierIndex = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (activityCount >= RANK_TIERS[i].minActivity) {
      currentTierIndex = i;
    }
  }

  const currentTier = RANK_TIERS[currentTierIndex];
  const nextTier = RANK_TIERS[currentTierIndex + 1] ?? null;

  if (!nextTier) {
    return {
      currentRank: currentTier.label,
      nextRank: null,
      progressPercent: 100,
      remainingToNextRank: 0,
    };
  }

  const range = nextTier.minActivity - currentTier.minActivity;
  const progress = activityCount - currentTier.minActivity;

  return {
    currentRank: currentTier.label,
    nextRank: nextTier.label,
    progressPercent: Math.round((progress / range) * 100),
    remainingToNextRank: nextTier.minActivity - activityCount,
  };
}
