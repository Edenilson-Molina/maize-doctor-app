import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { validateEmail } from '@/auth/validation';
import { FormInput } from '@/components/FormInput';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    const error = validateEmail(email);
    setEmailError(error);
    if (error) return;
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background px-container-padding"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center items-center">
        <Logo size={80} />
        <Text className="font-hanken-bold text-headline-lg-mobile text-on-surface text-center mb-3 mt-4">
          ¿Olvidaste tu contraseña?
        </Text>
        <Text className="font-inter text-body-md text-on-surface-variant text-center mb-8 px-4">
          No te preocupes. Ingresa tu correo electronico y te enviaremos las instrucciones para
          restablecerla.
        </Text>

        {sent ? (
          <View className="bg-surface-container-lowest rounded-xl p-6 w-full">
            <View className="items-center mb-4">
              <Icon name="email-check-outline" size={48} color="#1b4332" />
            </View>
            <Text className="font-inter text-body-md text-on-surface text-center">
              Si existe una cuenta con ese correo, recibiras las instrucciones en breve.
            </Text>
          </View>
        ) : (
          <View className="bg-surface-container-lowest rounded-xl p-6 w-full">
            <FormInput
              label="CORREO ELECTRONICO"
              placeholder="ejemplo@agromail.com"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setEmailError(undefined);
              }}
              error={emailError}
              icon="email-outline"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Pressable
              className="bg-primary-container rounded-xl min-h-touch-target flex-row items-center justify-center"
              onPress={handleSend}
            >
              <Text className="font-hanken-bold text-body-lg text-on-primary mr-2">
                Enviar instrucciones
              </Text>
              <Icon name="send" size={18} color="#ffffff" />
            </Pressable>
          </View>
        )}
      </View>

      <Pressable
        className="flex-row items-center justify-center pb-8"
        onPress={() => navigation.navigate('Login')}
      >
        <Icon name="arrow-left" size={18} color="#191c1d" />
        <Text className="font-jetbrains-medium text-label-md text-on-surface ml-1.5 tracking-widest">
          VOLVER AL INICIO DE SESION
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
