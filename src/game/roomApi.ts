import {
  ref,
  set,
  get,
  update,
  onValue,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/database';
import {
  CaseItem,
  ModelId,
  PlayerRecord,
  RoomConfig,
  RoomData,
  RoundResult,
  SessionRoundCount,
} from '../types';
import { ensureParticipantIdentity, getFirebaseHandles } from '../firebase';
import { generateRoomCode, normalizeRoomCode } from './roomCode';
import { buildSessionSequence } from './sequences';
import { calculateRoundScore } from './scoring';

const LOCAL_ROOM_PREFIX = 'el_encargo_room_v1_';
const CHANNEL_NAME = 'el_encargo_sync_channel_v1';

function notifyLocalRoomChange(roomCode: string) {
  if (typeof window === 'undefined') return;
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage({ type: 'ROOM_UPDATED', roomCode });
      bc.close();
    }
    window.dispatchEvent(new CustomEvent('el-encargo-local-room', { detail: { roomCode } }));
  } catch {
    // Ignore
  }
}

function readLocalRoom(roomCode: string): RoomData | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(LOCAL_ROOM_PREFIX + roomCode);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomData;
  } catch {
    return null;
  }
}

function writeLocalRoom(roomCode: string, data: RoomData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_ROOM_PREFIX + roomCode, JSON.stringify(data));
  notifyLocalRoomChange(roomCode);
}

export interface CreateRoomOptions {
  roundCount: SessionRoundCount;
  durations?: { 1: number; 2: number; 3: number };
  customCode?: string;
}

export async function createRoom(
  allCases: CaseItem[],
  options: CreateRoomOptions
): Promise<{ code: string; hostUid: string }> {
  const { uid } = await ensureParticipantIdentity();
  const { mode, db } = getFirebaseHandles();

  const code = options.customCode
    ? normalizeRoomCode(options.customCode)
    : generateRoomCode(5);

  const sequence = buildSessionSequence(allCases, options.roundCount);
  const durations = options.durations ?? {
    1: 180,
    2: 240,
    3: 300,
  };

  const config: RoomConfig = {
    roundCount: options.roundCount,
    sequence,
    durations,
  };

  const initialRoom: RoomData = {
    code,
    hostUid: uid,
    createdAt: Date.now(),
    config,
    state: {
      phase: 'lobby',
      roundIndex: 0,
      openedAt: 0,
      deadline: 0,
    },
    players: {},
    answers: {},
    results: {},
  };

  if (mode !== 'local-broadcast' && db) {
    await set(ref(db, `rooms/${code}`), {
      hostUid: uid,
      createdAt: serverTimestamp(),
      config,
      state: initialRoom.state,
    });
  } else {
    writeLocalRoom(code, initialRoom);
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('el_encargo_last_host_room', code);
    } catch {
      // Ignore
    }
  }

  return { code, hostUid: uid };
}

