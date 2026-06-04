const DEFAULT_LAT = 51.8985;
const DEFAULT_LON = -8.4756;

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'freezing fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow',
  80: 'showers', 81: 'heavy showers', 82: 'violent showers',
  95: 'thunderstorm',
};

export interface WeatherData {
  tempMin: number;
  tempMax: number;
  precip: number;
  description: string;
  uvIndex: number;
}

interface OpenMeteoDaily {
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weathercode: number[];
    uv_index_max: number[];
  };
}

export async function getWeatherData(lat = DEFAULT_LAT, lon = DEFAULT_LON): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max` +
    `&timezone=auto&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo weather error: ${res.status}`);
  const data = await res.json() as OpenMeteoDaily;

  return {
    tempMin: Math.round(data.daily.temperature_2m_min[0] ?? 0),
    tempMax: Math.round(data.daily.temperature_2m_max[0] ?? 0),
    precip: data.daily.precipitation_sum[0] ?? 0,
    description: WMO_DESCRIPTIONS[data.daily.weathercode[0] ?? 0] ?? 'variable',
    uvIndex: Math.round(data.daily.uv_index_max[0] ?? 0),
  };
}
