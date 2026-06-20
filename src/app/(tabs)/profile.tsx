import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Tab 5 — Profile & Settings (architecture v2 §01). The full contents — Collections
// (saved + imported), custom recipe upload, subscription, household, allergies, stats,
// and a flexible local cooking reminder — arrive in their own v2 steps.
// TODO(design): throughout — neutral structural placeholder only.
export default function ProfileScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View className="flex-1 gap-6 p-6">
        <View className="gap-1 pt-4">
          <Text className="type-h1">Profile</Text>
          <Text className="type-body-sm">Settings and preferences.</Text>
        </View>

        {/* TODO(reminders): local cooking reminder (day/time) via expo-notifications — §08 step 9. */}
        {/* TODO(later steps): Collections (saved + imported), custom recipe upload,
            subscription, household, allergies, stats. */}
      </View>
    </SafeAreaView>
  );
}
