import cron from 'node-cron';

// TODO Phase 3: weather agent (daily 07:00 Europe/Dublin)
// TODO Phase 3: pollen agent (daily 07:00 Europe/Dublin)

console.log('Eolas agents running');

// Placeholder: keep process alive
cron.schedule('0 7 * * *', () => {
  console.log('TODO: run daily agents');
}, { timezone: 'Europe/Dublin' });
