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
import { Contribute } from '@/screens/home/Contribute';
import { ScanScreen } from '@/screens/scan/ScanScreen';
import { ScanResult } from '@/screens/scan/ScanResult';
import { HistoryScreen } from '@/screens/history/HistoryScreen';
import { ScanDetail } from '@/screens/history/ScanDetail';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import type {
  AuthStackParamList,
  AppTabParamList,
  ScanStackParamList,
  HomeStackParamList,
  HistoryStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTabs = createBottomTabNavigator<AppTabParamList>();
const ScanStack = createNativeStackNavigator<ScanStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function ScanNavigator() {
  return (
    <ScanStack.Navigator>
      <ScanStack.Screen
        name="ScanCamera"
        component={ScanScreen}
        options={{ header: () => <TopAppBar /> }}
      />
      <ScanStack.Screen
        name="ScanResult"
        component={ScanResult}
        options={({ navigation }) => ({
          header: () => <TopAppBar onBack={() => navigation.goBack()} />,
        })}
      />
    </ScanStack.Navigator>
  );
}

function HomeNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ header: () => <TopAppBar /> }}
      />
      <HomeStack.Screen
        name="Contribute"
        component={Contribute}
        options={({ navigation }) => ({
          header: () => <TopAppBar onBack={() => navigation.goBack()} />,
        })}
      />
    </HomeStack.Navigator>
  );
}

function HistoryNavigator() {
  return (
    <HistoryStack.Navigator>
      <HistoryStack.Screen
        name="HistoryList"
        component={HistoryScreen}
        options={{ header: () => <TopAppBar /> }}
      />
      <HistoryStack.Screen
        name="ScanDetail"
        component={ScanDetail}
        options={({ navigation }) => ({
          header: () => <TopAppBar onBack={() => navigation.goBack()} />,
        })}
      />
    </HistoryStack.Navigator>
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
      <AppTabs.Screen name="Home" component={HomeNavigator} options={{ headerShown: false }} />
      <AppTabs.Screen name="Scan" component={ScanNavigator} options={{ headerShown: false }} />
      <AppTabs.Screen
        name="History"
        component={HistoryNavigator}
        options={{ headerShown: false }}
      />
      <AppTabs.Screen name="Profile" component={ProfileScreen} />
      <AppTabs.Screen
        name="Auth"
        component={AuthNavigator}
        options={{ tabBarButton: () => null, headerShown: false }}
      />
    </AppTabs.Navigator>
  );
}

export function RootNavigator() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#1b4332" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AppTabsNavigator />
    </NavigationContainer>
  );
}
