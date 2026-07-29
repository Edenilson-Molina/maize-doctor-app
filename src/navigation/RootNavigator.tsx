import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/auth/AuthContext';
import { TopAppBar } from '@/components/TopAppBar';
import { BottomTabBar } from '@/components/BottomTabBar';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { ScanScreen } from '@/screens/scan/ScanScreen';
import { HistoryScreen } from '@/screens/history/HistoryScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import type { AuthStackParamList, AppTabParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTabs = createBottomTabNavigator<AppTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function AppTabsNavigator() {
  return (
    <AppTabs.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        header: () => <TopAppBar />,
      }}
    >
      <AppTabs.Screen name="Home" component={HomeScreen} />
      <AppTabs.Screen name="Scan" component={ScanScreen} />
      <AppTabs.Screen name="History" component={HistoryScreen} />
      <AppTabs.Screen name="Profile" component={ProfileScreen} />
    </AppTabs.Navigator>
  );
}

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#1b4332" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppTabsNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
