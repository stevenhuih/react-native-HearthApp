import { useRouter } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

// The logged-in shell — 4 tabs + a floating center AI button (design system v2 §05,
// Creme-style). Home · Explore · ✦(AI) · Pantry · Profile. The center is NOT a tab:
// it opens the AI cook-assistant as a presented modal (/ai).
//
// NOTE: <TabList> MUST be a direct child of <Tabs> — expo-router/ui's trigger parser
// only descends into Fragments/TabList, so wrapping it in a View hides every trigger
// ("Couldn't find any screens"). The center button is a non-trigger child of TabList:
// it renders in the bar but the parser ignores it.
//
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
// monochrome (design system note). Reserves a fixed slot in the row; the circle
// itself floats up via absolute positioning. Opens the AI assistant.
function CenterButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ width: 64 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="AI cook-assistant"
        style={{
          position: 'absolute',
          top: -22,
          left: 4, // centre the 56px circle in the 64px slot
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
      <TabList
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
        }}>
        <TabTrigger name="home" href="/" asChild>
          <TabButton icon={HOME_ICON} label="Home" />
        </TabTrigger>
        <TabTrigger name="explore" href="/explore" asChild>
          <TabButton icon={EXPLORE_ICON} label="Explore" />
        </TabTrigger>

        {/* Center AI button — non-trigger child: renders in the bar, ignored by the parser. */}
        <CenterButton onPress={() => router.navigate('/ai')} />

        <TabTrigger name="pantry" href="/pantry" asChild>
          <TabButton icon={HOME_ICON} label="Pantry" />
        </TabTrigger>
        <TabTrigger name="profile" href="/profile" asChild>
          <TabButton icon={HOME_ICON} label="Profile" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
