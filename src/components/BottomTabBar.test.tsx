import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomTabBar } from './BottomTabBar';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderTabBar(routeNames: string[]) {
  const props = {
    state: {
      index: 0,
      routes: routeNames.map((name) => ({ key: `${name}-key`, name })),
    },
    navigation: { navigate: jest.fn() },
  } as unknown as BottomTabBarProps;

  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <BottomTabBar {...props} />
    </SafeAreaProvider>
  );
}

describe('BottomTabBar', () => {
  it('renders the four labelled tabs', async () => {
    const { queryByText } = await renderTabBar(['Home', 'Scan', 'History', 'Profile']);

    expect(queryByText('Inicio')).toBeTruthy();
    expect(queryByText('Escanear')).toBeTruthy();
    expect(queryByText('Historial')).toBeTruthy();
    expect(queryByText('Perfil')).toBeTruthy();
  });

  it('omits routes with no label, such as the hidden Auth stack', async () => {
    const { queryByText } = await renderTabBar(['Home', 'Scan', 'History', 'Profile', 'Auth']);

    expect(queryByText('Auth')).toBeNull();
    expect(queryByText('Perfil')).toBeTruthy();
  });
});
