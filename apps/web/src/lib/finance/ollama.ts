import { CATEGORIES } from './types';
import type { Transaction } from './types';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'qwen2.5:7b';

// Keyword rules checked before Ollama — case-insensitive substring match.
// Order matters: first match wins.
const KEYWORD_RULES: Array<{ keywords: string[]; category: string }> = [
  // Income — must be first to avoid salary payments matching other rules
  {
    keywords: ['salary', 'payroll', 'wages', 'pay credit', 'bacs credit', 'employer',
               'commission', 'bonus payment', 'dividend', 'refund credit', 'cashback',
               'tax refund', 'revenue refund', 'social welfare', 'jobseekers',
               'carer allowance', 'child benefit'],
    category: 'Income',
  },

  // Savings — transfers to savings accounts
  {
    keywords: ['savings', 'save '],
    category: 'Savings',
  },

  // Loan repayments
  {
    keywords: ['loan', 'credit union', 'cu repayment', 'finance payment',
               'car finance', 'personal loan', 'loan repayment', 'loan payment',
               'hire purchase', 'pcp ', 'student loan'],
    category: 'Loan',
  },

  // Transfers — before shopping/other to catch Revolut/PayPal correctly
  {
    keywords: ['revolut', 'n26', 'wise.com', 'transferwise', 'monzo',
               'sepa transfer', 'bank transfer', 'funds transfer',
               'own account', 'savings transfer', 'aib transfer',
               'paypal transfer', 'stripe payout'],
    category: 'Transfers',
  },

  // Groceries — Irish supermarkets & food shops
  {
    keywords: ['tesco', 'lidl', 'aldi', 'dunnes stores', 'dunnes ', 'supervalu',
               'centra', 'spar', 'eurospar', 'mace ', 'londis', 'costcutter',
               'marks & spencer', 'm&s ', 'iceland foods', 'costco',
               'fresh the good food', 'martin\'s newsagent'],
    category: 'Groceries',
  },

  // Dining & Cafes
  {
    keywords: ['deliveroo', 'just eat', 'justeat', 'uber eats', 'ubereats', 'doordash',
               'mcdonalds', "mcdonald's", 'mcdonald', 'kfc', 'burger king', 'burgerking',
               'subway', 'five guys', 'supermacs', 'dominos', "domino's", 'pizza hut',
               "nando's", 'nandos', 'thunders', 'eddie rockets', 'bunnys',
               'starbucks', 'costa coffee', 'insomnia coffee', 'butlers chocolate',
               'joe and the juice', 'the counter', 'esquires',
               'restaurant', 'takeaway', 'chipper', 'fish & chips',
               'kebab', 'sushi', 'wok to walk', 'diner', 'bistro', 'brasserie',
               'cafe ', ' cafe', 'coffee shop', 'bakery', 'patisserie'],
    category: 'Dining & Cafes',
  },

  // Transport
  {
    keywords: ['leap card', 'leap top-up', 'dublin bus', 'irish rail', 'iarnrod eireann',
               'luas ', 'bus eireann', 'translink', 'aircoach', 'citylink', 'gobus',
               'expressway', 'free now', 'freenow', 'hailo', 'taxi', 'cab ',
               'uber', 'bolt.eu',
               'parking', 'ncp ', 'q-park', 'indigo park', 'car park',
               'circle k', 'applegreen', 'maxol', 'texaco', 'topaz', 'esso ',
               'bp ', 'shell ', 'fuel', 'petrol', 'diesel',
               'toll', 'e-flow', 'eflow', 'm50 toll',
               'aa ireland', 'rac ', 'nct test', 'rsa ', 'motor tax',
               'car insurance', 'axa insurance', 'allianz', 'fbd insurance',
               'aviva car', 'zurich car'],
    category: 'Transport',
  },

  // Utilities & Bills
  {
    keywords: ['electric ireland', 'bord gais', 'energia ', 'prepay power', 'airtricity',
               'flogas', 'calor gas',
               'eir ', 'eir.ie', 'eircom', 'vodafone', 'three ireland', '3 ireland',
               'sky ireland', 'sky digital', 'virgin media', 'siro ', 'net d\'or',
               'broadband', 'upc ', 'gas networks', 'irish water',
               'tv licence', 'an post', 'waste collection', 'bin collection',
               'property tax', 'lpt ', 'management fee', 'service charge',
               'insurance premium', 'life insurance', 'pensions'],
    category: 'Utilities & Bills',
  },

  // Housing
  {
    keywords: ['rent payment', 'rental payment', 'landlord', 'property management',
               'management company', 'estate agent', 'daft.ie',
               'mortgage', 'home insurance', 'buildings insurance',
               'contents insurance', 'renters insurance'],
    category: 'Housing',
  },

  // Health & Fitness
  {
    keywords: ['boots ', 'boots.com', 'lloyds pharmacy', 'mccabe pharmacy',
               'o\'brien pharmacy', 'pharmacy', 'chemist', 'pharma',
               'health store', 'holland & barrett',
               'gp visit', 'doctor visit', 'medical centre', 'health centre',
               'dentist', 'dental', 'orthodon', 'optician', 'specsavers',
               'vision express', 'oscar de la renta',
               'hospital', 'clinic', 'hse ', 'beacon hospital', 'mater ',
               'blackrock clinic', 'laya healthcare', 'vhi ', 'vhi.ie',
               'irish life health', 'glo health',
               'gym', 'flyfit', 'energie fitness', 'total fitness',
               'personal trainer', 'physio', 'crossfit', 'yoga', 'pilates',
               'swimming', 'leisure centre', 'david lloyd'],
    category: 'Health & Fitness',
  },

  // Subscriptions — recurring digital services
  {
    keywords: ['netflix', 'spotify', 'disney+', 'disney plus', 'disneyplus',
               'apple tv+', 'apple tv plus', 'apple one', 'apple icloud',
               'icloud storage', 'amazon prime', 'prime video',
               'youtube premium', 'youtube music',
               'deezer', 'tidal ', 'apple music', 'audible',
               'twitch', 'patreon',
               'playstation plus', 'ps plus', 'xbox game pass', 'xbox live',
               'nintendo switch online',
               'adobe ', 'microsoft 365', 'office 365', 'google one',
               'dropbox', 'lastpass', '1password', 'nordvpn', 'expressvpn',
               'chatgpt', 'claude.ai', 'openai', 'github copilot',
               'linkedin premium', 'duolingo'],
    category: 'Subscriptions',
  },

  // Entertainment — one-off purchases and events
  {
    keywords: ['steam ', 'playstation store', 'psn store', 'xbox store', 'nintendo eshop',
               'epic games', 'humble bundle', 'ea games', 'blizzard', 'ubisoft',
               'cinema', 'cineworld', 'odeon', 'vue ', 'light house cinema',
               'ifi ', 'irish film',
               'ticketmaster', 'eventbrite', 'aiken promotions', 'mcd productions'],
    category: 'Entertainment',
  },

  // Travel
  {
    keywords: ['ryanair', 'aer lingus', 'aerlingus', 'easyjet', 'wizzair', 'wizz air',
               'norwegian air', 'british airways', 'lufthansa',
               'flight', 'dublin airport', 'cork airport', 'shannon airport',
               'airbnb', 'booking.com', 'hotels.com', 'hostelworld',
               'expedia', 'trivago', 'lastminute', 'holiday', 'hotel ',
               'enterprise rent', 'hertz ', 'europcar', 'avis '],
    category: 'Travel',
  },

  // Shopping — online and retail
  {
    keywords: ['amazon', 'amzn', 'ebay', 'asos', 'next plc', 'next.co',
               'penneys', 'primark',
               'zara ', 'h&m ', 'river island', 'tk maxx', 'tkmaxx',
               'argos', 'harvey norman', 'currys', 'pc world',
               'apple store', 'apple.com/bill', 'google play', 'google store',
               'ikea', 'woodies', 'b&q', 'homebase', 'mr price', 'flying tiger',
               'shein', 'aliexpress', 'wish.com', 'etsy',
               'brown thomas', 'arnotts', 'debenhams', 'lifestyle sports',
               'jd sports', 'foot locker', 'size?', 'schuh',
               'smyths toys', 'toy master', 'gamestop',
               'peter mark', 'regis salon', 'blow dry'],
    category: 'Shopping',
  },
];

