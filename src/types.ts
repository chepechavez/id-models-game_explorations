export type ModelId =
  | 'action-mapping'
  | '4c-id'
  | 'addie'
  | 'dick-carey'
  | 'pebble-in-the-pond'
  | 'backward-design';

export type CaseLevel = 1 | 2 | 3;

export type FeedbackVerdict = 'correct' | 'trap' | 'no';

export interface OptionFeedback {
  verdict: FeedbackVerdict;
  label: string;
  text: string;
  source: string;
  quote?: string;
}

export interface CaseValidation {
  status: 'draft' | 'validated' | 'revised';
  notebookRef: string;
  verifiedQuote: string;
  notes?: string;
}

export interface CaseItem {
  id: string;
  model: ModelId;
  level: CaseLevel;
  title: string;
  sector: string;
  client: string;
  brief: string;
  constraints: string[];
  successMetric: string;
  options: ModelId[];
  feedback: Partial<Record<ModelId, OptionFeedback>>;
  takeaway: string;
  artifactUnlocked: string;
  validation: CaseValidation;
}

export interface ModelSourceRef {
  citation: string;
  work: string;
  verbatimQuote: string;
}

export interface ModelGuideItem {
  id: ModelId;
  name: string;
  shortName: string;
  author: string;
  year: string;
  roleLayer: 'motor-pedagogico' | 'contenedor-gestion';
  color: string;
  accentBg: string;
  essence: string;
  metaphor: string;
  phases: string[];
  mindset: string;
  strengths: string[];
  weaknesses: string[];
  useWhen: string[];
  avoidWhen: string[];
  contextFit: {
    academic: string;
    corporate: string;
    bestFor: string;
  };
  outputArtifact: {
    name: string;
    description: string;
  };
  authorNote: string;
  sources: ModelSourceRef[];
}

export type RoundPhase = 'lobby' | 'open' | 'closed' | 'revealed' | 'final';

export type SessionRoundCount = 6 | 12 | 18;

export interface RoomConfig {
  roundCount: SessionRoundCount;
  sequence: string[]; // CaseItem IDs
  durations: {
    1: number;
    2: number;
    3: number;
  };
}

export interface RoomState {
  phase: RoundPhase;
  roundIndex: number;
  openedAt: number;
  deadline: number;
  closedAt?: number;
  revealedAt?: number;
}

export interface PlayerRecord {
  uid: string;
  name: string;
  joinedAt: number;
  lastSeen: number;
  score: number;
  streak: number;
  guideOpenedCount?: number;
}

export interface AnswerRecord {
  option: ModelId;
  at: number;
}

export interface RoundResult {
  distribution: Partial<Record<ModelId, number>>;
  playerDeltas: Record<
    string,
    {
      pointsAdded: number;
      newScore: number;
      newStreak: number;
      correct: boolean;
      option: ModelId | null;
      responseTimeMs: number | null;
    }
  >;
  scored: boolean;
}

export interface RoomData {
  code: string;
  hostUid: string;
  createdAt: number;
  config: RoomConfig;
  state: RoomState;
  players?: Record<string, PlayerRecord>;
  answers?: Record<string, Record<string, AnswerRecord>>;
  results?: Record<string, RoundResult>;
}
