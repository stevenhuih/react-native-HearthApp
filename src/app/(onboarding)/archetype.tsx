import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingProgress } from '@/components/onboarding-progress';
import { fetchArchetypes, fetchIngredientsByIds } from '@/lib/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';
import type { PantryArchetype } from '@/types/db';

type Phase = 'select' | 'confirm';
const PREVIEW_CHIP_COUNT = 8;
const LOAD_ERROR = 'We couldn’t load cooking styles. Check your connection and try again.';

// Step 2 of 4 — Pantry Archetype. Phase 1: pick one of the 6 styles (single
// select) with a staple preview. Phase 2: confirm/deselect the seeded items.
export default function ArchetypeScreen() {
  const router = useRouter();
  const { archetypeId, confirmedItemIds, selectArchetype, toggleConfirmedItem, setLastStep } =
    useOnboardingStore();

  const [archetypes, setArchetypes] = useState<PantryArchetype[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedId, setSelectedId] = useState<number | null>(archetypeId);
  const [nameMap, setNameMap] = useState<Record<number, string>>({});

  useEffect(() => setLastStep(2), [setLastStep]);

  // Retry handler (invoked from onPress — outside any effect).
  const load = useCallback(async () => {
    try {
      const rows = await fetchArchetypes();
      setArchetypes(rows);
      setLoadError(null);
    } catch {
      setArchetypes([]);
      setLoadError(LOAD_ERROR);
    }
  }, []);

  // Initial load. setState happens only in async callbacks (never synchronously
  // in the effect body), so it won't trigger cascading renders.
  useEffect(() => {
    let ignore = false;
    fetchArchetypes()
      .then((rows) => {
        if (!ignore) {
          setArchetypes(rows);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (!ignore) {
          setArchetypes([]);
          setLoadError(LOAD_ERROR);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const selected = archetypes?.find((a) => a.id === selectedId) ?? null;

  // Resolve seed ingredient_ids -> names for the selected archetype (preview + confirm list).
  useEffect(() => {
    if (!selected) return;
    fetchIngredientsByIds(selected.ingredient_seeds.map((s) => s.ingredient_id))
      .then((rows) => setNameMap(Object.fromEntries(rows.map((r) => [r.id, r.name]))))
      .catch(() => setNameMap({}));
  }, [selected]);

  function handleContinueToConfirm() {
    if (!selected) return;
    selectArchetype(selected.id, selected.ingredient_seeds);
    setPhase('confirm');
  }

  // ── loading / error states ─────────────────────────────────────────────
  if (archetypes === null) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <OnboardingProgress step={2} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || archetypes.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <OnboardingProgress step={2} />
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="type-body text-center">
            {loadError ?? 'No cooking styles are available yet.'}
          </Text>
          <Pressable className="btn btn-ghost" onPress={load}>
            <Text className="type-button text-olive">Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── confirm phase ───────────────────────────────────────────────────────
  if (phase === 'confirm' && selected) {
    const total = selected.ingredient_seeds.length;
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <OnboardingProgress step={2} />
        <View className="px-6 pt-4 gap-1">
          {/* TODO(design): header + live-count treatment. */}
          <Text className="type-h2">Confirm your staples</Text>
          <Text className="type-body-sm">
            Adding {confirmedItemIds.length} of {total} items. Uncheck anything you don’t have.
          </Text>
        </View>

        <ScrollView className="flex-1">
          <View className="p-6 gap-2">
            {selected.ingredient_seeds.map((seed) => {
              const checked = confirmedItemIds.includes(seed.ingredient_id);
              return (
                <Pressable
                  key={seed.ingredient_id}
                  onPress={() => toggleConfirmedItem(seed.ingredient_id)}
                  className="flex-row items-center gap-3 rounded-control border border-border px-4 py-3">
                  {/* TODO(design): checkbox component + checked/unchecked visuals. */}
                  <View
                    className={`h-5 w-5 rounded-md border ${checked ? 'bg-terracotta border-terracotta' : 'border-muted'}`}
                  />
                  <Text className="type-body flex-1">
                    {nameMap[seed.ingredient_id] ?? `Ingredient #${seed.ingredient_id}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View className="p-6 gap-3">
          <Pressable
            disabled={confirmedItemIds.length === 0}
            className={`btn btn-primary ${confirmedItemIds.length === 0 ? 'opacity-50' : ''}`}
            onPress={() => router.push('/(onboarding)/dietary')}>
            <Text className="type-button text-white">
              Set up my pantry with {confirmedItemIds.length} items
            </Text>
          </Pressable>
          <Pressable className="items-center" onPress={() => setPhase('select')}>
            <Text className="type-body-sm">Back to cooking styles</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── select phase ─────────────────────────────────────────────────────────
  const previewNames = selected
    ? selected.ingredient_seeds
        .map((s) => nameMap[s.ingredient_id])
        .filter((n): n is string => Boolean(n))
    : [];

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <OnboardingProgress step={2} />
      <View className="px-6 pt-4 gap-1">
        <Text className="type-h2">Pick your cooking style</Text>
        <Text className="type-body-sm">We’ll pre-fill your pantry with the right staples.</Text>
      </View>

      <ScrollView className="flex-1">
        {/* TODO(design): card grid sizing, selected-state treatment, emoji size. */}
        <View className="flex-row flex-wrap gap-3 p-6">
          {archetypes.map((a) => {
            const isSelected = a.id === selectedId;
            return (
              <Pressable
                key={a.id}
                onPress={() => setSelectedId(a.id)}
                className={`w-[47%] gap-1 rounded-card border p-4 ${isSelected ? 'border-terracotta' : 'border-border'}`}>
                <Text className="text-3xl">{a.emoji ?? '🍽️'}</Text>
                <Text className="type-h4">{a.name}</Text>
                <Text className="type-caption">~{a.ingredient_seeds.length} staples pre-filled</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Pre-fill preview for the selected archetype. */}
        {selected ? (
          <View className="px-6 pb-6 gap-2">
            <Text className="type-body-sm">This will add:</Text>
            <View className="flex-row flex-wrap gap-2">
              {previewNames.slice(0, PREVIEW_CHIP_COUNT).map((name) => (
                <Text key={name} className="pill pill-fresh">
                  {name}
                </Text>
              ))}
              {selected.ingredient_seeds.length > PREVIEW_CHIP_COUNT ? (
                <Text className="type-caption self-center">
                  and {selected.ingredient_seeds.length - PREVIEW_CHIP_COUNT} more
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View className="p-6">
        <Pressable
          disabled={!selected}
          className={`btn btn-primary ${!selected ? 'opacity-50' : ''}`}
          onPress={handleContinueToConfirm}>
          <Text className="type-button text-white">Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
