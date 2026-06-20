import { useRouter } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

// The logged-in shell — 4 tabs + a floating center AI button (design system v2 §05,
// Creme-style). Home · Explore · ✦(AI) · Pantry · Profile. The center is NOT a tab:
// it opens the AI cook-assistant as a presented modal (/ai).
// TODO(design): real Pantry/Profile icons — Home/Explore use the existing template
// PNGs; Pantry/Profile reuse Home as a placeholder for now.
const HOME_ICON = require('@/assets/images/tabIcons/home.png');
const EXPLORE_ICON = require('@/assets/images/tabIcons/explore.png');

interface TabButtonProps extends TabTriggerSlotProps {
  icon: number;
  label: string;
}

const TabButton = forwardRef<View, TabButtonProps>(function TabButton(
  { icon, label, isFocused, ...props },
  ref
) {
  const tint = isFocused ? colors.ink : colors.muted; // white active · muted inactive
  return (
    <Pressable
      ref={ref}
      {...props}
      className="flex-1 items-center justify-center gap-1 pt-2.5 pb-1"
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}>
      <Image source={icon} style={{ width: 24, height: 24, tintColor: tint }} />
      <Text style={{ color: tint, fontFamily: 'Inter_500Medium', fontSize: 10 }}>{label}</Text>
    </Pressable>
  );
});

// White circle floating above the bar — the signature element that breaks the dark
// monochrome (design system note). Opens the AI assistant.
function CenterButton({ onPress }: { onPress: () => void }) {
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: -22, left: 0, right: 0, alignItems: 'center' }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="AI cook-assistant"
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.ink, // white
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 5,
          borderColor: colors.background, // canvas ring
        }}>
        <Text style={{ color: colors.background, fontSize: 22, fontFamily: 'Inter_800ExtraBold' }}>✦</Text>
      </Pressable>
    </View>
  );
}

export default function AppTabs() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot />
      <View
        style={{
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
        }}>
        <TabList style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon={HOME_ICON} label="Home" />
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton icon={EXPLORE_ICON} label="Explore" />
          </TabTrigger>
          <TabTrigger name="pantry" href="/pantry" asChild>
            <TabButton icon={HOME_ICON} label="Pantry" />
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton icon={HOME_ICON} label="Profile" />
          </TabTrigger>
        </TabList>
        <CenterButton onPress={() => router.navigate('/ai')} />
      </View>
    </Tabs>
  );
}
