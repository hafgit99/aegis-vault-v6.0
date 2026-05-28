import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const source = path.join(root, 'assets', 'brand', 'aegisvault-icon.svg');
const output = path.join(root, 'src-tauri', 'icons', 'aegisvault-icon-source.png');

const svg = await readFile(source, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1024, height: 1024 },
  deviceScaleFactor: 1,
});

await page.setContent(`
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        html,
        body {
          width: 1024px;
          height: 1024px;
          margin: 0;
          background: transparent;
          overflow: hidden;
        }

        svg {
          display: block;
          width: 1024px;
          height: 1024px;
        }
      </style>
    </head>
    <body>${svg}</body>
  </html>
`);

await page.screenshot({ path: output, omitBackground: true });
await browser.close();

console.log(`Rendered icon source: ${output}`);
