import React from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CaseItem, ModelGuideItem, ModelId } from '../types';
import { useRoom } from '../game/useRoom';
import { useServerClock } from '../game/useServerClock';
import { computeDecisionMap, computeLeaderboard } from '../game/analytics';
import { encodeFirebaseConfigParam, getStoredFirebaseConfig } from '../firebase';

interface ScreenViewProps {
  cases: CaseItem[];
  models: ModelGuideItem[];
}

export const ScreenView: React.FC<ScreenViewProps> = ({ cases, models }) => {
  const { code } = useParams<{ code: string }>();
  const { room, loading } = useRoom(code);
  const now = useServerClock(250);

  if (loading || !room || !code) {
    return (
      <main className="container">
        <div className="surface-card">Conectando vista de proyección ({code})...</div>
      </main>
    );
  }

  const roundIndex = room.state.roundIndex;
  const totalRounds = room.config.sequence.length;
  const currentCaseId = room.config.sequence[roundIndex];
  const currentCase = cases.find((c) => c.id === currentCaseId);
  const playersList = Object.values(room.players ?? {});
  const roundAnswers = room.answers?.[roundIndex] ?? {};
  const answeredCount = Object.keys(roundAnswers).length;
  const roundResult = room.results?.[roundIndex];
  const leaderboard = computeLeaderboard(room.players);
  const top5 = leaderboard.slice(0, 5);
  const modelMap = new Map<ModelId, ModelGuideItem>(models.map((m) => [m.id, m]));

  const remainingSeconds =
    room.state.phase === 'open'
      ? Math.max(0, Math.ceil((room.state.deadline - now) / 1000))
      : 0;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const fbParam = encodeFirebaseConfigParam(getStoredFirebaseConfig());
  const baseHref = window.location.origin + window.location.pathname;
  const joinUrl = `${baseHref}#/?code=${room.code}${fbParam ? `&fb=${fbParam}` : ''}`;

  const allModelIds = models.map((m) => m.id);
  const decisionMap = computeDecisionMap(room, cases, allModelIds);

  return (
    <main className="container screen-mode" id="projection-screen-root">
      {/* Barra de cabecera de Proyección */}
      <header
        className="surface-card"
        style={{
          padding: '1rem 1.5rem',
          marginBottom: '1.35rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem', flexWrap: 'wrap' }}>
          <span
            className="mono-num"
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--accent-gold)',
              letterSpacing: '0.06em',
            }}
          >
            SALA: {room.code}
          </span>
          {room.state.phase !== 'lobby' && room.state.phase !== 'final' && (
            <span className="badge mono-num" style={{ fontSize: '0.92rem' }}>
              Ronda {roundIndex + 1} / {totalRounds}
            </span>
          )}
          <span className="badge badge-emerald mono-num" style={{ fontSize: '0.92rem' }}>
            {playersList.length} Consultores Conectados
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {(room.state.phase === 'open' || room.state.phase === 'closed') && (
            <span className="badge badge-sky mono-num" id="screen-response-progress" style={{ fontSize: '0.95rem' }}>
              Votos recibidos: {answeredCount} / {playersList.length}
            </span>
          )}
          {room.state.phase === 'open' && (
            <span
              id="screen-timer"
              className={`timer-pill mono-num ${remainingSeconds <= 20 ? 'is-urgent' : ''}`}
              style={{ fontSize: '1.35rem' }}
            >
              ⏱ {formatTimer(remainingSeconds)}
            </span>
          )}
        </div>
      </header>

      {/* FASE 1: LOBBY DE PROYECCIÓN */}
      {room.state.phase === 'lobby' && (
        <section
          id="screen-lobby"
          className="surface-card"
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '2.2rem',
            alignItems: 'center',
            padding: '2.2rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              padding: '1rem',
              borderRadius: '12px',
              display: 'inline-flex',
            }}
          >
            <QRCodeSVG value={joinUrl} size={210} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span className="kicker">Únete desde tu celular o navegador</span>
            <h1 style={{ fontSize: '2.4rem' }}>
              Código de Sala:{' '}
              <span className="mono-num" style={{ color: 'var(--accent-gold)' }}>
                {room.code}
              </span>
            </h1>
            <p style={{ fontSize: '1.08rem', color: 'var(--text-secondary)' }}>
              Escanea el código QR o ingresa el código <strong>{room.code}</strong>. Tienes acceso al{' '}
              <strong>Vademécum de Modelos ID</strong> desde la Ronda 1 para fundamentar cada decisión.
            </p>

            <div style={{ marginTop: '0.5rem' }}>
              <span className="brief-section-label">
                Consultores en Sala ({playersList.length})
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.35rem' }}>
                {playersList.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>Esperando que se unan participantes...</span>
                ) : (
                  playersList.map((p) => (
                    <span
                      key={p.uid}
                      className="badge badge-gold"
                      style={{ fontSize: '0.92rem', padding: '0.35rem 0.75rem' }}
                    >
                      {p.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FASES 2, 3 Y 4: ENCARGO EN PANTALLA Y REVELACIÓN */}
      {(room.state.phase === 'open' ||
        room.state.phase === 'closed' ||
        room.state.phase === 'revealed') &&
        currentCase && (
          <div className="split-grid">
            {/* Izquierda (55%): Expediente / Brief del Cliente */}
            <article className="brief-dossier" id="screen-case-brief">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span className="kicker">
                  EXPEDIENTE #{String(roundIndex + 1).padStart(2, '0')} — NIVEL {currentCase.level}
                </span>
                <span className="badge">{currentCase.sector}</span>
              </div>

              <div>
                <h1 style={{ fontSize: '1.85rem' }}>{currentCase.title}</h1>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Cliente: <strong>{currentCase.client}</strong>
                </p>
              </div>

              <div>
                <span className="brief-section-label">Síntoma Operativo y Pedido del Cliente</span>
                <p className="brief-text">{currentCase.brief}</p>
              </div>

              <div>
                <span className="brief-section-label">Restricciones del Ecosistema</span>
                <ul className="constraints-list" style={{ fontSize: '1rem' }}>
                  {currentCase.constraints.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className="metric-callout" style={{ fontSize: '1rem' }}>
                <span className="brief-section-label" style={{ color: '#6ee7b7' }}>
                  Meta de Éxito y Criterio de Aceptación
                </span>
                {currentCase.successMetric}
              </div>

              {room.state.phase === 'revealed' && (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                  }}
                >
                  <span className="brief-section-label" style={{ color: '#6ee7b7' }}>
                    Conclusión Senior y Artefacto Desbloqueado
                  </span>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.3rem' }}>
                    Artefacto: {currentCase.artifactUnlocked}
                  </div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    {currentCase.takeaway}
                  </div>
                  <div className="author-citation-box">
                    <strong>Respaldo primario ({currentCase.validation.notebookRef}):</strong> «
                    {currentCase.validation.verifiedQuote}»
                  </div>
                </div>
              )}
            </article>

            {/* Derecha (45%): Opciones, Distribución, Feedback por Opción y Top 5 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="kicker">
                    {room.state.phase === 'revealed'
                      ? 'Distribución y Dictamen por Opción'
                      : `Modelos Candidatos (${currentCase.options.length} Opciones)`}
                  </span>
                  {room.state.phase === 'closed' && (
                    <span className="badge badge-gold">Votación Cerrada</span>
                  )}
                </div>

                <div className="model-options-stack">
                  {currentCase.options.map((optId, idx) => {
                    const m = modelMap.get(optId);
                    const fb = currentCase.feedback[optId];
                    if (!m) return null;
                    const letter = String.fromCharCode(65 + idx);
                    const votes = roundResult?.distribution?.[optId] ?? 0;
                    const pct = answeredCount > 0 ? Math.round((votes / answeredCount) * 100) : 0;
                    const isRevealed = room.state.phase === 'revealed';

                    return (
                      <div
                        key={optId}
                        id={`screen-option-${optId}`}
                        className={`model-option-card ${
                          isRevealed && fb?.verdict === 'correct'
                            ? 'is-correct'
                            : isRevealed && fb?.verdict === 'trap'
                            ? 'is-trap'
                            : ''
                        }`}
                        style={{ '--model-color': m.color, cursor: 'default' } as React.CSSProperties}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span
                              className="mono-num"
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '4px',
                                background: m.accentBg,
                                border: `1px solid ${m.color}`,
                                color: m.color,
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 700,
                              }}
                            >
                              {letter}
                            </span>
                            <div>
                              <strong style={{ fontSize: '1.05rem' }}>{m.name}</strong>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {m.author}
                              </div>
                            </div>
                          </div>

                          {isRevealed && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {fb?.verdict === 'correct' && (
                                <span className="badge badge-emerald">✓ CORRECTO</span>
                              )}
                              {fb?.verdict === 'trap' && (
                                <span className="badge badge-gold">⚠ TRAMPA</span>
                              )}
                              {fb?.verdict === 'no' && (
                                <span className="badge badge-rose">✕ NO</span>
                              )}
                              <span className="badge mono-num">
                                {votes} ({pct}%)
                              </span>
                            </div>
                          )}
                        </div>

                        {isRevealed && (
                          <>
                            <div className="vote-bar-track">
                              <div
                                className="vote-bar-fill"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            {fb && (
                              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>{fb.label}:</strong>{' '}
                                {fb.text}{' '}
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  ({fb.source})
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Top 5 Ranking después de cada revelación */}
              {room.state.phase === 'revealed' && top5.length > 0 && (
                <section
                  id="screen-top5-leaderboard"
                  className="surface-card"
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}
                >
                  <span className="kicker">Ranking Acumulado (Top 5 Consultores)</span>
                  {top5.map((p) => (
                    <div
                      key={p.uid}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.55rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        background: p.rank === 1 ? 'var(--accent-gold-bg)' : 'var(--bg-elevated)',
                        border:
                          p.rank === 1
                            ? '1px solid rgba(245, 158, 11, 0.45)'
                            : '1px solid var(--border-subtle)',
                      }}
                    >
                      <span>
                        <strong className="mono-num" style={{ marginRight: '0.5rem' }}>
                          #{p.rank}
                        </strong>
                        <strong>{p.name}</strong>
                      </span>
                      <span className="mono-num" style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>
                        {p.score} pts
                      </span>
                    </div>
                  ))}
                </section>
              )}
            </div>
          </div>
        )}

      {/* FASE 5: PODIO FINAL Y MAPA DE DECISIONES DE LA COHORTE */}
      {room.state.phase === 'final' && (
        <div id="screen-final-summary" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Podio Top 5 */}
          <section className="surface-card" style={{ borderTop: '3px solid var(--accent-gold)' }}>
            <span className="kicker">Cierre de la Junta Consultora</span>
            <h1 style={{ fontSize: '2rem', marginTop: '0.2rem', marginBottom: '1rem' }}>
              Podio Final de Lead Instructional Designers
            </h1>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '0.9rem',
              }}
            >
              {top5.map((p) => (
                <div
                  key={p.uid}
                  className="surface-card-elevated"
                  style={{
                    borderTop:
                      p.rank === 1
                        ? '3px solid var(--accent-gold)'
                        : p.rank === 2
                        ? '3px solid var(--accent-emerald)'
                        : '3px solid var(--border-strong)',
                  }}
                >
                  <span className="kicker">Puesto #{p.rank}</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>
                    {p.name}
                  </div>
                  <div
                    className="mono-num"
                    style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-gold)', marginTop: '0.25rem' }}
                  >
                    {p.score} pts
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Mapa de Decisiones de la Cohorte (Matriz de Confusión por Modelo) */}
          <section className="surface-card" id="cohort-decision-map">
            <span className="kicker">Diagnóstico Pedagógico de Cierre para el Docente</span>
            <h2 style={{ fontSize: '1.55rem', marginTop: '0.2rem' }}>
              Mapa de Decisiones de la Cohorte por Modelo
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', marginTop: '0.25rem', marginBottom: '1rem' }}>
              Esta matriz muestra el porcentaje de acierto de la clase frente a cada modelo y cuál fue el
              distractor («trampa») que generó mayor confusión, para focalizar el cierre del facilitador.
            </p>

            <div className="matrix-table-wrap">
              <table className="confusion-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Modelo Requerido por el Caso</th>
                    <th>Rondas</th>
                    <th>Precisión de la Clase</th>
                    <th>Principal Confusión / Trampa Elegida</th>
                    {models.map((col) => (
                      <th key={col.id} className="mono-num" style={{ fontSize: '0.76rem' }}>
                        {col.shortName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {decisionMap.map((row) => {
                    const m = modelMap.get(row.modelId);
                    const trapModel = row.mostFrequentTrap
                      ? modelMap.get(row.mostFrequentTrap)
                      : null;
                    return (
                      <tr key={row.modelId}>
                        <td style={{ textAlign: 'left', fontWeight: 700, borderLeft: `4px solid ${m?.color}` }}>
                          {m?.name}
                        </td>
                        <td className="mono-num">{row.roundsPlayed}</td>
                        <td className="mono-num" style={{ fontWeight: 700 }}>
                          {row.totalVotes > 0 ? `${row.accuracyPct}% (${row.correctVotes}/${row.totalVotes})` : '—'}
                        </td>
                        <td style={{ textAlign: 'left' }}>
                          {trapModel ? (
                            <span className="badge badge-rose">{trapModel.shortName}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Sin confusiones</span>
                          )}
                        </td>
                        {models.map((col) => {
                          const count = row.chosenDistribution[col.id] ?? 0;
                          const isDiag = col.id === row.modelId;
                          return (
                            <td
                              key={col.id}
                              className={`mono-num ${
                                count > 0
                                  ? isDiag
                                    ? 'confusion-cell-correct'
                                    : 'confusion-cell-error'
                                  : ''
                              }`}
                            >
                              {count}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
