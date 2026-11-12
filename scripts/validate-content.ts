import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CaseItem, ModelGuideItem, ModelId } from '../src/types';
import { buildSessionSequence } from '../src/game/sequences';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const MODELS_PATH = path.join(ROOT, 'content', 'models.json');
const CASES_PATH = path.join(ROOT, 'content', 'cases.json');

const EXPECTED_MODELS: ModelId[] = [
  'action-mapping',
  '4c-id',
  'addie',
  'dick-carey',
  'pebble-in-the-pond',
  'backward-design',
];

// Frases literales de la matriz o nombres de modelos que delatarían la respuesta por Ctrl+F en el brief
const FORBIDDEN_BRIEF_PHRASES = [
  'action mapping',
  'cathy moore',
  '4c-id',
  '4c/id',
  'merriënboer',
  'merrienboer',
  'addie',
  'dick & carey',
  'dick and carey',
  'pebble in the pond',
  'david merrill',
  'backward design',
  'wiggins',
  'mctighe',
  'ubd',
  'understanding by design',
  'grasps',
  'whereto',
  'mastery learning',
  'tema por tema',
  'alineación constructiva',
  'carga cognitiva',
  'carga germana',
  'vertedero de información',
  'vertederos de información',
  'info-dump',
  'ondas concéntricas',
  'piedra en el estanque',
  'blueprint 4c',
  'mapa de acción',
];

