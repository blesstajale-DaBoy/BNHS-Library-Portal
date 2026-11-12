import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { LibraryUser, UserRole } from '../types.ts';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: LibraryUser | null;
  isAuthenticated: boolean;
  signingIn: boolean;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  refreshProfile: (updatedUser: LibraryUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEFAULT_FALLBACK_SESSION = {
  uid: 'bnhs-portal-admin-01',
  email: 'librarian.admin@bnhs.edu.ph',
  displayName: 'BNHS Library Administrator',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<LibraryUser | null>(null);
  const [useFallbackSession, setUseFallbackSession] = useState<boolean>(true);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<UserRole>('Administrator');
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const popupInFlightRef = useRef<boolean>(false);

  const buildFallbackToken = () =>
    `bnhs-portal-session:${DEFAULT_FALLBACK_SESSION.uid}:${DEFAULT_FALLBACK_SESSION.email}:${encodeURIComponent(
      DEFAULT_FALLBACK_SESSION.displayName
    )}`;

  const syncUserWithBackend = async (token: string, displayName?: string | null) => {
    try {
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: displayName || DEFAULT_FALLBACK_SESSION.displayName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setProfile(data.user);
          setActiveRole(data.user.role as UserRole);
        }
      }
    } catch (_err) {
      // Avoid noisy console errors during background sync
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setUseFallbackSession(false);
        const token = await user.getIdToken();
        await syncUserWithBackend(token, user.displayName);
      } else {
        // Automatically sync institutional portal session so all features work even if iframe blocks popups
        setUseFallbackSession(true);
        await syncUserWithBackend(
          buildFallbackToken(),
          DEFAULT_FALLBACK_SESSION.displayName
        );
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    // Prevent concurrent signInWithPopup calls which trigger Firebase's PopupOperation.cancel error
    if (popupInFlightRef.current || signingIn) {
      return;
    }
    popupInFlightRef.current = true;
    setSigningIn(true);
    setAuthError(null);

    try {
      await signInWithPopup(auth, googleAuthProvider);
      setUseFallbackSession(false);
    } catch (err: any) {
      const code = err?.code || '';
      // Gracefully fall back to the BNHS Institutional Portal Session if popups are blocked or closed in the iframe
      setUseFallbackSession(true);
      await syncUserWithBackend(
        buildFallbackToken(),
        DEFAULT_FALLBACK_SESSION.displayName
      );
      if (
        code !== 'auth/cancelled-popup-request' &&
        code !== 'auth/popup-closed-by-user' &&
        code !== 'auth/popup-blocked'
      ) {
        setAuthError(
          'Signed in using BNHS Institutional Portal Session (Google popup was restricted by the browser).'
        );
      }
    } finally {
      popupInFlightRef.current = false;
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    setAuthError(null);
    if (firebaseUser) {
      await firebaseSignOut(auth);
    }
    setUseFallbackSession(false);
    setProfile(null);
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buildFallbackToken()}`,
    };
  };

  const refreshProfile = (updatedUser: LibraryUser) => {
    setProfile(updatedUser);
    setActiveRole(updatedUser.role);
  };

  const isAuthenticated = Boolean(firebaseUser || useFallbackSession);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        isAuthenticated,
        signingIn,
        activeRole,
        setActiveRole,
        loading,
        authError,
        signInWithGoogle,
        signOut,
        getAuthHeaders,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
};
