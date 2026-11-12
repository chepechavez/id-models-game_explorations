import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { joinRoom } from '../game/roomApi';
import { normalizeRoomCode } from '../game/roomCode';
import { getActiveBackendMode, setForceLocalMode } from '../firebase';

const LAST_JOIN_KEY = 'el_encargo_last_join_v1';

export const JoinView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [backendMode, setBackendMode] = useState(() => getActiveBackendMode());

  useEffect(() => {
    setBackendMode(getActiveBackendMode());
    try {
      const saved = localStorage.getItem(LAST_JOIN_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!initialCode && parsed.code) setCode(parsed.code);
        if (parsed.name) setName(parsed.name);
      }
    } catch {
      // Ignore
    }
  }, [initialCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanCode = normalizeRoomCode(code);
    if (cleanCode.length < 4) {
      setError('Ingresa un código de sala válido (4 a 6 caracteres).');
      return;
    }
    if (!name.trim()) {
      setError('Ingresa tu nombre o apodo para entrar como Lead ID.');
      return;
    }

    setSubmitting(true);
    try {
      const joined = await joinRoom(cleanCode, name.trim());
      localStorage.setItem(
        LAST_JOIN_KEY,
        JSON.stringify({ code: joined.code, name: joined.player.name })
      );
      navigate(`/play/${joined.code}`);
    } catch (err: any) {
      setError(err?.message || 'No fue posible unirse a la sala.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container-narrow">
      <div
        className="surface-card"
        style={{
          borderTop: '3px solid var(--accent-gold)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.35rem',
        }}
      >
        <div>
          <span className="kicker">Firma de Consultoría Instruccional</span>
          <h1 style={{ fontSize: '1.85rem', marginTop: '0.25rem' }}>
            El Encargo: Decisiones de Arquitectura ID
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.45rem', fontSize: '0.95rem' }}>
            Asume el rol de <strong>Lead Instructional Designer</strong>. En cada ronda recibirás el
            encargo real de un cliente con síntomas operativos y restricciones críticas: diagnostica el
            caso usando el Vademécum y prescribe el modelo adecuado antes del cierre.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="field-group">
            <label htmlFor="join-room-code" className="field-label">
              Código de Sala (proyectado por el docente)
            </label>
            <input
              id="join-room-code"
              type="text"
              className="text-input mono-num"
              placeholder="Ej. K7M4X"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{
                fontSize: '1.35rem',
                letterSpacing: '0.14em',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="join-player-name" className="field-label">
              Tu Nombre o Apodo
            </label>
            <input
              id="join-player-name"
              type="text"
              className="text-input"
              placeholder="Ej. Camila R."
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.14)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                color: '#fca5a5',
                fontSize: '0.88rem',
              }}
            >
              {error}
            </div>
          )}

          <button
            id="join-submit-btn"
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={submitting}
          >
            {submitting ? 'Conectando a la sala...' : 'Entrar a la sala de consultoría'}
          </button>
        </form>
      </div>
    </main>
  );
};
