import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const path = resolve(
      root,
      '.' + decodeURIComponent(url.pathname),
      url.pathname.endsWith('/') ? 'index.html' : ''
    );
    if (!path.startsWith(root + '/')) {
      response.writeHead(403).end();
      return;
    }
    response.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
}).listen(4174, '127.0.0.1');
