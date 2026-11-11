import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, connectAuthEmulator, Auth } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, Database } from 'firebase/database';

export interface FirebaseRuntimeConfig {
  apiKey: string;
  authDomain?: string;
  databaseURL: string;
  projectId: string;
  appId?: string;
}

const FORCE_LOCAL_KEY = 'el_encargo_force_local_v1';

// Lee exclusivamente las variables de entorno inyectadas en el build (GitHub Actions / .env.local)
const ENV_CONFIG: Partial<FirebaseRuntimeConfig> = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export function isEmulatorRequested(): boolean {
  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') return true;
  if (typeof window !== 'undefined') {
    const search = window.location.search || window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(search);
    if (params.get('emulator') === '1') return true;
  }
  return false;
}

export function isForceLocalRequested(): boolean {
  if (typeof window === 'undefined') return false;
  const search = window.location.search || window.location.hash.split('?')[1] || '';
  const params = new URLSearchParams(search);
  if (params.get('local') === '1') {
    localStorage.setItem(FORCE_LOCAL_KEY, '1');
    return true;
  }
  if (params.get('local') === '0') {
    localStorage.removeItem(FORCE_LOCAL_KEY);
    return false;
  }
  return localStorage.getItem(FORCE_LOCAL_KEY) === '1';
}

export function setForceLocalMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) {
    localStorage.setItem(FORCE_LOCAL_KEY, '1');
  } else {
    localStorage.removeItem(FORCE_LOCAL_KEY);
  }
}

export function getEnvFirebaseConfig(): FirebaseRuntimeConfig | null {
  if (ENV_CONFIG.apiKey && ENV_CONFIG.databaseURL && ENV_CONFIG.projectId) {
    return ENV_CONFIG as FirebaseRuntimeConfig;
  }
  return null;
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Database | null = null;
let emulatorConnected = false;

export type BackendMode = 'firebase-cloud' | 'firebase-emulator' | 'local-broadcast';

export function getActiveBackendMode(): BackendMode {
  if (isForceLocalRequested()) return 'local-broadcast';
  if (isEmulatorRequested()) return 'firebase-emulator';
  if (getEnvFirebaseConfig()) return 'firebase-cloud';
  return 'local-broadcast';
}

export function getFirebaseHandles(): {
  mode: BackendMode;
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Database | null;
} {
  const mode = getActiveBackendMode();
  if (mode === 'local-broadcast') {
    return { mode, app: null, auth: null, db: null };
  }

  if (!cachedApp) {
    const existing = getApps();
    if (existing.length > 0) {
      cachedApp = existing[0];
    } else if (mode === 'firebase-emulator') {
      cachedApp = initializeApp({
        apiKey: 'demo-api-key',
        authDomain: 'demo-el-encargo.firebaseapp.com',
        databaseURL: 'http://127.0.0.1:9000?ns=demo-el-encargo',
        projectId: 'demo-el-encargo',
      });
    } else {
      const cfg = getEnvFirebaseConfig()!;
      cachedApp = initializeApp(cfg);
    }

    cachedAuth = getAuth(cachedApp);
    cachedDb = getDatabase(cachedApp);

    if (mode === 'firebase-emulator' && !emulatorConnected) {
      connectAuthEmulator(cachedAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectDatabaseEmulator(cachedDb, '127.0.0.1', 9000);
      emulatorConnected = true;
    }
  }

  return { mode, app: cachedApp, auth: cachedAuth, db: cachedDb };
}

export async function ensureParticipantIdentity(): Promise<{ uid: string; mode: BackendMode }> {
  const { mode, auth } = getFirebaseHandles();
  if (mode !== 'local-broadcast' && auth) {
    if (auth.currentUser) {
      return { uid: auth.currentUser.uid, mode };
    }
    try {
      const cred = await signInAnonymously(auth);
      return { uid: cred.user.uid, mode };
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/configuration-not-found' ||
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation'
      ) {
        throw new Error(
          'Falta habilitar "Acceso Anónimo" en Firebase Console: entra a Authentication → Sign-in method (Método de acceso) → Anónimo → Habilitar y Guardar.'
        );
      }
      throw err;
    }
  }

  // Modo ensayo local (persiste por pestaña o sesión en localStorage)
  const localUidKey = 'el_encargo_local_uid_v1';
  let uid = localStorage.getItem(localUidKey);
  if (!uid) {
    uid = 'usr_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(localUidKey, uid);
  }
  return { uid, mode: 'local-broadcast' };
}