export async function joinRoom(
  rawCode: string,
  playerName: string
): Promise<{ code: string; uid: string; player: PlayerRecord }> {
  const code = normalizeRoomCode(rawCode);
  const cleanName = playerName.trim().slice(0, 40);
  if (!cleanName) {
    throw new Error('Ingresa tu nombre o apodo para entrar a la consultora.');
  }

  const { uid } = await ensureParticipantIdentity();
  const { mode, db } = getFirebaseHandles();

  if (mode !== 'local-broadcast' && db) {
    const roomSnap = await get(ref(db, `rooms/${code}/state`));
    if (!roomSnap.exists()) {
      throw new Error(`No encontramos la sala ${code}. Verifica el código con el docente.`);
    }

    const existingSnap = await get(ref(db, `rooms/${code}/players/${uid}`));
    if (existingSnap.exists()) {
      const existing = existingSnap.val() as PlayerRecord;
      await update(ref(db, `rooms/${code}/players/${uid}`), {
        name: cleanName,
        lastSeen: serverTimestamp(),
      });
      return {
        code,
        uid,
        player: { ...existing, uid, name: cleanName, lastSeen: Date.now() },
      };
    }

    const newPlayer: PlayerRecord = {
      uid,
      name: cleanName,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      score: 0,
      streak: 0,
      guideOpenedCount: 0,
    };

    await set(ref(db, `rooms/${code}/players/${uid}`), {
      name: cleanName,
      joinedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      score: 0,
      streak: 0,
      guideOpenedCount: 0,
    });

    return { code, uid, player: newPlayer };
  }

  // Modo local-broadcast
  const room = readLocalRoom(code);
  if (!room) {
    throw new Error(`No encontramos la sala ${code}. Verifica el código con el docente.`);
  }
  const players = room.players ?? {};
  const existing = players[uid];
  const player: PlayerRecord = existing
    ? { ...existing, name: cleanName, lastSeen: Date.now() }
    : {
        uid,
        name: cleanName,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        score: 0,
        streak: 0,
        guideOpenedCount: 0,
      };

  room.players = { ...players, [uid]: player };
  writeLocalRoom(code, room);
  return { code, uid, player };
}

export async function submitAnswer(
  rawCode: string,
  roundIndex: number,
  option: ModelId
): Promise<void> {
  const code = normalizeRoomCode(rawCode);
  const { uid } = await ensureParticipantIdentity();
  const { mode, db } = getFirebaseHandles();

  if (mode !== 'local-broadcast' && db) {
    await set(ref(db, `rooms/${code}/answers/${roundIndex}/${uid}`), {
      option,
      at: serverTimestamp(),
    });
    return;
  }

  const room = readLocalRoom(code);
  if (!room) throw new Error('Sala no encontrada');
  if (room.state.phase !== 'open' || room.state.roundIndex !== roundIndex) {
    throw new Error('La ronda ya está cerrada.');
  }
  if (Date.now() > room.state.deadline) {
    throw new Error('El tiempo de la ronda terminó.');
  }
  const roundAnswers = room.answers?.[roundIndex] ?? {};
  roundAnswers[uid] = { option, at: Date.now() };
  room.answers = { ...(room.answers ?? {}), [roundIndex]: roundAnswers };
  writeLocalRoom(code, room);
}

export async function recordGuideOpen(rawCode: string): Promise<void> {
  const code = normalizeRoomCode(rawCode);
  const { uid } = await ensureParticipantIdentity();
  const { mode, db } = getFirebaseHandles();

  if (mode !== 'local-broadcast' && db) {
    const snap = await get(ref(db, `rooms/${code}/players/${uid}/guideOpenedCount`));
    const current = snap.exists() ? Number(snap.val() || 0) : 0;
    await set(ref(db, `rooms/${code}/players/${uid}/guideOpenedCount`), current + 1);
    return;
  }

  const room = readLocalRoom(code);
  if (!room || !room.players?.[uid]) return;
  room.players[uid].guideOpenedCount = (room.players[uid].guideOpenedCount ?? 0) + 1;
  writeLocalRoom(code, room);
}

export async function openRound(
  rawCode: string,
  roundIndex: number,
  durationSeconds: number
): Promise<void> {
  const code = normalizeRoomCode(rawCode);
  const { mode, db } = getFirebaseHandles();
  const now = Date.now();
  const deadline = now + durationSeconds * 1000;

  if (mode !== 'local-broadcast' && db) {
    await set(ref(db, `rooms/${code}/state`), {
      phase: 'open',
      roundIndex,
      openedAt: now,
      deadline,
    });
    return;
  }

  const room = readLocalRoom(code);
  if (!room) throw new Error('Sala no encontrada');
  room.state = {
    phase: 'open',
    roundIndex,
    openedAt: now,
    deadline,
  };
  writeLocalRoom(code, room);
}

