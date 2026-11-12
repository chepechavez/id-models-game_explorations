import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaseItem, ModelId, SessionRoundCount } from '../types';
import { createRoom } from '../game/roomApi';
import { getActiveBackendMode, setForceLocalMode } from '../firebase';
import { ALL_MODELS } from '../game/sequences';

interface HostSetupViewProps {
  cases: CaseItem[];
}

const MODEL_LABELS: Record<ModelId, { name: string; author: string; color: string }> = {
  'action-mapping': { name: 'Action Mapping', author: 'Cathy Moore', color: '#10b981' },
  '4c-id': { name: '4C-ID', author: 'van Merriënboer & Kirschner', color: '#f59e0b' },
  addie: { name: 'ADDIE', author: 'Branch', color: '#0ea5e9' },
  'dick-carey': { name: 'Dick & Carey', author: 'Dick, Carey & Carey', color: '#14b8a6' },
  'pebble-in-the-pond': { name: 'Pebble in the Pond', author: 'M. David Merrill', color: '#f97316' },
  'backward-design': { name: 'Backward Design (UbD)', author: 'Wiggins & McTighe', color: '#8b5cf6' },
};

export const HostSetupView: React.FC<HostSetupViewProps> = ({ cases }) => {
  const navigate = useNavigate();
  const [roundCount, setRoundCount] = useState<SessionRoundCount>(12);
  const [selectedModels, setSelectedModels] = useState<ModelId[]>([...ALL_MODELS]);
  const [durL1, setDurL1] = useState<number>(180);
  const [durL2, setDurL2] = useState<number>(240);
  const [durL3, setDurL3] = useState<number>(300);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(() => getActiveBackendMode());

  const toggleModel = (modelId: ModelId) => {
    setSelectedModels((prev) => {
      if (prev.includes(modelId)) {
        if (prev.length <= 2) {
          setError('Debes mantener al menos 2 modelos activos para permitir opciones contrastadas.');
          return prev;
        }
        setError(null);
        return prev.filter((id) => id !== modelId);
      } else {
        setError(null);
        return [...prev, modelId];
      }
    });
  };

  const handleSelectAllModels = () => {
    setSelectedModels([...ALL_MODELS]);
    setError(null);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedModels.length < 2) {
      setError('Debes seleccionar al menos 2 modelos para que las preguntas tengan opciones de respuesta.');
      return;
    }

    setCreating(true);
    try {
      const { code } = await createRoom(cases, {
        roundCount,
        selectedModels,
        durations: {
          1: Math.max(15, durL1),
          2: Math.max(15, durL2),
          3: Math.max(15, durL3),
        },
      });
      navigate(`/host/${code}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('PERMISSION_DENIED') || msg.includes('permission_denied')) {
        setError(
          'Firebase rechazó la escritura (PERMISSION_DENIED): abre Firebase Console → Realtime Database → Reglas (Rules) y publica el contenido de database.rules.json.'
        );
      } else {
        setError(msg || 'No se pudo crear la sala.');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="container" style={{ maxWidth: '860px' }}>
      <div
        className="surface-card"
        style={{
          borderTop: '3px solid var(--accent-gold)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        <div>
          <span className="kicker">Consola del docente / facilitador</span>
          <h1 style={{ fontSize: '1.8rem', marginTop: '0.25rem' }}>
            Configurar nueva sesión de «El Encargo»
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.94rem' }}>
            Selecciona la extensión de la sesión, los modelos activos y los tiempos por nivel.
            El sistema genera una secuencia aleatoria y progresiva:
            <strong> Nivel 1 (2 opciones) → Nivel 2 (3 opciones) → Nivel 3 (4 opciones)</strong>.
          </p>
        </div>

        {typeof window !== 'undefined' && localStorage.getItem('el_encargo_last_host_room') && (
          <div
            className="surface-card-elevated"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              borderLeft: '4px solid var(--accent-emerald)',
              padding: '0.85rem 1.15rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--accent-emerald)', fontSize: '0.92rem' }}>
                ✓ Tienes una sala reciente en este navegador
              </div>
              <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Código de sala:{' '}
                <strong className="mono-num" style={{ color: 'var(--text-primary)' }}>
                  {localStorage.getItem('el_encargo_last_host_room')}
                </strong>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => navigate(`/host/${localStorage.getItem('el_encargo_last_host_room')}`)}
            >
              Reanudar consola de la sala
            </button>
          </div>
        )}

        <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
          {/* Selector de rondas */}
          <div>
            <span className="brief-section-label">1. Extensión de la sesión (número de rondas)</span>
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
                    title: '6 rondas (Express)',
                    subtitle: '2 casos de nivel 1, 2 de nivel 2 y 2 de nivel 3',
                    duration: '~35 – 45 min con debate',
                  },
                  {
                    count: 12 as SessionRoundCount,
                    title: '12 rondas (Estándar)',
                    subtitle: '4 casos por nivel (progresión balanceada)',
                    duration: '~75 – 90 min con debate',
                  },
                  {
                    count: 18 as SessionRoundCount,
                    title: '18 rondas (Banco completo)',
                    subtitle: '6 casos por nivel (experiencia profunda)',
                    duration: '~110 – 130 min (o 2 sesiones)',
                  },
                ] as const
              ).map((opt) => {
                const active = roundCount === opt.count;
                return (
                  <button
                    key={opt.count}
                    type="button"
                    id={`select-rounds-${opt.count}`}
                    data-testid={`select-rounds-${opt.count}`}
                    className={`model-option-card ${active ? 'is-selected' : ''}`}
                    style={
                      {
                        '--model-color': active ? 'var(--accent-gold)' : 'var(--border-strong)',
                      } as React.CSSProperties
                    }
                    onClick={() => setRoundCount(opt.count)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <strong style={{ fontSize: '1.05rem' }}>{opt.title}</strong>
                      {active && <span className="badge badge-gold">Elegido</span>}
                    </div>
                    <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{opt.subtitle}</p>
                    <span className="mono-num" style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {opt.duration}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modelos activos para la sesión */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span className="brief-section-label" style={{ margin: 0 }}>
                2. Modelos sobre los que se harán preguntas ({selectedModels.length} de {ALL_MODELS.length} activos)
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
              Puedes desactivar modelos que aún no se hayan cubierto en clase. Se requieren al menos 2 modelos activos.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.65rem',
              }}
            >
              {ALL_MODELS.map((mId) => {
                const meta = MODEL_LABELS[mId];
                const isSelected = selectedModels.includes(mId);
                return (
                  <label
                    key={mId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'var(--bg-elevated)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isSelected ? meta.color : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleModel(mId)}
                      style={{ accentColor: meta.color, width: '17px', height: '17px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {meta.name}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {meta.author}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Temporizadores por nivel */}
          <div>
            <span className="brief-section-label">
              3. Temporizador sugerido por ronda (puedes cerrar antes o extender +60s en vivo)
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.85rem',
                marginTop: '0.4rem',
              }}
            >
              <div className="surface-card-elevated">
                <label htmlFor="dur-l1" className="field-label">
                  Nivel 1 (2 opciones — Básico)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <input
                    id="dur-l1"
                    type="number"
                    min={15}
                    max={900}
                    className="text-input mono-num"
                    value={durL1}
                    onChange={(e) => setDurL1(Number(e.target.value))}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>seg</span>
                </div>
              </div>

              <div className="surface-card-elevated">
                <label htmlFor="dur-l2" className="field-label">
                  Nivel 2 (3 opciones — Diagnóstico y trade-offs)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <input
                    id="dur-l2"
                    type="number"
                    min={15}
                    max={900}
                    className="text-input mono-num"
                    value={durL2}
                    onChange={(e) => setDurL2(Number(e.target.value))}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>seg</span>
                </div>
              </div>

              <div className="surface-card-elevated">
                <label htmlFor="dur-l3" className="field-label">
                  Nivel 3 (4 opciones — Alta tensión y trampas)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <input
                    id="dur-l3"
                    type="number"
                    min={15}
                    max={900}
                    className="text-input mono-num"
                    value={durL3}
                    onChange={(e) => setDurL3(Number(e.target.value))}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>seg</span>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ color: '#fca5a5', fontSize: '0.88rem' }}>{error}</div>
          )}

          <button
            id="create-room-btn"
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={creating}
          >
            {creating ? 'Generando sala...' : `Crear sala de ${roundCount} rondas`}
          </button>
        </form>

        {/* Indicador de estado de sincronización */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Motor de sincronización:{' '}
            <strong style={{ color: 'var(--accent-gold)' }}>
              {mode === 'firebase-cloud'
                ? 'Firebase Realtime Database (Multidispositivo en la nube)'
                : mode === 'firebase-emulator'
                ? 'Emulador local de Firebase Realtime Database'
                : 'Modo ensayo local (Sincronización entre pestañas)'}
            </strong>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const nextLocal = mode !== 'local-broadcast';
              setForceLocalMode(nextLocal);
              const updated = getActiveBackendMode();
              setMode(updated);
              if (!nextLocal && updated === 'local-broadcast') {
                setError(
                  'No se encontraron las variables VITE_FIREBASE_* en este build. Verifica las variables del repositorio en GitHub Actions o tu archivo .env.local.'
                );
              } else {
                setError(null);
              }
            }}
          >
            {mode === 'local-broadcast'
              ? 'Usar sincronización en la nube'
              : 'Usar modo ensayo local'}
          </button>
        </div>
      </div>
    </main>
  );
};
