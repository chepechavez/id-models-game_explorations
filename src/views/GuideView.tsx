import React, { useRef, useState } from 'react';
import { ModelGuideItem, ModelId } from '../types';

interface GuideViewProps {
  models: ModelGuideItem[];
  highlightedOptions?: ModelId[];
  compact?: boolean;
}

type GuideDisplayMode = 'cards' | 'matrix';

const NOTEBOOK_URL = 'https://notebook.google.com/notebook/e7877e8f-0636-4582-ad53-53fd68587b5e';

const MATRIX_CRITERIA = [
  { key: 'essence', label: 'Esencia' },
  { key: 'metaphor', label: 'Metáfora' },
  { key: 'phases', label: 'Fases / Componentes' },
  { key: 'mindset', label: 'Mentalidad del ID' },
  { key: 'useWhen', label: 'Úsalo cuando (Indicaciones)' },
  { key: 'avoidWhen', label: 'Evítalo cuando (Contraindicaciones)' },
  { key: 'contextFit', label: 'Pertinencia de contexto' },
  { key: 'outputArtifact', label: 'Artefacto de salida' },
] as const;

/**
 * Síntesis rigurosa contrastada con las fuentes primarias (Moore, van Merriënboer & Kirschner,
 * Branch, Dick & Carey, Merrill, Wiggins & McTighe) para agilizar la lectura clínica durante la partida.
 */
const SYNTHESIZED_MATRIX: Record<
  ModelId,
  {
    essence: string;
    metaphor: string;
    phases: string[];
    mindset: string;
    useWhen: string[];
    avoidWhen: string[];
    contextFit: string;
    outputArtifact: string;
  }
