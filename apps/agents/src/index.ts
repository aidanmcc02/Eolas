import cron from 'node-cron';
import { createServer } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { getWeatherData } from './agents/weather.js';
import { getPollenData } from './agents/pollen.js';

const API_URL = process.env['INTERNAL_API_URL'];
const API_KEY = process.env['API_KEY'];

if (!API_URL || !API_KEY) {
  throw new Error('INTERNAL_API_URL and API_KEY must be set');
}

const anthropic = new Anthropic();

async function sendNotification(title: string, body: string, url = '/'): Promise<void> {
  const res = await fetch(`${API_URL}/v1/push/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ title, body, url }),
  });
  if (!res.ok) console.error(`push/notify failed: ${res.status}`);
}

async function runMorningBrief(): Promise<void> {
  const [weatherResult, pollenResult] = await Promise.allSettled([
    getWeatherData(),
    getPollenData(),
  ]);

  if (weatherResult.status === 'rejected') {
    console.error('weather fetch failed:', weatherResult.reason);
    return;
  }

  const w = weatherResult.value;
  const p = pollenResult.status === 'fulfilled' ? pollenResult.value : null;

  const pollenContext = p
    ? `Pollen (grains/m³): grass ${p.grass}, alder ${p.alder}, birch ${p.birch}`
    : 'Pollen data unavailable';

  const dataContext = `Dublin weather today: ${w.tempMin}–${w.tempMax}°C, ${w.description}${w.precip > 0 ? `, ${w.precip.toFixed(1)}mm rain` : ''}, UV index ${w.uvIndex}. ${pollenContext}`;

  let advice: string;
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: 'You are a concise Dublin morning assistant. Given today\'s weather and pollen data, write one short practical sentence of advice. Mention coat or umbrella if rain is likely. Mention antihistamine if any pollen is above 10 grains/m³. Mention sunscreen if UV index is 3 or above. Be direct and brief — under 140 characters.',
      messages: [{ role: 'user', content: dataContext }],
    });
    advice = msg.content[0]?.type === 'text' ? msg.content[0].text : dataContext;
  } catch (err) {
    console.error('Claude call failed:', err);
    advice = `${w.tempMin}–${w.tempMax}°C, ${w.description}${w.precip > 0 ? `, ${w.precip.toFixed(1)}mm` : ''}`;
  }

  const now = new Date();
  const day = now.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Dublin' });

  await sendNotification(`Dublin · ${day}`, advice, '/?tab=weather');
}

console.log('Eolas agents running');

cron.schedule('0 7 * * *', () => {
  runMorningBrief().catch((err) => console.error('morning brief failed:', err));
}, { timezone: 'Europe/Dublin' });

const port = Number(process.env['PORT'] ?? 3002);
createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/trigger') {
    runMorningBrief()
      .then(() => { res.writeHead(200); res.end('ok'); })
      .catch((err) => { console.error('trigger failed:', err); res.writeHead(500); res.end('error'); });
  } else {
    res.writeHead(404); res.end();
  }
}).listen(port, () => console.log(`Agents trigger listening on ${port}`));
