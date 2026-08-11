import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface ConfidenceDonutProps {
  confidence: number; // 0–1
  size?: number;
}

const STROKE_WIDTH = 8;

export function ConfidenceDonut({ confidence, size = 96 }: ConfidenceDonutProps) {
  const progress = Math.max(0, Math.min(1, confidence));
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#a5d0b9"
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </Svg>
      <Text
        className="font-hanken-bold text-on-primary-container"
        style={{ fontSize: size * 0.28 }}
      >
        {Math.round(progress * 100)}%
      </Text>
    </View>
  );
}
