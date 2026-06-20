import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { colors } from '@/theme';
import type { FeedRecipe } from '@/types/db';

interface RecipeFeedCardProps {
  recipe: FeedRecipe;
  height: number; // full viewport height → reels-style snap paging
  onToggleLike: (recipeId: string) => void;
}

// One full-bleed feed card (US-V2-01). Hero image from R2 with a graceful fallback,
// amber cuisine kicker, title + meta, and an optimistic like (heart button + double
// tap). // TODO(design): heart-pop animation, real gradient, story rings/filters.
export function RecipeFeedCard({ recipe, height, onToggleLike }: RecipeFeedCardProps) {
  const router = useRouter();
  const [imageFailed, setImageFailed] = useState(false);

  const open = () => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } });
  const like = () => onToggleLike(recipe.id);

  // Double-tap likes; single tap opens detail (Exclusive disambiguates).
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => runOnJS(like)());
  const singleTap = Gesture.Tap().onEnd(() => runOnJS(open)());
  const gesture = Gesture.Exclusive(doubleTap, singleTap);

  const showImage = recipe.hero_image_url && !imageFailed;

  return (
    <View style={{ height, backgroundColor: colors.background }}>
      <GestureDetector gesture={gesture}>
        <View
          style={{
            flex: 1,
            margin: 14,
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: colors.surface,
          }}>
          {showImage ? (
            <Image
              source={{ uri: recipe.hero_image_url! }}
              style={{ flex: 1 }}
              contentFit="cover"
              transition={200}
              onError={() => setImageFailed(true)}
            />
          ) : (
            // Dark fallback tile — never a broken-image icon (US-V2-01).
            <View className="flex-1 items-center justify-center gap-2 p-6">
              {recipe.cuisine_theme ? <Text className="type-label">{recipe.cuisine_theme}</Text> : null}
              <Text className="type-h2 text-center">{recipe.title}</Text>
              <Text className="type-caption">Image coming soon</Text>
            </View>
          )}

          {/* Like button (also works via double-tap). */}
          <Pressable
            onPress={like}
            accessibilityRole="button"
            accessibilityLabel={recipe.liked ? 'Unlike recipe' : 'Like recipe'}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(0,0,0,0.4)',
              borderRadius: 999,
              paddingHorizontal: 11,
              paddingVertical: 7,
            }}>
            <Text style={{ fontSize: 16, color: recipe.liked ? colors.like : colors.white }}>
              {recipe.liked ? '♥' : '♡'}
            </Text>
            {recipe.like_count > 0 ? (
              <Text style={{ color: colors.white, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                {recipe.like_count}
              </Text>
            ) : null}
          </Pressable>

          {/* Bottom scrim + meta. // TODO(design): replace the flat scrim with a gradient. */}
          {showImage ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingHorizontal: 18,
                paddingTop: 56,
                paddingBottom: 18,
                backgroundColor: 'rgba(0,0,0,0.55)',
              }}>
              {recipe.cuisine_theme ? <Text className="type-label">{recipe.cuisine_theme}</Text> : null}
              <Text className="type-h2 text-white" numberOfLines={2}>
                {recipe.title}
              </Text>
              <View className="mt-1 flex-row gap-3">
                {recipe.cook_time_mins ? (
                  <Text className="type-body-sm text-white">{recipe.cook_time_mins} min</Text>
                ) : null}
                {recipe.difficulty ? (
                  <Text className="type-body-sm text-white" style={{ textTransform: 'capitalize' }}>
                    {recipe.difficulty}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}
