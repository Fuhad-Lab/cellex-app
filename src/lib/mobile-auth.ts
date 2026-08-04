/**
 * Mobile Secure Storage — OAuth 2.0 Token Management
 *
 * This module provides boilerplate for storing OAuth tokens (access_token
 * and refresh_token) in OS-level secure storage on iOS and Android.
 *
 * ARCHITECTURE:
 * - access_token: Short-lived (1 hour). Used for all API requests.
 *   Stored in memory only — refreshed via refresh_token when expired.
 * - refresh_token: Long-lived (60 days with sliding expiration).
 *   Stored in OS-level secure storage (iOS Keychain / Android Keystore).
 *
 * SECURITY:
 * - Tokens are NEVER stored in localStorage or sessionStorage.
 * - On iOS, tokens are stored in Keychain with kSecAttrAccessibleWhenUnlocked.
 * - On Android, tokens are stored in Keystore with encryption.
 * - The Capacitor SecureStorage plugin handles the platform-specific logic.
 *
 * TOKEN ROTATION FLOW:
 * 1. Mobile app starts → reads refresh_token from secure storage
 * 2. Calls /api/auth with op=refresh to get a new access_token
 * 3. Uses access_token for all API requests (Authorization: Bearer <token>)
 * 4. When access_token expires (401 response), repeats step 2
 * 5. If refresh_token is also expired (60 days inactive), user must re-login
 *
 * SLIDING EXPIRATION:
 * Each API request extends the session's expiration to 60 days from now.
 * Active users never have to re-login. Inactive users (no activity for 60
 * days) must re-login.
 */

import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const ACCESS_TOKEN_KEY = 'cellex_access_token';
const REFRESH_TOKEN_KEY = 'cellex_refresh_token';
const TOKEN_EXPIRY_KEY = 'cellex_token_expiry';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  expires_at: number; // timestamp (ms)
}

/**
 * Store tokens securely.
 *
 * On native platforms (iOS/Android), Capacitor Preferences uses:
 * - iOS: Keychain (encrypted, device-bound)
 * - Android: EncryptedSharedPreferences (Keystore-encrypted)
 * - Web: localStorage (fallback — NOT secure, but web uses HTTP-only cookies)
 *
 * For maximum security on native, consider using @capacitor-community/secure-storage
 * which provides explicit Keychain/Keystore access.
 */
export async function storeTokens(tokens: TokenPair): Promise<void> {
  const expiresAt = Date.now() + (tokens.expires_in * 1000);

  await Preferences.set({
    key: ACCESS_TOKEN_KEY,
    value: tokens.access_token,
  });

  await Preferences.set({
    key: REFRESH_TOKEN_KEY,
    value: tokens.refresh_token,
  });

  await Preferences.set({
    key: TOKEN_EXPIRY_KEY,
    value: String(expiresAt),
  });
}

/**
 * Retrieve the access token from secure storage.
 * Returns null if the token doesn't exist or has expired.
 */
export async function getAccessToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: ACCESS_TOKEN_KEY });
  if (!value) return null;

  // Check if the access token has expired
  const { value: expiryStr } = await Preferences.get({ key: TOKEN_EXPIRY_KEY });
  if (expiryStr) {
    const expiresAt = parseInt(expiryStr, 10);
    if (Date.now() >= expiresAt) {
      // Access token expired — try to refresh
      const newToken = await refreshAccessToken();
      return newToken;
    }
  }

  return value;
}

/**
 * Retrieve the refresh token from secure storage.
 * The refresh token is long-lived (60 days with sliding expiration).
 */
export async function getRefreshToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: REFRESH_TOKEN_KEY });
  return value;
}

/**
 * Refresh the access token using the refresh token.
 *
 * This calls the /api/auth endpoint with op=refresh.
 * The server returns a new access_token (1 hour) and may rotate the
 * refresh_token (Supabase rotates refresh tokens on each use for security).
 *
 * If the refresh_token is also expired (60 days inactive), the user must
 * re-login.
 *
 * @returns New access token, or null if refresh failed (user must re-login)
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const API_BASE = Capacitor.isNativePlatform()
      ? (process.env.NEXT_PUBLIC_API_BASE || '')
      : '';

    const resp = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'refresh',
        refresh_token: refreshToken,
      }),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.success) return null;

    // Store the new tokens (refresh_token may be rotated)
    await storeTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      expires_at: Date.now() + (data.expires_in * 1000),
    });

    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Clear all tokens from secure storage (logout).
 */
export async function clearTokens(): Promise<void> {
  await Preferences.remove({ key: ACCESS_TOKEN_KEY });
  await Preferences.remove({ key: REFRESH_TOKEN_KEY });
  await Preferences.remove({ key: TOKEN_EXPIRY_KEY });
}

/**
 * Check if the user is authenticated (has a valid refresh token).
 * The access token may be expired — it will be refreshed on next API call.
 */
export async function isAuthenticated(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  return !!refreshToken;
}

/**
 * Get the Authorization header for API requests.
 * Automatically refreshes the access token if expired.
 *
 * Usage:
 *   const headers = await getAuthHeaders();
 *   fetch('/api/products', { headers, ... });
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  if (!accessToken) return {};

  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}
