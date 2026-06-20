import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { expiryLabel } from '@/lib/expiry';
import { captureReceiptImage } from '@/lib/ocr';
import { useOcrStore } from '@/stores/ocr-store';

// OCR Confirm (§07): processing → review (removable items + dropped note) →
// batch insert. Plus the US-002 failure state with Retry. // TODO(design):.
export default function OcrConfirmScreen() {
  const router = useRouter();
  const { status, items, droppedCount, errorKind, runScan, removeItem, confirm, reset } =
    useOcrStore();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function close() {
    reset();
    router.back();
  }

  async function retry() {
    const base64 = await captureReceiptImage();
    if (base64) runScan(base64);
  }

  async function onConfirm() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await confirm();
      router.back();
    } catch {
      setSubmitError('We couldn’t add those items. Please try again.');
      setSubmitting(false);
    }
  }

  // ── processing ───────────────────────────────────────────────────────────
  if (status === 'processing') {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <ActivityIndicator />
          <Text className="type-body">Reading your receipt…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── error (US-002 failure mode) ────────────────────────────────────────────
  if (status === 'error') {
    const message =
      errorKind === 'unreadable'
        ? 'We couldn’t read that receipt — try better lighting or a flatter surface.'
        : 'Something went wrong reading your receipt. Please try again.';
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="type-h3 text-center">Scan failed</Text>
          <Text className="type-body text-center">{message}</Text>
          <View className="w-full gap-3">
            <Pressable className="btn btn-primary" onPress={retry}>
              <Text className="type-button text-white">Try again</Text>
            </Pressable>
            <Pressable className="items-center py-2" onPress={close}>
              <Text className="type-body-sm">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── review ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-row items-center justify-between px-6 py-3">
        <Text className="type-h2">Confirm items</Text>
        <Pressable onPress={close} accessibilityLabel="Cancel">
          <Text className="type-button text-muted">Cancel</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="type-body text-center">
            No trackable ingredients were found on this receipt.
          </Text>
          <Pressable className="btn btn-ghost" onPress={retry}>
            <Text className="type-button text-olive">Scan again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView className="flex-1">
            <View className="p-6 gap-2">
              {items.map((item, index) => (
                <View
                  key={`${item.ingredient_id}-${index}`}
                  className="flex-row items-center justify-between rounded-control border border-border px-4 py-3">
                  <View className="flex-1">
                    <Text className="type-body">{item.name}</Text>
                    <Text className="type-caption">
                      {item.quantity != null ? `${item.quantity} ${item.unit} · ` : ''}
                      Est. {expiryLabel(item.expires_at)}
                    </Text>
                  </View>
                  {/* Remove before confirming — no forced additions (US-002). */}
                  <Pressable onPress={() => removeItem(index)} accessibilityLabel={`Remove ${item.name}`}>
                    <Text className="type-button text-muted">✕</Text>
                  </Pressable>
                </View>
              ))}

              {droppedCount > 0 ? (
                <Text className="type-caption mt-2">
                  {droppedCount} item{droppedCount === 1 ? '' : 's'} weren’t added — Hearth tracks
                  fresh ingredients and staples.
                </Text>
              ) : null}

              {submitError ? <Text className="type-body-sm text-error mt-2">{submitError}</Text> : null}
            </View>
          </ScrollView>

          <View className="p-6">
            <Pressable
              className={`btn btn-primary ${submitting ? 'opacity-50' : ''}`}
              disabled={submitting}
              onPress={onConfirm}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="type-button text-white">
                  Add {items.length} item{items.length === 1 ? '' : 's'} to pantry
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