export async function extendRoundTime(rawCode: string, extraSeconds: number): Promise<void> {
  const code = normalizeRoomCode(rawCode);
  const { mode, db } = getFirebaseHandles();

  if (mode !== 'local-broadcast' && db) {
    const snap = await get(ref(db, `rooms/${code}/state`));
    if (!snap.exists()) return;
    const st = snap.val();
    const base = Math.max(Date.now(), Number(st.deadline || Date.now()));
    await update(ref(db, `rooms/${code}/state`), {
      phase: 'open',
      deadline: base + extraSeconds * 1000,
    });
    return;
  }

  const room = readLocalRoom(code);
  if (!room) return;
  const base = Math.max(Date.now(), room.state.deadline || Date.now());
  room.state = {
    ...room.state,
    phase: 'open',
    deadline: base + extraSeconds * 1000,
  };
  writeLocalRoom(code, room);
}

export async function closeRound(rawCode: string): Promise<void> {
  const code = normalizeRoomCode(rawCode);
  const { mode, db } = getFirebaseHandles();
  const now = Date.now();

  if (mode !== 'local-broadcast' && db) {
    const snap = await get(ref(db, `rooms/${code}/state`));
    if (!snap.exists()) return;
    const st = snap.val();
    await set(ref(db, `rooms/${code}/state`), {
      ...st,
      phase: 'closed',
      closedAt: now,
    });
    return;
  }

  const room = readLocalRoom(code);
  if (!room) return;
  room.state = {
    ...room.state,
    phase: 'closed',
    closedAt: now,
  };
  writeLocalRoom(code, room);
}

export async function revealRound(
  rawCode: string,
  allCases: CaseItem[]
): Promise<RoundResult | null> {
  const code = normalizeRoomCode(rawCode);
  const { mode, db } = getFirebaseHandles();

  let room: RoomData | null = null;
  if (mode !== 'local-broadcast' && db) {
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) return null;
    room = { code, ...(snap.val() as Omit<RoomData, 'code'>) };
  } else {
    room = readLocalRoom(code);
  }

  if (!room) return null;

  const roundIndex = room.state.roundIndex;
  const existingResult = room.results?.[roundIndex];
  if (existingResult?.scored) {
    // Si ya se había calificado, solo aseguramos fase 'revealed'
    if (mode !== 'local-broadcast' && db) {
      await set(ref(db, `rooms/${code}/state`), {
        ...room.state,
        phase: 'revealed',
        revealedAt: Date.now(),
      });
    } else {
      room.state.phase = 'revealed';
      room.state.revealedAt = Date.now();
      writeLocalRoom(code, room);
    }
    return existingResult;
  }

  const caseId = room.config.sequence[roundIndex];
  const currentCase = allCases.find((c) => c.id === caseId);
  if (!currentCase) return null;

  const distribution: Partial<Record<ModelId, number>> = {};
  for (const opt of currentCase.options) {
    distribution[opt] = 0;
  }

  const roundAnswers = room.answers?.[roundIndex] ?? {};
  const players = room.players ?? {};
  const playerDeltas: RoundResult['playerDeltas'] = {};
  const multiPathUpdates: Record<string, unknown> = {};

  for (const [uid, ans] of Object.entries(roundAnswers)) {
    if (ans && ans.option) {
      distribution[ans.option] = (distribution[ans.option] ?? 0) + 1;
    }
  }

  // Calcular puntaje para todos los jugadores registrados
  for (const [uid, player] of Object.entries(players)) {
    const ans = roundAnswers[uid];
    const chosenOption = ans?.option ?? null;
    const isCorrect = chosenOption === currentCase.model;

    const scoreCalc = calculateRoundScore({
      isCorrect,
      openedAt: room.state.openedAt,
      deadline: room.state.deadline,
      answeredAt: ans?.at ?? room.state.deadline,
    });

    const newScore = (player.score ?? 0) + scoreCalc.totalPoints;
    const newStreak = isCorrect ? (player.streak ?? 0) + 1 : 0;

    playerDeltas[uid] = {
      pointsAdded: scoreCalc.totalPoints,
      newScore,
      newStreak,
      correct: isCorrect,
      option: chosenOption,
      responseTimeMs: ans ? Math.max(0, ans.at - room.state.openedAt) : null,
    };

    multiPathUpdates[`players/${uid}/score`] = newScore;
    multiPathUpdates[`players/${uid}/streak`] = newStreak;
  }

  const result: RoundResult = {
    distribution,
    playerDeltas,
    scored: true,
  };

  const nextState = {
    ...room.state,
    phase: 'revealed' as const,
    revealedAt: Date.now(),
  };

  if (mode !== 'local-broadcast' && db) {
    multiPathUpdates[`results/${roundIndex}`] = result;
    multiPathUpdates['state'] = nextState;
    await update(ref(db, `rooms/${code}`), multiPathUpdates);
  } else {
    for (const [uid, delta] of Object.entries(playerDeltas)) {
      if (room.players?.[uid]) {
        room.players[uid].score = delta.newScore;
        room.players[uid].streak = delta.newStreak;
      }
    }
    room.results = { ...(room.results ?? {}), [roundIndex]: result };
    room.state = nextState;
    writeLocalRoom(code, room);
  }

  return result;
}

