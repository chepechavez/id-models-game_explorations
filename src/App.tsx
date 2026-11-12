import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import modelsData from '../content/models.json';
import casesData from '../content/cases.json';
import { CaseItem, ModelGuideItem } from './types';
import { JoinView } from './views/JoinView';
import { PlayView } from './views/PlayView';
import { HostSetupView } from './views/HostSetupView';
import { HostPanelView } from './views/HostPanelView';
import { ScreenView } from './views/ScreenView';
import { GuideView } from './views/GuideView';
import { soundEffects } from './game/soundEffects';

const models = modelsData as unknown as ModelGuideItem[];
const cases = casesData as unknown as CaseItem[];

interface TopNavigationProps {
  onOpenGuide: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const TopNavigation: React.FC<TopNavigationProps> = ({
  onOpenGuide,
  soundEnabled,
  onToggleSound,
}) => {
  const location = useLocation();
  const isProjection = location.pathname.startsWith('/screen/');
  const isHome = location.pathname === '/' || location.pathname === '';
  const isPlay = location.pathname.startsWith('/play/');
  const isHost = location.pathname.startsWith('/host');

  return (
    <nav className="topbar" aria-label="Navegación principal">
      <Link to="/" className="brand-lockup">
        <span className="brand-mark">ID</span>
        <div>
          <span className="brand-title">EL ENCARGO</span>
          <span className="brand-subtitle">
            Simulador de decisiones en diseño instruccional
          </span>
        </div>
      </Link>

      {!isProjection && (
        <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Botón de sonido accesible */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={onToggleSound}
            title={soundEnabled ? 'Silenciar efectos de sonido' : 'Activar efectos de sonido'}
            style={{ fontSize: '0.84rem', padding: '0.35rem 0.65rem' }}
          >
            {soundEnabled ? '🔊 Sonido: ON' : '🔇 Silencio'}
          </button>

          {/* Vademécum interactivo (abre modal sin sacar al usuario de la pantalla) */}
          <button
            type="button"
            id="topbar-vademecum-btn"
            className="btn btn-sm"
            onClick={onOpenGuide}
          >
            Vademécum (6 modelos)
          </button>

          {/* Botón Ingresar a Sala: solo visible cuando NO se está en la página de inicio */}
          {!isHome && (
            <Link to="/" className="btn btn-sm">
              {isPlay ? 'Cambiar de sala' : 'Ingresar a sala'}
            </Link>
          )}

          {/* Consola Docente: visible salvo que ya esté en consola */}
          {!isHost && (
            <Link to="/host" className="btn btn-sm btn-primary">
              Consola docente
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

const StandaloneGuidePage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <main className="container" style={{ paddingTop: '1rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => navigate(-1)}
        >
          ← Volver a la pantalla anterior
        </button>
        <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
          Presiona «Volver» para regresar directamente a tu partida o consola.
        </span>
      </div>
      <GuideView models={models} />
    </main>
  );
};

export const AppContent: React.FC = () => {
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => soundEffects.isEnabled());

  const handleToggleSound = () => {
    const next = soundEffects.toggle();
    setSoundEnabled(next);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && guideModalOpen) {
        setGuideModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guideModalOpen]);

  return (
    <>
      <TopNavigation
        onOpenGuide={() => setGuideModalOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      <Routes>
        <Route path="/" element={<JoinView />} />
        <Route path="/play/:code" element={<PlayView cases={cases} models={models} />} />
        <Route path="/host" element={<HostSetupView cases={cases} />} />
        <Route path="/host/:code" element={<HostPanelView cases={cases} models={models} />} />
        <Route path="/screen/:code" element={<ScreenView cases={cases} models={models} />} />
        <Route path="/guia" element={<StandaloneGuidePage />} />
      </Routes>

      {/* Modal flotante del Vademécum que no interrumpe el juego */}
      {guideModalOpen && (
        <div
          className="vademecum-modal-overlay"
          onClick={() => setGuideModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Vademécum de modelos ID"
        >
          <div
            className="vademecum-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vademecum-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-gold">Vademécum ID</span>
                <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                  Consulta clínica de modelos
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setGuideModalOpen(false)}
                title="Cerrar vademécum y volver al caso"
              >
                ✕ Cerrar y volver al caso (Esc)
              </button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <GuideView models={models} compact={true} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
