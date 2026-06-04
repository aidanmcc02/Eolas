// Dublin coordinates
const LAT = 53.3498;
const LON = -6.2603;

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'freezing fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow',
  80: 'showers', 81: 'heavy showers', 82: 'violent showers',
  95: 'thunderstorm',
};

interface OpenMeteoDaily {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weathercode: number[];
  };
}

export async function getWeatherSummary(): Promise<string> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode` +
    `&timezone=Europe%2FDublin&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo weather error: ${res.status}`);
  const data = await res.json() as OpenMeteoDaily;

  const max = Math.round(data.daily.temperature_2m_max[0] ?? 0);
  const min = Math.round(data.daily.temperature_2m_min[0] ?? 0);
  const precip = data.daily.precipitation_sum[0] ?? 0;
  const code = data.daily.weathercode[0] ?? 0;
  const desc = WMO_DESCRIPTIONS[code] ?? 'variable';

  const precipStr = precip > 0 ? `, ${precip.toFixed(1)}mm rain` : '';
  return `${min}–${max}°C, ${desc}${precipStr}`;
}
