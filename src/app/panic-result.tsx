import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logCook } from '@/lib/cook';
import { isRedZone } from '@/lib/expiry';
import { usePanicStore } from '@/stores/panic-store';
import { usePantryStore } from '@/stores/pantry-store';

// Panic Result (§07): loading → recipe OR honest message → "I cooked this".
// // TODO(design): bottom-sheet presentation, illustration, confetti.
export default function PanicResultScreen() {
  const router = useRouter();
  const status = usePanicStore((s) => s.status);
  const result = usePanicStore((s) => s.result);
  const run = usePanicStore((s) => s.run);
  const reset = usePanicStore((s) => s.reset);
  const pantryItems = usePantryStore((s) => s.items);
  const reloadPantry = usePantryStore((s) => s.loadAll);
  const [cooked, setCooked] = useState(false);
  const [rescued, setRescued] = useState(false);

  function close() {
    reset();
    router.back();
  }

  // "I cooked this": optimistic success now; the cook_log INSERT fires the
  // trigger that deducts the pantry. We never deduct client-side (rule #5).
  function handleCooked() {
    const recipe = result?.recipe;
    if (recipe) {
      const usedNames = recipe.ingredients_used.map((i) => i.name.toLowerCase());
      setRescued(
        pantryItems.some(
          (p) =>
            isRedZone(p.expires_at) &&
            usedNames.some(
              (n) =>
                p.ingredient.name.toLowerCase().includes(n) || n.includes(p.ingredient.name.toLowerCase())
            )
        )
      );
    }
    setCooked(true);
    if (result?.recipe_id) {
      logCook(result.recipe_id)
        .then(() => reloadPantry())
        .catch(() => {});
    }
  }

  // ── loading ────────────────────────────────────────────────────────────
  if (status === 'idle' || status === 'loading') {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <ActivityIndicator />
          <Text className="type-body">Finding the laziest thing to cook…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── error / timeout (US-003) ──────────────────────────────────────────────
  if (status === 'error') {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="type-h3 text-center">Something went wrong</Text>
          <Text className="type-body text-center">Give it another go.</Text>
          <View className="w-full gap-3">
            <Pressable className="btn btn-primary" onPress={() => run()}>
              <Text className="type-button text-white">Try again</Text>
            </Pressable>
            <Pressable className="items-center py-2" onPress={close}>
              <Text className="type-body-sm">Close</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const recipe = result?.recipe ?? null;

  // ── honest / empty (no recipe) ────────────────────────────────────────────
  if (!recipe) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="type-h3 text-center">Hmm…</Text>
          <Text className="type-body text-center">
            {result?.message ?? "Couldn't find a good option right now."}
          </Text>
          <Pressable className="btn btn-ghost" onPress={close}>
            <Text className="type-button text-olive">Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── cooked confirmation (deduction wiring lands in step 9) ─────────────────
  if (cooked) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="type-h2 text-center">Nice — enjoy! 🍳</Text>
          {/* TODO(design): real confetti animation. */}
          {rescued ? (
            <Text className="type-body text-center text-olive">
              🎉 You rescued an item that was about to expire!
            </Text>
          ) : null}
          <Text className="type-body-sm text-center">Your pantry’s been updated.</Text>
          <Pressable className="btn btn-primary" onPress={close}>
            <Text className="type-button text-white">Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── recipe ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-row items-center justify-between px-6 py-3">
        <Text className="type-caption">{result?.state?.toUpperCase()}</Text>
        <Pressable onPress={close} accessibilityLabel="Close">
          <Text className="type-button text-muted">Close</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1">
        <View className="gap-4 p-6">
          {/* Honest preface for SPARSE pantries. */}
          {result?.honest && result?.message ? (
            <Text className="type-body-sm">{result.message}</Text>
          ) : null}

          <Text className="type-h1">{recipe.recipe_name}</Text>
          <Text className="type-body-sm">
            {recipe.total_mins} min · {recipe.pans_needed} pan{recipe.pans_needed === 1 ? '' : 's'}
          </Text>

          <View className="gap-1">
            <Text className="type-h4">Uses</Text>
            {recipe.ingredients_used.map((ing, i) => (
              <Text key={`${ing.name}-${i}`} className="type-body">
                • {ing.name}
                {ing.qty != null ? ` (${ing.qty}${ing.unit ? ` ${ing.unit}` : ''})` : ''}
              </Text>
            ))}
          </View>

          <View className="gap-2">
            <Text className="type-h4">Steps</Text>
            {recipe.steps.map((step) => (
              <View key={step.n} className="flex-row gap-2">
                <Text className="type-body">{step.n}.</Text>
                <Text className="type-body flex-1">
                  {step.text}
                  {step.mins ? ` (${step.mins} min)` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View className="p-6">
        <Pressable className="btn btn-primary" onPress={handleCooked}>
          <Text className="type-button text-white">I cooked this</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
