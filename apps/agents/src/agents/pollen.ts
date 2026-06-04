const DEFAULT_LAT = 51.8985;
const DEFAULT_LON = -8.4756;

export interface PollenData {
  grass: number;
  alder: number;
  birch: number;
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

export async function getPollenData(lat = DEFAULT_LAT, lon = DEFAULT_LON): Promise<PollenData | null> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=grass_pollen,alder_pollen,birch_pollen` +
    `&timezone=auto&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as OpenMeteoAirQuality;

  return {
    grass: Math.round(maxOf(data.hourly.grass_pollen)),
    alder: Math.round(maxOf(data.hourly.alder_pollen)),
    birch: Math.round(maxOf(data.hourly.birch_pollen)),
  };
}
