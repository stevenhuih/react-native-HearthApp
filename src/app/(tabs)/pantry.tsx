import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PantryItemRow } from '@/components/pantry/pantry-item-row';
import { SwipeableRow } from '@/components/pantry/swipeable-row';
import { CATEGORIES } from '@/constants/categories';
import { isRedZone } from '@/lib/expiry';
import { captureReceiptImage } from '@/lib/ocr';
import { useOcrStore } from '@/stores/ocr-store';
import { usePantryStore } from '@/stores/pantry-store';
import type { PantryItem } from '@/types/db';

// Tab 2 — Pantry (§07). Red Zone pinned top, then collapsible category sections,
// each soonest-to-expire first. All styling is // TODO(design):.
export default function PantryScreen() {
  const router = useRouter();
  const items = usePantryStore((s) => s.items);
  const isLoading = usePantryStore((s) => s.isLoading);
  const error = usePantryStore((s) => s.error);
  const loadAll = usePantryStore((s) => s.loadAll);
  const dismissError = usePantryStore((s) => s.dismissError);
  const runScan = useOcrStore((s) => s.runScan);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Scan → camera → OCR Confirm (§07). Needs the expo-image-picker native module
  // (present only after a dev build that includes it). Cancel/deny → no-op.
  async function handleScan() {
    const base64 = await captureReceiptImage();
    if (!base64) return;
    runScan(base64); // sets processing synchronously
    router.push('/ocr-confirm');
  }

  const { redZone, categorySections } = useMemo(() => {
    const rz = items.filter((it) => isRedZone(it.expires_at));
    const rest = items.filter((it) => !isRedZone(it.expires_at));
    const sections = CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      emoji: c.emoji,
      items: rest.filter((it) => it.ingredient.category === c.key),
    })).filter((s) => s.items.length > 0);
    return { redZone: rz, categorySections: sections };
  }, [items]);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      {/* Header — TODO(design): real scan/add icons + title styling */}
      <View className="flex-row items-center justify-between px-6 py-3">
        <Text className="type-h2">Pantry</Text>
        <View className="flex-row items-center gap-4">
          <Pressable accessibilityLabel="Scan receipt" onPress={handleScan}>
            <Text className="type-button text-muted">Scan</Text>
          </Pressable>
          <Pressable accessibilityLabel="Add item" onPress={() => router.push('/add-item')}>
            <Text className="type-button text-terracotta">+ Add</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <Pressable onPress={dismissError} className="mx-6 mb-2 rounded-control bg-cream-deep px-4 py-2">
          <Text className="type-body-sm text-error">{error} (tap to dismiss)</Text>
        </Pressable>
      ) : null}

      {isLoading && items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-4 p-6">
          {/* First-class empty state (AGENTS.md): an invitation, not a dead end. */}
          <Text className="type-h3 text-center">Your pantry is empty</Text>
          <Text className="type-body text-center">Scan a receipt or add items to get started.</Text>
          <View className="w-full gap-3">
            <Pressable className="btn btn-primary" accessibilityLabel="Scan a receipt" onPress={handleScan}>
              <Text className="type-button text-white">Scan a receipt</Text>
            </Pressable>
            <Pressable className="btn btn-ghost" onPress={() => router.push('/add-item')}>
              <Text className="type-button text-olive">Add items manually</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView className="flex-1">
          <View className="pb-10">
            {redZone.length > 0 ? (
              <Section
                title={`Red Zone · ${redZone.length}`}
                collapsed={collapsed.has('redzone')}
                onToggle={() => toggle('redzone')}>
                {redZone.map((item) => (
                  <PantryRow key={item.id} item={item} />
                ))}
              </Section>
            ) : null}

            {categorySections.map((section) => (
              <Section
                key={section.key}
                title={`${section.emoji}  ${section.label} · ${section.items.length}`}
                collapsed={collapsed.has(section.key)}
                onToggle={() => toggle(section.key)}>
                {section.items.map((item) => (
                  <PantryRow key={item.id} item={item} />
                ))}
              </Section>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({
  title,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-2">
      {/* TODO(design): section header treatment + chevron icon */}
      <Pressable onPress={onToggle} className="flex-row items-center justify-between px-6 py-2">
        <Text className="type-caption">{title}</Text>
        <Text className="type-caption text-muted">{collapsed ? '▸' : '▾'}</Text>
      </Pressable>
      {!collapsed ? children : null}
    </View>
  );
}

function PantryRow({ item }: { item: PantryItem }) {
  const router = useRouter();
  const markUsed = usePantryStore((s) => s.markUsedOptimistic);
  const stillHave = usePantryStore((s) => s.stillHaveItOptimistic);

  return (
    <SwipeableRow onMarkUsed={() => markUsed(item.id)} onStillHave={() => stillHave(item.id)}>
      <Pressable onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}>
        <PantryItemRow item={item} />
      </Pressable>
    </SwipeableRow>
  );
}
