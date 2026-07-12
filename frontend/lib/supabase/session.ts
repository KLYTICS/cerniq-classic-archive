/**
 * Supabase session helpers for API bearer attachment.
 */
import { getSupabaseBrowserClient, isSupabaseAuthEnabled } from './client';

const ACCESS_TOKEN_KEY = 'cerniq_access_token';

export async function getSupabaseAccessToken(): Promise<string> {
  if (!isSupabaseAuthEnabled()) {
    return '';
  }
  const client = getSupabaseBrowserClient();
  if (!client) {
    return '';
  }
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    return '';
  }
  return data.session.access_token;
}

export async function syncSupabaseAccessTokenToStorage(): Promise<string> {
  const token = await getSupabaseAccessToken();
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    }
  }
  return token;
}

export async function signInWithSupabasePassword(
  email: string,
  password: string,
): Promise<{ accessToken: string; userId: string; email: string }> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error('Supabase auth is not configured');
  }
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.session?.access_token || !data.user) {
    throw new Error(error?.message || 'Supabase sign-in failed');
  }
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, data.session.access_token);
  }
  return {
    accessToken: data.session.access_token,
    userId: data.user.id,
    email: data.user.email || email,
  };
}

export async function signOutSupabase(): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  await client.auth.signOut();
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}
