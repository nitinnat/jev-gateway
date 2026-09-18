import { createServer } from 'node:http';

const MAX_BODY_BYTES = 1024 * 1024;

function validQuestions(questions) {
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) return false;
  const entries = Object.entries(questions);
  if (entries.length === 0) return false;

  return entries.every(([, question]) => {
    if (!question || typeof question !== 'object' || typeof question.instructions !== 'string' || !question.instructions.trim()) return false;
    if (question.type === 'boolean') return question.criteria === undefined ||
      (question.criteria && typeof question.criteria.true === 'string' && typeof question.criteria.false === 'string');
    if (question.type === 'choice') return question.criteria && typeof question.criteria === 'object' &&
      !Array.isArray(question.criteria) && Object.keys(question.criteria).length >= 2 &&
      Object.values(question.criteria).every(description => typeof description === 'string');
    if (question.type === 'score') return Array.isArray(question.criteria) && question.criteria.length >= 2 &&
      question.criteria.every(label => typeof label === 'string');
    return false;
  });
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function createGatewayServer(evaluate) {
  return createServer(async (request, response) => {
    const started = Date.now();
    let status = 200;

    try {
      if (request.method === 'GET' && request.url === '/health') {
        send(response, status, { status: 'ok' });
        return;
      }
      if (request.method !== 'POST' || request.url !== '/v1/evaluate') {
        status = 404;
        send(response, status, { error: 'Not found' });
        return;
      }

      let raw = '';
      for await (const chunk of request) {
        raw += chunk;
        if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
          status = 413;
          send(response, status, { error: 'Request body exceeds 1 MiB' });
          return;
        }
      }

      let input;
      try {
        input = JSON.parse(raw);
      } catch {
        status = 400;
        send(response, status, { error: 'Request body must be JSON' });
        return;
      }
      if (!input || typeof input !== 'object' || Array.isArray(input) ||
          !(typeof input.state === 'string' || (input.state && typeof input.state === 'object')) ||
          !validQuestions(input.questions)) {
        status = 400;
        send(response, status, { error: 'Expected state and nonempty typed questions' });
        return;
      }

      const result = await evaluate({
        model: 'typesafe-ai/jev',
        state: input.state,
        questions: input.questions,
      });
      send(response, status, {
        answers: result.answers,
        providerMetadata: result.providerMetadata,
      });
    } catch (error) {
      status = 502;
      console.error('[evaluate] upstream failure', error.name, error.statusCode || '');
      if (!response.headersSent) send(response, status, { error: 'Jev evaluation failed' });
    } finally {
      console.log('[request]', request.method, request.url, status, `${Date.now() - started}ms`);
    }
  });
}
