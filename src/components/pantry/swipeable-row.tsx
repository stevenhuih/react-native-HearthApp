import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

interface Props {
  children: ReactNode;
  /** Swipe LEFT (reveals the right-side action). */
  onMarkUsed: () => void;
  /** Swipe RIGHT (reveals the left-side action). */
  onStillHave: () => void;
}

/**
 * Reanimated swipe row (§07): swipe left → "Mark used" (red), swipe right →
 * "Still have it" (green). A full swipe past threshold fires the action.
 * // TODO(design): action panel visuals, icons, spring feel.
 * // TODO: confirm haptic — needs expo-haptics (a native module → fresh dev build).
 */
export function SwipeableRow({ children, onMarkUsed, onStillHave }: Props) {
  const ref = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      leftThreshold={64}
      rightThreshold={64}
      renderLeftActions={() => (
        <View className="flex-1 justify-center bg-success px-5">
          <Text className="type-button text-white">Still have it</Text>
        </View>
      )}
      renderRightActions={() => (
        <View className="flex-1 items-end justify-center bg-error px-5">
          <Text className="type-button text-white">Mark used</Text>
        </View>
      )}
      onSwipeableOpen={(direction) => {
        ref.current?.close();
        // 'right' = right actions opened (user swiped left) → Mark used.
        // 'left'  = left actions opened (user swiped right) → Still have it.
        if (direction === 'right') onMarkUsed();
        else onStillHave();
      }}>
      {children}
    </ReanimatedSwipeable>
  );
}
