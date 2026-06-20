import { useLocalSearchParams, useRouter } from 'expo-router';
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
  // Set when the user taps the Sunday push (US-007): emphasize expiry items.
  const { highlightExpiring } = useLocalSearchParams<{ highlightExpiring?: string }>();
  const items = usePantryStore((s) => s.items);
  const loadAll = usePantryStore((s) => s.loadAll);
  const runPanic = usePanicStore((s) => s.run);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const hasItems = items.length > 0;
  // Items expiring within the week, soonest first — also what the Sunday push is about.
  const expiringItems = useMemo(
    () =>
      items
        .map((it) => ({ name: it.ingredient.name, days: daysUntil(it.expires_at) }))
        .filter((it): it is { name: string; days: number } => it.days !== null && it.days >= 0 && it.days <= 7)
        .sort((a, b) => a.days - b.days),
    [items]
  );
  const expiringSoon = expiringItems.length;
  const isHighlighted = !!highlightExpiring && expiringSoon > 0;

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

          {/* Expiry highlight — shown when arriving from the Sunday push tap.
              // TODO(design): this is the structural stand-in until the Red Zone
              // section lands; replace with the real highlighted Red Zone cards. */}
          {isHighlighted ? (
            <View className="mt-3 gap-1 rounded-xl border border-amber-500 p-4">
              <Text className="type-caption">Expiring this week</Text>
              {expiringItems.slice(0, 5).map((it) => (
                <Text key={it.name} className="type-body-sm">
                  {it.name} · {it.days === 0 ? 'today' : `${it.days} day${it.days === 1 ? '' : 's'}`}
                </Text>
              ))}
            </View>
          ) : null}
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
