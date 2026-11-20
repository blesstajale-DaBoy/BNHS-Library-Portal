import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { LibraryUser, UserRole, normalizeUserRole } from '../types.ts';
import { INITIAL_USERS } from '../data/bnhsInitialData.ts';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: LibraryUser | null;
  isAuthenticated: boolean;
  isSignedInAccount: boolean;
  signingIn: boolean;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  loading: boolean;
  authError: string | null;
  isSignInModalOpen: boolean;
  openSignInModal: () => void;
  closeSignInModal: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithGooglePopup: () => Promise<boolean>;
  signInWithPortalAccount: (account: {
    id?: number;
    uid?: string;
    fullName: string;
    email: string;
    role: UserRole;
    idNumber: string;
    gradeOrDepartment: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  refreshProfile: (updatedUser: LibraryUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEFAULT_FALLBACK_SESSION: LibraryUser = INITIAL_USERS[0];
const SESSION_STORAGE_KEY = 'bnhs_active_user_session_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<LibraryUser | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as LibraryUser;
        return { ...parsed, role: normalizeUserRole(parsed.role) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_FALLBACK_SESSION;
  });
  const [isSignedInAccount, setIsSignedInAccount] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(SESSION_STORAGE_KEY));
    } catch {
      return false;
    }
  });
  const [isSignInModalOpen, setIsSignInModalOpen] = useState<boolean>(false);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<UserRole>('Administrator');
  const [loading, setLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const popupInFlightRef = useRef<boolean>(false);

  const buildSessionToken = (userObj: LibraryUser) =>
    `bnhs-portal-session:${userObj.uid}:${userObj.email}:${encodeURIComponent(
      userObj.fullName
    )}`;

  const syncUserWithBackend = async (
    token: string,
    fallbackUser: LibraryUser
  ) => {
    try {
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: fallbackUser.fullName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setProfile(data.user);
          return;
        }
      }
    } catch {
      // Fallback to local profile when offline or in static preview
    }
    setProfile(fallbackUser);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setIsSignedInAccount(true);
        let savedProfile: LibraryUser | null = null;
        try {
          const raw = localStorage.getItem(SESSION_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as LibraryUser;
            if (parsed.uid === user.uid) {
              savedProfile = parsed;
            }
          }
        } catch {
          // ignore
        }
        const mappedUser: LibraryUser = savedProfile || {
          id: 1,
          uid: user.uid,
          email: user.email || 'blesstajale@gmail.com',
          fullName: user.displayName || 'Bless T. Tajale',
          role: 'Administrator',
          idNumber: 'ADM-2026-0001',
          gradeOrDepartment: 'Portal Developer & System Administration',
          status: 'Active',
        };
        try {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(mappedUser));
        } catch {
          // ignore
        }
        const token = await user.getIdToken();
        await syncUserWithBackend(token, mappedUser);
      } else {
        const currentProfile = profile || DEFAULT_FALLBACK_SESSION;
        await syncUserWithBackend(
          buildSessionToken(currentProfile),
          currentProfile
        );
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openSignInModal = () => {
    setAuthError(null);
    setIsSignInModalOpen(true);
  };

  const closeSignInModal = () => {
    setIsSignInModalOpen(false);
  };

  const signInWithPortalAccount = async (account: {
    id?: number;
    uid?: string;
    fullName: string;
    email: string;
    role: UserRole;
    idNumber: string;
    gradeOrDepartment: string;
  }) => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const normalizedRole = normalizeUserRole(account.role);
      const customUser: LibraryUser = {
        id: account.id || Date.now(),
        uid:
          account.uid ||
          `bnhs-member-${account.email.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        email: account.email.trim(),
        fullName: account.fullName.trim(),
        role: normalizedRole,
        idNumber: account.idNumber.trim() || 'ADM-2026-0001',
        gradeOrDepartment:
          account.gradeOrDepartment.trim() || 'BNHS Library Portal',
        status: 'Active',
      };
      setProfile(customUser);
      setActiveRole(normalizedRole);
      setIsSignedInAccount(true);
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(customUser));
      } catch {
        // ignore
      }
      await syncUserWithBackend(buildSessionToken(customUser), customUser);
      setIsSignInModalOpen(false);
    } finally {
      setSigningIn(false);
    }
  };

  const signInWithGooglePopup = async (): Promise<boolean> => {
    if (popupInFlightRef.current) {
      return false;
    }
    popupInFlightRef.current = true;
    setSigningIn(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (cred?.user) {
        setFirebaseUser(cred.user);
        setIsSignedInAccount(true);
        setIsSignInModalOpen(false);
        return true;
      }
      return false;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-blocked') {
        setAuthError(
          'Browser blocked the Google sign-in popup. Please allow popups for this site and click "Sign In with Google Account" again.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          'This domain is not yet allowlisted in Firebase Auth. Open Firebase Console -> Authentication -> Settings -> Authorized domains to enable Google Sign-In here.'
        );
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setAuthError(err?.message || 'Google Sign-In failed. Please try again.');
      }
      return false;
    } finally {
      popupInFlightRef.current = false;
      setSigningIn(false);
    }
  };

  const signInWithGoogle = async () => {
    // Open the Interactive Fluorescent Bulb Login Modal cleanly without interrupting with an unsolicited popup
    openSignInModal();
  };

  const signOut = async () => {
    setAuthError(null);
    try {
      if (firebaseUser) {
        await firebaseSignOut(auth);
      }
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setIsSignedInAccount(false);
    setProfile(DEFAULT_FALLBACK_SESSION);
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
    }
    const activeUser = profile || DEFAULT_FALLBACK_SESSION;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buildSessionToken(activeUser)}`,
    };
  };

  const refreshProfile = (updatedUser: LibraryUser) => {
    setProfile(updatedUser);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedUser));
    } catch {
      // ignore
    }
  };

  const isAuthenticated = true;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        isAuthenticated,
        isSignedInAccount,
        signingIn,
        activeRole,
        setActiveRole,
        loading,
        authError,
        isSignInModalOpen,
        openSignInModal,
        closeSignInModal,
        signInWithGoogle,
        signInWithGooglePopup,
        signInWithPortalAccount,
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
