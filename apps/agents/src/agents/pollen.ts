const LAT = 53.3498;
const LON = -6.2603;

interface OpenMeteoAirQuality {
  hourly: {
    time: string[];
    grass_pollen: (number | null)[];
    alder_pollen: (number | null)[];
    birch_pollen: (number | null)[];
  };
}

function pollenLevel(grains: number): string {
  if (grains < 10) return 'low';
  if (grains < 50) return 'moderate';
  if (grains < 200) return 'high';
  return 'very high';
}

export async function getPollenSummary(): Promise<string | null> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&hourly=grass_pollen,alder_pollen,birch_pollen` +
    `&timezone=Europe%2FDublin&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as OpenMeteoAirQuality;

  const maxOf = (arr: (number | null)[]) =>
    arr.reduce<number>((m, v) => (v != null && v > m ? v : m), 0);

  const grass = maxOf(data.hourly.grass_pollen);
  const alder = maxOf(data.hourly.alder_pollen);
  const birch = maxOf(data.hourly.birch_pollen);

  const parts: string[] = [];
  if (grass >= 10) parts.push(`grass ${pollenLevel(grass)}`);
  if (alder >= 10) parts.push(`alder ${pollenLevel(alder)}`);
  if (birch >= 10) parts.push(`birch ${pollenLevel(birch)}`);

  if (parts.length === 0) return null;
  return parts.join(', ');
}
