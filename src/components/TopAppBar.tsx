import { Pressable, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from './Logo';
import { Icon } from './Icon';

interface TopAppBarProps {
  title?: string;
  onBack?: () => void;
}

export function TopAppBar({ title = 'DoctorMaiz', onBack }: TopAppBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-primary-container px-container-padding pb-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <View className="flex-row items-center">
        {onBack ? (
          <Pressable onPress={onBack} className="mr-2" accessibilityLabel="Volver">
            <Icon name="arrow-left" size={24} color="#ffffff" />
          </Pressable>
        ) : null}
        <Logo size={32} />
        <Text className="font-hanken-bold text-headline-sm text-on-primary ml-2">{title}</Text>
      </View>
    </View>
  );
}
