import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
});

export async function startFixtureServer({ port = 0 } = {}) {
  const server = createServer((request, response) => serveFixtureRequest(request, response));
  await new Promise((resolveStart, rejectStart) => {
    server.once('error', rejectStart);
    server.listen({ host: '127.0.0.1', port }, () => {
      server.off('error', rejectStart);
      resolveStart();
    });
  });

  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  return Object.freeze({
    origin,
    port: address.port,
    close: () => new Promise((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    }),
  });
}

function serveFixtureRequest(request, response) {
  const requestUrl = new URL(request.url, 'http://127.0.0.1');
  if (requestUrl.pathname === '/delayed-jwplayer.js') {
    setTimeout(() => {
      send(response, 200, 'text/javascript; charset=utf-8', 'window.KulchaFloDelayedPlayer = true;\n');
    }, 250);
    return;
  }
  const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    send(response, 400, 'text/plain; charset=utf-8', 'Bad request\n');
    return;
  }
  if (decodedPath.split('/').includes('..') || decodedPath.split('\\').includes('..')) {
    send(response, 403, 'text/plain; charset=utf-8', 'Forbidden\n');
    return;
  }
  const relativePath = normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = resolve(join(FIXTURE_ROOT, relativePath));

  if (!filePath.startsWith(`${FIXTURE_ROOT}${sep}`) && filePath !== FIXTURE_ROOT) {
    send(response, 403, 'text/plain; charset=utf-8', 'Forbidden\n');
    return;
  }

  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    send(response, 404, 'text/plain; charset=utf-8', 'Not found\n');
    return;
  }

  if (!stat.isFile()) {
    send(response, 404, 'text/plain; charset=utf-8', 'Not found\n');
    return;
  }

  response.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
}

function send(response, status, contentType, body) {
  response.writeHead(status, {
    'content-type': contentType,
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const explicitPortArg = process.argv.find((arg) => arg.startsWith('--port='));
  const smokeMsArg = process.argv.find((arg) => arg.startsWith('--smoke-ms='));
  const port = explicitPortArg ? Number(explicitPortArg.slice('--port='.length)) : 0;
  const smokeMs = smokeMsArg ? Number(smokeMsArg.slice('--smoke-ms='.length)) : null;
  const fixture = await startFixtureServer({ port });
  console.log(`Player Lab fixture server listening on ${fixture.origin}`);
  if (Number.isFinite(smokeMs) && smokeMs >= 0) {
    setTimeout(async () => {
      await fixture.close();
      console.log('Player Lab fixture server stopped');
    }, smokeMs);
  }
  const shutdown = async () => {
    await fixture.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
