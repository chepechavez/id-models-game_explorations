import { CaseItem, ModelId, SessionRoundCount } from '../types';

export const ALL_MODELS: ModelId[] = [
  'action-mapping',
  'backward-design',
  'dick-carey',
  '4c-id',
  'pebble-in-the-pond',
  'addie',
];

/**
 * Baraja aleatoriamente un arreglo (Fisher-Yates shuffle).
 */
export function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Construye una secuencia balanceada y aleatorizada de 6, 12 o 18 rondas:
 * - Respeta la progresión pedagógica ascendente:
 *   Nivel 1 (2 opciones) -> Nivel 2 (3 opciones) -> Nivel 3 (4 opciones).
 * - Permite repetir modelos entre rondas consecutivas según preferencia del docente.
 * - Si se especifican selectedModels, solo se incluyen casos pertenecientes a dichos modelos.
 */
export function buildSessionSequence(
  allCases: CaseItem[],
  roundCount: SessionRoundCount,
  selectedModels?: ModelId[]
): string[] {
  const activeModelSet = new Set<ModelId>(
    selectedModels && selectedModels.length >= 2 ? selectedModels : ALL_MODELS
  );

  const eligibleCases = allCases.filter((c) => activeModelSet.has(c.model));

  const l1Cases = shuffleArray(eligibleCases.filter((c) => c.level === 1));
  const l2Cases = shuffleArray(eligibleCases.filter((c) => c.level === 2));
  const l3Cases = shuffleArray(eligibleCases.filter((c) => c.level === 3));

  // Determinar cuántos casos corresponden a cada nivel
  let countL1 = Math.floor(roundCount / 3);
  let countL2 = Math.floor(roundCount / 3);
  let countL3 = roundCount - countL1 - countL2;

  // Función para tomar N casos (repitiendo si el banco filtrado es menor a N)
  const pickFromPool = (pool: CaseItem[], count: number): CaseItem[] => {
    if (pool.length === 0) return [];
    const result: CaseItem[] = [];
    let currentShuffled = [...pool];
    while (result.length < count) {
      if (currentShuffled.length === 0) {
        currentShuffled = shuffleArray(pool);
      }
      result.push(currentShuffled.pop()!);
    }
    return result;
  };

  const selectedL1 = pickFromPool(l1Cases, countL1);
  const selectedL2 = pickFromPool(l2Cases, countL2);
  const selectedL3 = pickFromPool(l3Cases, countL3);

  const sequence = [...selectedL1, ...selectedL2, ...selectedL3];
  return sequence.map((c) => c.id);
}
