import { useAuthStore } from '@/store/auth-store';

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().tokens?.accessToken;
  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}
