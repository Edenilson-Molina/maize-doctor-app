import { Image, View } from 'react-native';
import { Icon } from '@/components/Icon';

interface ScanThumbnailProps {
  uri: string | null;
  size?: number;
  borderRadius?: number;
}

/**
 * Renders a scan's captured photo, falling back to a leaf glyph only when
 * no image URI exists (e.g. mock/dev data).
 */
export function ScanThumbnail({ uri, size, borderRadius = 0 }: ScanThumbnailProps) {
  if (!uri) {
    return (
      <View
        className="w-full h-full bg-surface-container items-center justify-center"
        style={{ borderRadius }}
      >
        <Icon name="leaf" size={size ?? 36} color="#c1c8c2" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      className="w-full h-full"
      style={{ borderRadius }}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
    />
  );
}