function fail(errors: string[]): never {
  console.error('\n❌ Falló la validación del banco de contenidos:\n');
  for (const err of errors) {
    console.error(`  • ${err}`);
  }
  process.exit(1);
}

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(MODELS_PATH)) {
    fail([`No existe ${MODELS_PATH}`]);
  }
  if (!fs.existsSync(CASES_PATH)) {
    fail([`No existe ${CASES_PATH}`]);
  }

  const models: ModelGuideItem[] = JSON.parse(fs.readFileSync(MODELS_PATH, 'utf8'));
  const cases: CaseItem[] = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));

  // 1. Validar los 6 modelos
  const modelIds = new Set(models.map((m) => m.id));
  for (const expectedId of EXPECTED_MODELS) {
    if (!modelIds.has(expectedId)) {
      errors.push(`Falta el modelo '${expectedId}' en content/models.json`);
    }
  }

  for (const m of models) {
    if (!m.sources || m.sources.length === 0) {
      errors.push(`El modelo '${m.id}' no incluye fuentes primarias en 'sources'.`);
    }
    if (!m.useWhen || m.useWhen.length < 2) {
      errors.push(`El modelo '${m.id}' debe tener al menos 2 criterios en 'useWhen'.`);
    }
    if (!m.avoidWhen || m.avoidWhen.length < 2) {
      errors.push(`El modelo '${m.id}' debe tener al menos 2 contraindicaciones en 'avoidWhen'.`);
    }
  }

  // 2. Validar cobertura 3 casos x 6 modelos = 18 casos
  if (cases.length !== 18) {
    errors.push(`Se esperaban exactamente 18 casos y se encontraron ${cases.length}.`);
  }

  const seenIds = new Set<string>();
  for (const modelId of EXPECTED_MODELS) {
    const modelCases = cases.filter((c) => c.model === modelId);
    if (modelCases.length !== 3) {
      errors.push(`El modelo '${modelId}' tiene ${modelCases.length} casos (debe tener exactamente 3).`);
    }
    for (const lvl of [1, 2, 3] as const) {
      const hasLevel = modelCases.some((c) => c.level === lvl);
      if (!hasLevel) {
        errors.push(`El modelo '${modelId}' no tiene caso de nivel ${lvl}.`);
      }
    }
  }

  // 3. Validar cada caso individualmente
  for (const c of cases) {
    if (seenIds.has(c.id)) {
      errors.push(`ID de caso duplicado: '${c.id}'`);
    }
    seenIds.add(c.id);

    const expectedOptionsCount = c.level + 1;
    if (c.options.length !== expectedOptionsCount) {
      errors.push(
        `Caso '${c.id}' (nivel ${c.level}): tiene ${c.options.length} opciones, pero debe tener exactamente ${expectedOptionsCount}.`
      );
    }

    const uniqueOptions = new Set(c.options);
    if (uniqueOptions.size !== c.options.length) {
      errors.push(`Caso '${c.id}': contiene opciones duplicadas.`);
    }

    if (!c.options.includes(c.model)) {
      errors.push(`Caso '${c.id}': la respuesta correcta '${c.model}' no figura en 'options'.`);
    }

    // Revisar feedback para cada opción
    let correctCount = 0;
    let trapCount = 0;
    for (const opt of c.options) {
      const fb = c.feedback[opt];
      if (!fb) {
        errors.push(`Caso '${c.id}': falta el bloque de feedback para la opción '${opt}'.`);
        continue;
      }
      if (!fb.text || fb.text.trim().length < 40) {
        errors.push(`Caso '${c.id}': el feedback para '${opt}' es demasiado corto.`);
      }
      if (!fb.source || fb.source.trim().length < 5) {
        errors.push(`Caso '${c.id}': el feedback para '${opt}' no incluye referencia bibliográfica ('source').`);
      }
      if (opt === c.model && fb.verdict !== 'correct') {
        errors.push(`Caso '${c.id}': la opción correcta '${opt}' debe tener verdict='correct'.`);
      }
      if (opt !== c.model && fb.verdict === 'correct') {
        errors.push(`Caso '${c.id}': el distractor '${opt}' tiene verdict='correct'.`);
      }
      if (fb.verdict === 'correct') correctCount++;
      if (fb.verdict === 'trap') trapCount++;
    }

    if (correctCount !== 1) {
      errors.push(`Caso '${c.id}': debe haber exactamente 1 opción con verdict='correct'.`);
    }
    if (trapCount < 1) {
      errors.push(`Caso '${c.id}': debe marcar al menos 1 distractor como trampa ('trap').`);
    }

    // Revisar que el brief y las restricciones estén redactados como síntomas y sin palabras prohibidas
    const textToScan = [c.title, c.brief, ...c.constraints, c.successMetric].join(' ').toLowerCase();
    for (const phrase of FORBIDDEN_BRIEF_PHRASES) {
      if (textToScan.includes(phrase)) {
        errors.push(
          `Caso '${c.id}': el enunciado contiene el tecnicismo o pista directa prohibida "${phrase}". Redáctalo en lenguaje de síntomas.`
        );
      }
    }

    // Estado de validación con fuentes primarias / cuaderno
    if (!c.validation || !c.validation.notebookRef || !c.validation.verifiedQuote) {
      errors.push(`Caso '${c.id}': falta cita verificada ('verifiedQuote') o referencia ('notebookRef').`);
    }
    if (c.validation?.status === 'draft') {
      warnings.push(`Caso '${c.id}' sigue en estado 'draft'.`);
    }
  }

  // 4. Validar secuencias de 6, 12 y 18 rondas
  for (const count of [6, 12, 18] as const) {
    try {
      const seq = buildSessionSequence(cases, count);
      if (seq.length !== count) {
        errors.push(`La secuencia de ${count} rondas devolvió ${seq.length} casos.`);
      }
      const seqCases = seq.map((id) => cases.find((c) => c.id === id)!);
      for (let i = 1; i < seqCases.length; i++) {
        if (seqCases[i].level < seqCases[i - 1].level) {
          errors.push(`La secuencia de ${count} rondas retrocede de nivel en la ronda ${i + 1}.`);
        }
      }
    } catch (e: any) {
      errors.push(`Error generando secuencia de ${count} rondas: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    fail(errors);
  }

  console.log(`✅ Validación exitosa: ${models.length} modelos y ${cases.length} casos verificados.`);
  console.log(`   • Cobertura: 3 casos por modelo (Niveles 1, 2 y 3 completos).`);
  console.log(`   • Filtro anti-Ctrl+F: 0 tecnicismos delatores en los briefs.`);
  console.log(`   • Secuencias de 6, 12 y 18 rondas verificadas con progresión ascendente de niveles (N1: 2, N2: 3, N3: 4 opciones).`);
  if (warnings.length > 0) {
    console.warn(`⚠️  Advertencias (${warnings.length}):`);
    for (const w of warnings) console.warn(`   - ${w}`);
  } else {
    console.log(`   • Todos los 18 casos cuentan con cita verificada de las fuentes primarias de los autores.`);
  }
}

main();
