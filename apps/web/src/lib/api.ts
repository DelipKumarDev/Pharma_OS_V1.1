import { useAuthStore } from '@/store/auth-store';

// Requests that must never trigger a refresh attempt (they ARE the auth flow).
const AUTH_BYPASS = ['/api/auth/login', '/api/auth/token/refresh', '/api/auth/password'];

// Single-flight refresh: many components fire requests at once; if the access
// token has expired they would all 401 simultaneously. We coalesce them into a
// single refresh call and let every caller await the same result.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { tokens, user, setAuth, clearAuth } = useAuthStore.getState();
  const refreshToken = tokens?.refreshToken;
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/auth/token/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      // Refresh token expired/revoked → session is truly over.
      clearAuth();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return null;
    }
    const json = await res.json();
    const newTokens = json?.data?.tokens;
    if (!newTokens?.accessToken) return null;
    // Keep the existing user if the refresh response omits it.
    setAuth(json.data.user ?? user!, newTokens);
    return newTokens.accessToken as string;
  } catch {
    return null;
  }
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().tokens?.accessToken;
  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  // Transparently recover from an expired access token: refresh once, retry once.
  const isAuthCall = AUTH_BYPASS.some(p => url.startsWith(p));
  if (res.status === 401 && !isAuthCall && useAuthStore.getState().tokens?.refreshToken) {
    refreshPromise = refreshPromise ?? refreshAccessToken();
    const newToken = await refreshPromise;
    refreshPromise = null;

    if (newToken) {
      const retryHeaders = new Headers(options.headers as HeadersInit | undefined);
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
      return fetch(url, { ...options, headers: retryHeaders });
    }
  }

  return res;
}
