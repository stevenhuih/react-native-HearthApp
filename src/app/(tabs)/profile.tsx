import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { setSundayPushEnabled } from '@/lib/notifications';

// Tab 4 — Profile & Settings (architecture §06). For now this hosts only the
// Notification Settings section (the Sunday-push toggle, US-007). Subscription,
// household, analytics, and dietary-profile editing arrive with their own stories.
// TODO(design): throughout — neutral structural layout only.
export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const sundayPush = profile?.notification_prefs?.sunday_push ?? true;
  const [saving, setSaving] = useState(false);

  async function onToggleSundayPush(value: boolean) {
    const userId = session?.user?.id;
    if (!userId || saving) return;
    setSaving(true);
    try {
      await setSundayPushEnabled(userId, value, profile?.notification_prefs);
      await refreshProfile(); // reflect the persisted state
    } catch {
      // Leave the switch unchanged; the next toggle retries. Never a raw error.
      // TODO(design): surface a small inline "couldn't save — try again" note.
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View className="flex-1 gap-6 p-6">
        <View className="gap-1 pt-4">
          <Text className="type-h1">Profile</Text>
          <Text className="type-body-sm">Settings and preferences.</Text>
        </View>

        {/* Notification settings */}
        <View className="gap-3">
          <Text className="type-caption">Notifications</Text>
          {/* TODO(design): settings-row styling (divider, spacing, switch colors). */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-0.5 pr-4">
              <Text className="type-body">Sunday meal-prep reminder</Text>
              <Text className="type-caption">A weekly heads-up about what’s expiring soon.</Text>
            </View>
            <Switch value={sundayPush} disabled={saving} onValueChange={onToggleSundayPush} />
          </View>
        </View>

        {/* TODO(later stories): subscription (US-009), household (US-011),
            analytics detail (US-010), dietary-profile edit, expiry-alert threshold. */}
      </View>
    </SafeAreaView>
  );
}
