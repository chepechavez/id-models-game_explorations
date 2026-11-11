import { describe, expect, it } from 'vitest';
import { calculateRoundScore, BASE_CORRECT_POINTS, MAX_SPEED_BONUS } from '../../src/game/scoring';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../src/game/roomCode';
import { buildSessionSequence } from '../../src/game/sequences';
import casesData from '../../content/cases.json';
import { CaseItem } from '../../src/types';

describe('calculateRoundScore (puntaje mixto)', () => {
  it('devuelve 0 puntos si la respuesta es incorrecta sin importar la rapidez', () => {
    const res = calculateRoundScore({
      isCorrect: false,
      openedAt: 1000,
      deadline: 181000,
      answeredAt: 1500,
    });
    expect(res.totalPoints).toBe(0);
    expect(res.basePoints).toBe(0);
    expect(res.speedBonus).toBe(0);
  });

  it('otorga el puntaje máximo (1000 = 600 base + 400 rapidez) si responde en el instante de apertura', () => {
    const res = calculateRoundScore({
      isCorrect: true,
      openedAt: 1000,
      deadline: 181000,
      answeredAt: 1000,
    });
    expect(res.basePoints).toBe(BASE_CORRECT_POINTS);
    expect(res.speedBonus).toBe(MAX_SPEED_BONUS);
    expect(res.totalPoints).toBe(1000);
  });

  it('otorga la mitad del bono de rapidez (600 + 200 = 800) si responde a mitad del tiempo', () => {
    const res = calculateRoundScore({
      isCorrect: true,
      openedAt: 0,
      deadline: 100000,
      answeredAt: 50000,
    });
    expect(res.totalPoints).toBe(800);
    expect(res.speedBonus).toBe(200);
  });

  it('garantiza los 600 puntos base incluso si cambia su respuesta en el último segundo', () => {
    const res = calculateRoundScore({
      isCorrect: true,
      openedAt: 0,
      deadline: 180000,
      answeredAt: 180000,
    });
    expect(res.totalPoints).toBe(600);
    expect(res.speedBonus).toBe(0);
  });
});

describe('roomCode utilities', () => {
  it('genera códigos de 5 caracteres sin letras ambiguas (O, 0, I, 1, L)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode(5);
      expect(code).toHaveLength(5);
      expect(code).not.toMatch(/[O0I1L]/);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it('normaliza espacios y minúsculas correctamente', () => {
    expect(normalizeRoomCode('  k7m-4x ')).toBe('K7M4X');
  });
});

describe('buildSessionSequence (6, 12 y 18 rondas)', () => {
  const cases = casesData as unknown as CaseItem[];

  it('arma secuencias válidas de 6, 12 y 18 rondas sin modelos consecutivos repetidos', () => {
    for (const count of [6, 12, 18] as const) {
      const seq = buildSessionSequence(cases, count);
      expect(seq).toHaveLength(count);
      const mapped = seq.map((id) => cases.find((c) => c.id === id)!);

      for (let i = 1; i < mapped.length; i++) {
        expect(mapped[i].model).not.toBe(mapped[i - 1].model);
        expect(mapped[i].level).toBeGreaterThanOrEqual(mapped[i - 1].level);
      }
    }
  });
});
