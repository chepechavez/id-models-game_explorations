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

const STORAGE_KEY = 'el_encargo_firebase_config_v1';

// Si el docente desea dejar sus credenciales fijas en el código, puede pegarlas aquí:
const HARDCODED_CONFIG: Partial<FirebaseRuntimeConfig> = {
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

export function getStoredFirebaseConfig(): FirebaseRuntimeConfig | null {
  if (typeof window === 'undefined') return null;

  // 1. Revisar si viene codificado en el enlace de invitación (?fb=base64)
  try {
    const hashQuery = window.location.hash.includes('?')
      ? window.location.hash.split('?')[1]
      : window.location.search.slice(1);
    const params = new URLSearchParams(hashQuery);
    const encoded = params.get('fb');
    if (encoded) {
      const parsed = JSON.parse(atob(encoded));
      if (parsed && parsed.apiKey && parsed.databaseURL && parsed.projectId) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch {
    // Ignorar parámetro malformado
  }

  // 2. Revisar localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.apiKey && parsed.databaseURL && parsed.projectId) {
        return parsed;
      }
    }
  } catch {
    // Ignorar
  }

  // 3. Revisar variables de entorno / config fija
  if (
    HARDCODED_CONFIG.apiKey &&
    HARDCODED_CONFIG.databaseURL &&
    HARDCODED_CONFIG.projectId
  ) {
    return HARDCODED_CONFIG as FirebaseRuntimeConfig;
  }

  return null;
}

export function saveFirebaseConfigToStorage(config: FirebaseRuntimeConfig | null): void {
  if (typeof window === 'undefined') return;
  if (!config) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}

export function encodeFirebaseConfigParam(config: FirebaseRuntimeConfig | null): string {
  if (!config) return '';
  try {
    return btoa(
      JSON.stringify({
        apiKey: config.apiKey,
        databaseURL: config.databaseURL,
        projectId: config.projectId,
        authDomain: config.authDomain,
      })
    );
  } catch {
    return '';
  }
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Database | null = null;
let emulatorConnected = false;

export type BackendMode = 'firebase-cloud' | 'firebase-emulator' | 'local-broadcast';

export function getActiveBackendMode(): BackendMode {
  if (isEmulatorRequested()) return 'firebase-emulator';
  if (getStoredFirebaseConfig()) return 'firebase-cloud';
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
      const cfg = getStoredFirebaseConfig()!;
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
    const cred = await signInAnonymously(auth);
    return { uid: cred.user.uid, mode };
  }

  // Modo ensayo local (persiste por pestaña o sesión en localStorage/sessionStorage)
  const localUidKey = 'el_encargo_local_uid_v1';
  let uid = localStorage.getItem(localUidKey);
  if (!uid) {
    uid = 'usr_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(localUidKey, uid);
  }
  return { uid, mode: 'local-broadcast' };
}
