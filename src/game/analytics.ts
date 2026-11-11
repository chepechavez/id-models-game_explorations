import { CaseItem, ModelId, PlayerRecord, RoomData } from '../types';

export interface LeaderboardEntry extends PlayerRecord {
  rank: number;
}

export function computeLeaderboard(players: Record<string, PlayerRecord> | undefined): LeaderboardEntry[] {
  if (!players) return [];
  const list = Object.entries(players).map(([uid, p]) => ({
    ...p,
    uid: p.uid || uid,
  }));
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.joinedAt || 0) - (b.joinedAt || 0);
  });
  return list.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

export interface ModelCohortStats {
  modelId: ModelId;
  roundsPlayed: number;
  totalVotes: number;
  correctVotes: number;
  accuracyPct: number;
  chosenDistribution: Partial<Record<ModelId, number>>;
  mostFrequentTrap: ModelId | null;
}

export function computeDecisionMap(
  room: RoomData,
  allCases: CaseItem[],
  modelOrder: ModelId[]
): ModelCohortStats[] {
  const statsByModel = new Map<ModelId, ModelCohortStats>();
  for (const m of modelOrder) {
    statsByModel.set(m, {
      modelId: m,
      roundsPlayed: 0,
      totalVotes: 0,
      correctVotes: 0,
      accuracyPct: 0,
      chosenDistribution: {},
      mostFrequentTrap: null,
    });
  }

  const results = room.results ?? {};
  for (const [roundIdxStr, res] of Object.entries(results)) {
    const rIdx = Number(roundIdxStr);
    const caseId = room.config.sequence[rIdx];
    const caseItem = allCases.find((c) => c.id === caseId);
    if (!caseItem) continue;

    const st = statsByModel.get(caseItem.model);
    if (!st) continue;

    st.roundsPlayed += 1;
    const dist = res.distribution ?? {};
    for (const [chosenModel, count] of Object.entries(dist) as [ModelId, number][]) {
      const n = Number(count || 0);
      st.totalVotes += n;
      st.chosenDistribution[chosenModel] = (st.chosenDistribution[chosenModel] ?? 0) + n;
      if (chosenModel === caseItem.model) {
        st.correctVotes += n;
      }
    }
  }

  for (const st of statsByModel.values()) {
    st.accuracyPct = st.totalVotes > 0 ? Math.round((st.correctVotes / st.totalVotes) * 100) : 0;
    let bestWrongModel: ModelId | null = null;
    let bestWrongVotes = 0;
    for (const [m, count] of Object.entries(st.chosenDistribution) as [ModelId, number][]) {
      if (m !== st.modelId && count > bestWrongVotes) {
        bestWrongVotes = count;
        bestWrongModel = m;
      }
    }
    st.mostFrequentTrap = bestWrongModel;
  }

  return modelOrder.map((m) => statsByModel.get(m)!);
}
