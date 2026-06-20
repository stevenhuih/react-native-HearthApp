import { makeRedirectUri } from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

// Magic-link / OAuth redirect back into the app. Scheme "hearth" is set in app.json.
// Path is parens-free ("callback", not "(auth)/callback") so the deep link is
// allow-list-friendly in Supabase; the (auth) group is transparent in URLs, so
// the callback screen is reachable at /callback. Add this exact URL to
// Supabase → Auth → URL Configuration → Redirect URLs: hearth://callback
const redirectTo = makeRedirectUri({ scheme: 'hearth', path: 'callback' });

/** Email magic link (passwordless). Caller shows the "check your email" state. */
export async function signInWithMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

/**
 * Apple Sign In (iOS only). Uses the native credential's identity token with
 * Supabase's id-token flow.
 * TODO(setup): enable the "Sign in with Apple" capability + configure Apple as
 * an auth provider in the Supabase dashboard.
 */
export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error('No identity token returned from Apple.');
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

/**
 * Google OAuth via the system browser.
 * TODO(setup): configure Google as an auth provider in Supabase + add the
 * client IDs / redirect URI (and iOS/Android entries in app.json).
 */
export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned from Supabase.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    await exchangeCodeFromUrl(result.url);
  }
}

/** Exchanges the PKCE ?code= from a redirect URL for a session. */
export async function exchangeCodeFromUrl(url: string): Promise<void> {
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if (typeof code === 'string') {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
