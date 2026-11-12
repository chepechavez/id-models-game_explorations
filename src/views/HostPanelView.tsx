import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CaseItem, ModelGuideItem, ModelId } from '../types';
import { useRoom } from '../game/useRoom';
import { useServerClock } from '../game/useServerClock';
import {
  advanceToNextRoundOrFinal,
  closeRound,
  extendRoundTime,
  openRound,
  revealRound,
} from '../game/roomApi';
import { computeLeaderboard } from '../game/analytics';
import { getActiveBackendMode } from '../firebase';

interface HostPanelViewProps {
  cases: CaseItem[];
  models: ModelGuideItem[];
}

export const HostPanelView: React.FC<HostPanelViewProps> = ({ cases, models }) => {
  const { code } = useParams<{ code: string }>();
  const { room, loading } = useRoom(code);
  const now = useServerClock(250);

  if (loading) {
    return (
      <main className="container">
        <div className="surface-card">Cargando consola del docente...</div>
      </main>
    );
  }

  if (!room || !code) {
    return (
      <main className="container-narrow">
        <div className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2>Sala {code} no encontrada</h2>
          <Link to="/host" className="btn btn-primary">
            Crear nueva sala
          </Link>
        </div>
      </main>
    );
  }

  const roundIndex = room.state.roundIndex;
  const totalRounds = room.config.sequence.length;
  const currentCaseId = room.config.sequence[roundIndex];
  const currentCase = cases.find((c) => c.id === currentCaseId);
  const nextCaseId = room.config.sequence[roundIndex + 1];
  const nextCase = cases.find((c) => c.id === nextCaseId);

  const playersList = Object.values(room.players ?? {});
  const roundAnswers = room.answers?.[roundIndex] ?? {};
  const answeredCount = Object.keys(roundAnswers).length;
  const roundResult = room.results?.[roundIndex];
  const leaderboard = computeLeaderboard(room.players);
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

  const backendMode = getActiveBackendMode();
  const modeParam = backendMode === 'local-broadcast' ? 'local=1' : 'local=0';
  const baseHref = window.location.origin + window.location.pathname;
  const joinUrl = `${baseHref}#/?code=${room.code}&${modeParam}`;
  const screenUrl = `${baseHref}#/screen/${room.code}?${modeParam}`;

  const handleStartFirstRound = async () => {
    const firstCase = cases.find((c) => c.id === room.config.sequence[0]);
    const dur = room.config.durations[firstCase?.level ?? 1] ?? 180;
    await openRound(room.code, 0, dur);
  };

  const handleCloseAndReveal = async () => {
    await closeRound(room.code);
    await revealRound(room.code, cases);
  };

  return (
    <main className="container">
      {/* Encabezado de control de sala */}
      <div
        className="surface-card"
        style={{
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderTop: '3px solid var(--accent-gold)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <span className="kicker">Consola del Docente</span>
            <h1 className="mono-num" style={{ fontSize: '1.7rem' }}>
              SALA {room.code}
            </h1>
          </div>
          <span className="badge badge-gold mono-num">
            Fase: {room.state.phase.toUpperCase()}
          </span>
          <span className="badge mono-num">
            Ronda {roundIndex + 1} de {totalRounds}
          </span>
          <span className="badge badge-emerald mono-num" id="host-player-count">
            {playersList.length} estudiantes conectados
          </span>
          <span className="badge badge-sky mono-num" id="host-sync-mode-badge">
            {backendMode === 'firebase-cloud'
              ? '☁️ Sincronización en la Nube'
              : backendMode === 'firebase-emulator'
              ? '🧪 Emulador Firebase'
              : '💻 Modo Ensayo Local'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {room.state.phase === 'open' && (
            <span
              id="host-timer"
              className={`timer-pill mono-num ${remainingSeconds <= 20 ? 'is-urgent' : ''}`}
            >
              ⏱ {formatTimer(remainingSeconds)}
            </span>
          )}
          <a
            href={screenUrl}
            target="_blank"
            rel="noreferrer"
            id="open-screen-view-btn"
            className="btn btn-sm"
          >
            ↗ Abrir Vista de Proyección
          </a>
        </div>
      </div>

      <div className="split-grid">
        {/* Columna izquierda: Controles de ritmo y Caso Actual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Botonera Maestra del Docente */}
          <section
            className="surface-card-elevated"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span className="kicker">Control del Ritmo Sincrónico</span>
                <h2 style={{ fontSize: '1.25rem', marginTop: '0.15rem' }}>
                  {room.state.phase === 'lobby' && 'Sala abierta esperando participantes'}
                  {room.state.phase === 'open' && 'Votación en curso (oculta hasta revelar)'}
                  {room.state.phase === 'closed' && 'Votación cerrada — Lista para revelar'}
                  {room.state.phase === 'revealed' && 'Retroalimentación revelada en pantalla'}
                  {room.state.phase === 'final' && 'Sesión completada — Podio y Mapa de Decisiones'}
                </h2>
              </div>

              {room.state.phase !== 'lobby' && (
                <div className="badge badge-sky mono-num" id="host-answer-counter" style={{ fontSize: '0.9rem' }}>
                  Respondieron: {answeredCount} / {playersList.length}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {room.state.phase === 'lobby' && (
                <button
                  type="button"
                  id="host-start-round-1-btn"
                  className="btn btn-primary btn-lg"
                  onClick={handleStartFirstRound}
                >
                  ▶ Abrir Ronda 1 ({totalRounds} rondas en secuencia)
                </button>
              )}

              {room.state.phase === 'open' && (
                <>
                  <button
                    type="button"
                    id="host-extend-time-btn"
                    className="btn"
                    onClick={() => extendRoundTime(room.code, 60)}
                  >
                    +60s Extender Tiempo
                  </button>
                  <button
                    type="button"
                    id="host-close-round-btn"
                    className="btn btn-danger"
                    onClick={() => closeRound(room.code)}
                  >
                    ■ Cerrar Votación
                  </button>
                  <button
                    type="button"
                    id="host-close-and-reveal-btn"
                    className="btn btn-emerald"
                    onClick={handleCloseAndReveal}
                  >
                    ★ Cerrar y Revelar Feedback Ahora
                  </button>
                </>
              )}

              {room.state.phase === 'closed' && (
                <>
                  <button
                    type="button"
                    id="host-reveal-btn"
                    className="btn btn-emerald btn-lg"
                    onClick={() => revealRound(room.code, cases)}
                  >
                    ★ Revelar Respuesta Correcta y Feedback
                  </button>
                  <button
                    type="button"
                    id="host-reopen-btn"
                    className="btn"
                    onClick={() => extendRoundTime(room.code, 45)}
                  >
                    ↺ Reabrir +45s
                  </button>
                </>
              )}

              {room.state.phase === 'revealed' && (
                <button
                  type="button"
                  id="host-next-round-btn"
                  className="btn btn-primary btn-lg"
                  onClick={() => advanceToNextRoundOrFinal(room.code, cases)}
                >
                  {roundIndex + 1 < totalRounds
                    ? `▶ Abrir Ronda ${roundIndex + 2} (${nextCase?.title || ''})`
                    : '🏆 Finalizar y Mostrar Podio + Mapa de Decisiones'}
                </button>
              )}
            </div>
          </section>

          {/* Vista del Caso Actual y Guía de Facilitación del Docente */}
          {currentCase && (
            <article className="brief-dossier">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span className="kicker">
                  Caso de la Ronda {roundIndex + 1} • Nivel {currentCase.level} ({currentCase.options.length} opciones)
                </span>
                <span className="badge badge-emerald">
                  Clave Docente: {modelMap.get(currentCase.model)?.name}
                </span>
              </div>

              <div>
                <h3 style={{ fontSize: '1.35rem' }}>{currentCase.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Cliente: <strong>{currentCase.client}</strong> ({currentCase.sector})
                </p>
              </div>

              <p className="brief-text">{currentCase.brief}</p>

              <div>
                <span className="brief-section-label">Restricciones</span>
                <ul className="constraints-list">
                  {currentCase.constraints.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              {/* Pauta privada del facilitador */}
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.9rem 1rem',
                  fontSize: '0.88rem',
                }}
              >
                <span className="brief-section-label" style={{ color: '#fcd34d' }}>
                  Guía Privada para el Debate Docente (Oculta a Estudiantes antes de revelar)
                </span>
                <div>
                  <strong>Idea fuerza (Takeaway):</strong> {currentCase.takeaway}
                </div>
                <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                  <strong>Evidencia de validación ({currentCase.validation.notebookRef}):</strong> «
                  {currentCase.validation.verifiedQuote}»
                </div>
              </div>

              {/* Si ya se reveló, mostrar distribución de votos */}
              {room.state.phase === 'revealed' && roundResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <span className="brief-section-label">Distribución de Respuestas de la Clase</span>
                  {currentCase.options.map((optId) => {
                    const m = modelMap.get(optId);
                    const count = roundResult.distribution[optId] ?? 0;
                    const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
                    const fb = currentCase.feedback[optId];
                    return (
                      <div
                        key={optId}
                        style={{
                          padding: '0.65rem 0.9rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-elevated)',
                          borderLeft: `4px solid ${m?.color || 'var(--accent-gold)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                          <strong>
                            {m?.name} {optId === currentCase.model ? '✓ (Correcta)' : ''}
                          </strong>
                          <span className="mono-num">
                            {count} votos ({pct}%)
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {fb?.text} <em>({fb?.source})</em>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          )}
        </div>

        {/* Columna derecha: QR de acceso, Estado de participantes y Top 5 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Tarjeta de invitación rápida */}
          <section className="surface-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                background: '#ffffff',
                padding: '0.55rem',
                borderRadius: '8px',
                display: 'inline-flex',
              }}
            >
              <QRCodeSVG value={joinUrl} size={108} />
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <span className="kicker">Ingreso de Estudiantes</span>
              <div className="mono-num" style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.1rem' }}>
                Código: {room.code}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all', marginTop: '0.25rem' }}>
                {joinUrl}
              </p>
            </div>
          </section>

          {/* Estado de respuesta en la ronda actual (sin delatar qué votaron mientras está abierta) */}
          <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span className="kicker">Monitoreo de Participación</span>
            <h3 style={{ fontSize: '1.08rem' }}>
              Consultores en Sala ({playersList.length})
            </h3>
            {playersList.length === 0 ? (
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                Aún no se han unido estudiantes. Comparte el código <strong>{room.code}</strong>.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {leaderboard.map((p) => {
                  const hasAnswered = Boolean(roundAnswers[p.uid]);
                  const delta = roundResult?.playerDeltas?.[p.uid];
                  return (
                    <div
                      key={p.uid}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.88rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong className="mono-num">#{p.rank}</strong>
                        <span>{p.name}</span>
                        {p.streak >= 2 && (
                          <span className="badge badge-streak" style={{ fontSize: '0.74rem', padding: '0.1rem 0.35rem' }}>
                            {p.streak >= 5 ? '⚡' : '🔥'} x{p.streak}
                          </span>
                        )}
                        {delta?.rankDelta !== undefined && (
                          delta.rankDelta > 0 ? (
                            <span className="badge badge-rank-up" style={{ fontSize: '0.7rem', padding: '0.05rem 0.3rem' }}>
                              ▲ +{delta.rankDelta}
                            </span>
                          ) : delta.rankDelta < 0 ? (
                            <span className="badge badge-rank-down" style={{ fontSize: '0.7rem', padding: '0.05rem 0.3rem' }}>
                              ▼ {delta.rankDelta}
                            </span>
                          ) : (
                            <span className="badge badge-rank-same" style={{ fontSize: '0.7rem', padding: '0.05rem 0.3rem' }}>
                              =
                            </span>
                          )
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {room.state.phase !== 'lobby' && (
                          <span className={`badge ${hasAnswered ? 'badge-emerald' : ''}`}>
                            {hasAnswered ? '✓ Respondió' : 'Pensando...'}
                          </span>
                        )}
                        <span className="mono-num" style={{ fontWeight: 600 }}>
                          {p.score} pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recursos de profundización para compartir */}
          <section
            className="surface-card"
            style={{
              borderTop: '3px solid var(--accent-sky)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <span className="kicker">Recursos de cátedra</span>
            <h4 style={{ fontSize: '1rem', margin: 0 }}>
              Cuaderno NotebookLM y lecturas
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Comparte el enlace al cuaderno de NotebookLM y las lecturas con tus estudiantes:
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <a
                href="https://notebook.google.com/notebook/e7877e8f-0636-4582-ad53-53fd68587b5e"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-sky"
              >
                📓 Abrir NotebookLM
              </a>
              <a
                href="https://drive.google.com/drive/folders/1ByUqJZhA83Wwrb_cVSfKo_hwYfqBnNLV"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm"
              >
                📁 Carpeta de lecturas
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};
