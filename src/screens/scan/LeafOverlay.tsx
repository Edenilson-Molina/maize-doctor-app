import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

const LEAF_WIDTH = 260;
const LEAF_HEIGHT = 320;
const FRAME_SIZE = 32;

export function LeafOverlay() {
  const scanLinePosition = useSharedValue(0);

  useEffect(() => {
    scanLinePosition.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [scanLinePosition]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLinePosition.value * (LEAF_HEIGHT - 2) }],
    opacity: scanLinePosition.value === 0 || scanLinePosition.value === 1 ? 0.4 : 1,
  }));

  return (
    <View
      pointerEvents="none"
      className="items-center justify-center"
      style={{ width: LEAF_WIDTH, height: LEAF_HEIGHT }}
    >
      <View
        style={{
          width: LEAF_WIDTH,
          height: LEAF_HEIGHT,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: 'rgba(255,255,255,0.8)',
          borderTopLeftRadius: 999,
          borderBottomRightRadius: 999,
          transform: [{ rotate: '-15deg' }],
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: '#a5d0b9',
              shadowColor: '#a5d0b9',
              shadowOpacity: 0.9,
              shadowRadius: 8,
            },
            scanLineStyle,
          ]}
        />
      </View>

      <View
        className="absolute left-0 top-0 border-l-2 border-t-2 border-white/60"
        style={{ width: FRAME_SIZE, height: FRAME_SIZE }}
      />
      <View
        className="absolute right-0 top-0 border-r-2 border-t-2 border-white/60"
        style={{ width: FRAME_SIZE, height: FRAME_SIZE }}
      />
      <View
        className="absolute bottom-0 left-0 border-b-2 border-l-2 border-white/60"
        style={{ width: FRAME_SIZE, height: FRAME_SIZE }}
      />
      <View
        className="absolute bottom-0 right-0 border-b-2 border-r-2 border-white/60"
        style={{ width: FRAME_SIZE, height: FRAME_SIZE }}
      />
    </View>
  );
}
