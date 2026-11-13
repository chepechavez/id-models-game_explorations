import { beforeEach, describe, expect, it } from 'vitest';
import casesData from '../../content/cases.json';
import { CaseItem } from '../../src/types';
import { BASE_CORRECT_POINTS } from '../../src/game/scoring';
import {
  PRACTICE_STORAGE_KEY,
  buildRetrySequence,
  clearPracticeSession,
  computePracticeSummary,
  confirmAnswer,
  createPracticeSession,
  loadPracticeSession,
  nextCase,
  savePracticeSession,
  selectOption,
} from '../../src/game/practice';

const cases = casesData as unknown as CaseItem[];

describe('practice engine (sin temporizador)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('crea sesiones de 6, 12 y 18 casos con progresión de niveles 1 -> 2 -> 3 y filtro de modelos', () => {
    for (const count of [6, 12, 18] as const) {
      const session = createPracticeSession(cases, { roundCount: count }, 1000);
      expect(session.sequence).toHaveLength(count);
      expect(session.phase).toBe('open');
      expect(session.roundIndex).toBe(0);
      expect(session.selected).toBeNull();
      expect(session.score).toBe(0);

      const mapped = session.sequence.map((id) => cases.find((c) => c.id === id)!);
      for (let i = 1; i < mapped.length; i++) {
        expect(mapped[i].level).toBeGreaterThanOrEqual(mapped[i - 1].level);
      }
    }

    const filtered = createPracticeSession(
      cases,
      { roundCount: 6, selectedModels: ['action-mapping', 'addie'] },
      1000
    );
    expect(filtered.sequence).toHaveLength(6);
    for (const id of filtered.sequence) {
      const item = cases.find((c) => c.id === id)!;
      expect(['action-mapping', 'addie']).toContain(item.model);
    }
  });

  it('permite seleccionar/cambiar opción solo en fase open e ignora cambios en revealed', () => {
    let session = createPracticeSession(cases, { roundCount: 6 }, 1000, ['am-1', 'ubd-1']);
    const firstCase = cases.find((c) => c.id === 'am-1')!;
    const wrongOption = firstCase.options.find((o) => o !== firstCase.model)!;

    // No confirma si no hay selección
    expect(confirmAnswer(session, cases).phase).toBe('open');

    session = selectOption(session, wrongOption);
    expect(session.selected).toBe(wrongOption);

    session = selectOption(session, firstCase.model);
    expect(session.selected).toBe(firstCase.model);

    session = confirmAnswer(session, cases);
    expect(session.phase).toBe('revealed');

    // En revealed no cambia la selección
    const afterAttempt = selectOption(session, wrongOption);
    expect(afterAttempt.selected).toBe(firstCase.model);
  });

  it('otorga 600 pts fijos por acierto, 0 por fallo y actualiza racha y bestStreak (A, A, E, A)', () => {
    const seq = ['am-1', '4cid-1', 'addie-1', 'dc-1'];
    let session = createPracticeSession(cases, { roundCount: 6 }, 1000, seq);

    const answerStep = (caseId: string, correctChoice: boolean) => {
      const item = cases.find((c) => c.id === caseId)!;
      const opt = correctChoice
        ? item.model
        : item.options.find((o) => o !== item.model)!;
      session = selectOption(session, opt);
      session = confirmAnswer(session, cases);
    };

    // Caso 1: Acierto
    answerStep(seq[0], true);
    expect(session.score).toBe(BASE_CORRECT_POINTS);
    expect(session.streak).toBe(1);
    expect(session.bestStreak).toBe(1);
    session = nextCase(session);

    // Caso 2: Acierto
    answerStep(seq[1], true);
    expect(session.score).toBe(BASE_CORRECT_POINTS * 2);
    expect(session.streak).toBe(2);
    expect(session.bestStreak).toBe(2);
    session = nextCase(session);

    // Caso 3: Error -> racha vuelve a 0, bestStreak sigue en 2
    answerStep(seq[2], false);
    expect(session.score).toBe(BASE_CORRECT_POINTS * 2);
    expect(session.streak).toBe(0);
    expect(session.bestStreak).toBe(2);
    session = nextCase(session);

    // Caso 4: Acierto -> racha 1, bestStreak 2, pasa a final al avanzar
    answerStep(seq[3], true);
    expect(session.score).toBe(BASE_CORRECT_POINTS * 3);
    expect(session.streak).toBe(1);
    expect(session.bestStreak).toBe(2);

    session = nextCase(session);
    expect(session.phase).toBe('final');
  });

  it('nextCase no avanza si está en open y al terminar el último caso entra en final', () => {
    let session = createPracticeSession(cases, { roundCount: 6 }, 1000, ['am-1', 'am-2']);
    expect(nextCase(session)).toBe(session);

    session = selectOption(session, 'action-mapping');
    session = confirmAnswer(session, cases);
    session = nextCase(session);

    expect(session.phase).toBe('open');
    expect(session.roundIndex).toBe(1);
    expect(session.selected).toBeNull();

    session = selectOption(session, 'action-mapping');
    session = confirmAnswer(session, cases);
    session = nextCase(session);

    expect(session.phase).toBe('final');
  });

  it('calcula el resumen personal, precisión por modelo y trampa más frecuente', () => {
    // am-1 (N1), am-2 (N2), am-3 (N3), ubd-1 (N1)
    const seq = ['am-1', 'am-2', 'am-3', 'ubd-1'];
    let session = createPracticeSession(cases, { roundCount: 6 }, 1000, seq);

    // am-1: acierto
    session = selectOption(session, 'action-mapping');
    session = confirmAnswer(session, cases);
    session = nextCase(session);

    // am-2: fallo con pebble-in-the-pond
    session = selectOption(session, 'pebble-in-the-pond');
    session = confirmAnswer(session, cases);
    session = nextCase(session);

    // am-3: fallo con pebble-in-the-pond
    session = selectOption(session, 'pebble-in-the-pond');
    session = confirmAnswer(session, cases);
    session = nextCase(session);

    // ubd-1: acierto
    session = selectOption(session, 'backward-design');
    session = confirmAnswer(session, cases);
    session = nextCase(session);

    const summary = computePracticeSummary(session, cases);
    expect(summary.total).toBe(4);
    expect(summary.correctCount).toBe(2);
    expect(summary.score).toBe(BASE_CORRECT_POINTS * 2);
    expect(summary.bestStreak).toBe(1);
    expect(summary.failedCaseIds).toEqual(['am-2', 'am-3']);

    // byModel solo incluye modelos jugados (action-mapping y backward-design)
    expect(summary.byModel.map((m) => m.modelId)).toEqual([
      'action-mapping',
      'backward-design',
    ]);

    const amStats = summary.byModel.find((m) => m.modelId === 'action-mapping')!;
    expect(amStats.rounds).toBe(3);
    expect(amStats.correct).toBe(1);
    expect(amStats.accuracyPct).toBe(33);
    expect(amStats.mostFrequentTrap).toBe('pebble-in-the-pond');

    const ubdStats = summary.byModel.find((m) => m.modelId === 'backward-design')!;
    expect(ubdStats.rounds).toBe(1);
    expect(ubdStats.correct).toBe(1);
    expect(ubdStats.accuracyPct).toBe(100);
    expect(ubdStats.mostFrequentTrap).toBeNull();
  });

  it('buildRetrySequence devuelve fallados únicos ordenados por nivel y createPracticeSession respeta override', () => {
    // Orden intencionalmente desordenado de niveles: N3, N1, N2, N3 duplicado
    const seq = ['am-3', 'ubd-1', 'addie-2', 'am-3'];
    let session = createPracticeSession(cases, { roundCount: 6 }, 1000, seq);

    // Fallar am-3 (N3)
    session = selectOption(session, 'dick-carey');
    session = confirmAnswer(session, cases);
    session = nextCase(session);

    // Acertar ubd-1 (N1)
    session = selectOption(session, 'backward-design');
    session = confirmAnswer(session, cases);
    session = nextCase(session);

    // Fallar addie-2 (N2)
    session = selectOption(session, '4c-id');
    session = confirmAnswer(session, cases);
    session = nextCase(session);

    // Fallar am-3 otra vez (duplicado)
    session = selectOption(session, '4c-id');
    session = confirmAnswer(session, cases);
    session = nextCase(session);

    const retrySeq = buildRetrySequence(session, cases);
    // addie-2 es N2, am-3 es N3 -> debe venir primero N2 y luego N3, sin duplicados
    expect(retrySeq).toEqual(['addie-2', 'am-3']);

    const retrySession = createPracticeSession(cases, session.config, 2000, retrySeq);
    expect(retrySession.sequence).toEqual(['addie-2', 'am-3']);
    expect(retrySession.score).toBe(0);
    expect(retrySession.roundIndex).toBe(0);
    expect(retrySession.phase).toBe('open');
  });

  it('guarda, carga, limpia y descarta estado corrupto o incompatible en localStorage', () => {
    let session = createPracticeSession(cases, { roundCount: 6 }, 1234, ['am-1', 'ubd-1']);
    session = selectOption(session, 'action-mapping');
    session = confirmAnswer(session, cases);

    savePracticeSession(session);
    const loaded = loadPracticeSession(cases);
    expect(loaded).toEqual(session);

    clearPracticeSession();
    expect(loadPracticeSession(cases)).toBeNull();

    // JSON corrupto
    window.localStorage.setItem(PRACTICE_STORAGE_KEY, '{not-valid-json');
    expect(loadPracticeSession(cases)).toBeNull();

    // Versión distinta
    window.localStorage.setItem(
      PRACTICE_STORAGE_KEY,
      JSON.stringify({ ...session, version: 99 })
    );
    expect(loadPracticeSession(cases)).toBeNull();

    // ID de caso inexistente
    window.localStorage.setItem(
      PRACTICE_STORAGE_KEY,
      JSON.stringify({ ...session, sequence: ['no-existe-1'] })
    );
    expect(loadPracticeSession(cases)).toBeNull();

    // roundIndex fuera de rango
    window.localStorage.setItem(
      PRACTICE_STORAGE_KEY,
      JSON.stringify({ ...session, roundIndex: 5 })
    );
    expect(loadPracticeSession(cases)).toBeNull();

    // Fase revealed sin respuesta correspondiente
    window.localStorage.setItem(
      PRACTICE_STORAGE_KEY,
      JSON.stringify({ ...session, phase: 'revealed', answers: [] })
    );
    expect(loadPracticeSession(cases)).toBeNull();
  });
});
