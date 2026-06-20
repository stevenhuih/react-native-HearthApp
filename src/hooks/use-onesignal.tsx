import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '@/hooks/use-auth';
import {
  getOneSignal,
  ONESIGNAL_APP_ID,
  verboseLogLevel,
  type OneSignalClickEvent,
} from '@/lib/onesignal';
import { supabase } from '@/lib/supabase';

/**
 * OneSignalBridge — initializes OneSignal once, keeps users.onesignal_id in sync
 * with the device's push subscription, and routes a Sunday-push tap to Home with
 * the expiry items highlighted (US-007). Renders nothing.
 *
 * Mount once inside AuthProvider (it needs session + profile). The native module
 * is optional: when it's absent (Expo Go / web) every call here is a no-op, so the
 * app still runs. The OneSignal REST key is never referenced — sends happen
 * server-side in the sunday-push-scheduler Edge Function.
 */
export function OneSignalBridge() {
  const { session, profile } = useAuth();
  const router = useRouter();

  // The active user id, kept current for the long-lived listeners below.
  const userIdRef = useRef<string | null>(null);
  // Guards against redundant PATCHes: `${userId}:${subscriptionId}`.
  const lastPersisted = useRef<string | null>(null);
  const initialized = useRef(false);

  const persistSubscriptionId = useCallback(async (subId: string | null | undefined) => {
    const userId = userIdRef.current;
    if (!userId || !subId) return;
    const key = `${userId}:${subId}`;
    if (lastPersisted.current === key) return;
    lastPersisted.current = key;
    // RLS (users_update_own) permits writing only the caller's own row.
    const { error } = await supabase.from('users').update({ onesignal_id: subId }).eq('id', userId);
    if (error) lastPersisted.current = null; // allow a retry on the next event
  }, []);

  // One-time init + long-lived listeners (live for the app session).
  useEffect(() => {
    const os = getOneSignal();
    if (!os || !ONESIGNAL_APP_ID || initialized.current) return;
    initialized.current = true;

    // Verbose logs in development only — OneSignal's recommended troubleshooting
    // setup. Never in production builds.
    if (__DEV__) os.Debug.setLogLevel(verboseLogLevel());

    os.initialize(ONESIGNAL_APP_ID);
    // Prompt for push permission. No-op if already decided; harmless to call early.
    os.Notifications.requestPermission(true).catch(() => {});

    // Tap handler → Home with expiry highlighted (US-007).
    const onClick = (event: OneSignalClickEvent) => {
      const data = (event.notification?.additionalData ?? {}) as Record<string, unknown>;
      if (data.screen === 'home') {
        router.navigate({ pathname: '/', params: { highlightExpiring: '1' } });
      }
    };
    os.Notifications.addEventListener('click', onClick);

    // The subscription id can arrive/refresh asynchronously after permission is
    // granted; persist it against whoever is signed in at that moment.
    os.User.pushSubscription.addObserver((e) => {
      persistSubscriptionId(e.current?.id);
    });
  }, [router, persistSubscriptionId]);

  // Track the active user; associate + persist once signed in and onboarded.
  useEffect(() => {
    const os = getOneSignal();
    const userId = session?.user?.id ?? null;
    const ready = !!userId && !!profile?.onboarding_complete;
    userIdRef.current = ready ? userId : null;
    if (!os || !ONESIGNAL_APP_ID || !ready || !userId) return;

    // External id = Supabase user id (lets the server also target by alias later).
    os.login(userId);
    os.User.pushSubscription.getIdAsync().then(persistSubscriptionId).catch(() => {});
  }, [session, profile, persistSubscriptionId]);

  return null;
}
