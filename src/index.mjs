import { experimental_evaluate as evaluate } from 'ai';
import { createGatewayServer } from './server.mjs';

if (!process.env.AI_GATEWAY_API_KEY) {
  console.error('AI_GATEWAY_API_KEY is required');
  process.exit(1);
}

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 8787);

createGatewayServer(evaluate).listen(port, host, () => {
  console.log(`[startup] Jev gateway listening on ${host}:${port}`);
});
