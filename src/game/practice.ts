import { CaseItem, ModelId, SessionRoundCount } from '../types';
import { ALL_MODELS, buildSessionSequence } from './sequences';
import { BASE_CORRECT_POINTS } from './scoring';

export const PRACTICE_STORAGE_KEY = 'el_encargo_practice_v1';

export interface PracticeConfig {
  roundCount: SessionRoundCount;
  selectedModels?: ModelId[];
}

export interface PracticeAnswer {
  caseId: string;
  option: ModelId;
  correct: boolean;
  pointsAdded: number;
}

export type PracticePhase = 'open' | 'revealed' | 'final';

export interface PracticeSession {
  version: 1;
  createdAt: number;
  config: PracticeConfig;
  sequence: string[];
  roundIndex: number;
  phase: PracticePhase;
  selected: ModelId | null;
  answers: PracticeAnswer[];
  score: number;
  streak: number;
  bestStreak: number;
}

export function createPracticeSession(
  cases: CaseItem[],
  config: PracticeConfig,
  now: number = Date.now(),
  sequenceOverride?: string[]
): PracticeSession {
  const sequence =
    sequenceOverride && sequenceOverride.length > 0
      ? [...sequenceOverride]
      : buildSessionSequence(cases, config.roundCount, config.selectedModels);

  return {
    version: 1,
    createdAt: now,
    config: {
      roundCount: config.roundCount,
      selectedModels: config.selectedModels ? [...config.selectedModels] : undefined,
    },
    sequence,
    roundIndex: 0,
    phase: 'open',
    selected: null,
    answers: [],
    score: 0,
    streak: 0,
    bestStreak: 0,
  };
}

export function selectOption(session: PracticeSession, option: ModelId): PracticeSession {
  if (session.phase !== 'open') return session;
  return {
    ...session,
    selected: option,
  };
}

/**
 * Confirma la opción seleccionada en el caso actual, calcula puntaje fijo y revela el dictamen.
 */
export function confirmAnswer(session: PracticeSession, cases: CaseItem[]): PracticeSession {
  if (session.phase !== 'open' || !session.selected) return session;

  const caseId = session.sequence[session.roundIndex];
  const caseItem = cases.find((c) => c.id === caseId);
  if (!caseItem) return session;

  const option = session.selected;
  const correct = option === caseItem.model;
  const pointsAdded = correct ? BASE_CORRECT_POINTS : 0;
  const streak = correct ? session.streak + 1 : 0;

  const answer: PracticeAnswer = {
    caseId: caseItem.id,
    option,
    correct,
    pointsAdded,
  };

  return {
    ...session,
    phase: 'revealed',
    answers: [...session.answers.slice(0, session.roundIndex), answer],
    score: session.score + pointsAdded,
    streak,
    bestStreak: Math.max(session.bestStreak, streak),
  };
}

export function nextCase(session: PracticeSession): PracticeSession {
  if (session.phase !== 'revealed') return session;

  const nextIndex = session.roundIndex + 1;
  if (nextIndex >= session.sequence.length) {
    return {
      ...session,
      phase: 'final',
    };
  }

  return {
    ...session,
    roundIndex: nextIndex,
    phase: 'open',
    selected: null,
  };
}

export interface PracticeModelStats {
  modelId: ModelId;
  rounds: number;
  correct: number;
  accuracyPct: number;
  mostFrequentTrap: ModelId | null;
}

export interface PracticeSummary {
  total: number;
  correctCount: number;
  score: number;
  bestStreak: number;
  byModel: PracticeModelStats[];
  failedCaseIds: string[];
}

