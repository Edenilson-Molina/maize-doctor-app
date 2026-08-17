import { useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@/auth/AuthContext';
import { validateRegisterForm, hasErrors } from '@/auth/validation';
import type { ValidationErrors } from '@/auth/validation';
import { FormInput } from '@/components/FormInput';
import { Logo } from '@/components/Logo';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldError = (field: keyof ValidationErrors) => {
    setErrors((e) => ({ ...e, [field]: undefined }));
    setServerError('');
  };

  const handleRegister = async () => {
    const validationErrors = validateRegisterForm(name, email, password, confirmPassword);
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setIsSubmitting(true);
    setServerError('');
    const result = await register(name, email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigation.getParent()?.navigate('Profile');
      return;
    }

    if (result.error) {
      setServerError(result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-grow px-container-padding py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-6">
          <Logo size={80} />
          <Text className="font-hanken-bold text-display-lg text-on-surface mt-4">Crea tu cuenta</Text>
          <Text className="font-inter text-body-md text-on-surface-variant mt-2 text-center">
            Unete a la plataforma lider en diagnostico agricola de precision.
          </Text>
        </View>

        <View className="bg-surface-container-lowest rounded-xl p-6 mb-6">
          <FormInput
            label="Nombre Completo"
            placeholder="Ej. Juan Perez"
            value={name}
            onChangeText={(t) => {
              setName(t);
              clearFieldError('name');
            }}
            error={errors.name}
            icon="account-outline"
            autoCapitalize="words"
          />

          <FormInput
            label="Correo Electronico"
            placeholder="usuario@campo.com"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              clearFieldError('email');
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
              clearFieldError('password');
            }}
            error={errors.password}
            icon="lock-outline"
            secureTextEntry
          />

          <FormInput
            label="Confirmar Contraseña"
            placeholder="........"
            value={confirmPassword}
            onChangeText={(t) => {
              setConfirmPassword(t);
              clearFieldError('confirmPassword');
            }}
            error={errors.confirmPassword}
            icon="shield-check-outline"
            secureTextEntry
          />

          {serverError ? (
            <View className="bg-error-container rounded-lg p-3 mb-4">
              <Text className="font-inter text-sm text-on-error-container">{serverError}</Text>
            </View>
          ) : null}

          <Pressable
            className={`bg-primary-container rounded-xl min-h-touch-target flex-row items-center justify-center ${
              isSubmitting ? 'opacity-60' : ''
            }`}
            onPress={handleRegister}
            disabled={isSubmitting}
          >
            <Text className="font-hanken-bold text-body-lg text-on-primary mr-2">
              Registrarse
            </Text>
          </Pressable>
        </View>

        <Pressable
          className="flex-row justify-center mb-6"
          onPress={() => navigation.navigate('Login')}
        >
          <Text className="font-inter text-body-md text-on-surface">¿Ya tienes cuenta? </Text>
          <Text className="font-hanken-bold text-body-md text-on-surface underline">
            Inicia sesion
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
