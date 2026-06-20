import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Landing route for the magic-link / OAuth redirect (hearth://(auth)/callback).
 * The actual code exchange runs in AuthProvider's deep-link handler; once the
 * session updates, the root gate redirects onward. This screen only shows a
 * transient loading state.
 */
export default function AuthCallbackScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <ActivityIndicator />
        {/* TODO(design): final copy/branding for the signing-in moment. */}
        <Text className="type-body">Signing you in…</Text>
      </View>
    </SafeAreaView>
  );
}
