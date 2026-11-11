import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaseItem, SessionRoundCount } from '../types';
import { createRoom } from '../game/roomApi';
import { getActiveBackendMode, setForceLocalMode } from '../firebase';

interface HostSetupViewProps {
  cases: CaseItem[];
}

export const HostSetupView: React.FC<HostSetupViewProps> = ({ cases }) => {
  const navigate = useNavigate();
  const [roundCount, setRoundCount] = useState<SessionRoundCount>(12);
  const [durL1, setDurL1] = useState<number>(180);
  const [durL2, setDurL2] = useState<number>(240);
  const [durL3, setDurL3] = useState<number>(300);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(() => getActiveBackendMode());

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const { code } = await createRoom(cases, {
        roundCount,
        durations: {
          1: Math.max(15, durL1),
          2: Math.max(15, durL2),
          3: Math.max(15, durL3),
        },
      });
      navigate(`/host/${code}`);
    } catch (err: any) {
      const msg = String(err?.message || '');
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
          <span className="kicker">Consola del Docente / Facilitador</span>
          <h1 style={{ fontSize: '1.8rem', marginTop: '0.25rem' }}>
            Configurar Nueva Sesión de «El Encargo»
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.94rem' }}>
            Selecciona la extensión de la sesión y los tiempos por nivel de complejidad. El sistema
            construye automáticamente una secuencia balanceada que cubre los 6 modelos sin repetir el
            mismo modelo en rondas consecutivas y escalando de 3 a 5 opciones.
          </p>
        </div>

        <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
          {/* Selector de 6, 12 o 18 rondas */}
          <div>
            <span className="brief-section-label">1. Extensión de la Sesión (Número de Rondas)</span>
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
                    title: '6 Rondas (Express)',
                    subtitle: '1 caso por modelo (2 básicos, 2 intermedios, 2 avanzados)',
                    duration: '~35 – 45 min con debate',
                  },
                  {
                    count: 12 as SessionRoundCount,
                    title: '12 Rondas (Estándar)',
                    subtitle: '2 casos por modelo (6 básicos + 3 intermedios + 3 avanzados)',
                    duration: '~75 – 90 min con debate',
                  },
                  {
                    count: 18 as SessionRoundCount,
                    title: '18 Rondas (Banco Completo)',
                    subtitle: '3 casos por modelo (6 básicos + 6 intermedios + 6 avanzados)',
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

          {/* Temporizadores por nivel */}
          <div>
            <span className="brief-section-label">
              2. Temporizador Sugerido por Ronda (Puedes cerrar antes o extender +60s en vivo)
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
                  Nivel 1 (3 opciones — Básico)
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
                  Nivel 2 (4 opciones — Trade-offs)
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
                  Nivel 3 (5 opciones — Alta tensión)
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
            {creating ? 'Generando Sala...' : `Crear Sala de ${roundCount} Rondas`}
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
                ? 'Emulador Local de Firebase Realtime Database'
                : 'Modo Ensayo Local (Sincronización entre pestañas)'}
            </strong>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const nextLocal = mode !== 'local-broadcast';
              setForceLocalMode(nextLocal);
              setMode(getActiveBackendMode());
              setError(null);
            }}
          >
            {mode === 'local-broadcast'
              ? 'Usar Sincronización en la Nube'
              : 'Usar Modo Ensayo Local'}
          </button>
        </div>
      </div>
    </main>
  );
};
