import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MATCH_TIER_TEXT_CLASS, matchTier } from '@/constants/match';
import { logCook } from '@/lib/cook';
import { isRedZone } from '@/lib/expiry';
import { addMissingToShoppingList, classifyIngredient, fetchRecipeDetail, type RecipeDetail } from '@/lib/recipe';
import { usePantryStore } from '@/stores/pantry-store';
import type { IngredientMatchStatus, RecipeInstructionStep } from '@/types/db';

// Recipe Detail (§07): match banner, per-ingredient have/low/missing, steps, and
// the two CTAs (add missing → shopping list; I cooked this → cook_log).
// // TODO(design): throughout — structure only.
export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const pantryItems = usePantryStore((s) => s.items);
  const ingredientsCatalog = usePantryStore((s) => s.ingredients);
  const ensureIngredients = usePantryStore((s) => s.ensureIngredients);
  const reloadPantry = usePantryStore((s) => s.loadAll);

  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [addState, setAddState] = useState<'idle' | 'adding' | 'added'>('idle');
  const [cooked, setCooked] = useState(false);
  const [rescued, setRescued] = useState(false);

  useEffect(() => {
    let active = true;
    ensureIngredients();
    fetchRecipeDetail(id)
      .then((d) => active && (setDetail(d), setStatus('ready')))
      .catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, [id, ensureIngredients]);

  const servings = detail?.recipe.servings ?? 1;

  // Per-ingredient have/low/missing against the live pantry.
  const classified = useMemo(
    () =>
      (detail?.ingredients ?? []).map((ri) => ({
        ri,
        status: classifyIngredient(pantryItems, ri, servings),
      })),
    [detail, pantryItems, servings]
  );

  const total = classified.length;
  const haveCount = classified.filter((c) => c.status !== 'missing').length;
  const bannerPct = total > 0 ? Math.round((haveCount / total) * 100) : 0;
  const missingIds = classified.filter((c) => c.status === 'missing').map((c) => c.ri.ingredient_id);

  async function handleAddMissing() {
    if (missingIds.length === 0 || addState !== 'idle') return;
    setAddState('adding');
    try {
      await addMissingToShoppingList(missingIds, ingredientsCatalog);
      setAddState('added');
    } catch {
      setAddState('idle'); // let them retry; never a raw error
    }
  }

  // "I cooked this": optimistic success now; the cook_log INSERT fires the trigger
  // that deducts the pantry (step 9 / rule #5). We never deduct client-side.
  function handleCooked() {
    if (!detail) return;
    const recipeIngredientIds = new Set(detail.ingredients.map((ri) => ri.ingredient_id));
    setRescued(pantryItems.some((p) => isRedZone(p.expires_at) && recipeIngredientIds.has(p.ingredient_id)));
    setCooked(true);
    logCook(id, servings)
      .then(() => reloadPantry())
      .catch(() => {});
  }

  if (status === 'loading') {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'error' || !detail) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="type-h3 text-center">Couldn’t load this recipe</Text>
          <Pressable className="btn btn-ghost" onPress={() => router.back()}>
            <Text className="type-button text-olive">Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Cooked confirmation (deduction handled by the trigger).
  if (cooked) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="type-h2 text-center">Nice — enjoy! 🍳</Text>
          {/* TODO(design): real confetti when a Red Zone item was rescued. */}
          {rescued ? (
            <Text className="type-body text-center text-olive">🎉 You rescued an item that was about to expire!</Text>
          ) : null}
          <Text className="type-body-sm text-center">Your pantry’s been updated.</Text>
          <Pressable className="btn btn-primary" onPress={() => router.back()}>
            <Text className="type-button text-white">Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { recipe } = detail;
  const steps = recipe.instructions ?? [];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View className="flex-row items-center justify-between px-6 py-3">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <Text className="type-button text-muted">Back</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 40 }}>
        <Text className="type-h1">{recipe.title}</Text>
        {recipe.cook_time_mins ? <Text className="type-body-sm text-muted">{recipe.cook_time_mins} min</Text> : null}

        {/* Pantry match banner — the most important signal (§07). */}
        <View className="rounded-xl border border-border p-4">
          <Text className={`type-body ${MATCH_TIER_TEXT_CLASS[matchTier(bannerPct)]}`}>
            You have {haveCount} of {total} ingredient{total === 1 ? '' : 's'}
          </Text>
        </View>

        {/* Ingredients with have / low / missing state. // TODO(design): real marks. */}
        <View className="gap-1">
          <Text className="type-h4">Ingredients</Text>
          {classified.map(({ ri, status: st }) => (
            <View key={ri.id} className="flex-row items-start gap-2">
              <Text className="type-body">{MATCH_MARK[st]}</Text>
              <Text className="type-body flex-1">
                {ri.ingredient.name}
                {ri.quantity != null ? ` · ${ri.quantity}${ri.unit ? ` ${ri.unit}` : ''}` : ''}
                {ri.is_optional ? ' (optional)' : ''}
                {st === 'low' ? ' — running low' : ''}
              </Text>
            </View>
          ))}
        </View>

        {/* Add missing → shopping list (purchase units). Hidden when nothing's missing. */}
        {missingIds.length > 0 ? (
          <Pressable
            className={`btn btn-secondary ${addState === 'added' ? 'opacity-60' : ''}`}
            disabled={addState !== 'idle'}
            onPress={handleAddMissing}>
            <Text className="type-button">
              {addState === 'added'
                ? 'Added to shopping list'
                : addState === 'adding'
                  ? 'Adding…'
                  : `Add ${missingIds.length} missing to shopping list`}
            </Text>
          </Pressable>
        ) : null}

        {steps.length > 0 ? (
          <View className="gap-2">
            <Text className="type-h4">Steps</Text>
            {steps.map((step, i) => (
              <View key={stepKey(step, i)} className="flex-row gap-2">
                <Text className="type-body">{stepNumber(step, i)}.</Text>
                <Text className="type-body flex-1">
                  {step.text}
                  {stepMins(step) ? ` (${stepMins(step)} min)` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky "I cooked this" (§07). */}
      <View className="p-6">
        <Pressable className="btn btn-primary" onPress={handleCooked}>
          <Text className="type-button text-white">I cooked this</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const MATCH_MARK: Record<IngredientMatchStatus, string> = {
  // TODO(design): replace glyphs with the real have/low/missing marks + colour.
  have: '✓',
  low: '▴',
  missing: '✗',
};

function stepNumber(step: RecipeInstructionStep, i: number): number {
  return step.n ?? step.step ?? i + 1;
}
function stepMins(step: RecipeInstructionStep): number | null {
  return step.mins ?? step.duration_mins ?? null;
}
function stepKey(step: RecipeInstructionStep, i: number): string {
  return `${stepNumber(step, i)}-${i}`;
}
