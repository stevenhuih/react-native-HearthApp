import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecipeFeedCard } from '@/components/feed/recipe-feed-card';
import { useFeedStore } from '@/stores/feed-store';
import { colors } from '@/theme';

// Tab 1 — Home: the content-first front door. A vertical, swipe-to-next feed of
// hearth_featured recipe cards (US-V2-01). Browsing costs zero AI — plain query.
// // TODO(design): brand mark, "Get Plus" pill, story rings, theme filters.
export default function HomeScreen() {
  const items = useFeedStore((s) => s.items);
  const isLoading = useFeedStore((s) => s.isLoading);
  const error = useFeedStore((s) => s.error);
  const load = useFeedStore((s) => s.load);
  const toggleLike = useFeedStore((s) => s.toggleLike);
  const [listHeight, setListHeight] = useState(0);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onLayout = (e: LayoutChangeEvent) => setListHeight(e.nativeEvent.layout.height);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 22, letterSpacing: -0.6, color: colors.ink }}>
          hearth<Text style={{ color: colors.amber }}>.</Text>
        </Text>
        {/* TODO(design): Get Plus pill + header actions. */}
      </View>

      <View style={{ flex: 1 }} onLayout={onLayout}>
        {error && items.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-4 p-6">
            <Text className="type-body text-center">{error}</Text>
            <Pressable className="btn btn-primary" onPress={load}>
              <Text className="type-button text-white">Try again</Text>
            </Pressable>
          </View>
        ) : isLoading && items.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.muted} />
          </View>
        ) : items.length === 0 ? (
          // Empty feed (pre-launch) — friendly, never blank (US-V2-01).
          <View className="flex-1 items-center justify-center gap-2 p-8">
            <Text className="type-display">✦</Text>
            <Text className="type-h2 text-center">New recipes coming</Text>
            <Text className="type-body-sm text-center">
              We’re cooking up the launch library. Check back soon for recipes you can make tonight.
            </Text>
          </View>
        ) : listHeight > 0 ? (
          <FlashList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={({ item }) => (
              <RecipeFeedCard recipe={item} height={listHeight} onToggleLike={toggleLike} />
            )}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            refreshing={isLoading}
            onRefresh={load}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