export async function advanceToNextRoundOrFinal(
  rawCode: string,
  allCases: CaseItem[]
): Promise<void> {
  const code = normalizeRoomCode(rawCode);
  const { mode, db } = getFirebaseHandles();

  let room: RoomData | null = null;
  if (mode !== 'local-broadcast' && db) {
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) return;
    room = { code, ...(snap.val() as Omit<RoomData, 'code'>) };
  } else {
    room = readLocalRoom(code);
  }
  if (!room) return;

  const nextIndex = room.state.roundIndex + 1;
  if (nextIndex >= room.config.sequence.length) {
    const finalState = {
      ...room.state,
      phase: 'final' as const,
    };
    if (mode !== 'local-broadcast' && db) {
      await set(ref(db, `rooms/${code}/state`), finalState);
    } else {
      room.state = finalState;
      writeLocalRoom(code, room);
    }
    return;
  }

  const nextCaseId = room.config.sequence[nextIndex];
  const nextCase = allCases.find((c) => c.id === nextCaseId);
  const level = nextCase?.level ?? 1;
  const durationSeconds = room.config.durations[level] ?? 180;
  await openRound(code, nextIndex, durationSeconds);
}

export function subscribeToRoom(
  rawCode: string,
  callback: (room: RoomData | null) => void
): Unsubscribe {
  const code = normalizeRoomCode(rawCode);
  const { mode, db } = getFirebaseHandles();

  if (mode !== 'local-broadcast' && db) {
    const roomRef = ref(db, `rooms/${code}`);
    return onValue(roomRef, (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const val = snap.val();
      // Asegurar que cada player tenga su uid en el objeto
      const players: Record<string, PlayerRecord> = {};
      if (val.players) {
        for (const [pUid, pData] of Object.entries(val.players)) {
          players[pUid] = { ...(pData as PlayerRecord), uid: pUid };
        }
      }
      callback({
        code,
        ...val,
        players,
      });
    });
  }

  // Suscripción reactiva en modo local-broadcast (entre pestañas)
  const emitCurrent = () => {
    callback(readLocalRoom(code));
  };
  emitCurrent();

  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCAL_ROOM_PREFIX + code) {
      emitCurrent();
    }
  };
  const onCustom = (e: Event) => {
    const ce = e as CustomEvent;
    if (ce.detail?.roomCode === code) {
      emitCurrent();
    }
  };

  let bc: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = (ev) => {
      if (ev.data?.roomCode === code) {
        emitCurrent();
      }
    };
  }

  window.addEventListener('storage', onStorage);
  window.addEventListener('el-encargo-local-room', onCustom);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('el-encargo-local-room', onCustom);
    if (bc) bc.close();
  };
}
