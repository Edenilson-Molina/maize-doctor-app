import { useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@/auth/AuthContext';
import { validateLoginForm, hasErrors } from '@/auth/validation';
import type { ValidationErrors } from '@/auth/validation';
import { FormInput } from '@/components/FormInput';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    const validationErrors = validateLoginForm(email, password);
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setIsSubmitting(true);
    setServerError('');
    const result = await login(email, password);
    setIsSubmitting(false);

    if (!result.success && result.error) {
      setServerError(result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-end px-container-padding pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-6">
          <Logo size={96} />
        </View>

        <View className="bg-surface-container-lowest rounded-xl p-6 mb-6">
          <Text className="font-hanken-bold text-headline-md text-on-surface mb-6">
            Iniciar Sesion
          </Text>

          <FormInput
            label="Correo Electronico"
            placeholder="ejemplo@correo.com"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setErrors((e) => ({ ...e, email: undefined }));
              setServerError('');
            }}
            error={errors.email}
            icon="email-outline"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormInput
            label="Contraseña"
            placeholder="........"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setErrors((e) => ({ ...e, password: undefined }));
              setServerError('');
            }}
            error={errors.password}
            icon="lock-outline"
            secureTextEntry
          />

          <Pressable
            className="self-end mb-4"
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text className="font-inter text-sm text-secondary">
              ¿Olvido su contraseña?
            </Text>
          </Pressable>

          {serverError ? (
            <View className="bg-error-container rounded-lg p-3 mb-4">
              <Text className="font-inter text-sm text-on-error-container">{serverError}</Text>
            </View>
          ) : null}

          <Pressable
            className={`bg-primary-container rounded-xl min-h-touch-target items-center justify-center ${
              isSubmitting ? 'opacity-60' : ''
            }`}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            <Text className="font-hanken-bold text-body-lg text-on-primary">Entrar</Text>
          </Pressable>

          <View className="flex-row items-center justify-center mt-6">
            <Icon name="cloud-check-outline" size={18} color="#717973" />
            <Text className="font-inter text-sm text-outline ml-1.5">Sistema en linea</Text>
          </View>
        </View>

        <Pressable
          className="flex-row justify-center mb-6"
          onPress={() => navigation.navigate('Register')}
        >
          <Text className="font-inter text-body-md text-on-surface">
            ¿No tiene una cuenta?{' '}
          </Text>
          <Text className="font-hanken-bold text-body-md text-on-surface underline">
            Crear una cuenta nueva
          </Text>
        </Pressable>

        <View className="items-center">
          <Text className="font-jetbrains text-xs text-outline tracking-widest">
            RESILIENCIA & PRECISION
          </Text>
          <Text className="font-inter text-xs text-outline mt-1">
            © 2024 DoctorMaiz AgroTech Solutions
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
