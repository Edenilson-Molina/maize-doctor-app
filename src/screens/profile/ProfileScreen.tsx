import { View, Text, Pressable } from 'react-native';
import { useAuth } from '@/auth/AuthContext';

export function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 bg-background items-center justify-center px-container-padding">
      <Text className="font-hanken-semibold text-headline-md text-on-surface">
        Perfil e Impacto
      </Text>
      {user && (
        <Text className="font-inter text-body-md text-on-surface-variant mt-stack-sm">
          {user.name}
        </Text>
      )}
      <Text className="font-inter text-body-md text-on-surface-variant mt-1 mb-stack-md">
        Placeholder — Fase 6
      </Text>
      <Pressable
        className="border border-outline rounded-lg px-8 py-4 min-h-touch-target items-center justify-center"
        onPress={logout}
      >
        <Text className="font-hanken-semibold text-body-md text-on-surface">Cerrar Sesion</Text>
      </Pressable>
    </View>
  );
}
