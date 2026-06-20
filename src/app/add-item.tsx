import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORIES } from '@/constants/categories';
import { addDaysISO } from '@/lib/expiry';
import { usePantryStore } from '@/stores/pantry-store';
import type { Ingredient, IngredientCategory } from '@/types/db';

// Add Item (§07 / US-005). Search OR browse by category → confirm quantity → add.
// Everything resolves to a canonical ingredient — there is no free-text path.
export default function AddItemScreen() {
  const router = useRouter();
  const ingredients = usePantryStore((s) => s.ingredients);
  const items = usePantryStore((s) => s.items);
  const ensureIngredients = usePantryStore((s) => s.ensureIngredients);
  const addItem = usePantryStore((s) => s.addItem);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<IngredientCategory | null>(null);
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const [qtyText, setQtyText] = useState('');

  useEffect(() => {
    ensureIngredients();
  }, [ensureIngredients]);

  const inPantry = useMemo(() => new Set(items.map((it) => it.ingredient_id)), [items]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return ingredients.filter(
        (i) => i.name.includes(q) || i.aliases.some((a) => a.toLowerCase().includes(q))
      );
    }
    if (category) return ingredients.filter((i) => i.category === category);
    return [];
  }, [query, category, ingredients]);

  function pick(ingredient: Ingredient) {
    setSelected(ingredient);
    setQtyText(ingredient.default_quantity != null ? String(ingredient.default_quantity) : '');
  }

  async function confirmAdd() {
    if (!selected) return;
    const quantity = selected.track_quantity
      ? qtyText.trim() === ''
        ? null
        : Number(qtyText)
      : null;
    const expiresAt =
      selected.default_shelf_life_days != null ? addDaysISO(selected.default_shelf_life_days) : null;
    await addItem(selected, quantity, expiresAt); // optimistic
    // Reset to browse so the user can add more; the item now shows "In pantry".
    setSelected(null);
    setQtyText('');
  }

  const qtyInvalid = selected?.track_quantity && qtyText.trim() !== '' && Number.isNaN(Number(qtyText));

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-row items-center justify-between px-6 py-3">
        <Text className="type-h2">Add to pantry</Text>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close">
          <Text className="type-button text-muted">Done</Text>
        </Pressable>
      </View>

      {/* TODO(design): search field styling/focus state */}
      <View className="px-6">
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setSelected(null);
          }}
          placeholder="Search ingredients"
          autoCapitalize="none"
          autoFocus
          className="rounded-control border border-border px-4 py-3 type-body"
        />
      </View>

      {/* Quantity-confirm panel for the picked ingredient. */}
      {selected ? (
        <View className="m-6 gap-3 rounded-card border border-border p-4">
          <Text className="type-h4">{selected.name}</Text>
          {selected.track_quantity ? (
            <View className="flex-row items-center gap-3">
              <TextInput
                value={qtyText}
                onChangeText={setQtyText}
                keyboardType="numeric"
                inputMode="numeric"
                className="w-24 rounded-control border border-border px-3 py-2 type-body"
              />
              <Text className="type-body">{selected.default_unit}</Text>
            </View>
          ) : (
            <Text className="type-body-sm">Tracked by presence (no quantity).</Text>
          )}
          <View className="flex-row gap-3">
            <Pressable
              className={`btn btn-primary flex-1 ${qtyInvalid ? 'opacity-50' : ''}`}
              disabled={qtyInvalid}
              onPress={confirmAdd}>
              <Text className="type-button text-white">Add</Text>
            </Pressable>
            <Pressable className="btn btn-ghost flex-1" onPress={() => setSelected(null)}>
              <Text className="type-button text-olive">Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView className="flex-1">
          <View className="p-6">
            {/* Default view: 9-category grid. */}
            {!query && !category ? (
              <View className="flex-row flex-wrap gap-3">
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    className="w-[30%] items-center gap-1 rounded-control border border-border p-3">
                    <Text className="text-3xl">{c.emoji}</Text>
                    <Text className="type-caption text-center">{c.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View className="gap-1">
                {category && !query ? (
                  <Pressable className="pb-2" onPress={() => setCategory(null)}>
                    <Text className="type-body-sm text-olive">‹ All categories</Text>
                  </Pressable>
                ) : null}

                {results.length === 0 ? (
                  // Soft empty state — never a hard error (US-005 edge case).
                  <Text className="type-body-sm">Not found — we add items regularly.</Text>
                ) : (
                  results.map((ing) => {
                    const already = inPantry.has(ing.id);
                    return (
                      <Pressable
                        key={ing.id}
                        onPress={() => pick(ing)}
                        className="flex-row items-center justify-between rounded-control border border-border px-4 py-3">
                        <View className="flex-1">
                          <Text className="type-body">{ing.name}</Text>
                          {ing.default_quantity != null ? (
                            <Text className="type-caption">
                              {ing.default_quantity} {ing.default_unit}
                            </Text>
                          ) : null}
                        </View>
                        {already ? <Text className="type-caption text-olive">In pantry</Text> : null}
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
