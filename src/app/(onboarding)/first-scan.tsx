import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingProgress } from '@/components/onboarding-progress';
import { useAuth } from '@/hooks/use-auth';
import { completeOnboarding } from '@/lib/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';

type Status = 'idle' | 'loading' | 'error';

// Step 4 of 4 — First Scan prompt. Both "Scan receipt" and "Skip" finalize
// onboarding; the gate then routes to Home once onboarding_complete flips.
export default function FirstScanScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const { archetypeId, confirmedItemIds, dietaryProfile, seeds, setLastStep, reset } =
    useOnboardingStore();

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setLastStep(4), [setLastStep]);

  async function finalize() {
    setStatus('loading');
    setError(null);
    try {
      await completeOnboarding({ archetypeId, confirmedItemIds, dietaryProfile, seeds });
      await refreshProfile(); // gate sees onboarding_complete and redirects to '/'
      reset();
      router.replace('/');
    } catch (e) {
      // US-001 failure mode: never strand the user — offer retry.
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  if (status === 'loading') {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <ActivityIndicator />
          <Text className="type-body">Setting up your pantry…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <OnboardingProgress step={4} />
      <View className="flex-1 justify-center gap-4 p-6">
        {/* TODO(design): illustration + copy for the receipt-scan nudge. */}
        <Text className="type-h2">Add your first receipt</Text>
        <Text className="type-body">
          Scan a grocery receipt and Hearth fills your pantry automatically — no typing. You can
          always do this later.
        </Text>

        {status === 'error' ? (
          <Text className="type-body-sm text-error">
            {error ?? 'Something went wrong — tap to retry.'}
          </Text>
        ) : null}
      </View>

      <View className="p-6 gap-3">
        {/* TODO(step 6): open the receipt OCR camera flow. For now this finalizes
            onboarding like Skip; scanning happens from the Pantry tab once built. */}
        <Pressable className="btn btn-primary" onPress={finalize}>
          <Text className="type-button text-white">
            {status === 'error' ? 'Try again' : 'Scan receipt'}
          </Text>
        </Pressable>
        <Pressable className="items-center" onPress={finalize}>
          <Text className="type-body-sm">Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
