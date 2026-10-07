import * as SecureStore from 'expo-secure-store';
import {
  classifySoilMoisture,
  fetchWeather,
  getAgroclimaticGuidance,
  loadCachedWeather,
  resetWeatherState,
  DEFAULT_OFFLINE_WEATHER,
} from './weatherService';
import { type WeatherData } from './weatherTypes';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/utils/location', () => ({
  getLocationCoordinates: jest.fn().mockResolvedValue({ latitude: 13.7, longitude: -89.2 }),
}));

describe('weatherService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWeatherState();
    (global as any).fetch = jest.fn();
  });

  describe('classifySoilMoisture', () => {
    it('handles null/undefined returning Adecuada', () => {
      expect(classifySoilMoisture(null)).toBe('Adecuada');
      expect(classifySoilMoisture(undefined)).toBe('Adecuada');
    });

    it('classifies dry soil below 0.15', () => {
      expect(classifySoilMoisture(0.12)).toBe('Seca');
    });

    it('classifies adequate soil between 0.15 and 0.38', () => {
      expect(classifySoilMoisture(0.25)).toBe('Adecuada');
    });

    it('classifies waterlogged soil above 0.38', () => {
      expect(classifySoilMoisture(0.42)).toBe('Exceso de Agua');
    });
  });

  describe('fetchWeather', () => {
    it('fetches live weather from Open-Meteo, saves to cache, and returns live WeatherData', async () => {
      const mockApiResponse = {
        current: {
          temperature_2m: 26.4,
          relative_humidity_2m: 78.2,
          wind_speed_10m: 11.1,
          soil_moisture_0_to_1cm: 0.28,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      const weather = await fetchWeather({ latitude: 13.7, longitude: -89.2 });

      expect(weather.source).toBe('live');
      expect(weather.temperature).toBe(26);
      expect(weather.humidity).toBe(78);
      expect(weather.windSpeed).toBe(11);
      expect(weather.soilStatus).toBe('Adecuada');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'doctor_maiz_weather_cache',
        expect.stringContaining('"temperature":26')
      );
    });

    it('falls back to cached weather when fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const cachedData: WeatherData = {
        temperature: 23,
        humidity: 82,
        windSpeed: 14,
        soilStatus: 'Seca',
        timestamp: 1600000000000,
        source: 'live',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const weather = await fetchWeather({ latitude: 13.7, longitude: -89.2 });

      expect(weather.source).toBe('cached');
      expect(weather.temperature).toBe(23);
      expect(weather.humidity).toBe(82);
      expect(weather.soilStatus).toBe('Seca');
    });

    it('returns default weather when network fails and no cache exists', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network timeout'));
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

      const weather = await fetchWeather({ latitude: 13.7, longitude: -89.2 });

      expect(weather.temperature).toBe(DEFAULT_OFFLINE_WEATHER.temperature);
      expect(weather.humidity).toBe(DEFAULT_OFFLINE_WEATHER.humidity);
      expect(weather.windSpeed).toBe(DEFAULT_OFFLINE_WEATHER.windSpeed);
    });
  });

  describe('getAgroclimaticGuidance', () => {
    const sampleData: WeatherData = {
      temperature: 25,
      humidity: 85,
      windSpeed: 18,
      soilStatus: 'Exceso de Agua',
      timestamp: Date.now(),
      source: 'live',
    };

    it('provides correct guidance for rust-risk temperature (20-28°C)', () => {
      const guidance = getAgroclimaticGuidance('temperature', sampleData);
      expect(guidance.riskStatus).toBe('alert');
      expect(guidance.statusBadge).toContain('Roya');
      expect(guidance.agronomicDescription).toContain('Puccinia sorghi');
    });

    it('provides favorable status for temperature outside rust range', () => {
      const coldData = { ...sampleData, temperature: 16 };
      const guidance = getAgroclimaticGuidance('temperature', coldData);
      expect(guidance.riskStatus).toBe('favorable');
    });

    it('identifies critical humidity above 80%', () => {
      const guidance = getAgroclimaticGuidance('humidity', sampleData);
      expect(guidance.riskStatus).toBe('alert');
      expect(guidance.currentValueDisplay).toBe('85 %');
      expect(guidance.fieldRecommendation).toContain('rocío');
    });

    it('identifies soil moisture excess and warning', () => {
      const guidanceExcess = getAgroclimaticGuidance('soil', sampleData);
      expect(guidanceExcess.riskStatus).toBe('alert');
      expect(guidanceExcess.statusBadge).toContain('Encharcado');

      const guidanceDry = getAgroclimaticGuidance('soil', { ...sampleData, soilStatus: 'Seca' });
      expect(guidanceDry.riskStatus).toBe('warning');
      expect(guidanceDry.statusBadge).toContain('Déficit');
    });

    it('warns when wind is above 15 km/h for spray drift', () => {
      const guidanceWind = getAgroclimaticGuidance('wind', sampleData);
      expect(guidanceWind.riskStatus).toBe('alert');
      expect(guidanceWind.statusBadge).toContain('No Apto');
      expect(guidanceWind.fieldRecommendation).toContain('deriva');

      const safeWind = getAgroclimaticGuidance('wind', { ...sampleData, windSpeed: 8 });
      expect(safeWind.riskStatus).toBe('favorable');
      expect(safeWind.statusBadge).toContain('Apto');
    });
  });
});
