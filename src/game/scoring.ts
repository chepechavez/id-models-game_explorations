/**
 * Puntaje mixto acordado para «El Encargo»:
 * - Acierto base: 600 puntos fijos (premia el razonamiento clínico y la consulta del Vademécum).
 * - Bono de rapidez: hasta 400 puntos que decrecen linealmente entre la apertura de la ronda y el deadline.
 * - La hora que cuenta es la de la ÚLTIMA respuesta antes del cierre.
 */
export const BASE_CORRECT_POINTS = 600;
export const MAX_SPEED_BONUS = 400;

export interface ScoreCalculationInput {
  isCorrect: boolean;
  openedAt: number;
  deadline: number;
  answeredAt: number;
}

export interface ScoreCalculationResult {
  totalPoints: number;
  basePoints: number;
  speedBonus: number;
  elapsedRatio: number;
}

export function calculateRoundScore(input: ScoreCalculationInput): ScoreCalculationResult {
  if (!input.isCorrect) {
    return {
      totalPoints: 0,
      basePoints: 0,
      speedBonus: 0,
      elapsedRatio: 1,
    };
  }

  const totalDuration = Math.max(1000, input.deadline - input.openedAt);
  const elapsed = Math.max(0, input.answeredAt - input.openedAt);
  const clampedRatio = Math.min(1, Math.max(0, elapsed / totalDuration));

  const speedBonus = Math.floor(MAX_SPEED_BONUS * (1 - clampedRatio));
  const totalPoints = BASE_CORRECT_POINTS + speedBonus;

  return {
    totalPoints,
    basePoints: BASE_CORRECT_POINTS,
    speedBonus,
    elapsedRatio: clampedRatio,
  };
}
