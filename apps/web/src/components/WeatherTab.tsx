import { useEffect, useState } from 'react';
import {
  fetchWeather,
  fetchWeatherSummary,
  getCachedSummary,
  getUserLocation,
  getLocationLabel,
  saveLocation,
  uvInfo,
  pollenInfo,
  WMO_EMOJI,
  WMO_LABEL,
  type WeatherData,
  type DailyForecast,
} from '../lib/weather.js';

export function WeatherTab() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState('Cork, Ireland');
  const [error, setError] = useState(false);
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBarsReady(false);
    setSummary(null);

    async function load() {
      const coords = await getUserLocation();
      const lat = coords?.lat ?? 51.8985;
      const lon = coords?.lon ?? -8.4756;

      const [weatherData, label] = await Promise.all([
        fetchWeather(lat, lon),
        coords ? getLocationLabel(lat, lon) : Promise.resolve('Cork, Ireland'),
      ]);

      if (cancelled) return;
      setData(weatherData);
      setLocationLabel(label);
      setTimeout(() => setBarsReady(true), 200);

      if (coords) saveLocation(lat, lon, label).catch(() => {});

      const cached = getCachedSummary();
      if (cached) {
        if (!cancelled) setSummary(cached);
      } else {
        fetchWeatherSummary(weatherData)
          .then((s) => { if (!cancelled) setSummary(s); })
          .catch(() => {});
      }
    }

    load().catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#080808]">
        <p className="text-[#ff0040] text-xs tracking-widest">ERR: FAILED TO LOAD WEATHER DATA</p>
      </div>
    );
  }

  if (!data) return <WeatherSkeleton />;

  const { current, today, week, pollen } = data;
  const uv = uvInfo(today.uvIndex);

  return (
    <div className="flex-1 overflow-y-auto bg-[#080808]">
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Header */}
        <div
          className="animate-slide-up opacity-0 flex items-baseline justify-between"
          style={{ animationDelay: '0ms' }}
        >
          <span className="text-[#00ff41] text-xs tracking-[0.15em] uppercase">{locationLabel}</span>
          <span className="text-[#00ff4150] text-xs">
            {new Date().toLocaleDateString('en-IE', {
              weekday: 'short', day: 'numeric', month: 'short',
              timeZone: 'Europe/Dublin',
            }).toUpperCase()}
          </span>
        </div>

        {/* AI summary */}
        <div
          className="animate-slide-up opacity-0 border border-[#00ff4222] bg-[#0a0a0a] px-4 py-3"
          style={{ animationDelay: '60ms' }}
        >
          <p className="text-[#00ff4155] text-xs tracking-widest mb-2">// AI ANALYSIS</p>
          {summary ? (
            <p className="text-[#00cc33] text-xs leading-relaxed animate-fade-in">{summary}</p>
          ) : (
            <div className="space-y-1.5 animate-pulse">
              <div className="h-2 bg-[#00ff4112] w-full" />
              <div className="h-2 bg-[#00ff4112] w-4/5" />
            </div>
          )}
        </div>

        {/* Current conditions */}
        <div
          className="animate-slide-up opacity-0 border border-[#00ff4222] bg-[#0a0a0a] px-4 py-4"
          style={{ animationDelay: '120ms' }}
        >
          <p className="text-[#00ff4155] text-xs tracking-widest mb-3">// CURRENT CONDITIONS</p>

          {/* Hero */}
          <div className="flex items-center gap-5 mb-4">
            <span className="text-5xl leading-none select-none">{WMO_EMOJI[current.code] ?? '🌡️'}</span>
            <div>
              <div className="text-[#00ff41] text-5xl leading-none animate-glow-pulse">
                {current.temp}<span className="text-2xl text-[#00ff4180]">°C</span>
              </div>
              <div className="text-[#00cc33] text-xs mt-1 tracking-wider">
                {(WMO_LABEL[current.code] ?? 'Variable').toUpperCase()}
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="border-t border-[#00ff4115] pt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-xs sm:grid-cols-4">
            <StatCell label="FEELS LIKE" value={`${current.feelsLike}°C`} />
            <StatCell label="WIND" value={`${current.windSpeed} km/h`} />
            <StatCell label="UV INDEX" value={`${today.uvIndex} — ${uv.label.toUpperCase()}`} />
            <StatCell
              label="PRECIP"
              value={today.precip > 0 ? `${today.precip.toFixed(1)} mm` : 'NONE'}
            />
          </div>
        </div>

        {/* Pollen */}
        {pollen && (
          <div
            className="animate-slide-up opacity-0 border border-[#00ff4222] bg-[#0a0a0a] px-4 py-4"
            style={{ animationDelay: '200ms' }}
          >
            <p className="text-[#00ff4155] text-xs tracking-widest mb-3">// POLLEN INDEX</p>
            <div className="space-y-3">
              <PollenRow label="GRASS" grains={pollen.grass} ready={barsReady} delay={0} />
              <PollenRow label="ALDER" grains={pollen.alder} ready={barsReady} delay={80} />
              <PollenRow label="BIRCH" grains={pollen.birch} ready={barsReady} delay={160} />
            </div>
          </div>
        )}

        {/* 7-day forecast */}
        <div
          className="animate-slide-up opacity-0"
          style={{ animationDelay: '280ms' }}
        >
          <p className="text-[#00ff4155] text-xs tracking-widest mb-3">// 7-DAY FORECAST</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {week.map((day, i) => (
              <DayCard key={day.date.toISOString()} day={day} isToday={i === 0} delay={i * 40} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[#00ff4148] text-[10px] tracking-widest">{label}</div>
      <div className="text-[#00ff41] text-xs mt-0.5">{value}</div>
    </div>
  );
}

