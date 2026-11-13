import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CaseItem, ModelGuideItem, ModelId, SessionRoundCount } from '../types';
import { ALL_MODELS, shuffleArray } from '../game/sequences';
import { BASE_CORRECT_POINTS } from '../game/scoring';
import {
  PracticeSession,
  buildRetrySequence,
  clearPracticeSession,
  computePracticeSummary,
  confirmAnswer,
  createPracticeSession,
  loadPracticeSession,
  nextCase,
  savePracticeSession,
  selectOption,
} from '../game/practice';
import { GuideView } from './GuideView';
import { soundEffects } from '../game/soundEffects';
import { fireCelebrationCannon, fireSuccessConfetti } from '../game/confetti';

interface PracticeViewProps {
  cases: CaseItem[];
  models: ModelGuideItem[];
}

const NOTEBOOK_URL = 'https://notebook.google.com/notebook/e7877e8f-0636-4582-ad53-53fd68587b5e';

export const PracticeView: React.FC<PracticeViewProps> = ({ cases, models }) => {
  const [session, setSession] = useState<PracticeSession | null>(() => loadPracticeSession(cases));
  const [activeTab, setActiveTab] = useState<'brief' | 'guide'>('brief');

  // Estado de configuración inicial
  const [roundCount, setRoundCount] = useState<SessionRoundCount>(6);
  const [selectedModels, setSelectedModels] = useState<ModelId[]>([...ALL_MODELS]);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const modelMap = useMemo(
    () => new Map<ModelId, ModelGuideItem>(models.map((m) => [m.id, m])),
    [models]
  );
  const caseMap = useMemo(
    () => new Map<string, CaseItem>(cases.map((c) => [c.id, c])),
    [cases]
  );

  const commitSession = (next: PracticeSession) => {
    setSession(next);
    savePracticeSession(next);
  };

  // Inicializar con el estado cargado para no repetir audio/confeti tras una recarga
  const initialHandledKey = session
    ? `${session.createdAt}-${session.roundIndex}-${session.phase}`
    : '';
  const lastPhaseHandledRef = useRef<string>(initialHandledKey);

  const currentCaseId = session ? session.sequence[session.roundIndex] : undefined;
  const currentCase = currentCaseId ? caseMap.get(currentCaseId) : undefined;
  const currentAnswer =
    session && session.phase === 'revealed'
      ? session.answers[session.roundIndex]
      : undefined;

  const displayOptions = useMemo(() => {
    if (!currentCase) return [];
    return shuffleArray(currentCase.options);
  }, [currentCase?.id, session?.roundIndex, session?.createdAt]);

  useEffect(() => {
    if (!session) return;
    const key = `${session.createdAt}-${session.roundIndex}-${session.phase}`;
    if (lastPhaseHandledRef.current === key) return;
    lastPhaseHandledRef.current = key;

    if (session.phase === 'revealed' && currentAnswer) {
      if (currentAnswer.correct) {
        soundEffects.playSuccess();
        fireSuccessConfetti();
      } else {
        soundEffects.playFailure();
      }
    } else if (session.phase === 'final') {
      fireCelebrationCannon();
    }
  }, [session?.createdAt, session?.roundIndex, session?.phase, currentAnswer]);

  const handleToggleModel = (modelId: ModelId) => {
    setSelectedModels((prev) => {
      if (prev.includes(modelId)) {
        if (prev.length <= 2) {
          setSetupError('Debes mantener al menos 2 modelos activos para contrastar opciones.');
          return prev;
        }
        setSetupError(null);
        return prev.filter((id) => id !== modelId);
      }
      setSetupError(null);
      return [...prev, modelId];
    });
  };

  const handleSelectAllModels = () => {
    setSelectedModels([...ALL_MODELS]);
    setSetupError(null);
  };

  const handleStartPractice = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedModels.length < 2) {
      setSetupError('Debes seleccionar al menos 2 modelos para iniciar la práctica.');
      return;
    }
    setSetupError(null);
    const activeFilter =
      selectedModels.length === ALL_MODELS.length ? undefined : selectedModels;
    const fresh = createPracticeSession(
      cases,
      { roundCount, selectedModels: activeFilter },
      Date.now()
    );
    commitSession(fresh);
    setActiveTab('brief');
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  const handleConfirm = () => {
    if (!session || session.phase !== 'open' || !session.selected) return;
    const next = confirmAnswer(session, cases);
    commitSession(next);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  const handleNextCase = () => {
    if (!session || session.phase !== 'revealed') return;
    const next = nextCase(session);
    commitSession(next);
    setActiveTab('brief');
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  const handleAbandon = () => {
    const confirmed = window.confirm(
      '¿Empezar de nuevo? Se borrará el progreso de la práctica actual.'
    );
    if (!confirmed) return;
    clearPracticeSession();
    setSession(null);
    setActiveTab('brief');
  };

  const handleNewPractice = () => {
    clearPracticeSession();
    setSession(null);
    setActiveTab('brief');
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  const handleRetryFailed = () => {
    if (!session) return;
    const retryIds = buildRetrySequence(session, cases);
    if (retryIds.length === 0) return;
    const fresh = createPracticeSession(cases, session.config, Date.now(), retryIds);
    commitSession(fresh);
    setActiveTab('brief');
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  const handleCopyNotebookLink = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(NOTEBOOK_URL).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2200);
      });
    }
  };

  const summary = useMemo(() => {
    if (!session || session.phase !== 'final') return null;
    return computePracticeSummary(session, cases);
  }, [session, cases]);

  const retrySequence = useMemo(() => {
    if (!session || session.phase !== 'final') return [];
    return buildRetrySequence(session, cases);
  }, [session, cases]);

  // VISTA 0: CONFIGURACIÓN DE LA PRÁCTICA
  if (!session) {
    const uniqueEligibleCount = cases.filter((c) => selectedModels.includes(c.model)).length;
    const willRepeatCases = uniqueEligibleCount < roundCount;

    return (
      <main className="container" style={{ maxWidth: '860px' }}>
        <section
          id="practice-setup"
          className="surface-card"
          style={{
            borderTop: '3px solid var(--accent-emerald)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.4rem',
          }}
        >
          <div>
            <span className="kicker">Entrenamiento autónomo sin sala</span>
            <h1 style={{ fontSize: '1.8rem', marginTop: '0.25rem' }}>
              Modo práctica individual
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '0.94rem' }}>
              Resuelve casos reales a tu ritmo, sin límite de tiempo y consultando el{' '}
              <strong>Vademécum</strong> en cualquier momento. Cada prescripción acertada suma{' '}
              <strong className="mono-num">{BASE_CORRECT_POINTS} pts</strong> y alimenta tu racha,
              avanzando de{' '}
              <strong>Nivel 1 (2 opciones) → Nivel 2 (3 opciones) → Nivel 3 (4 opciones)</strong>.
            </p>
          </div>

          <form
            onSubmit={handleStartPractice}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}
          >
            {/* 1. Cantidad de casos */}
            <div>
              <span className="brief-section-label">1. Extensión de la práctica</span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.85rem',
                  marginTop: '0.4rem',
                }}
              >
                {(
                  [
                    {
                      count: 6 as SessionRoundCount,
                      title: '6 casos (Express)',
                      subtitle: '2 casos de nivel 1, 2 de nivel 2 y 2 de nivel 3',
                    },
                    {
                      count: 12 as SessionRoundCount,
                      title: '12 casos (Estándar)',
                      subtitle: '4 casos por nivel con dificultad progresiva',
                    },
                    {
                      count: 18 as SessionRoundCount,
                      title: '18 casos (Banco completo)',
                      subtitle: 'Todos los niveles y matices del banco de casos',
                    },
                  ] as const
                ).map((opt) => {
                  const active = roundCount === opt.count;
                  return (
                    <button
                      key={opt.count}
                      type="button"
                      id={`practice-rounds-${opt.count}`}
                      className={`model-option-card ${active ? 'is-selected' : ''}`}
                      style={
                        {
                          '--model-color': active
                            ? 'var(--accent-emerald)'
                            : 'var(--border-strong)',
                        } as React.CSSProperties
                      }
                      onClick={() => setRoundCount(opt.count)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <strong style={{ fontSize: '1.03rem' }}>{opt.title}</strong>
                        {active && <span className="badge badge-emerald">Elegido</span>}
                      </div>
                      <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                        {opt.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Filtro opcional de modelos */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.4rem',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span className="brief-section-label" style={{ margin: 0 }}>
                  2. Modelos a practicar ({selectedModels.length} de {ALL_MODELS.length} activos)
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleSelectAllModels}
                  style={{ fontSize: '0.78rem', padding: '0.2rem 0.55rem' }}
                >
                  Activar todos
                </button>
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                Puedes enfocarte en los modelos que quieras repasar (mínimo 2 activos).
              </p>

              <div className="practice-chip-grid">
                {ALL_MODELS.map((mId) => {
                  const meta = modelMap.get(mId);
                  if (!meta) return null;
                  const isOn = selectedModels.includes(mId);
                  return (
                    <button
                      key={mId}
                      type="button"
                      id={`practice-model-toggle-${mId}`}
                      aria-pressed={isOn}
                      className={`practice-chip ${isOn ? 'is-on' : ''}`}
                      style={{ '--chip-color': meta.color } as React.CSSProperties}
                      onClick={() => handleToggleModel(mId)}
                    >
                      <span className="practice-chip-indicator" aria-hidden="true">
                        {isOn ? '✓' : '+'}
                      </span>
                      <span style={{ textAlign: 'left', flex: 1 }}>
                        <span
                          style={{
                            display: 'block',
                            fontWeight: 600,
                            fontSize: '0.91rem',
                            color: isOn ? 'var(--text-primary)' : 'var(--text-muted)',
                          }}
                        >
                          {meta.shortName}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {meta.author}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {willRepeatCases && (
                <div
                  id="practice-repeat-warning"
                  role="note"
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.65rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#fcd34d',
                    fontSize: '0.84rem',
                  }}
                >
                  Con {selectedModels.length} modelos hay {uniqueEligibleCount} casos únicos en el
                  banco; para completar {roundCount} rondas, algunos casos se repetirán.
                </div>
              )}
            </div>

            {setupError && (
              <div role="alert" style={{ color: '#fca5a5', fontSize: '0.88rem' }}>
                {setupError}
              </div>
            )}

            <button
              id="practice-start-btn"
              type="submit"
              className="btn btn-emerald btn-lg"
            >
              Comenzar práctica ({roundCount} casos)
            </button>
          </form>
        </section>
      </main>
    );
  }

  // VISTAS ACTIVAS (open / revealed / final)
  return (
    <main className="container" style={{ maxWidth: '960px' }}>
      {/* Barra de estado de práctica */}
      <div
        id="practice-status-bar"
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <span className="badge badge-emerald mono-num">MODO PRÁCTICA</span>
          {session.phase !== 'final' ? (
            <span className="badge mono-num" id="practice-progress-badge">
              Caso {session.roundIndex + 1} de {session.sequence.length}
            </span>
          ) : (
            <span className="badge mono-num" id="practice-progress-badge">
              {session.sequence.length} casos completados
            </span>
          )}
          {session.streak >= 2 && session.phase !== 'final' && (
            <span className="badge badge-streak">
              {session.streak >= 5 ? '⚡' : '🔥'} Racha: {session.streak}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div className="badge badge-gold mono-num" id="practice-score-badge">
            {session.score} pts
          </div>
          <button
            type="button"
            id="practice-abandon-btn"
            className="btn btn-sm btn-danger"
            onClick={handleAbandon}
          >
            Empezar de nuevo
          </button>
        </div>
      </div>

      {/* Pestañas contextuales durante la partida */}
      {session.phase !== 'final' && (
        <div className="tab-strip" style={{ marginBottom: '1.2rem' }}>
          <button
            type="button"
            id="practice-tab-brief-btn"
            className={`tab-btn ${activeTab === 'brief' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('brief')}
          >
            1. Encargo y prescripción
          </button>
          <button
            type="button"
            id="practice-tab-guide-btn"
            className={`tab-btn ${activeTab === 'guide' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('guide')}
          >
            2. Consultar Vademécum ID ({models.length} modelos)
          </button>
        </div>
      )}

      {session.phase !== 'final' && activeTab === 'guide' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setActiveTab('brief')}
            >
              ← Volver al encargo actual
            </button>
          </div>
          <GuideView
            models={models}
            highlightedOptions={currentCase?.options}
            compact={true}
          />
        </div>
      ) : (
        <>
          {/* FASE 1: CASO ABIERTO */}
          {session.phase === 'open' && currentCase && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <article
                className="brief-dossier"
                id="practice-case-brief"
                data-case-id={currentCase.id}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span className="kicker">
                    Encargo #{session.roundIndex + 1} • Nivel {currentCase.level} (
                    {currentCase.options.length} opciones)
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
                  <span className="brief-section-label">Síntoma y situación actual</span>
                  <p className="brief-text">{currentCase.brief}</p>
                </div>

                <div>
                  <span className="brief-section-label">Restricciones operativas y del ecosistema</span>
                  <ul className="constraints-list">
                    {currentCase.constraints.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>

                <div className="metric-callout">
                  <span className="brief-section-label" style={{ color: '#6ee7b7' }}>
                    Meta de éxito y criterio de aceptación
                  </span>
                  {currentCase.successMetric}
                </div>
              </article>

              <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div>
                    <span className="kicker">Prescripción metodológica</span>
                    <h3 style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
                      Selecciona el modelo idóneo y confirma tu prescripción
                    </h3>
                  </div>

                  {session.selected && (
                    <span className="badge badge-gold" id="practice-current-choice">
                      Tu elección actual: {modelMap.get(session.selected)?.shortName || session.selected}
                    </span>
                  )}
                </div>

                <div className="model-options-stack">
                  {displayOptions.map((optId, idx) => {
                    const m = modelMap.get(optId);
                    if (!m) return null;
                    const isSelected = session.selected === optId;
                    const letter = String.fromCharCode(65 + idx);

                    return (
                      <button
                        key={optId}
                        type="button"
                        id={`practice-option-btn-${optId}`}
                        data-testid={`practice-option-btn-${optId}`}
                        className={`model-option-card ${isSelected ? 'is-selected' : ''}`}
                        style={{ '--model-color': m.color } as React.CSSProperties}
                        onClick={() => commitSession(selectOption(session, optId))}
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
                                flexShrink: 0,
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
                            <span className="badge badge-gold">✓ Seleccionado</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    marginTop: '0.35rem',
                  }}
                >
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    {session.selected
                      ? 'Puedes cambiar tu elección antes de confirmar.'
                      : 'Elige una opción arriba para habilitar la confirmación.'}
                  </span>
                  <button
                    type="button"
                    id="practice-confirm-btn"
                    className="btn btn-primary btn-lg"
                    disabled={!session.selected}
                    onClick={handleConfirm}
                  >
                    Confirmar prescripción
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* FASE 2: DICTAMEN REVELADO */}
          {session.phase === 'revealed' && currentCase && currentAnswer && (
            <div id="practice-revealed-state" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div
                className="surface-card"
                style={{
                  borderLeft: `5px solid ${
                    currentAnswer.correct ? 'var(--status-correct)' : 'var(--status-wrong)'
                  }`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: '1 1 320px' }}>
                  <span className="kicker">
                    {currentAnswer.correct
                      ? 'Diagnóstico senior acertado'
                      : 'Prescripción contraindicada'}
                  </span>
                  <h2 style={{ fontSize: '1.4rem', marginTop: '0.2rem' }}>
                    Modelo correcto: {modelMap.get(currentCase.model)?.name}
                  </h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    <strong>Artefacto desbloqueado:</strong> {currentCase.artifactUnlocked}
                  </p>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    className="mono-num"
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: currentAnswer.correct ? '#6ee7b7' : '#fca5a5',
                    }}
                  >
                    +{currentAnswer.pointsAdded} pts
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Acumulado: {session.score} pts
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.45rem', justifyContent: 'flex-end' }}>
                    {session.streak >= 2 && (
                      <span className="badge badge-streak">
                        {session.streak >= 5 ? '⚡' : '🔥'} ¡En racha! {session.streak} aciertos seguidos
                      </span>
                    )}
                    {!currentAnswer.correct && (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.14)', color: '#fca5a5' }}>
                        ❄️ Racha reiniciada
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {currentCase.feedback[currentAnswer.option] && (
                <div
                  className="surface-card-elevated"
                  id="practice-my-choice-feedback"
                  style={{
                    borderLeft: `4px solid ${
                      currentAnswer.correct ? 'var(--status-correct)' : 'var(--status-wrong)'
                    }`,
                  }}
                >
                  <span className="kicker">
                    Retroalimentación sobre tu elección ({modelMap.get(currentAnswer.option)?.shortName})
                  </span>
                  <h3 style={{ fontSize: '1.08rem', marginTop: '0.25rem' }}>
                    {currentCase.feedback[currentAnswer.option]?.label}
                  </h3>
                  <p style={{ marginTop: '0.4rem', fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                    {currentCase.feedback[currentAnswer.option]?.text}
                  </p>
                  <div className="author-citation-box">
                    <strong>Fuente de validación:</strong>{' '}
                    {currentCase.feedback[currentAnswer.option]?.source}
                    {currentCase.feedback[currentAnswer.option]?.quote && (
                      <div style={{ fontStyle: 'italic', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                        «{currentCase.feedback[currentAnswer.option]?.quote}»
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                  <span className="kicker">Dictamen de la junta consultora</span>
                  <h3 style={{ fontSize: '1.2rem', marginTop: '0.2rem' }}>
                    Por qué sí y por qué no cada opción en este caso
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
                    const isMyPick = currentAnswer.option === optId;

                    return (
                      <div
                        key={optId}
                        className={`model-option-card ${
                          fb.verdict === 'correct'
                            ? 'is-correct'
                            : fb.verdict === 'trap'
                            ? 'is-trap'
                            : isMyPick
                            ? 'is-wrong-choice'
                            : ''
                        }`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                          cursor: 'default',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <strong style={{ color: m.color, fontSize: '1.02rem' }}>{m.name}</strong>
                            {fb.verdict === 'correct' && (
                              <span className="badge badge-emerald">✓ Modelo idóneo</span>
                            )}
                            {fb.verdict === 'trap' && (
                              <span className="badge badge-gold">⚠️ Trampa frecuente</span>
                            )}
                            {isMyPick && (
                              <span className="badge" style={{ background: 'rgba(255,255,255,0.16)' }}>
                                Tu elección
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{fb.label}</div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{fb.text}</p>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Fuente: <strong>{fb.source}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                  <button
                    type="button"
                    id="practice-next-btn"
                    className="btn btn-primary btn-lg"
                    onClick={handleNextCase}
                  >
                    {session.roundIndex + 1 < session.sequence.length
                      ? 'Siguiente encargo →'
                      : 'Ver balance final →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FASE 3: BALANCE FINAL */}
          {session.phase === 'final' && summary && (
            <div id="practice-final-state" style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
              <section
                className="surface-card"
                style={{
                  borderTop: '3px solid var(--accent-emerald)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.1rem',
                }}
              >
                <div>
                  <span className="kicker">Práctica completada</span>
                  <h2 style={{ fontSize: '1.6rem', marginTop: '0.2rem' }}>
                    Balance personal de consultoría
                  </h2>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="surface-card-elevated" style={{ flex: 1, minWidth: '170px' }}>
                    <span className="brief-section-label">Puntaje total</span>
                    <div className="mono-num" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                      {summary.score} pts
                    </div>
                  </div>
                  <div className="surface-card-elevated" style={{ flex: 1, minWidth: '170px' }}>
                    <span className="brief-section-label">Aciertos</span>
                    <div className="mono-num" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                      {summary.correctCount} / {summary.total}
                    </div>
                  </div>
                  <div className="surface-card-elevated" style={{ flex: 1, minWidth: '170px' }}>
                    <span className="brief-section-label">Mejor racha</span>
                    <div className="mono-num" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-sky)' }}>
                      {summary.bestStreak}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {retrySequence.length > 0 && (
                    <button
                      type="button"
                      id="practice-retry-failed-btn"
                      className="btn btn-primary"
                      onClick={handleRetryFailed}
                    >
                      Reintentar solo los fallados ({retrySequence.length})
                    </button>
                  )}
                  <button
                    type="button"
                    id="practice-new-btn"
                    className={`btn ${retrySequence.length === 0 ? 'btn-primary' : ''}`}
                    onClick={handleNewPractice}
                  >
                    Nueva práctica
                  </button>
                </div>
              </section>

              {/* Mapa de decisiones personal por modelo */}
              <section className="surface-card" id="practice-model-map">
                <span className="kicker">Autodiagnóstico por modelo</span>
                <h3 style={{ fontSize: '1.35rem', marginTop: '0.2rem' }}>
                  Mapa de decisiones personal
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: '1rem' }}>
                  Revisa tu precisión en cada enfoque y qué distractor te hizo dudar cuando fallaste.
                </p>

                <div className="matrix-table-wrap">
                  <table className="confusion-table practice-model-map">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Modelo requerido</th>
                        <th>Casos</th>
                        <th>Aciertos</th>
                        <th>Precisión</th>
                        <th style={{ textAlign: 'left' }}>Trampa más frecuente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.byModel.map((row) => {
                        const m = modelMap.get(row.modelId);
                        const trap = row.mostFrequentTrap
                          ? modelMap.get(row.mostFrequentTrap)
                          : null;
                        return (
                          <tr key={row.modelId}>
                            <td
                              style={{
                                textAlign: 'left',
                                fontWeight: 700,
                                borderLeft: `4px solid ${m?.color || 'var(--accent-gold)'}`,
                              }}
                            >
                              {m?.name || row.modelId}
                            </td>
                            <td className="mono-num">{row.rounds}</td>
                            <td className="mono-num">{row.correct}</td>
                            <td
                              className={`mono-num ${
                                row.accuracyPct === 100
                                  ? 'confusion-cell-correct'
                                  : row.accuracyPct < 50
                                  ? 'confusion-cell-error'
                                  : ''
                              }`}
                            >
                              {row.accuracyPct}%
                            </td>
                            <td style={{ textAlign: 'left' }}>
                              {trap ? (
                                <span
                                  className="badge"
                                  style={{
                                    borderColor: trap.color,
                                    color: trap.color,
                                    background: trap.accentBg,
                                  }}
                                >
                                  {trap.shortName}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Sin confusiones</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Lista de casos fallados */}
              {summary.failedCaseIds.length > 0 && (
                <section className="surface-card" id="practice-failed-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <span className="kicker">Casos para reforzar</span>
                    <h3 style={{ fontSize: '1.25rem', marginTop: '0.2rem' }}>
                      Encargos fallados en esta práctica ({summary.failedCaseIds.length})
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {summary.failedCaseIds.map((id) => {
                      const c = caseMap.get(id);
                      if (!c) return null;
                      const correctModel = modelMap.get(c.model);
                      const lastWrongAnswer = [...session.answers]
                        .reverse()
                        .find((a) => a.caseId === id && !a.correct);
                      const chosenModel = lastWrongAnswer
                        ? modelMap.get(lastWrongAnswer.option)
                        : undefined;

                      return (
                        <div
                          key={id}
                          className="surface-card-elevated"
                          style={{
                            padding: '0.95rem 1.15rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            borderLeft: `4px solid ${correctModel?.color || 'var(--status-wrong)'}`,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{c.title}</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              Nivel {c.level} • {c.sector}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {chosenModel && (
                              <span className="badge badge-rose">
                                Elegiste: {chosenModel.shortName}
                              </span>
                            )}
                            <span className="badge badge-emerald">
                              Correcto: {correctModel?.shortName || c.model}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Tarjeta de profundización NotebookLM */}
              <section
                className="surface-card"
                style={{
                  borderTop: '3px solid var(--accent-sky)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.95rem',
                }}
              >
                <div>
                  <span className="kicker">Material de profundización y recursos bibliográficos</span>
                  <h3 style={{ fontSize: '1.3rem', marginTop: '0.2rem' }}>
                    Experto en Modelos de Diseño Instruccional
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '0.3rem' }}>
                    Continúa tu formación y consulta las fuentes primarias de los modelos (Cathy Moore,
                    van Merriënboer, Robert Branch, Dick &amp; Carey, David Merrill y Wiggins &amp; McTighe)
                    en el cuaderno interactivo de NotebookLM.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <a
                    href={NOTEBOOK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <span>📓</span> Abrir cuaderno en NotebookLM
                  </a>

                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleCopyNotebookLink}
                  >
                    {copiedLink ? '✓ Enlace copiado' : 'Copiar enlace al cuaderno'}
                  </button>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
};
