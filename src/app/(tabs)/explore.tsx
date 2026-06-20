import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MATCH_TIER_TEXT_CLASS, matchTier } from '@/constants/match';
import { useExploreStore } from '@/stores/explore-store';
import { usePantryStore } from '@/stores/pantry-store';
import type { SavedRecipeCard } from '@/types/db';

// Tab 3 — Explore (US-008 / §06). Phase 1: Saved (default) + a locked Community
// teaser (Phase 2). // TODO(design): throughout — structure only.
type SubTab = 'saved' | 'community';

export default function ExploreScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<SubTab>('saved');

  const saved = useExploreStore((s) => s.saved);
  const isLoading = useExploreStore((s) => s.isLoading);
  const error = useExploreStore((s) => s.error);
  const load = useExploreStore((s) => s.load);
  const subscribe = useExploreStore((s) => s.subscribe);
  const unsubscribe = useExploreStore((s) => s.unsubscribe);

  const pantryItems = usePantryStore((s) => s.items);
  const loadPantry = usePantryStore((s) => s.loadAll);
  const pantryEmpty = pantryItems.length === 0;

  // Load + live-subscribe while focused; tear the subscription down on blur.
  useFocusEffect(
    useCallback(() => {
      load();
      subscribe();
      if (usePantryStore.getState().items.length === 0) loadPantry();
      return () => unsubscribe();
    }, [load, subscribe, unsubscribe, loadPantry])
  );

  // "Cook tonight" = ≥80% pantry match, pinned on top.
  const cookTonight = useMemo(() => saved.filter((s) => (s.pantry_match_pct ?? 0) >= 80), [saved]);
  const rest = useMemo(() => saved.filter((s) => (s.pantry_match_pct ?? 0) < 80), [saved]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-6 pt-4">
          <Text className="type-h1">Explore</Text>
          <Pressable onPress={() => router.push('/import')} accessibilityLabel="Import a recipe">
            <Text className="type-button text-olive">Import</Text>
          </Pressable>
        </View>

        {/* Sub-tabs. // TODO(design): real segmented control styling. */}
        <View className="flex-row gap-2 px-6 pt-3">
          <SubTabButton label="Saved" active={tab === 'saved'} onPress={() => setTab('saved')} />
          <SubTabButton label="Community" active={tab === 'community'} onPress={() => setTab('community')} />
        </View>

        {tab === 'community' ? (
          <CommunityTeaser />
        ) : (
          <SavedTab
            saved={saved}
            cookTonight={cookTonight}
            rest={rest}
            isLoading={isLoading}
            error={error}
            pantryEmpty={pantryEmpty}
            onRetry={load}
            onOpen={(recipeId) => router.push({ pathname: '/recipe/[id]', params: { id: recipeId } })}
            onImport={() => router.push('/import')}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function SubTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-control px-4 py-2 ${active ? 'bg-olive' : 'border border-border'}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}>
      <Text className={active ? 'type-button text-white' : 'type-button text-muted'}>{label}</Text>
    </Pressable>
  );
}

// Community is Phase 2 — locked teaser only, no functionality.
function CommunityTeaser() {
  return (
    <View className="flex-1 items-center justify-center gap-2 p-6">
      <Text className="type-h3 text-center">🔒 Community</Text>
      <Text className="type-body-sm text-center text-muted">
        Cook-first posts from the Hearth community are coming soon.
      </Text>
    </View>
  );
}

interface SavedTabProps {
  saved: SavedRecipeCard[];
  cookTonight: SavedRecipeCard[];
  rest: SavedRecipeCard[];
  isLoading: boolean;
  error: string | null;
  pantryEmpty: boolean;
  onRetry: () => void;
  onOpen: (recipeId: string) => void;
  onImport: () => void;
}

function SavedTab({ saved, cookTonight, rest, isLoading, error, pantryEmpty, onRetry, onOpen, onImport }: SavedTabProps) {
  if (error && saved.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text className="type-body text-center">{error}</Text>
        <Pressable className="btn btn-primary" onPress={onRetry}>
          <Text className="type-button text-white">Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading && saved.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <ActivityIndicator />
      </View>
    );
  }

  // Empty Saved state (US-008): invite to share a recipe in.
  if (saved.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-3 p-6">
        <Text className="type-h3 text-center">No saved recipes yet</Text>
        <Text className="type-body-sm text-center text-muted">
          Share a recipe from TikTok or YouTube to add it here.
        </Text>
        {/* TODO(design): visual guide illustrating the share-sheet → Hearth flow. */}
        <View className="gap-1 pt-2">
          <Text className="type-caption text-center">1 · Tap Share on a recipe video</Text>
          <Text className="type-caption text-center">2 · Choose Hearth</Text>
          <Text className="type-caption text-center">3 · We check it against your pantry</Text>
        </View>
        <Pressable className="btn btn-primary mt-2" onPress={onImport}>
          <Text className="type-button text-white">Import from a link</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 20 }}>
      {/* Empty-pantry edge (US-008): all 0% match, sorted by recency. */}
      {pantryEmpty ? (
        <View className="rounded-xl border border-border p-4">
          <Text className="type-body-sm">Scan a receipt to see what you can cook tonight.</Text>
        </View>
      ) : null}

      {cookTonight.length > 0 ? (
        <View className="gap-3">
          <Text className="type-h4">Cook tonight</Text>
          {cookTonight.map((s) => (
            <RecipeCard key={s.id} card={s} onOpen={onOpen} />
          ))}
        </View>
      ) : null}

      <View className="gap-3">
        {cookTonight.length > 0 && rest.length > 0 ? <Text className="type-h4">All saved</Text> : null}
        {rest.map((s) => (
          <RecipeCard key={s.id} card={s} onOpen={onOpen} />
        ))}
      </View>
    </ScrollView>
  );
}

function RecipeCard({ card, onOpen }: { card: SavedRecipeCard; onOpen: (recipeId: string) => void }) {
  const pct = Math.round(card.pantry_match_pct ?? 0);
  const missing = card.missing_ingredients.length;
  const cookTime = card.recipe.cook_time_mins;

  return (
    <Pressable
      className="gap-1 rounded-xl border border-border p-4"
      onPress={() => onOpen(card.recipe.id)}
      accessibilityRole="button">
      <Text className="type-h4">{card.recipe.title}</Text>
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        {/* Match % — three-tier colour (≥80 / 50–79 / <50). // TODO(design): palette. */}
        <Text className={`type-body-sm ${MATCH_TIER_TEXT_CLASS[matchTier(card.pantry_match_pct)]}`}>
          {pct}% match
        </Text>
        {missing > 0 ? (
          <Text className="type-body-sm text-muted">
            {missing} missing
          </Text>
        ) : null}
        {cookTime ? <Text className="type-body-sm text-muted">{cookTime} min</Text> : null}
      </View>
    </Pressable>
  );
}