/* Map severity label → terminal bar colour (keeps danger signals for High/Very high) */
function pollenBarColor(label: string): string {
  if (label === 'High')      return '#ffaa0088';
  if (label === 'Very high') return '#ff004088';
  if (label === 'Moderate')  return '#00ff4188';
  return '#00ff4148'; // Low
}

function PollenRow({ label, grains, ready, delay }: {
  label: string;
  grains: number;
  ready: boolean;
  delay: number;
}) {
  const info = pollenInfo(grains);
  const barColor = pollenBarColor(info.label);

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-11 text-[#00ff4165] shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-[#00ff4112] overflow-hidden">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: ready ? `${info.pct}%` : '0%',
            transitionDelay: `${delay}ms`,
            backgroundColor: barColor,
          }}
        />
      </div>
      <div className="w-28 shrink-0 flex items-center gap-1.5">
        <span className="text-[#00ff4170]">{info.label.toUpperCase()}</span>
        <span className="text-[#00ff4138]">({grains})</span>
      </div>
    </div>
  );
}

function DayCard({ day, isToday, delay }: { day: DailyForecast; isToday: boolean; delay: number }) {
  const emoji = WMO_EMOJI[day.code] ?? '🌡️';
  const name = isToday
    ? 'TODAY'
    : day.date.toLocaleDateString('en-IE', {
        weekday: 'short',
        timeZone: 'Europe/Dublin',
      }).toUpperCase();

  return (
    <div
      className={`animate-slide-up opacity-0 shrink-0 flex flex-col items-center gap-1.5 px-3 py-3 min-w-[62px] border transition-all duration-150 ${
        isToday
          ? 'border-[#00ff4155] bg-[#00ff410a] shadow-[0_0_14px_rgba(0,255,65,0.07)]'
          : 'border-[#00ff4220] bg-[#0a0a0a] hover:border-[#00ff4240] hover:bg-[#00ff4107]'
      }`}
      style={{ animationDelay: `${320 + delay}ms` }}
    >
      <span className="text-[10px] text-[#00ff4165]">{name}</span>
      <span className="text-xl leading-none">{emoji}</span>
      {day.precip > 0 && (
        <span className="text-[10px] text-[#4488ff90]">{day.precip.toFixed(0)}mm</span>
      )}
      <span className="text-xs text-[#00ff41]">{day.tempMax}°</span>
      <span className="text-[10px] text-[#00ff4145]">{day.tempMin}°</span>
    </div>
  );
}

function WeatherSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#080808] p-5 space-y-4 animate-pulse">
      <p className="text-[#00ff4140] text-xs tracking-widest">// LOADING WEATHER DATA...</p>

      <div className="border border-[#00ff4118] bg-[#0a0a0a] p-4 space-y-3">
        <div className="h-2 bg-[#00ff4112] w-24" />
        <div className="h-12 bg-[#00ff4112] w-32" />
        <div className="h-2 bg-[#00ff4112] w-48" />
      </div>

      <div className="border border-[#00ff4118] bg-[#0a0a0a] p-4 space-y-3">
        <div className="h-2 bg-[#00ff4112] w-20" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-11 h-2 bg-[#00ff4112]" />
            <div className="flex-1 h-1 bg-[#00ff4112]" />
            <div className="w-20 h-2 bg-[#00ff4112]" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="h-2 bg-[#00ff4112] w-24" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="shrink-0 w-[62px] h-24 bg-[#00ff4110] border border-[#00ff4118]" />
          ))}
        </div>
      </div>
    </div>
  );
}
