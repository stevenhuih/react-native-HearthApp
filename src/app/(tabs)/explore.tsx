import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Tab 3 — Explore (Saved + Community). Step 8 wires the import entry point; the
// full Saved/Community lists come in step 11. // TODO(design): throughout.
export default function ExploreScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View className="flex-1 gap-6 p-6">
        <View className="gap-1 pt-4">
          <Text className="type-h1">Explore</Text>
          <Text className="type-body-sm">Import recipes from anywhere and cook from your pantry.</Text>
        </View>

        <Pressable className="btn btn-primary" onPress={() => router.push('/import')}>
          <Text className="type-button text-white">Import from link</Text>
        </Pressable>

        <Text className="type-caption">
          Or share a TikTok, Instagram, or YouTube link to Hearth from that app’s share menu.
        </Text>

        {/* TODO(step 11): Saved recipes list (pantry-sorted) + Community tab. */}
      </View>
    </SafeAreaView>
  );
}
