import type { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface WeatherSummaryBody {
  temp: number;
  feelsLike: number;
  description: string;
  precip: number;
  uvIndex: number;
  windSpeed: number;
  pollen?: { grass: number; alder: number; birch: number };
}

export async function weatherRoutes(app: FastifyInstance): Promise<void> {
  app.post('/weather/summary', async (req, reply) => {
    const body = req.body as WeatherSummaryBody;

    const context = [
      `Dublin today: ${body.temp}°C (feels like ${body.feelsLike}°C), ${body.description}`,
      body.precip > 0 ? `${body.precip.toFixed(1)}mm rain expected` : 'No rain',
      `UV index ${body.uvIndex}, wind ${body.windSpeed} km/h`,
      body.pollen
        ? `Pollen (grains/m³): grass ${body.pollen.grass}, alder ${body.pollen.alder}, birch ${body.pollen.birch}`
        : '',
    ].filter(Boolean).join('. ');

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        system:
          'You are a friendly Dublin weather assistant. Write 2 concise sentences summarising today\'s weather and giving practical advice (umbrella, sunscreen, antihistamine if pollen > 10). Warm and natural tone. No emojis.',
        messages: [{ role: 'user', content: context }],
      });

      const summary = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
      return { summary };
    } catch (err) {
      app.log.error(err, 'weather summary Claude call failed');
      return reply.code(500).send({ error: 'Summary unavailable' });
    }
  });
}
