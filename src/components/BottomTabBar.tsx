import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon } from './Icon';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Icon>['name'];

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Scan: { active: 'leaf-circle', inactive: 'leaf-circle-outline' },
  History: { active: 'history', inactive: 'history' },
  Profile: { active: 'account', inactive: 'account-outline' },
};

const TAB_LABELS: Record<string, string> = {
  Home: 'Inicio',
  Scan: 'Escanear',
  History: 'Historial',
  Profile: 'Perfil',
};

export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row bg-surface-container-lowest border-t border-outline-variant"
      style={{ paddingBottom: insets.bottom }}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const icons = TAB_ICONS[route.name];
        const label = TAB_LABELS[route.name] ?? route.name;

        return (
          <Pressable
            key={route.key}
            className="flex-1 items-center justify-center py-2 min-h-touch-target"
            onPress={() => {
              if (!isFocused) {
                navigation.navigate(route.name);
              }
            }}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={label}
          >
            <Icon
              name={icons ? (isFocused ? icons.active : icons.inactive) : 'help-circle-outline'}
              size={24}
              color={isFocused ? '#1b4332' : '#717973'}
            />
            <Text
              className={`text-xs mt-1 ${
                isFocused
                  ? 'font-hanken-semibold text-primary-container'
                  : 'font-inter text-outline'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
