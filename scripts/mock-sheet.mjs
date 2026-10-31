/**
 * A stand-in for the Google Sheet's web app, for trying the chart out
 * without Google.
 *
 *   npm run mock-sheet                  then, in another terminal:
 *   VITE_SHEET_URL=http://localhost:8787 npm run dev
 *
 * It runs the real apps-script/Code.gs against an in-memory spreadsheet, so
 * what the devices see is what the real Sheet would do. Check marks vanish when it
 * stops. GET /sheet prints the pretend spreadsheet, to see what landed where.
 *
 * MOCK_DELAY=1200 makes every reply that slow — Apps Script really does take
 * about a second, and the chart has to feel right at that speed.
 */

import { createServer } from 'node:http';
import { loadScript, get } from './gas-fakes.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const DELAY = Number(process.env.MOCK_DELAY ?? 0);

const { script, spreadsheet } = loadScript();
script.setup();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url.pathname === '/sheet') {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(
        Object.fromEntries(spreadsheet.getSheets().map((s) => [s.getName(), s.cells])),
        null,
        1,
      ),
    );
    return;
  }

  await wait(DELAY);

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(get(script, Object.fromEntries(url.searchParams))));
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.setHeader('Content-Type', 'application/json');
    res.end(script.doPost({ postData: { contents: body } }).getContent());
    return;
  }

  res.statusCode = 405;
  res.end();
}).listen(PORT, () => {
  console.log(`Pretend Sheet listening on http://localhost:${PORT}`);
});

