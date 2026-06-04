const LAT = 53.3498;
const LON = -6.2603;

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

export async function getPollenData(): Promise<PollenData | null> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&hourly=grass_pollen,alder_pollen,birch_pollen` +
    `&timezone=Europe%2FDublin&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as OpenMeteoAirQuality;

  return {
    grass: Math.round(maxOf(data.hourly.grass_pollen)),
    alder: Math.round(maxOf(data.hourly.alder_pollen)),
    birch: Math.round(maxOf(data.hourly.birch_pollen)),
  };
}
