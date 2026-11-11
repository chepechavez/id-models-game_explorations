import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import modelsData from '../content/models.json';
import casesData from '../content/cases.json';
import { CaseItem, ModelGuideItem } from './types';
import { JoinView } from './views/JoinView';
import { PlayView } from './views/PlayView';
import { HostSetupView } from './views/HostSetupView';
import { HostPanelView } from './views/HostPanelView';
import { ScreenView } from './views/ScreenView';
import { GuideView } from './views/GuideView';

const models = modelsData as unknown as ModelGuideItem[];
const cases = casesData as unknown as CaseItem[];

const TopNavigation: React.FC = () => {
  const location = useLocation();
  const isProjection = location.pathname.startsWith('/screen/');

  return (
    <nav className="topbar" aria-label="Navegación principal">
      <Link to="/" className="brand-lockup">
        <span className="brand-mark">ID</span>
        <div>
          <span className="brand-title">EL ENCARGO</span>
          <span className="brand-subtitle">
            Simulador de Decisiones en Diseño Instruccional
          </span>
        </div>
      </Link>

      {!isProjection && (
        <div className="topbar-actions">
          <Link to="/" className="btn btn-sm">
            Ingresar a Sala
          </Link>
          <Link to="/guia" className="btn btn-sm">
            Vademécum (6 Modelos)
          </Link>
          <Link to="/host" className="btn btn-sm btn-primary">
            Consola Docente
          </Link>
        </div>
      )}
    </nav>
  );
};

const StandaloneGuidePage: React.FC = () => (
  <main className="container">
    <GuideView models={models} />
  </main>
);

export const App: React.FC = () => {
  return (
    <HashRouter>
      <TopNavigation />
      <Routes>
        <Route path="/" element={<JoinView />} />
        <Route path="/play/:code" element={<PlayView cases={cases} models={models} />} />
        <Route path="/host" element={<HostSetupView cases={cases} />} />
        <Route path="/host/:code" element={<HostPanelView cases={cases} models={models} />} />
        <Route path="/screen/:code" element={<ScreenView cases={cases} models={models} />} />
        <Route path="/guia" element={<StandaloneGuidePage />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
