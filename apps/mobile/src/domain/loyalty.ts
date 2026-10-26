export const LOYALTY_REWARD_TARGET = 7 as const;

export interface LoyaltyCard {
  readonly id: string;
  readonly memberName: string;
  readonly stampsCollected: number;
  readonly rewardTarget: typeof LOYALTY_REWARD_TARGET;
  readonly rewardsAvailable: number;
  readonly isDemo: boolean;
}

export interface LoyaltyProgress {
  readonly collected: number;
  readonly target: typeof LOYALTY_REWARD_TARGET;
  readonly remaining: number;
  readonly ratio: number;
  readonly isComplete: boolean;
  readonly rewardsAvailable: number;
}

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** Display-only progress; earning and redeeming rewards belong to the server. */
export function getLoyaltyProgress(card: LoyaltyCard): LoyaltyProgress {
  const target = LOYALTY_REWARD_TARGET;
  const collected = Math.min(nonNegativeInteger(card.stampsCollected), target);

  return {
    collected,
    target,
    remaining: target - collected,
    ratio: collected / target,
    isComplete: collected === target,
    rewardsAvailable: nonNegativeInteger(card.rewardsAvailable),
  };
}
