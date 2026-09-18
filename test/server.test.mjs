import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createGatewayServer } from '../src/server.mjs';

const calls = [];
const server = createGatewayServer(async input => {
  calls.push(input);
  return { answers: { relevant: { type: 'boolean', probability: 0.9 } } };
});
let baseURL;

before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise(resolve => server.close(resolve)));

test('health responds without evaluating', async () => {
  const response = await fetch(`${baseURL}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(calls.length, 0);
});

test('evaluates valid state and questions with the Jev model', async () => {
  const input = {
    state: { query: 'How are tokens rotated?', passage: 'Each used token is replaced.' },
    questions: { relevant: { type: 'boolean', instructions: 'Does the passage answer the query?' } },
  };
  const response = await fetch(`${baseURL}/v1/evaluate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { answers: { relevant: { type: 'boolean', probability: 0.9 } } });
  assert.deepEqual(calls[0], { model: 'typesafe-ai/jev', ...input });
});

test('rejects invalid questions before calling Jev', async () => {
  const response = await fetch(`${baseURL}/v1/evaluate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state: 'hello', questions: {} }),
  });

  assert.equal(response.status, 400);
  assert.equal(calls.length, 1);
});
