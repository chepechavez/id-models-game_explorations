import React, { useState } from 'react';
import { ModelGuideItem, ModelId } from '../types';

interface GuideViewProps {
  models: ModelGuideItem[];
  highlightedOptions?: ModelId[];
  compact?: boolean;
}

type GuideDisplayMode = 'cards' | 'matrix';

const MATRIX_CRITERIA = [
  { key: 'essence', label: 'Esencia' },
  { key: 'metaphor', label: 'Metáfora' },
  { key: 'phases', label: 'Fases / Componentes' },
  { key: 'mindset', label: 'Mentalidad del ID' },
  { key: 'useWhen', label: 'Úsalo cuando (Indicaciones)' },
  { key: 'avoidWhen', label: 'Evítalo cuando (Contraindicaciones)' },
  { key: 'contextFit', label: 'Pertinencia de Contexto' },
  { key: 'outputArtifact', label: 'Artefacto de Salida' },
] as const;

export const GuideView: React.FC<GuideViewProps> = ({
  models,
  highlightedOptions,
  compact = false,
}) => {
  const [displayMode, setDisplayMode] = useState<GuideDisplayMode>('cards');
  const [filterOnlyRoundOptions, setFilterOnlyRoundOptions] = useState<boolean>(false);
  const [selectedModelId, setSelectedModelId] = useState<ModelId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
            <span className="kicker">Vademécum de Arquitectura Instruccional</span>
            <h2 style={{ fontSize: compact ? '1.25rem' : '1.5rem', marginTop: '0.2rem' }}>
              Matriz Interactiva de los 6 Modelos
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              No memorices fases: interroga las <strong>indicaciones</strong>,{' '}
              <strong>contraindicaciones</strong> y el <strong>artefacto de salida</strong> frente a las
              restricciones reales de cada cliente.
            </p>
          </div>

          <div className="tab-strip" style={{ minWidth: '260px' }}>
            <button
              type="button"
              id="guide-mode-cards-btn"
              className={`tab-btn ${displayMode === 'cards' ? 'is-active' : ''}`}
              onClick={() => setDisplayMode('cards')}
            >
              Fichas por Modelo
            </button>
            <button
              type="button"
              id="guide-mode-matrix-btn"
              className={`tab-btn ${displayMode === 'matrix' ? 'is-active' : ''}`}
              onClick={() => setDisplayMode('matrix')}
            >
              Tabla Comparativa
            </button>
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
            Distinción clave — Contenedor de Gestión vs. Motor Pedagógico (Branch, 2009):
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
              style={{ width: '240px', padding: '0.42rem 0.75rem', fontSize: '0.84rem' }}
            />
          </div>
        </div>
      </div>

      {/* Vista 1: Fichas Tácticas por Modelo */}
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
                          ? 'Marco de Gestión / Ciclo de Vida'
                          : 'Motor de Arquitectura Pedagógica'}
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

                {/* Esencia y Metáfora */}
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

                {/* Mentalidad y Artefacto */}
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
                    <span className="brief-section-label">Mentalidad del Diseñador</span>
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
                    <span className="brief-section-label">Artefacto de Salida</span>
                    <strong style={{ color: m.color }}>{m.outputArtifact.name}:</strong>{' '}
                    {m.outputArtifact.description}
                  </div>
                </div>

                {/* Indicaciones vs Contraindicaciones */}
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
                      ✓ Úsalo cuando (Fortalezas)
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
                      ✕ Evítalo cuando (Límites)
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {m.avoidWhen.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Fases y Pertinencia */}
                <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                  <span className="brief-section-label">Fases / Componentes del Modelo</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {m.phases.map((p, idx) => (
                      <span key={idx} className="badge" style={{ fontWeight: 500 }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

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

                {/* Nota y cita verificada de las fuentes primarias */}
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
              </article>
            );
          })}
        </div>
      )}

      {/* Vista 2: Matriz Comparativa Completa */}
      {displayMode === 'matrix' && (
        <div className="matrix-table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Criterio</th>
                {filteredModels.map((m) => (
                  <th key={m.id} style={{ borderTop: `3px solid ${m.color}` }}>
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
                    if (row.key === 'essence') return <td key={m.id}>{m.essence}</td>;
                    if (row.key === 'metaphor') return <td key={m.id}>{m.metaphor}</td>;
                    if (row.key === 'mindset') return <td key={m.id}>{m.mindset}</td>;
                    if (row.key === 'phases') {
                      return (
                        <td key={m.id}>
                          <ol style={{ margin: 0, paddingLeft: '1.1rem' }}>
                            {m.phases.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ol>
                        </td>
                      );
                    }
                    if (row.key === 'useWhen') {
                      return (
                        <td key={m.id}>
                          <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                            {m.useWhen.map((u, i) => (
                              <li key={i}>{u}</li>
                            ))}
                          </ul>
                        </td>
                      );
                    }
                    if (row.key === 'avoidWhen') {
                      return (
                        <td key={m.id}>
                          <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                            {m.avoidWhen.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </td>
                      );
                    }
                    if (row.key === 'contextFit') {
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
                        <strong style={{ color: m.color }}>{m.outputArtifact.name}:</strong>{' '}
                        {m.outputArtifact.description}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
