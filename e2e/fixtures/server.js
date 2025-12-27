import { createServer } from 'http';
import { readFileSync } from 'fs';
import { statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = __dirname;

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:3000');
  const pathname = url.pathname === '/' ? '/fixture.html' : url.pathname;
  const filePath = join(fixturesDir, pathname);

  try {
    const stats = statSync(filePath);
    if (stats.isFile()) {
      const content = readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
});

const port = 3000;
server.listen(port, () => {
  console.log(`Test server running on http://localhost:${port}`);
});
