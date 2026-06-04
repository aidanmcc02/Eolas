const LAT = 53.3498;
const LON = -6.2603;

const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';

export interface CurrentConditions {
  temp: number;
  feelsLike: number;
  code: number;
  windSpeed: number;
}

export interface DailyForecast {
  date: Date;
  tempMin: number;
  tempMax: number;
  code: number;
  precip: number;
  uvIndex: number;
}

export interface PollenLevels {
  grass: number;
  alder: number;
  birch: number;
}

export interface WeatherData {
  current: CurrentConditions;
  today: DailyForecast;
  week: DailyForecast[];
  pollen: PollenLevels | null;
}

interface OpenMeteoForecast {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weathercode: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weathercode: number[];
    uv_index_max: number[];
  };
}

interface OpenMeteoAirQuality {
  hourly: {
    grass_pollen: (number | null)[];
    alder_pollen: (number | null)[];
    birch_pollen: (number | null)[];
  };
}

const maxOf = (arr: (number | null)[]) =>
  arr.reduce<number>((m, v) => (v != null && v > m ? v : m), 0);

export async function fetchWeather(): Promise<WeatherData> {
  const [forecastRes, pollenRes] = await Promise.allSettled([
    fetch(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,apparent_temperature,weathercode,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max` +
      `&timezone=Europe%2FDublin&forecast_days=7`,
    ),
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
      `?latitude=${LAT}&longitude=${LON}` +
      `&hourly=grass_pollen,alder_pollen,birch_pollen` +
      `&timezone=Europe%2FDublin&forecast_days=1`,
    ),
  ]);

  if (forecastRes.status === 'rejected' || !forecastRes.value.ok) {
    throw new Error('Weather fetch failed');
  }

  const forecast = await forecastRes.value.json() as OpenMeteoForecast;

  const week: DailyForecast[] = forecast.daily.time.map((dateStr, i) => ({
    date: new Date(dateStr + 'T00:00:00'),
    tempMin: Math.round(forecast.daily.temperature_2m_min[i] ?? 0),
    tempMax: Math.round(forecast.daily.temperature_2m_max[i] ?? 0),
    code: forecast.daily.weathercode[i] ?? 0,
    precip: forecast.daily.precipitation_sum[i] ?? 0,
    uvIndex: Math.round(forecast.daily.uv_index_max[i] ?? 0),
  }));

  let pollen: PollenLevels | null = null;
  if (pollenRes.status === 'fulfilled' && pollenRes.value.ok) {
    const pollenData = await pollenRes.value.json() as OpenMeteoAirQuality;
    pollen = {
      grass: Math.round(maxOf(pollenData.hourly.grass_pollen)),
      alder: Math.round(maxOf(pollenData.hourly.alder_pollen)),
      birch: Math.round(maxOf(pollenData.hourly.birch_pollen)),
    };
  }

  return {
    current: {
      temp: Math.round(forecast.current.temperature_2m),
      feelsLike: Math.round(forecast.current.apparent_temperature),
      code: forecast.current.weathercode,
      windSpeed: Math.round(forecast.current.wind_speed_10m),
    },
    today: week[0]!,
    week,
    pollen,
  };
}

export const WMO_EMOJI: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️', 77: '❄️',
  80: '🌦️', 81: '🌦️', 82: '🌦️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

export const WMO_LABEL: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Heavy showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

export function weatherGradient(code: number): string {
  if (code === 0 || code === 1) return 'from-amber-500/25 via-orange-500/10 to-transparent';
  if (code === 2 || code === 3) return 'from-slate-500/25 via-blue-900/10 to-transparent';
  if (code >= 51 && code <= 67) return 'from-blue-600/25 via-indigo-900/10 to-transparent';
  if (code >= 71 && code <= 77) return 'from-sky-300/20 via-blue-200/10 to-transparent';
  if (code >= 80 && code <= 82) return 'from-blue-500/20 via-slate-700/10 to-transparent';
  if (code >= 95) return 'from-slate-700/30 via-indigo-900/15 to-transparent';
  return 'from-slate-600/20 to-transparent';
}

export function uvInfo(uv: number): { label: string; color: string; bg: string } {
  if (uv <= 2) return { label: 'Low', color: 'text-green-400', bg: 'bg-green-500' };
  if (uv <= 5) return { label: 'Moderate', color: 'text-yellow-400', bg: 'bg-yellow-500' };
  if (uv <= 7) return { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500' };
  if (uv <= 10) return { label: 'Very high', color: 'text-red-400', bg: 'bg-red-500' };
  return { label: 'Extreme', color: 'text-purple-400', bg: 'bg-purple-500' };
}

export function pollenInfo(grains: number): { label: string; color: string; bg: string; pct: number } {
  const pct = Math.min(100, (grains / 200) * 100);
  if (grains < 10) return { label: 'Low', color: 'text-green-400', bg: 'bg-green-500', pct };
  if (grains < 50) return { label: 'Moderate', color: 'text-yellow-400', bg: 'bg-yellow-500', pct };
  if (grains < 200) return { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500', pct };
  return { label: 'Very high', color: 'text-red-400', bg: 'bg-red-500', pct: 100 };
}

export async function fetchWeatherSummary(data: WeatherData): Promise<string> {
  const apiKey = localStorage.getItem('eolas_api_key') ?? '';
  const res = await fetch(`${BASE_URL}/v1/weather/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      temp: data.current.temp,
      feelsLike: data.current.feelsLike,
      description: WMO_LABEL[data.current.code] ?? 'variable',
      precip: data.today.precip,
      uvIndex: data.today.uvIndex,
      windSpeed: data.current.windSpeed,
      pollen: data.pollen ?? undefined,
    }),
  });
  if (!res.ok) throw new Error('summary failed');
  const json = await res.json() as { summary: string };
  return json.summary;
}
