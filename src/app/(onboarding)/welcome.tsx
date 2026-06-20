import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingProgress } from '@/components/onboarding-progress';
import { useOnboardingStore } from '@/stores/onboarding-store';

// Step 1 of 4 — Welcome. Static value prop, no data.
export default function WelcomeScreen() {
  const router = useRouter();
  const setLastStep = useOnboardingStore((s) => s.setLastStep);

  useEffect(() => setLastStep(1), [setLastStep]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <OnboardingProgress step={1} />
      <View className="flex-1 justify-center gap-4 p-6">
        {/* TODO(design): hero art, value-prop copy, and typographic treatment. */}
        <Text className="type-h1">Welcome to Hearth</Text>
        <Text className="type-body">
          Scan a receipt, and Hearth tracks what&apos;s in your kitchen and what&apos;s about to
          expire — then tells you what to cook tonight. No manual logging, ever.
        </Text>
      </View>
      <View className="p-6">
        <Pressable className="btn btn-primary" onPress={() => router.push('/(onboarding)/archetype')}>
          <Text className="type-button text-white">Get started</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
