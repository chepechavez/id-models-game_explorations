import { CaseItem, ModelId, SessionRoundCount } from '../types';

const ALL_MODELS: ModelId[] = [
  'action-mapping',
  'backward-design',
  'dick-carey',
  '4c-id',
  'pebble-in-the-pond',
  'addie',
];

/**
 * Ordena una lista de casos para evitar que dos rondas consecutivas tengan el mismo modelo correcto,
 * respetando siempre el ascenso de nivel (Nivel 1: 3 opciones -> Nivel 2: 4 opciones -> Nivel 3: 5 opciones).
 */
function avoidAdjacentModels(cases: CaseItem[], previousModel?: ModelId): CaseItem[] {
  const remaining = [...cases];
  const result: CaseItem[] = [];
  let lastModel = previousModel;

  while (remaining.length > 0) {
    let idx = remaining.findIndex((c) => c.model !== lastModel);
    if (idx === -1) idx = 0;
    const picked = remaining.splice(idx, 1)[0];
    result.push(picked);
    lastModel = picked.model;
  }

  return result;
}

/**
 * Construye una secuencia balanceada de 6, 12 o 18 rondas:
 * - 6 rondas: 1 caso por modelo (2 básicos, 2 intermedios, 2 avanzados)
 * - 12 rondas: 2 casos por modelo (6 básicos + 3 intermedios + 3 avanzados complementarios)
 * - 18 rondas: 3 casos por modelo (6 básicos + 6 intermedios + 6 avanzados)
 */
export function buildSessionSequence(allCases: CaseItem[], roundCount: SessionRoundCount): string[] {
  const byModelAndLevel = new Map<string, CaseItem>();
  for (const c of allCases) {
    byModelAndLevel.set(`${c.model}:${c.level}`, c);
  }

  const getCase = (model: ModelId, level: 1 | 2 | 3): CaseItem => {
    const found = byModelAndLevel.get(`${model}:${level}`);
    if (!found) {
      throw new Error(`Falta caso para modelo ${model} en nivel ${level}`);
    }
    return found;
  };

  if (roundCount === 6) {
    const l1 = [getCase('action-mapping', 1), getCase('backward-design', 1)];
    const l2 = [getCase('pebble-in-the-pond', 2), getCase('addie', 2)];
    const l3 = [getCase('dick-carey', 3), getCase('4c-id', 3)];
    return [...l1, ...l2, ...l3].map((c) => c.id);
  }

  if (roundCount === 12) {
    const l1 = avoidAdjacentModels(ALL_MODELS.map((m) => getCase(m, 1)));
    const l2Models: ModelId[] = ['action-mapping', 'pebble-in-the-pond', 'addie'];
    const l3Models: ModelId[] = ['backward-design', 'dick-carey', '4c-id'];

    const l2 = avoidAdjacentModels(
      l2Models.map((m) => getCase(m, 2)),
      l1[l1.length - 1]?.model
    );
    const l3 = avoidAdjacentModels(
      l3Models.map((m) => getCase(m, 3)),
      l2[l2.length - 1]?.model
    );

    return [...l1, ...l2, ...l3].map((c) => c.id);
  }

  // 18 rondas (todos los casos)
  const l1 = avoidAdjacentModels(ALL_MODELS.map((m) => getCase(m, 1)));
  const l2 = avoidAdjacentModels(
    ALL_MODELS.map((m) => getCase(m, 2)),
    l1[l1.length - 1]?.model
  );
  const l3 = avoidAdjacentModels(
    ALL_MODELS.map((m) => getCase(m, 3)),
    l2[l2.length - 1]?.model
  );

  return [...l1, ...l2, ...l3].map((c) => c.id);
}
