import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { LibraryUser, UserRole } from '../types.ts';
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
  signInWithPortalAccount: (account: {
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
      if (saved) return JSON.parse(saved) as LibraryUser;
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
        const mappedUser: LibraryUser = {
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
    fullName: string;
    email: string;
    role: UserRole;
    idNumber: string;
    gradeOrDepartment: string;
  }) => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const customUser: LibraryUser = {
        id: Date.now(),
        uid: `bnhs-google-${account.email.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        email: account.email.trim(),
        fullName: account.fullName.trim(),
        role: account.role,
        idNumber: account.idNumber.trim() || 'ADM-2026-0001',
        gradeOrDepartment:
          account.gradeOrDepartment.trim() || 'BNHS Library Portal',
        status: 'Active',
      };
      setProfile(customUser);
      setActiveRole(customUser.role);
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

  const signInWithGoogle = async () => {
    // Open the persistent in-portal Google Sign-In modal so it never flashes and disappears in published live/iframe domains
    openSignInModal();

    if (popupInFlightRef.current || signingIn) {
      return;
    }
    popupInFlightRef.current = true;
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (cred?.user) {
        setIsSignedInAccount(true);
        setIsSignInModalOpen(false);
      }
    } catch {
      // Keep the in-portal Google Sign-In modal open so the user can sign in with one click even when browser popups or unauthorized preview domains block Firebase popup
    } finally {
      popupInFlightRef.current = false;
    }
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
    setActiveRole(updatedUser.role);
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
