import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from './Logo';

interface TopAppBarProps {
  title?: string;
}

export function TopAppBar({ title = 'DoctorMaiz' }: TopAppBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-primary-container px-container-padding pb-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <View className="flex-row items-center">
        <Logo size={32} />
        <Text className="font-hanken-bold text-headline-sm text-on-primary ml-2">
          {title}
        </Text>
      </View>
    </View>
  );
}
