// Optional wrapper around react-native-onesignal.
//
// The OneSignal native module is only linked in a dev/EAS build — it is absent in
// Expo Go and on web. We lazy-require it and degrade to `null` (no-op) when it's
// missing, mirroring the optional expo-share-intent usage in app/_layout.tsx, so
// the app still runs in those environments.
//
// Only the PUBLIC app id lives in the client (EXPO_PUBLIC_ONESIGNAL_APP_ID). The
// OneSignal REST API key is a SECRET and lives ONLY in the Edge Function
// (AGENTS.md rule #3) — never import it here.

export const ONESIGNAL_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? '';

/** The bits of a notification-click event we read. The Sunday push tags itself
 *  with additionalData `{ screen: 'home', highlight: 'expiring' }` (US-007). */
export interface OneSignalClickEvent {
  notification: { additionalData?: Record<string, unknown> | null };
}

/** Minimal shape of the SDK surface we touch — keeps callers typed without a hard
 *  dependency on the native module being present. */
export interface OneSignalModule {
  initialize(appId: string): void;
  login(externalId: string): void;
  logout(): void;
  Debug: { setLogLevel(level: number): void };
  Notifications: {
    requestPermission(fallbackToSettings: boolean): Promise<boolean>;
    addEventListener(event: 'click', handler: (e: OneSignalClickEvent) => void): void;
    removeEventListener?(event: 'click', handler: (e: OneSignalClickEvent) => void): void;
  };
  User: {
    pushSubscription: {
      getIdAsync(): Promise<string | null | undefined>;
      addObserver(handler: (e: { current: { id?: string | null } }) => void): void;
    };
  };
}

let cached: OneSignalModule | null | undefined;

/** Returns the native OneSignal module, or null when it isn't linked
 *  (Expo Go / web). Result is memoised across calls. */
export function getOneSignal(): OneSignalModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = (require('react-native-onesignal').OneSignal as OneSignalModule) ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

/** OneSignal LogLevel.Verbose (6 in SDK v5). Read from the module when present so
 *  it stays correct if the enum ever changes; falls back to the known value. Used
 *  to turn on verbose logging in development, per OneSignal's setup guidance. */
export function verboseLogLevel(): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lvl = require('react-native-onesignal').LogLevel?.Verbose;
    return typeof lvl === 'number' ? lvl : 6;
  } catch {
    return 6;
  }
}
