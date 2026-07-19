// Rule-based opportunity scoring for a prospect.
// This is intentionally simple and transparent for the MVP — every point
// is explainable. Once we have real conversion outcomes (won/lost deals),
// this can be replaced or blended with a trained model without changing
// the shape callers depend on (Score).

export type ProspectSignals = {
  reviewCount: number | null;
  rating: number | null;
  hasWebsite: boolean;
  hasHttps: boolean | null;
  isResponsive: boolean | null;
  loadTimeMs: number | null;
  hasSeoTitle: boolean | null;
  hasMetaDescription: boolean | null;
  lastSocialPostDaysAgo: number | null;
};

export type ScoreReason = {
  label: string;
  points: number;
};

export type Score = {
  total: number; // 0-100
  reasons: ScoreReason[];
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export function scoreProspect(s: ProspectSignals): Score {
  const reasons: ScoreReason[] = [];
  let total = 40; // baseline: has some presence worth analyzing

  // Existing audience = existing demand you can redirect
  if (s.reviewCount !== null) {
    if (s.reviewCount >= 100) {
      total += 15;
      reasons.push({ label: "Clientèle établie (100+ avis)", points: 15 });
    } else if (s.reviewCount >= 20) {
      total += 8;
      reasons.push({ label: "Clientèle active (20+ avis)", points: 8 });
    }
  }

  if (s.rating !== null && s.rating >= 4.0) {
    total += 5;
    reasons.push({ label: "Bonne réputation (note ≥ 4.0)", points: 5 });
  }

  // No website at all is the strongest signal, but also the hardest sell —
  // weighted lower than "has a website but it's bad".
  if (!s.hasWebsite) {
    total += 10;
    reasons.push({ label: "Aucun site web", points: 10 });
  } else {
    if (s.hasHttps === false) {
      total += 8;
      reasons.push({ label: "Pas de HTTPS", points: 8 });
    }
    if (s.isResponsive === false) {
      total += 10;
      reasons.push({ label: "Site non responsive (mobile)", points: 10 });
    }
    if (s.loadTimeMs !== null && s.loadTimeMs > 4000) {
      total += 6;
      reasons.push({ label: "Temps de chargement > 4s", points: 6 });
    }
    if (s.hasSeoTitle === false || s.hasMetaDescription === false) {
      total += 5;
      reasons.push({ label: "Balises SEO manquantes", points: 5 });
    }
  }

  if (s.lastSocialPostDaysAgo !== null && s.lastSocialPostDaysAgo > 180) {
    total += 6;
    reasons.push({ label: "Réseaux sociaux inactifs (6 mois+)", points: 6 });
  }

  return { total: clamp(Math.round(total), 0, 100), reasons };
}
