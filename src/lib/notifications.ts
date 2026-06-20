import { supabase } from '@/lib/supabase';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@/types/db';

/**
 * Persist a Sunday-push on/off choice to users.notification_prefs (US-007). RLS
 * (users_update_own) scopes the write to the caller's own row. Merges with the
 * existing prefs so future keys (e.g. an expiry-alert threshold) are preserved.
 * The sunday-push-scheduler Edge Function reads this and skips opted-out users.
 */
export async function setSundayPushEnabled(
  userId: string,
  enabled: boolean,
  current: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS
): Promise<void> {
  const next: NotificationPrefs = { ...current, sunday_push: enabled };
  const { error } = await supabase.from('users').update({ notification_prefs: next }).eq('id', userId);
  if (error) throw error;
}
