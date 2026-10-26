import { createApp } from './bootstrap';
import { parseConfig } from './config/config';

async function main() {
  const config = parseConfig(process.env);
  const app = await createApp(config);
  await app.listen(config.PORT, config.HOST);
}
void main().catch((error: unknown) => {
  // Config validation messages are intentionally redacted; other startup failures are generic.
  const message = error instanceof Error && error.message.startsWith('Invalid API configuration:')
    ? error.message : 'API startup failed';
  console.error(message);
  process.exitCode = 1;
});
