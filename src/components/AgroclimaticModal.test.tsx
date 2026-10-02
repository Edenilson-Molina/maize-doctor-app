import { render, fireEvent } from '@testing-library/react-native';
import { AgroclimaticModal } from './AgroclimaticModal';
import { type WeatherData } from '@/services/weather/weatherTypes';

const mockWeather: WeatherData = {
  temperature: 25,
  humidity: 85,
  windSpeed: 18,
  soilStatus: 'Adecuada',
  timestamp: Date.now(),
  source: 'live',
};

describe('AgroclimaticModal', () => {
  it('renders modal with guidance and switches tabs', async () => {
    const handleClose = jest.fn();
    const { findByText, findByTestId, findAllByText } = await render(
      <AgroclimaticModal
        visible={true}
        onClose={handleClose}
        selectedMetric="temperature"
        weather={mockWeather}
      />
    );

    expect(await findByText('Criterio Agroclimático')).toBeTruthy();
    expect(await findByText('25 °C')).toBeTruthy();
    expect(await findByText(/Puccinia sorghi/i)).toBeTruthy();

    // Switch to Wind tab
    const windTab = await findByTestId('tab-wind');
    await fireEvent.press(windTab);

    expect(await findByText('18 km/h')).toBeTruthy();
    const elementsWithDeriva = await findAllByText(/deriva/i);
    expect(elementsWithDeriva.length).toBeGreaterThan(0);

    // Close button
    const closeBtn = await findByTestId('close-agroclimatic-modal');
    await fireEvent.press(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
