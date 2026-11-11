import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CaseItem, ModelGuideItem, ModelId } from '../types';
import { useRoom } from '../game/useRoom';
import { useServerClock } from '../game/useServerClock';
import { joinRoom, recordGuideOpen, submitAnswer } from '../game/roomApi';
import { computeLeaderboard } from '../game/analytics';
import { GuideView } from './GuideView';

interface PlayViewProps {
  cases: CaseItem[];
  models: ModelGuideItem[];
}

export const PlayView: React.FC<PlayViewProps> = ({ cases, models }) => {
  const { code } = useParams<{ code: string }>();
  const { room, loading, uid } = useRoom(code);
  const now = useServerClock(250);

  const [activeTab, setActiveTab] = useState<'brief' | 'guide'>('brief');
  const [quickJoinName, setQuickJoinName] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  if (loading) {
    return (
      <main className="container-narrow">
        <div className="surface-card">Cargando sala {code}...</div>
      </main>
    );
  }

  if (!room || !code) {
    return (
      <main className="container-narrow">
        <div className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2>Sala no encontrada ({code})</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Verifica el código con el docente o regresa al inicio para ingresar nuevamente.
          </p>
          <Link to="/" className="btn btn-primary">
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  const player = uid ? room.players?.[uid] : undefined;

  // Si entró por QR / link directo y aún no tiene registro en room.players
  if (!player) {
    const handleQuickJoin = async (e: React.FormEvent) => {
      e.preventDefault();
      setJoinErr(null);
      if (!quickJoinName.trim()) {
        setJoinErr('Ingresa tu nombre o apodo.');
        return;
      }
      try {
        await joinRoom(code, quickJoinName.trim());
      } catch (err: any) {
        setJoinErr(err?.message || 'Error al registrarse en la sala.');
      }
    };

    return (
      <main className="container-narrow">
        <div className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <span className="kicker">Sala {room.code}</span>
          <h2>Regístrate como Consultor ID</h2>
          <form onSubmit={handleQuickJoin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <input
              id="quick-join-name"
              type="text"
              className="text-input"
              placeholder="Tu nombre o apodo"
              value={quickJoinName}
              onChange={(e) => setQuickJoinName(e.target.value)}
              required
            />
            {joinErr && <div style={{ color: '#fca5a5', fontSize: '0.86rem' }}>{joinErr}</div>}
            <button id="quick-join-btn" type="submit" className="btn btn-primary">
              Entrar a la Sala {room.code}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const roundIndex = room.state.roundIndex;
  const totalRounds = room.config.sequence.length;
  const currentCaseId = room.config.sequence[roundIndex];
  const currentCase = cases.find((c) => c.id === currentCaseId);
  const myAnswer = uid ? room.answers?.[roundIndex]?.[uid] : undefined;
  const roundResult = room.results?.[roundIndex];
  const myDelta = uid ? roundResult?.playerDeltas?.[uid] : undefined;

  const remainingSeconds =
    room.state.phase === 'open'
      ? Math.max(0, Math.ceil((room.state.deadline - now) / 1000))
      : 0;
  const isTimeExpired = room.state.phase === 'open' && remainingSeconds <= 0;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSelectModel = async (modelId: ModelId) => {
    if (room.state.phase !== 'open' || isTimeExpired) return;
    setVoteError(null);
    setSubmittingVote(true);
    try {
      await submitAnswer(code, roundIndex, modelId);
    } catch (err: any) {
      setVoteError(err?.message || 'No se pudo registrar tu voto.');
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleSwitchTab = (tab: 'brief' | 'guide') => {
    setActiveTab(tab);
    if (tab === 'guide') {
      recordGuideOpen(code).catch(() => {});
    }
  };

  const modelMap = new Map<ModelId, ModelGuideItem>(models.map((m) => [m.id, m]));
  const leaderboard = computeLeaderboard(room.players);
  const myRank = leaderboard.find((p) => p.uid === uid)?.rank ?? '-';

  return (
    <main className="container" style={{ maxWidth: '960px' }}>
      {/* Barra de estado del jugador */}
      <div
        className="surface-card"
        style={{
          padding: '0.9rem 1.2rem',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="badge badge-gold mono-num">SALA {room.code}</span>
          <span style={{ fontWeight: 600 }}>{player.name}</span>
          {room.state.phase !== 'lobby' && (
            <span className="badge mono-num">
              Ronda {roundIndex + 1} / {totalRounds}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {room.state.phase === 'open' && (
            <span
              id="student-timer"
              className={`timer-pill mono-num ${remainingSeconds <= 20 ? 'is-urgent' : ''}`}
            >
              ⏱ {formatTimer(remainingSeconds)}
            </span>
          )}
          <div className="badge badge-emerald mono-num" id="student-score-badge">
            {player.score} pts (#{myRank})
          </div>
        </div>
      </div>

      {/* Pestañas: Brief / Vademécum disponible desde la ronda 1 */}
      <div className="tab-strip" style={{ marginBottom: '1.2rem' }}>
        <button
          type="button"
          id="tab-brief-btn"
          className={`tab-btn ${activeTab === 'brief' ? 'is-active' : ''}`}
          onClick={() => handleSwitchTab('brief')}
        >
          1. Encargo y Prescripción
        </button>
        <button
          type="button"
          id="tab-guide-btn"
          className={`tab-btn ${activeTab === 'guide' ? 'is-active' : ''}`}
          onClick={() => handleSwitchTab('guide')}
        >
          2. Consultar Vademécum ID ({models.length} modelos)
        </button>
      </div>

      {activeTab === 'guide' ? (
        <GuideView
          models={models}
          highlightedOptions={currentCase?.options}
          compact={true}
        />
      ) : (
        <>
          {/* ESTADO 1: LOBBY */}
          {room.state.phase === 'lobby' && (
            <section
              id="student-lobby-state"
              className="surface-card"
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <span className="kicker">Sala de Espera de Consultores</span>
              <h2>Conectado como Lead ID ({player.name})</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                El docente iniciará la Ronda 1 en breve. Mientras tanto, puedes explorar el{' '}
                <strong>Vademécum de Modelos</strong> en la pestaña superior para revisar las fortalezas,
                contraindicaciones y artefactos de salida de los 6 enfoques.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge mono-num">
                  {Object.keys(room.players ?? {}).length} consultores en sala
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => handleSwitchTab('guide')}
                >
                  Revisar Vademécum Ahora
                </button>
              </div>
            </section>
          )}

          {/* ESTADO 2 Y 3: RONDA ABIERTA O CERRADA */}
          {(room.state.phase === 'open' || room.state.phase === 'closed') && currentCase && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {/* Tarjeta del Caso (Brief) */}
              <article className="brief-dossier" id="student-case-brief">
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span className="kicker">
                    Encargo #{roundIndex + 1} • Nivel {currentCase.level} ({currentCase.options.length} opciones)
                  </span>
                  <span className="badge">{currentCase.sector}</span>
                </div>
                <div>
                  <h2 style={{ fontSize: '1.45rem' }}>{currentCase.title}</h2>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Cliente: <strong>{currentCase.client}</strong>
                  </p>
                </div>

                <div>
                  <span className="brief-section-label">Síntoma y Situación Actual</span>
                  <p className="brief-text">{currentCase.brief}</p>
                </div>

                <div>
                  <span className="brief-section-label">Restricciones Operativas y del Ecosistema</span>
                  <ul className="constraints-list">
                    {currentCase.constraints.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>

                <div className="metric-callout">
                  <span className="brief-section-label" style={{ color: '#6ee7b7' }}>
                    Meta de Éxito y Criterio de Aceptación
                  </span>
                  {currentCase.successMetric}
                </div>
              </article>

              {/* Estado de la prescripción del estudiante */}
              <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span className="kicker">Prescripción Metodológica</span>
                    <h3 style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
                      {room.state.phase === 'open' && !isTimeExpired
                        ? 'Selecciona el modelo idóneo (puedes cambiar tu opción antes del cierre)'
                        : 'Ronda cerrada — Esperando revelación del docente'}
                    </h3>
                  </div>
                  {myAnswer && (
                    <span className="badge badge-gold" id="current-choice-indicator">
                      Tu elección actual: {modelMap.get(myAnswer.option)?.shortName || myAnswer.option}
                    </span>
                  )}
                </div>

                {voteError && (
                  <div style={{ color: '#fca5a5', fontSize: '0.86rem' }}>{voteError}</div>
                )}

                <div className="model-options-stack">
                  {currentCase.options.map((optId, idx) => {
                    const m = modelMap.get(optId);
                    if (!m) return null;
                    const isSelected = myAnswer?.option === optId;
                    const letter = String.fromCharCode(65 + idx);
                    const disabled = room.state.phase !== 'open' || isTimeExpired || submittingVote;

                    return (
                      <button
                        key={optId}
                        type="button"
                        id={`option-btn-${optId}`}
                        data-testid={`option-btn-${optId}`}
                        className={`model-option-card ${isSelected ? 'is-selected' : ''}`}
                        style={{ '--model-color': m.color } as React.CSSProperties}
                        disabled={disabled}
                        onClick={() => handleSelectModel(optId)}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            gap: '0.75rem',
                          }}
                        >
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
                                fontSize: '0.85rem',
                              }}
                            >
                              {letter}
                            </span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '1.02rem' }}>{m.name}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {m.author} • Artefacto: {m.outputArtifact.name}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="badge badge-gold">
                              ✓ Seleccionado
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ESTADO 4: RONDA REVELADA (FEEDBACK DETALLADO) */}
          {room.state.phase === 'revealed' && currentCase && (
            <div id="student-revealed-state" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {/* Banner de resultado individual */}
              <div
                className="surface-card"
                style={{
                  borderLeft: `5px solid ${
                    myDelta?.correct ? 'var(--status-correct)' : 'var(--status-wrong)'
                  }`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <span className="kicker">
                    {myDelta?.correct
                      ? 'Diagnóstico Senior Acertado'
                      : myAnswer
                      ? 'Prescripción Contraindicada'
                      : 'Sin Respuesta Registrada'}
                  </span>
                  <h2 style={{ fontSize: '1.4rem', marginTop: '0.2rem' }}>
                    Modelo Correcto: {modelMap.get(currentCase.model)?.name}
                  </h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    <strong>Artefacto Desbloqueado:</strong> {currentCase.artifactUnlocked}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    className="mono-num"
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: myDelta?.correct ? '#6ee7b7' : '#fca5a5',
                    }}
                  >
                    +{myDelta?.pointsAdded ?? 0} pts
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Acumulado: {player.score} pts
                  </div>
                </div>
              </div>

              {/* Si el estudiante eligió una opción, resaltar primero su diagnóstico */}
              {myAnswer && currentCase.feedback[myAnswer.option] && (
                <div
                  className="surface-card-elevated"
                  id="my-choice-feedback-card"
                  style={{
                    borderLeft: `4px solid ${
                      myAnswer.option === currentCase.model
                        ? 'var(--status-correct)'
                        : 'var(--status-wrong)'
                    }`,
                  }}
                >
                  <span className="kicker">
                    Retroalimentación sobre tu elección ({modelMap.get(myAnswer.option)?.shortName})
                  </span>
                  <h3 style={{ fontSize: '1.08rem', marginTop: '0.25rem' }}>
                    {currentCase.feedback[myAnswer.option]?.label}
                  </h3>
                  <p style={{ marginTop: '0.4rem', fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                    {currentCase.feedback[myAnswer.option]?.text}
                  </p>
                  <div className="author-citation-box">
                    <strong>Fuente de validación:</strong> {currentCase.feedback[myAnswer.option]?.source}
                    {currentCase.feedback[myAnswer.option]?.quote && (
                      <div style={{ fontStyle: 'italic', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                        «{currentCase.feedback[myAnswer.option]?.quote}»
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Análisis completo de todas las opciones de la ronda */}
              <div className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                  <span className="kicker">Dictamen de la Junta Consultora</span>
                  <h3 style={{ fontSize: '1.2rem', marginTop: '0.2rem' }}>
                    Por qué SÍ y por qué NO cada opción en este caso
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <strong>Principio clave:</strong> {currentCase.takeaway}
                  </p>
                </div>

                <div className="model-options-stack">
                  {currentCase.options.map((optId) => {
                    const m = modelMap.get(optId);
                    const fb = currentCase.feedback[optId];
                    if (!m || !fb) return null;
                    const votes = roundResult?.distribution?.[optId] ?? 0;
                    const isMyPick = myAnswer?.option === optId;

                    return (
                      <div
                        key={optId}
                        className={`model-option-card ${
                          fb.verdict === 'correct'
                            ? 'is-correct'
                            : fb.verdict === 'trap'
                            ? 'is-trap'
                            : ''
                        }`}
                        style={{ '--model-color': m.color, cursor: 'default' } as React.CSSProperties}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '1rem' }}>{m.name}</strong>
                            {fb.verdict === 'correct' && (
                              <span className="badge badge-emerald">✓ MODELO IDÓNEO</span>
                            )}
                            {fb.verdict === 'trap' && (
                              <span className="badge badge-gold">⚠ TRAMPA FRECUENTE</span>
                            )}
                            {fb.verdict === 'no' && (
                              <span className="badge badge-rose">✕ CONTRAINDICADO</span>
                            )}
                            {isMyPick && <span className="badge">Tu voto</span>}
                          </div>
                          <span className="badge mono-num">{votes} votos</span>
                        </div>

                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {fb.label}
                        </div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{fb.text}</p>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Fuente: <strong>{fb.source}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ESTADO 5: CIERRE FINAL DE SESIÓN */}
          {room.state.phase === 'final' && (
            <section
              id="student-final-state"
              className="surface-card"
              style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
            >
              <span className="kicker">Sesión Finalizada</span>
              <h2>Balance de Consultoría — {player.name}</h2>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="surface-card-elevated" style={{ flex: 1, minWidth: '180px' }}>
                  <span className="brief-section-label">Puntaje Final</span>
                  <div className="mono-num" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                    {player.score} pts
                  </div>
                </div>
                <div className="surface-card-elevated" style={{ flex: 1, minWidth: '180px' }}>
                  <span className="brief-section-label">Posición en el Ranking</span>
                  <div className="mono-num" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                    #{myRank} de {leaderboard.length}
                  </div>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                Observa en la pantalla compartida del docente el <strong>Podio Final</strong> y el{' '}
                <strong>Mapa de Decisiones de la Cohorte</strong> para discutir los patrones y
                contraindicaciones de los 6 modelos.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
};