export function preCategorizeSingle(description: string): string | null {
  const lower = description.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return null;
}

export async function categorizeTransactions(
  transactions: Transaction[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, string>> {
  const uniqueDescs = [...new Set(transactions.map((t) => t.description))];
  const result = new Map<string, string>();

  // Pre-categorize with keywords first
  const needsOllama: string[] = [];
  for (const desc of uniqueDescs) {
    const cat = preCategorizeSingle(desc);
    if (cat) {
      result.set(desc, cat);
    } else {
      needsOllama.push(desc);
    }
  }

  // Send only ambiguous descriptions to Ollama
  const batchSize = 30;
  for (let i = 0; i < needsOllama.length; i += batchSize) {
    const batch = needsOllama.slice(i, i + batchSize);
    const categorized = await categorizeBatch(batch);
    for (const [desc, cat] of categorized) {
      result.set(desc, cat);
    }
    onProgress?.(
      Math.min(result.size, uniqueDescs.length),
      uniqueDescs.length
    );
  }

  onProgress?.(uniqueDescs.length, uniqueDescs.length);
  return result;
}

const SYSTEM_PROMPT = `You are a financial transaction categorizer for an Irish bank account.
Categorize each transaction description into exactly one of these categories:
${CATEGORIES.join(', ')}

Rules:
- Supermarkets and food shops → Groceries
- Food delivery apps, restaurants, cafes, takeaways → Dining & Cafes
- Fuel, parking, tolls, public transport, taxis, car insurance → Transport
- Salary, wages, employer credits → Income
- Revolut, Wise, PayPal, bank-to-bank transfers → Transfers
- Electricity, gas, broadband, phone, water → Utilities & Bills
- Rent, mortgage, property management → Housing
- Flights, hotels, Airbnb, holiday bookings → Travel
- Pharmacy, GP, gym, dentist, health insurance → Health & Fitness
- Online retail, clothing, electronics, hardware → Shopping
- Netflix, Spotify, Disney+, Apple One, recurring digital services → Subscriptions
- Cinema, concerts, one-off game purchases, events → Entertainment
- Loan repayments, credit union payments, car finance, hire purchase → Loan
- Anything else → Other

Respond ONLY with a valid JSON array, no explanation, no markdown.
Format: [{"d":"description","c":"Category"}]`;

async function categorizeBatch(descriptions: string[]): Promise<Map<string, string>> {
  const list = descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');
  const prompt = `${SYSTEM_PROMPT}\n\nCategorize these transactions:\n${list}`;

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Model "${MODEL}" not found. Run: ollama pull ${MODEL}`);
    }
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = (await response.json()) as { response: string };
  return parseCategorizationResponse(data.response, descriptions);
}

function parseCategorizationResponse(raw: string, descriptions: string[]): Map<string, string> {
  const result = new Map<string, string>();

  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ d: string; c: string }>;
    for (const item of parsed) {
      if (item.d && item.c && CATEGORIES.includes(item.c)) {
        result.set(item.d, item.c);
      }
    }
  } catch {
    const lines = raw.split('\n').filter((l) => l.trim());
    descriptions.forEach((desc, i) => {
      const line = lines[i] ?? '';
      const matched = CATEGORIES.find((c) => line.includes(c));
      result.set(desc, matched ?? 'Other');
    });
  }

  for (const desc of descriptions) {
    if (!result.has(desc)) result.set(desc, 'Other');
  }

  return result;
}

// Amount-aware overrides applied per-transaction after keyword/Ollama categorization.
// Revolut payments ≥ €600 are rent + utilities, not a generic transfer.
export function applyAmountOverrides(transactions: Transaction[]): Transaction[] {
  return transactions.map((t) => {
    // Any credit is income — regardless of description
    if (t.amount > 0) {
      return { ...t, category: 'Income' };
    }
    // Revolut payments ≥ €600 are rent + utilities
    if (t.description.toLowerCase().includes('revolut') && t.amount <= -600) {
      return { ...t, category: 'Housing' };
    }
    return t;
  });
}

export async function generateInsights(summaryText: string): Promise<string> {
  const prompt = `You are a personal finance advisor analyzing an Irish person's bank transactions.
Based on this spending summary, provide 3-4 specific, actionable insights and suggestions for improvement.
Be concise and direct. Format as bullet points starting with "• ".

${summaryText}`;

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.4 },
    }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Model "${MODEL}" not found. Run: ollama pull ${MODEL}`);
    }
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = (await response.json()) as { response: string };
  return data.response.trim();
}
