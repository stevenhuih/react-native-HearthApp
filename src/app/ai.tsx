import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePanicStore } from '@/stores/panic-store';
import { colors } from '@/theme';

// AI cook-assistant (the center tab button) — presented full-screen modal.
// v1 ships the one-shot "I'm exhausted" (pantry in → one recipe out), reusing the
// existing panic flow. Conversational chat is Phase 2. The full ai-exhausted
// rescope (retrieve-before-generate) is §08 step 7.
// TODO(design): full Creme-style treatment; this is the structural dark version.
export default function AiScreen() {
  const router = useRouter();
  const runPanic = usePanicStore((s) => s.run);

  function imExhausted() {
    runPanic(); // sets loading; panic-result reads the store
    router.push('/panic-result');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View className="flex-row items-center justify-between px-6 py-3">
        <Text className="type-label">AI Assistant</Text>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close">
          <Text className="type-button text-muted">Close</Text>
        </Pressable>
      </View>

      <View className="flex-1 justify-center gap-7 p-6">
        <View className="gap-3">
          <Text className="type-display">✦</Text>
          <Text className="type-h1">Don’t feel like deciding?</Text>
          <Text className="type-body-sm">
            Tell Hearth you’re exhausted and it’ll pick one thing to cook from what you already have —
            using only your pantry, respecting your allergies.
          </Text>
        </View>

        <Pressable className="btn btn-primary" onPress={imExhausted}>
          <Text className="type-button text-white text-center">I’m exhausted — tell me what to cook</Text>
        </Pressable>

        {/* TODO(phase 2): conversational chat assistant (GPT-4o, Plus). */}
      </View>
    </SafeAreaView>
  );
}
