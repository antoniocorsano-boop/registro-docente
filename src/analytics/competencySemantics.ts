export interface CompetencyEvidenceCoverage {
  evaluatedCount: number;
  totalCount: number;
  label: string;
  reliable: boolean;
}

export interface CompetencyScore {
  label: string;
  score: number;
}

export type GrowthRecommendation =
  | { kind: 'absolute'; item: CompetencyScore }
  | { kind: 'relative'; item: CompetencyScore }
  | { kind: 'none'; item: null };

export function getCompetencyEvidenceCoverage(
  evaluatedCount: number,
  totalCount: number,
): CompetencyEvidenceCoverage {
  return {
    evaluatedCount,
    totalCount,
    label: `${evaluatedCount}/${totalCount} con evidenze`,
    reliable: evaluatedCount >= 3,
  };
}

export function getGrowthRecommendation(
  scores: CompetencyScore[],
  absoluteThreshold: number,
): GrowthRecommendation {
  if (scores.length === 0) {
    return { kind: 'none', item: null };
  }

  const lowest = scores.reduce((currentLowest, candidate) =>
    candidate.score < currentLowest.score ? candidate : currentLowest
  );

  if (lowest.score < absoluteThreshold) {
    return { kind: 'absolute', item: lowest };
  }

  if (scores.length >= 2) {
    return { kind: 'relative', item: lowest };
  }

  return { kind: 'none', item: null };
}
