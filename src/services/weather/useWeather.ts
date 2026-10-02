import { useState, useEffect, useCallback } from 'react';
import {
  fetchWeather,
  getLatestWeather,
  loadCachedWeather,
} from './weatherService';
import { type WeatherData } from './weatherTypes';

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData>(() => getLatestWeather());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshWeather = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchWeather();
      setWeather(data);
    } catch {
      // Offline fallback already handled internally
      setWeather(getLatestWeather());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // First load cached data immediately to avoid any UI flash
    loadCachedWeather().then((cached) => {
      if (isMounted && cached) {
        setWeather(cached);
      }
    });

    // Then attempt background refresh
    fetchWeather().then((liveData) => {
      if (isMounted) {
        setWeather(liveData);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    weather,
    isLoading,
    refreshWeather,
  };
}