> = {
  'action-mapping': {
    essence: 'Mover un indicador de negocio diseñando solo práctica de decisiones en el puesto y ayudas de trabajo (job aids). Frena cursos teóricos innecesarios (Moore, 2017).',
    metaphor: 'Simulador de decisiones y escudo visual contra los vertederos de información.',
    phases: [
      '1. Meta de negocio medible',
      '2. Acciones y obstáculos (job aids)',
      '3. Práctica de decisiones realistas',
      '4. Información mínima indispensable',
    ],
    mindset: 'Consultor de rendimiento: ¿Se resuelve con formación o con un proceso/job aid?',
    useWhen: [
      'Métrica operativa o de negocio que debe cambiar en semanas.',
      'Decisiones observables en el puesto con tiempo limitado.',
      'El cliente pide un curso teórico pero se requiere práctica.',
    ],
    avoidWhen: [
      'Asignaturas académicas teóricas o de reflexión humanística.',
      'Formación de meses sin métricas operativas directas.',
    ],
    contextFit: 'Corporativo: Muy alto | Académico: Bajo',
    outputArtifact: 'Action Map + Prototipo de Escenario + Project Outline (4 págs.)',
  },
  '4c-id': {
    essence: 'Integrar habilidades complejas en tareas completas del mundo real (de simples a complejas) con andamiaje decreciente y control de carga cognitiva (van Merriënboer, 2024).',
    metaphor: 'Aprender a conducir o volar: enfrentas la tarea real completa desde el día uno.',
    phases: [
      '1. Tareas de aprendizaje auténticas',
      '2. Información de apoyo (previa a la tarea)',
      '3. Información procedimental (JIT, paso a paso)',
      '4. Práctica intensiva de partes críticas',
    ],
    mindset: 'Arquitecto cognitivo: erradica la fragmentación y combate la sobrecarga mental.',
    useWhen: [
      'Competencias profesionales complejas de larga duración (≥ 100 horas).',
      'Coordinación de juicio y destreza bajo incertidumbre y presión.',
      'Medicina, aviación, ciberseguridad o ingeniería de sistemas.',
    ],
    avoidWhen: [
      'Programas breves (< 100 horas) o talleres de pocos días.',
      'Procedimientos lineales simples sin juicio abierto.',
    ],
    contextFit: 'Académico (superior/técnico): Muy alto | Corporativo (complejo): Muy alto',
    outputArtifact: 'Blueprint 4C-ID (Matriz de clases de tareas, SAPs, JIT y práctica de partes)',
  },
  addie: {
    essence: 'Marco contenedor de gobernanza y ciclo de vida iterativo (Análisis, Diseño, Desarrollo, Implementación, Evaluación) para coordinar proyectos y proveedores (Branch, 2009).',
    metaphor: 'Mapa de navegación y gobernanza de una obra de ingeniería.',
    phases: [
      'Análisis (necesidades y contexto)',
      'Diseño (objetivos y estrategias)',
      'Desarrollo (producción de medios)',
      'Implementación (puesta en marcha)',
      'Evaluación (formativa continua y sumativa)',
    ],
    mindset: 'Director de orquesta/gestor: asegura hitos, calidad y coordinación multiproveedor.',
    useWhen: [
      'Gestión institucional, licitaciones y compras públicas.',
      'Equipos multidisciplinarios grandes con múltiples proveedores.',
      'Marco paraguas para gobernar el ciclo de vida del proyecto.',
    ],
    avoidWhen: [
      'Como motor pedagógico: por sí solo no prescribe cómo diseñar la práctica ni la carga cognitiva.',
    ],
    contextFit: 'Institucional / Gobernanza: Muy alto (Marco de gestión transversal)',
    outputArtifact: 'Plan de Proyecto ID + Matriz de Diseño Instruccional + Informe de Evaluación',
  },
  'dick-carey': {
    essence: 'Diseño sistemático basado en análisis jerárquico estricto de prerrequisitos, condiciones de aprendizaje y pruebas con referencia a criterio (Dick, Carey & Carey, 2015).',
    metaphor: 'Ingeniería de sistemas: diagrama de flujo riguroso donde cada engranaje depende del anterior.',
    phases: [
      '1. Meta instruccional y análisis de tareas',
      '2. Identificación de prerrequisitos y conductas de entrada',
      '3. Objetivos de ejecución y criterios de evaluación',
      '4. Instrumentos de evaluación referidos a criterio',
      '5. Desarrollo de estrategia, materiales y evaluación formativa',
    ],
    mindset: 'Ingeniero instruccional: precisión conductual y alineación estricta de objetivos y pruebas.',
    useWhen: [
      'Tareas algorítmicas con jerarquía estricta de prerrequisitos.',
      'Certificación de dominio técnico/normativo crítico.',
      'Estabilidad curricular y procesos repetibles a largo plazo.',
    ],
    avoidWhen: [
      'Entornos ágiles con plazos cortos que impiden el análisis jerárquico.',
      'Problemas abiertos sin una solución unívoca ni algorítmica.',
    ],
    contextFit: 'Técnico / Militar / Industrial: Muy alto | Académico: Alto',
    outputArtifact: 'Diagrama de Análisis Jerárquico + Tabla de Especificaciones y Pruebas',
  },
  'pebble-in-the-pond': {
    essence: 'Secuencia de problemas auténticos escalonados (de lo simple a lo complejo) anclados en los 5 Primeros Principios de Merrill (Merrill, 2013).',
    metaphor: 'Piedra en el estanque: el problema real es el centro del que emanan ondas de instrucción.',
    phases: [
      '1. Problema entero representativo (Pebble)',
      '2. Progresión escalonada de problemas (Pebbles)',
      '3. Análisis de componentes requeridos para cada problema',
      '4. Estrategia didáctica (Activación, Demostración, Aplicación, Integración)',
      '5. Interfaz de aprendizaje y recursos',
    ],
    mindset: 'Entrenador centrado en problemas: enseña resolviendo casos reales, no con teoría abstracta.',
    useWhen: [
      'Cursos completos centrados en problemas de 4 a 20 horas.',
      'Desmontar cursos abstractos dictados "tema por tema".',
      'Progresión escalonada de casos reales con retroalimentación.',
    ],
    avoidWhen: [
      'Problemas no instruccionales (requieren job aids o cambio de procesos).',
      'Programas de años con jerarquías cognitivas masivas (usar 4C-ID).',
    ],
    contextFit: 'Educación superior y corporativa: Muy alto (cursos completos)',
    outputArtifact: 'Matriz de Problemas Escalonados + Tablero de Componentes de Instrucción',
  },
  'backward-design': {
    essence: 'Diseño curricular inverso centrado en comprensión profunda y grandes ideas (1. Resultados deseados → 2. Evidencias de evaluación → 3. Plan WHERETO) (Wiggins & McTighe, 2012).',
    metaphor: 'Itinerario de viaje o juicio legal: fijas el destino y las pruebas antes de armar las maletas.',
    phases: [
      'Etapa 1: Identificar los resultados deseados (grandes ideas y preguntas esenciales)',
      'Etapa 2: Determinar las evidencias aceptables (tareas auténticas de transferencia)',
      'Etapa 3: Planificar las experiencias de aprendizaje y enseñanza (WHERETO)',
    ],
    mindset: 'Curador curricular: diseña con el fin en mente para transferir comprensión duradera.',
    useWhen: [
      'Currículos escolares o universitarios por semestres o asignaturas.',
      'Grandes ideas y preguntas esenciales de reflexión conceptual.',
      'Combatir la cobertura superficial de contenidos sin transferencia.',
    ],
    avoidWhen: [
      'Ajustes tácticos de conducta laboral en semanas.',
      'Tareas rutinarias basadas en métricas financieras inmediatas.',
    ],
    contextFit: 'Escolar / Universitario: Muy alto | Corporativo táctico: Bajo',
    outputArtifact: 'Plantilla UbD de 3 Etapas (Resultados, Evidencias, Plan WHERETO)',
  },
};

