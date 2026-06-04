import { useEffect, useState } from 'react';
import {
  fetchWeather,
  fetchWeatherSummary,
  weatherGradient,
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
  const [error, setError] = useState(false);
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    setBarsReady(false);
    setSummary(null);
    fetchWeather()
      .then((d) => {
        setData(d);
        setTimeout(() => setBarsReady(true), 200);
        fetchWeatherSummary(d).then(setSummary).catch(() => {});
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Failed to load weather data
      </div>
    );
  }

  if (!data) return <WeatherSkeleton />;

  const { current, today, week, pollen } = data;
  const gradient = weatherGradient(current.code);
  const uv = uvInfo(today.uvIndex);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className={`bg-gradient-to-b ${gradient} pb-6`}>

        {/* AI summary */}
        <div className="px-4 pt-4">
          {summary ? (
            <div className="animate-fade-in opacity-0 flex gap-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm px-4 py-3">
              <span className="text-indigo-400 text-sm mt-0.5 shrink-0">✦</span>
              <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
            </div>
          ) : (
            <div className="flex gap-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 animate-pulse">
              <span className="text-indigo-400/40 text-sm mt-0.5 shrink-0">✦</span>
              <div className="flex-1 space-y-2 py-0.5">
                <div className="h-3 bg-white/10 rounded-full w-full" />
                <div className="h-3 bg-white/10 rounded-full w-4/5" />
              </div>
            </div>
          )}
        </div>

        {/* Location + date */}
        <div
          className="animate-slide-up px-5 pt-5 pb-1 flex justify-between items-baseline opacity-0"
          style={{ animationDelay: '0ms' }}
        >
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Dublin, Ireland
          </span>
          <span className="text-xs text-slate-500">
            {new Date().toLocaleDateString('en-IE', {
              weekday: 'short', day: 'numeric', month: 'short',
              timeZone: 'Europe/Dublin',
            })}
          </span>
        </div>

        {/* Hero — current temp */}
        <div
          className="animate-slide-up opacity-0 px-5 pt-4 pb-6 flex items-center gap-6"
          style={{ animationDelay: '60ms' }}
        >
          <div className="text-8xl leading-none select-none">
            {WMO_EMOJI[current.code] ?? '🌡️'}
          </div>
          <div>
            <div className="text-7xl font-thin text-white tracking-tighter leading-none">
              {current.temp}°
            </div>
            <div className="mt-1 text-lg text-slate-300 font-light">
              {WMO_LABEL[current.code] ?? 'Variable'}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Feels like {current.feelsLike}° · Wind {current.windSpeed} km/h
            </div>
          </div>
        </div>

        {/* Condition pills */}
        <div
          className="animate-slide-up opacity-0 px-5 flex flex-wrap gap-2"
          style={{ animationDelay: '120ms' }}
        >
          {today.precip > 0 && (
            <Pill icon="💧" label={`${today.precip.toFixed(1)} mm`} sub="Rain" color="text-blue-300" />
          )}
          <Pill
            icon="☀️"
            label={`UV ${today.uvIndex}`}
            sub={uv.label}
            color={uv.color}
          />
          <Pill icon="💨" label={`${current.windSpeed} km/h`} sub="Wind" color="text-slate-300" />
          {today.precip === 0 && (
            <Pill icon="🌂" label="No rain" sub="Today" color="text-green-400" />
          )}
        </div>
      </div>

      {/* Pollen section */}
      {pollen && (
        <section
          className="animate-slide-up opacity-0 mx-4 mt-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-4"
          style={{ animationDelay: '200ms' }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Pollen Today
          </h2>
          <div className="space-y-3">
            <PollenBar label="Grass" grains={pollen.grass} ready={barsReady} delay={0} />
            <PollenBar label="Alder" grains={pollen.alder} ready={barsReady} delay={80} />
            <PollenBar label="Birch" grains={pollen.birch} ready={barsReady} delay={160} />
          </div>
        </section>
      )}

      {/* 7-day forecast */}
      <section
        className="animate-slide-up opacity-0 mx-4 mt-4 mb-6"
        style={{ animationDelay: '280ms' }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 px-1">
          This Week
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {week.map((day, i) => (
            <DayCard key={day.date.toISOString()} day={day} isToday={i === 0} delay={i * 40} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Pill({ icon, label, sub, color }: { icon: string; label: string; sub: string; color: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
      <span className="text-base leading-none">{icon}</span>
      <div>
        <div className={`text-sm font-semibold leading-tight ${color}`}>{label}</div>
        <div className="text-xs text-slate-500 leading-tight">{sub}</div>
      </div>
    </div>
  );
}

function PollenBar({ label, grains, ready, delay }: {
  label: string;
  grains: number;
  ready: boolean;
  delay: number;
}) {
  const info = pollenInfo(grains);

  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-xs text-slate-400 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${info.bg}`}
          style={{
            width: ready ? `${info.pct}%` : '0%',
            transitionDelay: `${delay}ms`,
          }}
        />
      </div>
      <div className="flex items-center gap-1.5 w-24 shrink-0">
        <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>
        <span className="text-xs text-slate-600">({grains})</span>
      </div>
    </div>
  );
}

function DayCard({ day, isToday, delay }: { day: DailyForecast; isToday: boolean; delay: number }) {
  const emoji = WMO_EMOJI[day.code] ?? '🌡️';
  const name = isToday
    ? 'Today'
    : day.date.toLocaleDateString('en-IE', { weekday: 'short', timeZone: 'Europe/Dublin' });

  return (
    <div
      className={`animate-slide-up opacity-0 shrink-0 flex flex-col items-center gap-1.5 rounded-2xl px-3 py-3 min-w-[64px] border transition-colors ${
        isToday
          ? 'bg-indigo-600/20 border-indigo-500/30'
          : 'bg-white/5 border-white/10 hover:bg-white/8'
      }`}
      style={{ animationDelay: `${320 + delay}ms` }}
    >
      <span className="text-xs font-medium text-slate-400">{name}</span>
      <span className="text-2xl leading-none">{emoji}</span>
      {day.precip > 0 && (
        <span className="text-[10px] text-blue-400">{day.precip.toFixed(0)}mm</span>
      )}
      <span className="text-sm font-semibold text-white">{day.tempMax}°</span>
      <span className="text-xs text-slate-500">{day.tempMin}°</span>
    </div>
  );
}

function WeatherSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-5 space-y-4 animate-pulse">
      <div className="h-3 w-32 bg-white/10 rounded-full" />
      <div className="flex items-center gap-6 py-4">
        <div className="w-20 h-20 bg-white/10 rounded-2xl" />
        <div className="space-y-2">
          <div className="h-14 w-28 bg-white/10 rounded-xl" />
          <div className="h-4 w-36 bg-white/10 rounded-full" />
          <div className="h-3 w-48 bg-white/10 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 w-20 bg-white/10 rounded-xl" />)}
      </div>
      <div className="h-32 bg-white/10 rounded-2xl" />
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="h-28 w-16 bg-white/10 rounded-2xl" />)}
      </div>
    </div>
  );
}
