import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signInWithApple, signInWithGoogle, signInWithMagicLink } from '@/lib/auth';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  async function run(action: () => Promise<void>) {
    setError(null);
    setIsSubmitting(true);
    try {
      await action();
    } catch (e) {
      // TODO(design): final non-technical error copy/tone in the design pass.
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMagicLink() {
    await run(async () => {
      await signInWithMagicLink(email.trim());
      setMagicLinkSent(true);
    });
  }

  // ── "magic-link-sent" state ────────────────────────────────────────────
  if (magicLinkSent) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 p-6">
          {/* TODO(design): confirmation illustration + final copy/styling. */}
          <Text className="type-h2 text-center">Check your email</Text>
          <Text className="type-body text-center">
            We sent a sign-in link to {email.trim()}. Open it on this device to continue.
          </Text>
          <Pressable
            onPress={() => {
              setMagicLinkSent(false);
              setError(null);
            }}>
            <Text className="type-button text-terracotta">Use a different email</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── sign-in / sign-up entry ────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-1 justify-center gap-6 p-6">
        {/* TODO(design): brand mark, headline treatment, spacing scale. */}
        <View className="gap-1">
          <Text className="type-h1">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</Text>
          <Text className="type-body-sm">Good food, made simple.</Text>
        </View>

        {/* Email magic link */}
        <View className="gap-3">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            editable={!isSubmitting}
            // TODO(design): input field styling (border, height, radius, focus state).
            className="rounded-control border border-border px-4 py-3 type-body"
          />
          <Pressable
            disabled={!emailValid || isSubmitting}
            onPress={handleMagicLink}
            className={`btn btn-primary ${!emailValid || isSubmitting ? 'opacity-50' : ''}`}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="type-button text-white">Send magic link</Text>
            )}
          </Pressable>
        </View>

        {/* Divider */}
        {/* TODO(design): "or" divider treatment. */}
        <Text className="type-caption text-center">or continue with</Text>

        {/* Apple Sign In — iOS only */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={999}
            style={{ height: 48, width: '100%' }}
            onPress={() => run(signInWithApple)}
          />
        )}

        {/* Google OAuth */}
        <Pressable
          disabled={isSubmitting}
          onPress={() => run(signInWithGoogle)}
          className="btn btn-ghost">
          {/* TODO(design): Google logo mark + button styling. */}
          <Text className="type-button text-olive">Continue with Google</Text>
        </Pressable>

        {error ? <Text className="type-body-sm text-error text-center">{error}</Text> : null}

        {/* sign-in / sign-up toggle (magic link is passwordless — copy only) */}
        <Pressable
          onPress={() => setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'))}
          className="items-center">
          <Text className="type-body-sm">
            {mode === 'sign-in' ? 'New to Hearth? Create an account' : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
