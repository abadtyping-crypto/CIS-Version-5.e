import { useState } from 'react';
import { fetchTenantUsersMap, upsertTenantUserMap } from '../lib/backendStore';
import { sendWhatsAppOTP } from '../lib/whatsappAuth';
import { auth } from '../lib/firebaseConfig';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { AuthContext } from './AuthContextValue';

const AUTH_STORAGE_KEY = 'acis_auth_session_v1';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = new Set(['Super Admin', 'Admin', 'Manager', 'Accountant', 'Staff']);
const ALLOWED_STATUS = new Set(['Active', 'Frozen', 'Invited']);

const readSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.user || !parsed.tenantId) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeSession = (session) => {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(readSession);

  const toValidatedUser = (rawUser) => {
    const displayName = String(rawUser?.displayName || '').trim();
    const email = String(rawUser?.email || '').trim().toLowerCase();
    const role = String(rawUser?.role || '').trim();
    const status = String(rawUser?.status || '').trim();

    if (!displayName) {
      return { ok: false, error: 'Invalid user profile: displayName is required.' };
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      return { ok: false, error: 'Invalid user profile: valid email is required.' };
    }
    if (!role || !ALLOWED_ROLES.has(role)) {
      return { ok: false, error: 'Invalid user profile: role is missing or not allowed.' };
    }
    if (!status || !ALLOWED_STATUS.has(status)) {
      return { ok: false, error: 'Invalid user profile: status is missing or not allowed.' };
    }
    if (status === 'Frozen') {
      return { ok: false, error: 'This user is frozen. Contact admin.' };
    }

    return {
      ok: true,
      user: {
        uid: String(rawUser?.uid || '').trim(),
        displayName,
        email,
        role,
        status,
        photoURL: rawUser?.photoURL || '/avatar.png',
      },
    };
  };

  const loginWithUid = async (tenantId, inputId, password) => {
    const usersRes = await fetchTenantUsersMap(tenantId);
    if (!usersRes.ok) return { ok: false, error: 'Failed to access tenant users.' };

    const searchStr = String(inputId).toLowerCase();
    const matchedUser = usersRes.rows.find(u =>
      String(u.uid).toLowerCase() === searchStr ||
      String(u.email || '').toLowerCase() === searchStr ||
      String(u.displayName || '').toLowerCase() === searchStr
    );

    if (!matchedUser) return { ok: false, error: 'User not found in this tenant workspace.' };

    const result = { data: matchedUser };
    if (result.data.password) {
      if (!password || password !== result.data.password) {
        return { ok: false, error: 'Incorrect password.' };
      }
    }

    const rawUser = {
      uid: result.data.uid,
      displayName: result.data.displayName || 'User',
      role: result.data.role || 'Staff',
      email: result.data.email || '',
      photoURL: result.data.photoURL || '/avatar.png',
      status: result.data.status || 'Active',
    };

    if (String(rawUser.status).toLowerCase() === 'invited') {
      const activated = {
        ...result.data,
        status: 'Active',
        invitedAcceptedAt: new Date().toISOString(),
      };
      await upsertTenantUserMap(tenantId, rawUser.uid, activated);
      rawUser.status = 'Active';
    }

    const validated = toValidatedUser(rawUser);
    if (!validated.ok) return validated;
    const user = validated.user;

    const nextSession = { tenantId, user };
    setSession(nextSession);
    writeSession(nextSession);
    return { ok: true, user };
  };

  const loginWithGoogle = async (tenantId) => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const googleResult = await signInWithPopup(auth, provider);
      const googleUser = googleResult?.user;
      const googleEmail = String(googleUser?.email || '').trim().toLowerCase();
      const googleUid = String(googleUser?.uid || '').trim();

      if (!googleEmail) {
        await signOut(auth).catch(() => null);
        return { ok: false, error: 'Google account email is required.' };
      }

      const usersRes = await fetchTenantUsersMap(tenantId);
      if (!usersRes.ok) {
        await signOut(auth).catch(() => null);
        return { ok: false, error: 'Failed to access tenant users.' };
      }

      const matchedUser = usersRes.rows.find((u) =>
        String(u.email || '').trim().toLowerCase() === googleEmail ||
        (googleUid && String(u.uid || '').trim() === googleUid),
      );

      if (!matchedUser) {
        await signOut(auth).catch(() => null);
        return { ok: false, error: 'This Google account is not authorized for this tenant workspace.' };
      }

      const rawUser = {
        uid: matchedUser.uid,
        displayName: matchedUser.displayName || googleUser?.displayName || 'User',
        role: matchedUser.role || 'Staff',
        email: matchedUser.email || googleEmail,
        photoURL: matchedUser.photoURL || googleUser?.photoURL || '/avatar.png',
        status: matchedUser.status || 'Active',
      };

      if (String(rawUser.status).toLowerCase() === 'invited') {
        const activated = {
          ...matchedUser,
          status: 'Active',
          invitedAcceptedAt: new Date().toISOString(),
        };
        await upsertTenantUserMap(tenantId, rawUser.uid, activated);
        rawUser.status = 'Active';
      }

      const validated = toValidatedUser(rawUser);
      if (!validated.ok) {
        await signOut(auth).catch(() => null);
        return validated;
      }

      const nextSession = { tenantId, user: validated.user };
      setSession(nextSession);
      writeSession(nextSession);
      return { ok: true, user: validated.user };
    } catch (error) {
      const code = String(error?.code || '');
      const message = String(error?.message || '');
      if (code === 'auth/popup-closed-by-user') {
        return { ok: false, error: 'Google sign-in was canceled.' };
      }
      if (code === 'auth/popup-blocked') {
        return { ok: false, error: 'Popup blocked. Please allow popups and try again.' };
      }
      if (message.toLowerCase().includes('redirect_uri_mismatch')) {
        return {
          ok: false,
          error:
            'Google OAuth redirect mismatch. Add your domain auth handler to OAuth redirect URIs (for example: https://typingapp.abadtyping.com/__/auth/handler).',
        };
      }
      return { ok: false, error: message || 'Google sign-in failed.' };
    }
  };

  const initiateWhatsAppLogin = async (tenantId, phoneNumber, otpCode) => {
    const usersRes = await fetchTenantUsersMap(tenantId);
    if (!usersRes.ok) return { ok: false, error: 'Failed to access tenant users.' };

    const searchStr = String(phoneNumber).replace(/\D/g, '');
    const matchedUser = usersRes.rows.find(u => 
      (u.mobile && String(u.mobile).replace(/\D/g, '') === searchStr) ||
      (u.email && u.email.includes(searchStr))
    );

    if (!matchedUser) {
      return { ok: false, error: 'User with this phone number not found in this tenant.' };
    }

    const res = await sendWhatsAppOTP(tenantId, phoneNumber, otpCode);
    if (!res.ok) return res;

    return { ok: true, matchedUser };
  };

  const completeWhatsAppLogin = async (tenantId, matchedUser) => {
    const rawUser = {
      uid: matchedUser.uid,
      displayName: matchedUser.displayName || 'User',
      role: matchedUser.role || 'Staff',
      email: matchedUser.email || '',
      photoURL: matchedUser.photoURL || '/avatar.png',
      status: matchedUser.status || 'Active',
    };

    if (String(rawUser.status).toLowerCase() === 'invited') {
      const activated = {
        ...matchedUser,
        status: 'Active',
        invitedAcceptedAt: new Date().toISOString(),
      };
      await upsertTenantUserMap(tenantId, rawUser.uid, activated);
      rawUser.status = 'Active';
    }

    const validated = toValidatedUser(rawUser);
    if (!validated.ok) return validated;

    const nextSession = { tenantId, user: validated.user };
    setSession(nextSession);
    writeSession(nextSession);
    return { ok: true, user: validated.user };
  };

  const logout = () => {
    setSession(null);
    writeSession(null);
  };

  const patchSessionUser = (patch) => {
    setSession((prev) => {
      if (!prev?.user || !prev?.tenantId) return prev;
      const next = {
        ...prev,
        user: {
          ...prev.user,
          ...(patch || {}),
        },
      };
      writeSession(next);
      return next;
    });
  };

  const value = {
    session,
    user: session?.user || null,
    tenantId: session?.tenantId || null,
    isAuthenticated: Boolean(session?.user && session?.tenantId),
    loginWithUid,
    loginWithGoogle,
    initiateWhatsAppLogin,
    completeWhatsAppLogin,
    logout,
    patchSessionUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
