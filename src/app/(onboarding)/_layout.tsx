import { Stack } from 'expo-router';

// The 4-step wizard. Each step renders its own <OnboardingProgress /> so the
// progress bar stays visible across the flow (US-001).
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
