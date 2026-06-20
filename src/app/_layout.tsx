import '@/global.css';

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { fontAssets } from '@/theme';

// Keep the native splash up until the design-system fonts are ready so text
// never flashes in a fallback family. The AnimatedSplashOverlay handles the
// transition once we hand off.
SplashScreen.preventAutoHideAsync();

/**
 * Auth gate (architecture §06). Redirects based on session + onboarding state:
 *   - no session                 -> (auth)
 *   - session, not onboarded     -> (onboarding)
 *   - session, onboarded         -> (tabs)  [URLs unchanged: "/", "/explore"]
 * Onboarding gates the tab bar until users.onboarding_complete = true.
 */
function RootGate() {
  const { session, profile, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const group = segments[0]; // '(auth)' | '(onboarding)' | '(tabs)' | undefined
    const inAuth = group === '(auth)';
    const inOnboarding = group === '(onboarding)';

    if (!session) {
      if (!inAuth) router.replace('/(auth)/sign-in');
      return;
    }

    if (!profile?.onboarding_complete) {
      if (!inOnboarding) router.replace('/(onboarding)/welcome');
      return;
    }

    // Signed in and onboarded — leave the auth/onboarding flows for the tabs.
    if (inAuth || inOnboarding) router.replace('/');
  }, [isLoading, session, profile, segments, router]);

  return (
    <>
      <ShareIntentHandler />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
        <Stack.Screen name="item/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ocr-confirm" options={{ presentation: 'modal' }} />
        <Stack.Screen name="panic-result" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

/**
 * Routes a shared URL (iOS Share Extension / Android Share Target) into the
 * import flow. The native module is optional, so on a build without it this
 * simply never fires (hasShareIntent stays false). Only acts once the user is
 * signed in + onboarded so the gate doesn't bounce the modal.
 */
function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const { session, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hasShareIntent) return;
    const url = shareIntent.webUrl ?? shareIntent.text ?? null;
    if (url && session && profile?.onboarding_complete) {
      router.push({ pathname: '/import', params: { url } });
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, session, profile, router, resetShareIntent]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AnimatedSplashOverlay />
          <RootGate />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
