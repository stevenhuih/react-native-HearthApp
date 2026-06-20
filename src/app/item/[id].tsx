import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORY_LABEL } from '@/constants/categories';
import { usePantryStore } from '@/stores/pantry-store';

// Item Detail (§07): edit quantity / expiry, remove. Opened from a pantry row tap.
export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = usePantryStore((s) => s.items.find((it) => it.id === id));
  const editItem = usePantryStore((s) => s.editItem);
  const removeItem = usePantryStore((s) => s.removeItemOptimistic);

  const [qtyText, setQtyText] = useState(() => (item?.quantity != null ? String(item.quantity) : ''));
  const [expiry, setExpiry] = useState(() => item?.expires_at ?? '');

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="type-body">This item is no longer in your pantry.</Text>
          <Pressable className="btn btn-ghost" onPress={() => router.back()}>
            <Text className="type-button text-olive">Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const expiryValid = expiry === '' || /^\d{4}-\d{2}-\d{2}$/.test(expiry);
  const qtyInvalid = item.ingredient.track_quantity && qtyText.trim() !== '' && Number.isNaN(Number(qtyText));

  async function save() {
    if (!item) return;
    await editItem(item.id, {
      quantity: item.ingredient.track_quantity ? (qtyText.trim() === '' ? null : Number(qtyText)) : null,
      expires_at: expiry.trim() === '' ? null : expiry,
    });
    router.back();
  }

  async function remove() {
    if (!item) return;
    await removeItem(item.id);
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-row items-center justify-between px-6 py-3">
        <Text className="type-h2">{item.ingredient.name}</Text>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close">
          <Text className="type-button text-muted">Close</Text>
        </Pressable>
      </View>

      <View className="gap-5 p-6">
        <Text className="type-caption">{CATEGORY_LABEL[item.ingredient.category]}</Text>

        {item.ingredient.track_quantity ? (
          <View className="gap-1">
            <Text className="type-body-sm">Quantity ({item.ingredient.default_unit})</Text>
            <TextInput
              value={qtyText}
              onChangeText={setQtyText}
              keyboardType="numeric"
              inputMode="numeric"
              className="rounded-control border border-border px-4 py-3 type-body"
            />
          </View>
        ) : (
          <Text className="type-body-sm">Tracked by presence (no quantity).</Text>
        )}

        <View className="gap-1">
          {/* TODO(design): replace with a date picker (needs a native module → rebuild). */}
          <Text className="type-body-sm">Expires (YYYY-MM-DD, blank for none)</Text>
          <TextInput
            value={expiry}
            onChangeText={setExpiry}
            placeholder="2026-07-01"
            autoCapitalize="none"
            className="rounded-control border border-border px-4 py-3 type-body"
          />
          {!expiryValid ? <Text className="type-caption text-error">Use YYYY-MM-DD.</Text> : null}
        </View>

        <Pressable
          className={`btn btn-primary ${!expiryValid || qtyInvalid ? 'opacity-50' : ''}`}
          disabled={!expiryValid || qtyInvalid}
          onPress={save}>
          <Text className="type-button text-white">Save</Text>
        </Pressable>

        <Pressable className="items-center py-2" onPress={remove}>
          <Text className="type-button text-error">Remove from pantry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
