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
  reloadUser: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateUserProfile: (updates: {
    displayName: string;
    role?: string;
    company?: string;
    experienceLevel: ExperienceLevel;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication -> Sign-in method -> Email/Password). Please use Continue with Google or enable Email/Password in Firebase Console.';
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
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed before completing authentication.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [, setAuthVersion] = useState(0);

  useEffect(() => {
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
    if (!authReady || !user) {
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    let cancelled = false;

    async function ensureUserProfile() {
      if (!user || !user.emailVerified) return;
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists() && !cancelled) {
          const payload: Record<string, unknown> = {
            uid: user.uid,
            displayName: clampString(user.displayName || user.email?.split('@')[0] || 'Founder', LIMITS.displayName) || 'Founder',
            email: clampString(user.email || 'founder@example.com', LIMITS.email),
            experienceLevel: 'beginner',
            planTier: 'free',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (user.photoURL) {
            payload.photoURL = clampString(user.photoURL, LIMITS.photoURL);
          }
          await setDoc(userRef, payload);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    }

    ensureUserProfile();

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
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }
    );

    return () => {
      cancelled = true;
      unsubProfile();
    };
  }, [authReady, user]);

  const clearAuthError = () => setAuthError(null);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
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
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const cleanName = clampString(name, LIMITS.displayName) || 'Founder';
      await updateProfile(cred.user, { displayName: cleanName });
      await sendEmailVerification(cred.user);
      // Store preferred experience level temporarily in memory on reload once verified
      sessionStorage.setItem('hp_pending_exp', experienceLevel);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resendVerification = async () => {
    if (!auth.currentUser) return;
    setAuthError(null);
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const reloadUser = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser(auth.currentUser);
    setAuthVersion((v) => v + 1);
    if (auth.currentUser.emailVerified) {
      const pendingExp = sessionStorage.getItem('hp_pending_exp');
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: auth.currentUser.uid,
          displayName: clampString(auth.currentUser.displayName || 'Founder', LIMITS.displayName),
          email: clampString(auth.currentUser.email || '', LIMITS.email),
          experienceLevel: pendingExp === 'experienced' ? 'experienced' : 'beginner',
          planTier: 'free',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      sessionStorage.removeItem('hp_pending_exp');
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  const updateUserProfile = async (updates: {
    displayName: string;
    role?: string;
    company?: string;
    experienceLevel: ExperienceLevel;
  }) => {
    if (!user) throw new Error('Not signed in.');
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
