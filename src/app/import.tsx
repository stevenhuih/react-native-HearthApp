import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useImportStore } from '@/stores/import-store';

// Import a recipe from a shared/pasted link (§07 / US-004). Whisper is invisible —
// the user only ever sees "Importing…". // TODO(design): throughout.
export default function ImportScreen() {
  const router = useRouter();
  const { url: paramUrl } = useLocalSearchParams<{ url?: string }>();
  const { status, result, errorKind, run, reset } = useImportStore();
  const [urlText, setUrlText] = useState(paramUrl ?? '');
  const started = useRef(false);

  // Auto-run when a URL arrives via share intent / Explore.
  useEffect(() => {
    if (paramUrl && !started.current && status === 'idle') {
      started.current = true;
      run(paramUrl);
    }
  }, [paramUrl, status, run]);

  function close() {
    reset();
    router.back();
  }

  // ── processing ────────────────────────────────────────────────────────────
  if (status === 'processing') {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <ActivityIndicator />
          <Text className="type-body">Importing recipe…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── error (US-004 edge/fail) ──────────────────────────────────────────────
  if (status === 'error') {
    const message =
      errorKind === 'no_recipe'
        ? 'We couldn’t find a recipe at that link.'
        : errorKind === 'unsupported'
          ? 'That link isn’t supported — it may be private or unavailable.'
          : 'Something went wrong importing that recipe.';
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="type-h3 text-center">Couldn’t import</Text>
          <Text className="type-body text-center">{message}</Text>
          <View className="w-full gap-3">
            <Pressable className="btn btn-primary" onPress={() => reset()}>
              <Text className="type-button text-white">Try another link</Text>
            </Pressable>
            <Pressable className="items-center py-2" onPress={close}>
              <Text className="type-body-sm">Close</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── done ──────────────────────────────────────────────────────────────────
  if (status === 'done' && result) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-row items-center justify-between px-6 py-3">
          <Text className="type-caption">Saved to your recipes</Text>
          <Pressable onPress={close} accessibilityLabel="Done">
            <Text className="type-button text-muted">Done</Text>
          </Pressable>
        </View>
        <ScrollView className="flex-1">
          <View className="gap-4 p-6">
            <Text className="type-h1">{result.title}</Text>
            <Text className="type-body-sm">
              {result.cook_time_mins ? `${result.cook_time_mins} min · ` : ''}
              {result.have} of {result.total} ingredients in your pantry
            </Text>

            <View className="gap-1">
              <Text className="type-h4">Ingredients</Text>
              {result.ingredients.map((ing, i) => (
                <Text key={`${ing.name}-${i}`} className={ing.have ? 'type-body text-olive' : 'type-body'}>
                  {ing.have ? '✓' : '•'} {ing.name}
                </Text>
              ))}
            </View>

            {result.steps.length > 0 ? (
              <View className="gap-2">
                <Text className="type-h4">Steps</Text>
                {result.steps.map((step) => (
                  <View key={step.n} className="flex-row gap-2">
                    <Text className="type-body">{step.n}.</Text>
                    <Text className="type-body flex-1">{step.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── idle — manual paste ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-row items-center justify-between px-6 py-3">
        <Text className="type-h2">Import a recipe</Text>
        <Pressable onPress={close} accessibilityLabel="Close">
          <Text className="type-button text-muted">Close</Text>
        </Pressable>
      </View>
      <View className="gap-4 p-6">
        <Text className="type-body-sm">
          Paste a link from TikTok, Instagram, YouTube, or a recipe site.
        </Text>
        <TextInput
          value={urlText}
          onChangeText={setUrlText}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="url"
          keyboardType="url"
          className="rounded-control border border-border px-4 py-3 type-body"
        />
        <Pressable
          className={`btn btn-primary ${urlText.trim() ? '' : 'opacity-50'}`}
          disabled={!urlText.trim()}
          onPress={() => run(urlText.trim())}>
          <Text className="type-button text-white">Import</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