export const GuideView: React.FC<GuideViewProps> = ({
  models,
  highlightedOptions,
  compact = false,
}) => {
  const [displayMode, setDisplayMode] = useState<GuideDisplayMode>('cards');
  const [useSynthesizedMatrix, setUseSynthesizedMatrix] = useState<boolean>(true);
  const [filterOnlyRoundOptions, setFilterOnlyRoundOptions] = useState<boolean>(false);
  const [selectedModelId, setSelectedModelId] = useState<ModelId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const scrollTable = (direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const offset = direction === 'left' ? -320 : 320;
      tableContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const filteredModels = models.filter((m) => {
    if (filterOnlyRoundOptions && highlightedOptions && highlightedOptions.length > 0) {
      if (!highlightedOptions.includes(m.id)) return false;
    }
    if (selectedModelId !== 'all' && m.id !== selectedModelId) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const blob = [
        m.name,
        m.author,
        m.essence,
        m.metaphor,
        m.mindset,
        ...m.phases,
        ...m.useWhen,
        ...m.avoidWhen,
        m.outputArtifact.name,
        m.outputArtifact.description,
      ]
        .join(' ')
        .toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  return (
    <section id="vademecum-guide" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Encabezado y controles del Vademécum */}
      <div
        className="surface-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          borderLeft: '4px solid var(--accent-gold)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <span className="kicker">Vademécum de arquitectura instruccional</span>
            <h2 style={{ fontSize: compact ? '1.25rem' : '1.5rem', marginTop: '0.2rem' }}>
              Matriz comparativa de los 6 modelos
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              No memorices fases: contrasta las <strong>indicaciones</strong>,{' '}
              <strong>contraindicaciones</strong> y el <strong>artefacto de salida</strong> frente a las
              restricciones reales de cada cliente.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="tab-strip" style={{ minWidth: '260px' }}>
              <button
                type="button"
                id="guide-mode-cards-btn"
                className={`tab-btn ${displayMode === 'cards' ? 'is-active' : ''}`}
                onClick={() => setDisplayMode('cards')}
              >
                Fichas por modelo
              </button>
              <button
                type="button"
                id="guide-mode-matrix-btn"
                className={`tab-btn ${displayMode === 'matrix' ? 'is-active' : ''}`}
                onClick={() => setDisplayMode('matrix')}
              >
                Tabla comparativa
              </button>
            </div>

            <a
              href={NOTEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-sky"
              title="Abrir cuaderno de investigación en NotebookLM"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>📓</span> Cuaderno NotebookLM
            </a>
          </div>
        </div>

        {/* Nota epistemológica: Contenedor vs. Motor */}
        <div
          style={{
            background: 'rgba(14, 165, 233, 0.09)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}
        >
          <strong style={{ color: '#7dd3fc' }}>
            Distinción epistemológica — Contenedor de gestión vs. Motor pedagógico (Branch, 2009):
          </strong>{' '}
          <strong>ADDIE</strong> es un paradigma iterativo de ciclo de vida y gobernanza de proyectos (no es
          sinónimo de cascada rígida), pero por sí solo no prescribe cómo gestionar la carga cognitiva ni cómo
          estructurar problemas auténticos. Los otros 5 modelos (<strong>Action Mapping</strong>,{' '}
          <strong>4C-ID</strong>, <strong>Dick &amp; Carey</strong>, <strong>Pebble in the Pond</strong> y{' '}
          <strong>Backward Design</strong>) son motores de arquitectura didáctica.
        </div>

        {/* Barra de filtros rápidos */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${selectedModelId === 'all' ? 'btn-primary' : ''}`}
              onClick={() => setSelectedModelId('all')}
            >
              Todos ({models.length})
            </button>
            {models.map((m) => {
              const isHighlighted = highlightedOptions?.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`btn btn-sm ${selectedModelId === m.id ? 'btn-primary' : ''}`}
                  style={{
                    borderColor: selectedModelId === m.id ? undefined : m.color,
                  }}
                  onClick={() => setSelectedModelId(selectedModelId === m.id ? 'all' : m.id)}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: m.color,
                      display: 'inline-block',
                    }}
                  />
                  {m.shortName}
                  {isHighlighted && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.05rem 0.35rem',
                        borderRadius: '3px',
                        background: 'rgba(255,255,255,0.14)',
                      }}
                    >
                      En ronda
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {highlightedOptions && highlightedOptions.length > 0 && (
              <button
                type="button"
                id="filter-round-options-btn"
                className={`btn btn-sm ${filterOnlyRoundOptions ? 'btn-emerald' : ''}`}
                onClick={() => setFilterOnlyRoundOptions(!filterOnlyRoundOptions)}
              >
                {filterOnlyRoundOptions
                  ? `Viendo solo los ${highlightedOptions.length} de esta ronda`
                  : `Filtrar los ${highlightedOptions.length} de esta ronda`}
              </button>
            )}
            <input
              type="search"
              id="guide-search-input"
              className="text-input"
              placeholder="Buscar criterio, artefacto o síntoma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '220px', padding: '0.42rem 0.75rem', fontSize: '0.84rem' }}
            />
          </div>
        </div>
      </div>

      {/* Vista 1: Fichas tácticas por modelo con detalles colapsables */}
      {displayMode === 'cards' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact
              ? '1fr'
              : 'repeat(auto-fill, minmax(min(100%, 540px), 1fr))',
            gap: '1.15rem',
          }}
        >
          {filteredModels.map((m) => {
            const isRoundOption = highlightedOptions?.includes(m.id);
            return (
              <article
                key={m.id}
                id={`guide-card-${m.id}`}
                className="surface-card"
                style={{
                  borderTop: `3px solid ${m.color}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.95rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        className="badge"
                        style={{
                          borderColor: m.color,
                          color: m.color,
                          background: m.accentBg,
                        }}
                      >
                        {m.roleLayer === 'contenedor-gestion'
                          ? 'Marco de gestión / ciclo de vida'
                          : 'Motor de arquitectura pedagógica'}
                      </span>
                      {isRoundOption && (
                        <span className="badge badge-gold">Opción en esta ronda</span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginTop: '0.4rem' }}>{m.name}</h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {m.author} ({m.year})
                    </p>
                  </div>
                </div>

                {/* Esencia y metáfora */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: `3px solid ${m.color}`,
                  }}
                >
                  <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {m.essence}
                  </div>
                  <div
                    style={{
                      fontSize: '0.84rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.35rem',
                    }}
                  >
                    <strong>Metáfora:</strong> {m.metaphor}
                  </div>
                </div>

                {/* Mentalidad y artefacto de salida */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.84rem',
                    }}
                  >
                    <span className="brief-section-label">Mentalidad del diseñador</span>
                    {m.mindset}
                  </div>
                  <div
                    style={{
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.84rem',
                    }}
                  >
                    <span className="brief-section-label">Artefacto de salida</span>
                    <strong style={{ color: m.color }}>{m.outputArtifact.name}:</strong>{' '}
                    {m.outputArtifact.description}
                  </div>
                </div>

                {/* Indicaciones vs. Contraindicaciones */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      padding: '0.75rem',
                      background: 'rgba(16, 185, 129, 0.06)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.83rem',
                    }}
                  >
                    <span className="brief-section-label" style={{ color: '#6ee7b7' }}>
                      ✓ Úsalo cuando (indicaciones)
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {m.useWhen.map((u, idx) => (
                        <li key={idx}>{u}</li>
                      ))}
                    </ul>
                  </div>

                  <div
                    style={{
                      padding: '0.75rem',
                      background: 'rgba(244, 63, 94, 0.06)',
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.83rem',
                    }}
                  >
                    <span className="brief-section-label" style={{ color: '#fda4af' }}>
                      ✕ Evítalo cuando (contraindicaciones)
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {m.avoidWhen.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Información adicional para profundizar (colapsable) */}
                <details
                  className="guide-additional-details"
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.83rem',
                  }}
                >
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: 'var(--accent-gold)',
                      userSelect: 'none',
                    }}
                  >
                    📖 Información adicional para profundizar (fases, contextos y fuentes primarias)
                  </summary>

                  <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Fases / Componentes */}
                    <div>
                      <span className="brief-section-label">Fases / Componentes del modelo</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {m.phases.map((p, idx) => (
                          <span key={idx} className="badge" style={{ fontWeight: 500, fontSize: '0.78rem' }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Pertinencia de contexto */}
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        paddingTop: '0.4rem',
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span>
                        <strong>Académico:</strong> {m.contextFit.academic}
                      </span>
                      <span>
                        <strong>Corporativo:</strong> {m.contextFit.corporate}
                      </span>
                      <span>
                        <strong>Ideal para:</strong> {m.contextFit.bestFor}
                      </span>
                    </div>

                    {/* Nota de autor y cita verificada */}
                    <div className="author-citation-box">
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                        Nota de autor ({m.sources[0]?.citation}):
                      </div>
                      <div>{m.authorNote}</div>
                      {m.sources[0]?.verbatimQuote && (
                        <div
                          style={{
                            marginTop: '0.35rem',
                            fontStyle: 'italic',
                            color: 'var(--text-muted)',
                          }}
                        >
                          «{m.sources[0].verbatimQuote}» — {m.sources[0].work}
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}

      {/* Vista 2: Matriz comparativa completa y sintetizada con controles de navegación */}
      {displayMode === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {/* Barra de navegación lateral de la tabla */}
          <div
            className="surface-card"
            style={{
              padding: '0.6rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Navegación horizontal:
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => scrollTable('left')}
                title="Desplazar columnas hacia la izquierda"
              >
                ◀ Desplazar izquierda
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => scrollTable('right')}
                title="Desplazar columnas hacia la derecha"
              >
                Desplazar derecha ▶
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Modo de lectura:</span>
              <button
                type="button"
                className={`btn btn-sm ${useSynthesizedMatrix ? 'btn-emerald' : ''}`}
                onClick={() => setUseSynthesizedMatrix(true)}
              >
                ✓ Sintetizada (rápida)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${!useSynthesizedMatrix ? 'btn-primary' : ''}`}
                onClick={() => setUseSynthesizedMatrix(false)}
              >
                Completa
              </button>
            </div>
          </div>

          {/* Contenedor de la tabla con cabecera y primera columna sticky */}
          <div className="matrix-table-wrap" ref={tableContainerRef}>
            <table className="matrix-table">
              <thead>
                <tr>
                  <th className="sticky-corner-th">Criterio</th>
                  {filteredModels.map((m) => (
                    <th key={m.id} style={{ borderTop: `3px solid ${m.color}`, minWidth: '220px' }}>
                      <div style={{ fontSize: '0.95rem' }}>{m.shortName}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {m.author}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX_CRITERIA.map((row) => (
                  <tr key={row.key}>
                    <td className="criterion-col">{row.label}</td>
                    {filteredModels.map((m) => {
                      const syn = SYNTHESIZED_MATRIX[m.id];

                      if (row.key === 'essence') {
                        return (
                          <td key={m.id}>
                            {useSynthesizedMatrix ? (
                              <div style={{ fontWeight: 500 }}>{syn?.essence || m.essence}</div>
                            ) : (
                              m.essence
                            )}
                          </td>
                        );
                      }

                      if (row.key === 'metaphor') {
                        return (
                          <td key={m.id}>
                            {useSynthesizedMatrix ? syn?.metaphor || m.metaphor : m.metaphor}
                          </td>
                        );
                      }

                      if (row.key === 'mindset') {
                        return (
                          <td key={m.id}>
                            {useSynthesizedMatrix ? syn?.mindset || m.mindset : m.mindset}
                          </td>
                        );
                      }

                      if (row.key === 'phases') {
                        const phaseList = useSynthesizedMatrix && syn ? syn.phases : m.phases;
                        return (
                          <td key={m.id}>
                            <ol style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem' }}>
                              {phaseList.map((p, i) => (
                                <li key={i} style={{ marginBottom: '0.2rem' }}>{p}</li>
                              ))}
                            </ol>
                          </td>
                        );
                      }

                      if (row.key === 'useWhen') {
                        const useList = useSynthesizedMatrix && syn ? syn.useWhen : m.useWhen;
                        return (
                          <td key={m.id}>
                            <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.82rem' }}>
                              {useList.map((u, i) => (
                                <li key={i} style={{ marginBottom: '0.2rem' }}>{u}</li>
                              ))}
                            </ul>
                          </td>
                        );
                      }

                      if (row.key === 'avoidWhen') {
                        const avoidList = useSynthesizedMatrix && syn ? syn.avoidWhen : m.avoidWhen;
                        return (
                          <td key={m.id}>
                            <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.82rem' }}>
                              {avoidList.map((w, i) => (
                                <li key={i} style={{ marginBottom: '0.2rem' }}>{w}</li>
                              ))}
                            </ul>
                          </td>
                        );
                      }

                      if (row.key === 'contextFit') {
                        if (useSynthesizedMatrix && syn) {
                          return (
                            <td key={m.id} style={{ fontSize: '0.83rem', fontWeight: 500 }}>
                              {syn.contextFit}
                            </td>
                          );
                        }
                        return (
                          <td key={m.id}>
                            <div>
                              <strong>Académico:</strong> {m.contextFit.academic}
                            </div>
                            <div>
                              <strong>Corporativo:</strong> {m.contextFit.corporate}
                            </div>
                            <div style={{ marginTop: '0.25rem' }}>
                              <strong>Mejor para:</strong> {m.contextFit.bestFor}
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={m.id}>
                          {useSynthesizedMatrix && syn ? (
                            <strong style={{ color: m.color }}>{syn.outputArtifact}</strong>
                          ) : (
                            <>
                              <strong style={{ color: m.color }}>{m.outputArtifact.name}:</strong>{' '}
                              {m.outputArtifact.description}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
