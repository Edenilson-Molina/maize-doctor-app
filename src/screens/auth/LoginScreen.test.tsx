import { render, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/AuthContext';
import { LoginScreen } from './LoginScreen';
import { View, Text } from 'react-native';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const Stack = createNativeStackNavigator<{
  Login: undefined;
  ForgotPassword: undefined;
  Register: undefined;
}>();

async function renderLoginScreen() {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <AuthProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword">
              {() => (
                <View>
                  <Text>ForgotPassword</Text>
                </View>
              )}
            </Stack.Screen>
            <Stack.Screen name="Register">
              {() => (
                <View>
                  <Text>Register</Text>
                </View>
              )}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

describe('LoginScreen', () => {
  it('renders all expected elements', async () => {
    const { getByText } = await renderLoginScreen();
    expect(getByText('Iniciar Sesion')).toBeTruthy();
    expect(getByText('Correo Electronico')).toBeTruthy();
    expect(getByText('Entrar')).toBeTruthy();
    expect(getByText('¿Olvido su contraseña?')).toBeTruthy();
    expect(getByText('Crear una cuenta nueva')).toBeTruthy();
  });

  it('shows validation errors when submitting empty form', async () => {
    const { getByText, findByText } = await renderLoginScreen();

    fireEvent.press(getByText('Entrar'));

    expect(await findByText('El correo es requerido.')).toBeTruthy();
    expect(await findByText('La contraseña es requerida.')).toBeTruthy();
  });
});
