export interface PointsSummary {
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  tier: string;
  tierExpiresAt: Date | null;
}

export interface PointsTransactionDetail {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  referenceId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface TierInfo {
  tier: string;
  tierName: string;
  minPoints: number;
  pointsMultiplier: number;
  benefits: string[];
}

interface TierMetadata {
  name: string;
  benefits: readonly string[];
}

export const TIER_CONFIG: Record<string, TierMetadata> = {
  bronze: { name: "Bronze", benefits: ["Pontuação padrão 1x"] },
  silver: {
    name: "Prata",
    benefits: ["Pontuação 1.25x", "Frete grátis acima de R$99"],
  },
  gold: {
    name: "Ouro",
    benefits: [
      "Pontuação 1.5x",
      "Frete grátis acima de R$99",
      "5% de desconto em datas especiais",
    ],
  },
  platinum: {
    name: "Platina",
    benefits: [
      "Pontuação 2x",
      "Frete grátis",
      "10% de desconto fixo",
      "Atendimento prioritário",
    ],
  },
};

export const POINTS_REDEEM_RATE = 0.01;
export const DEFAULT_TIER = "bronze";