export function computePracticeSummary(
  session: PracticeSession,
  cases: CaseItem[]
): PracticeSummary {
  const caseMap = new Map<string, CaseItem>(cases.map((c) => [c.id, c]));

  const statsMap = new Map<
    ModelId,
    {
      rounds: number;
      correct: number;
      wrongCounts: Partial<Record<ModelId, number>>;
    }
  >();

  for (const m of ALL_MODELS) {
    statsMap.set(m, { rounds: 0, correct: 0, wrongCounts: {} });
  }

  let correctCount = 0;
  const failedSeen = new Set<string>();
  const failedCaseIds: string[] = [];

  for (const ans of session.answers) {
    const caseItem = caseMap.get(ans.caseId);
    if (!caseItem) continue;

    const bucket = statsMap.get(caseItem.model);
    if (!bucket) continue;

    bucket.rounds += 1;
    if (ans.correct) {
      bucket.correct += 1;
      correctCount += 1;
    } else {
      bucket.wrongCounts[ans.option] = (bucket.wrongCounts[ans.option] ?? 0) + 1;
      if (!failedSeen.has(ans.caseId)) {
        failedSeen.add(ans.caseId);
        failedCaseIds.push(ans.caseId);
      }
    }
  }

  const byModel: PracticeModelStats[] = [];
  for (const modelId of ALL_MODELS) {
    const bucket = statsMap.get(modelId);
    if (!bucket || bucket.rounds === 0) continue;

    let mostFrequentTrap: ModelId | null = null;
    let bestWrongCount = 0;
    for (const candidate of ALL_MODELS) {
      const count = bucket.wrongCounts[candidate] ?? 0;
      if (candidate !== modelId && count > bestWrongCount) {
        bestWrongCount = count;
        mostFrequentTrap = candidate;
      }
    }

    byModel.push({
      modelId,
      rounds: bucket.rounds,
      correct: bucket.correct,
      accuracyPct: Math.round((bucket.correct / bucket.rounds) * 100),
      mostFrequentTrap,
    });
  }

  return {
    total: session.answers.length,
    correctCount,
    score: session.score,
    bestStreak: session.bestStreak,
    byModel,
    failedCaseIds,
  };
}

/**
 * Devuelve los IDs de casos fallados en la sesión, sin duplicados y ordenados por nivel (1 → 2 → 3).
 */
export function buildRetrySequence(session: PracticeSession, cases: CaseItem[]): string[] {
  const caseMap = new Map<string, CaseItem>(cases.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const failed: CaseItem[] = [];

  for (const ans of session.answers) {
    if (ans.correct || seen.has(ans.caseId)) continue;
    const item = caseMap.get(ans.caseId);
    if (!item) continue;
    seen.add(ans.caseId);
    failed.push(item);
  }

  failed.sort((a, b) => a.level - b.level);
  return failed.map((c) => c.id);
}

export function savePracticeSession(session: PracticeSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignorar errores de cuota o almacenamiento bloqueado
  }
}

export function loadPracticeSession(cases: CaseItem[]): PracticeSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PRACTICE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const candidate = parsed as Partial<PracticeSession>;
    if (candidate.version !== 1) return null;
    if (!Array.isArray(candidate.sequence) || candidate.sequence.length === 0) return null;

    const caseIdSet = new Set(cases.map((c) => c.id));
    if (!candidate.sequence.every((id) => typeof id === 'string' && caseIdSet.has(id))) {
      return null;
    }

    if (
      candidate.phase !== 'open' &&
      candidate.phase !== 'revealed' &&
      candidate.phase !== 'final'
    ) {
      return null;
    }

    if (
      typeof candidate.roundIndex !== 'number' ||
      !Number.isInteger(candidate.roundIndex) ||
      candidate.roundIndex < 0 ||
      candidate.roundIndex >= candidate.sequence.length
    ) {
      return null;
    }

    if (!Array.isArray(candidate.answers)) return null;
    if (candidate.phase === 'revealed' && !candidate.answers[candidate.roundIndex]) return null;
    if (candidate.phase === 'final' && candidate.answers.length === 0) return null;

    if (
      candidate.selected !== null &&
      (typeof candidate.selected !== 'string' || !ALL_MODELS.includes(candidate.selected as ModelId))
    ) {
      return null;
    }

    if (
      typeof candidate.score !== 'number' ||
      !Number.isFinite(candidate.score) ||
      candidate.score < 0 ||
      typeof candidate.streak !== 'number' ||
      !Number.isFinite(candidate.streak) ||
      candidate.streak < 0 ||
      typeof candidate.bestStreak !== 'number' ||
      !Number.isFinite(candidate.bestStreak) ||
      candidate.bestStreak < 0 ||
      typeof candidate.createdAt !== 'number' ||
      !Number.isFinite(candidate.createdAt)
    ) {
      return null;
    }

    const cfg = candidate.config;
    if (
      !cfg ||
      typeof cfg !== 'object' ||
      (cfg.roundCount !== 6 && cfg.roundCount !== 12 && cfg.roundCount !== 18)
    ) {
      return null;
    }

    return candidate as PracticeSession;
  } catch {
    return null;
  }
}

export function clearPracticeSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PRACTICE_STORAGE_KEY);
  } catch {
    // Ignorar errores de almacenamiento
  }
}
