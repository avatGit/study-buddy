import { runDemoSeed, DemoSeedError } from './demo-seed.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== '--reset') || args.length > 1) {
    throw new DemoSeedError('Usage: npm run seed:demo [-- --reset].');
  }

  await runDemoSeed(process.env, args[0] === '--reset' ? 'reset' : 'seed');
}

main()
  .then(() => {
    console.log(
      process.argv.includes('--reset')
        ? 'Demo records were removed from the local demo database.'
        : 'Demo data is ready in the local demo database.',
    );
  })
  .catch((error: unknown) => {
    console.error(
      error instanceof DemoSeedError
        ? error.message
        : 'Demo seeding failed. Check the local MongoDB instance and API environment.',
    );
    process.exitCode = 1;
  });
