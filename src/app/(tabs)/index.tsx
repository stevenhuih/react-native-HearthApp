import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { daysUntil } from '@/lib/expiry';
import { usePanicStore } from '@/stores/panic-store';
import { usePantryStore } from '@/stores/pantry-store';

// Tab 1 — Home (Today). Centerpiece is the Panic Button (US-003). Red Zone
// cards / savings / streak come in later steps. // TODO(design): throughout.
export default function HomeScreen() {
  const router = useRouter();
  const items = usePantryStore((s) => s.items);
  const loadAll = usePantryStore((s) => s.loadAll);
  const runPanic = usePanicStore((s) => s.run);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const hasItems = items.length > 0;
  const expiringSoon = useMemo(
    () =>
      items.filter((it) => {
        const d = daysUntil(it.expires_at);
        return d !== null && d >= 0 && d <= 7;
      }).length,
    [items]
  );

  function handlePanic() {
    if (!hasItems) return;
    runPanic(); // sets loading
    router.push('/panic-result');
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View className="flex-1 justify-between p-6">
        <View className="gap-1 pt-4">
          <Text className="type-script">Good food, made simple</Text>
          <Text className="type-h1">Tonight</Text>
          {hasItems ? (
            <Text className="type-body-sm">
              {expiringSoon > 0
                ? `${expiringSoon} item${expiringSoon === 1 ? '' : 's'} expiring this week.`
                : 'Nothing expiring soon.'}
            </Text>
          ) : (
            <Text className="type-body-sm">Your pantry is empty — scan a receipt to get started.</Text>
          )}
        </View>

        {/* Panic Button */}
        <View className="gap-2">
          <Pressable
            className={`btn btn-primary ${hasItems ? '' : 'opacity-50'}`}
            disabled={!hasItems}
            accessibilityLabel={hasItems ? 'Just tell me what to cook' : 'Scan a receipt first'}
            onPress={handlePanic}>
            <Text className="type-button text-white text-center">
              {hasItems ? "I'm exhausted. Just tell me what to cook." : 'Scan a receipt first'}
            </Text>
          </Pressable>
          {!hasItems ? (
            <Text className="type-caption text-center">Scan a receipt to unlock this.</Text>
          ) : null}
        </View>

        <View />
      </View>
    </SafeAreaView>
  );
}
