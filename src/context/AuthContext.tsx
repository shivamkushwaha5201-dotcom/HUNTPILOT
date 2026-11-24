import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  resolvedFirebaseStatus,
} from '../firebase';
import { ExperienceLevel, UserProfile } from '../types';
import { clampString, LIMITS } from '../utils/validation';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    name: string,
    email: string,
    password: string,
    experienceLevel: ExperienceLevel
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
  updateUserProfile: (updates: {
    displayName: string;
    role?: string;
    company?: string;
    experienceLevel: ExperienceLevel;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/unauthorized-domain': {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      return `Domain "${host}" is not authorized for Firebase sign-in. Add "${host}" under Firebase Console -> Authentication -> Settings -> Authorized domains.`;
    }
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'This sign-in method is not enabled in Firebase Console (Authentication -> Sign-in method). Enable Email/Password and/or Google sign-in in your Firebase project.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in window was closed before completing authentication.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase Authentication. Check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(!resolvedFirebaseStatus.configured);
  const [authError, setAuthError] = useState<string | null>(resolvedFirebaseStatus.error);
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    if (!auth || !resolvedFirebaseStatus.configured) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || !db) {
      if (!user || !user.emailVerified) {
        setProfile(null);
      }
      return;
    }

    const firestore = db;
    const verifiedUser = user;
    const userRef = doc(firestore, 'users', verifiedUser.uid);
    let cancelled = false;

    async function ensureUserProfile() {
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists() && !cancelled) {
          const pendingExp =
            typeof window !== 'undefined' ? sessionStorage.getItem('hp_pending_exp') : null;
          const payload: Record<string, unknown> = {
            uid: verifiedUser.uid,
            displayName:
              clampString(
                verifiedUser.displayName || verifiedUser.email?.split('@')[0] || 'Founder',
                LIMITS.displayName
              ) || 'Founder',
            email: clampString(verifiedUser.email || '', LIMITS.email),
            experienceLevel: pendingExp === 'experienced' ? 'experienced' : 'beginner',
            planTier: 'free',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (verifiedUser.photoURL) {
            payload.photoURL = clampString(verifiedUser.photoURL, LIMITS.photoURL);
          }
          await setDoc(userRef, payload);
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('hp_pending_exp');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setAuthError('Unable to initialize your founder profile in Firestore. Please refresh and try again.');
        }
        console.error('ensureUserProfile error:', err);
      }
    }

    void ensureUserProfile();

    const unsubProfile = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile(null);
        }
      },
      (err) => {
        if (!cancelled) {
          setAuthError('Unable to sync your founder profile from Firestore.');
        }
        console.error('Profile snapshot error:', err);
      }
    );

    return () => {
      cancelled = true;
      unsubProfile();
    };
  }, [authReady, user, user?.emailVerified, authVersion]);

  const clearAuthError = () => setAuthError(null);

  const requireConfiguredAuth = () => {
    if (!auth || !resolvedFirebaseStatus.configured) {
      const msg = resolvedFirebaseStatus.error || 'Firebase Authentication is not configured.';
      setAuthError(msg);
      throw new Error(msg);
    }
    return auth;
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    const firebaseAuth = requireConfiguredAuth();
    if (!googleProvider) throw new Error('Google sign-in provider is unavailable.');
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    const firebaseAuth = requireConfiguredAuth();
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithEmail = async (
    name: string,
    email: string,
    password: string,
    experienceLevel: ExperienceLevel
  ) => {
    setAuthError(null);
    const firebaseAuth = requireConfiguredAuth();
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('hp_pending_exp', experienceLevel);
      }
      const cleanName = clampString(name, LIMITS.displayName) || 'Founder';
      await updateProfile(cred.user, { displayName: cleanName });
      await sendEmailVerification(cred.user);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    const firebaseAuth = requireConfiguredAuth();
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resendVerification = async () => {
    const firebaseAuth = requireConfiguredAuth();
    if (!firebaseAuth.currentUser) return;
    setAuthError(null);
    try {
      await sendEmailVerification(firebaseAuth.currentUser);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const reloadUser = async (): Promise<boolean> => {
    if (!auth?.currentUser) return false;
    setAuthError(null);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        await auth.currentUser.getIdToken(true);
      }
      setUser(auth.currentUser);
      setAuthVersion((v) => v + 1);
      return Boolean(auth.currentUser.emailVerified);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    if (!auth) return;
    await signOut(auth);
  };

  const updateUserProfile = async (updates: {
    displayName: string;
    role?: string;
    company?: string;
    experienceLevel: ExperienceLevel;
  }) => {
    if (!user || !user.emailVerified || !db) throw new Error('Verified signed-in user required.');
    const userRef = doc(db, 'users', user.uid);
    const payload: Record<string, unknown> = {
      displayName: clampString(updates.displayName, LIMITS.displayName) || 'Founder',
      experienceLevel: updates.experienceLevel,
      updatedAt: serverTimestamp(),
    };
    if (updates.role !== undefined) {
      payload.role = clampString(updates.role, LIMITS.role);
    }
    if (updates.company !== undefined) {
      payload.company = clampString(updates.company, LIMITS.company);
    }
    try {
      await updateDoc(userRef, payload);
      await updateProfile(user, { displayName: String(payload.displayName) });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authReady,
        authError,
        clearAuthError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        resendVerification,
        reloadUser,
        signOutUser,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
