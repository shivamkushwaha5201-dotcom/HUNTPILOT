import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';
import {
  doc,
  Firestore,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore';
import rawFirebaseConfig from '../firebase-applet-config.json';

export interface FirebaseConfigStatus {
  configured: boolean;
  error: string | null;
  projectId: string | null;
}

export function validateFirebaseConfig(cfg: Record<string, unknown> | null | undefined): FirebaseConfigStatus {
  if (!cfg || typeof cfg !== 'object') {
    return {
      configured: false,
      error: 'Missing firebase-applet-config.json configuration.',
      projectId: null,
    };
  }

  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
  const missing: string[] = [];
  for (const key of requiredKeys) {
    const val = typeof cfg[key] === 'string' ? cfg[key].trim() : '';
    if (!val || val === 'remixed-project-id' || val.startsWith('YOUR_')) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    return {
      configured: false,
      error: `Firebase configuration is incomplete or contains placeholders (${missing.join(', ')}). Check firebase-applet-config.json.`,
      projectId: null,
    };
  }

  return {
    configured: true,
    error: null,
    projectId: String(cfg.projectId),
  };
}

export const firebaseConfigStatus: FirebaseConfigStatus = validateFirebaseConfig(
  rawFirebaseConfig as Record<string, unknown>
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let initFailure: string | null = firebaseConfigStatus.error;

function initFirestoreClient(firebaseApp: FirebaseApp, databaseId?: string): Firestore {
  const dbId = databaseId && databaseId.trim() ? databaseId.trim() : undefined;
  if (typeof window !== 'undefined') {
    try {
      return initializeFirestore(
        firebaseApp,
        { experimentalForceLongPolling: true },
        dbId
      );
    } catch {
      return dbId ? getFirestore(firebaseApp, dbId) : getFirestore(firebaseApp);
    }
  }
  return dbId ? getFirestore(firebaseApp, dbId) : getFirestore(firebaseApp);
}

if (firebaseConfigStatus.configured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(rawFirebaseConfig);
    db = initFirestoreClient(app, rawFirebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
    if (typeof window !== 'undefined') {
      void setPersistence(auth, browserLocalPersistence).catch(() => {
        // Fallback to Firebase SDK default persistence if browser storage is restricted
      });
    }
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    initFailure = err instanceof Error ? err.message : 'Failed to initialize Firebase SDK.';
  }
}

export const resolvedFirebaseStatus: FirebaseConfigStatus = initFailure
  ? { configured: false, error: initFailure, projectId: firebaseConfigStatus.projectId }
  : firebaseConfigStatus;

export { app, db, auth, googleProvider };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth?.currentUser ?? null;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (!db || !resolvedFirebaseStatus.configured) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  void testConnection();
}
