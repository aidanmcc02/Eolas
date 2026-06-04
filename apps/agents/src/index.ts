import cron from 'node-cron';
import { createServer } from 'node:http';
import { getWeatherSummary } from './agents/weather.js';
import { getPollenSummary } from './agents/pollen.js';

const API_URL = process.env['INTERNAL_API_URL'];
const API_KEY = process.env['API_KEY'];

if (!API_URL || !API_KEY) {
  throw new Error('INTERNAL_API_URL and API_KEY must be set');
}

async function sendNotification(title: string, body: string): Promise<void> {
  const res = await fetch(`${API_URL}/v1/push/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) {
    console.error(`push/notify failed: ${res.status}`);
  }
}

async function runMorningBrief(): Promise<void> {
  const [weather, pollen] = await Promise.allSettled([
    getWeatherSummary(),
    getPollenSummary(),
  ]);

  const weatherText = weather.status === 'fulfilled' ? weather.value : null;
  const pollenText = pollen.status === 'fulfilled' ? pollen.value : null;

  if (!weatherText && !pollenText) return;

  const parts: string[] = [];
  if (weatherText) parts.push(weatherText);
  if (pollenText) parts.push(`Pollen: ${pollenText}`);

  await sendNotification('Dublin Morning', parts.join(' · '));
}

console.log('Eolas agents running');

cron.schedule('0 7 * * *', () => {
  runMorningBrief().catch((err) => console.error('morning brief failed:', err));
}, { timezone: 'Europe/Dublin' });

// Manual trigger endpoint for testing
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
