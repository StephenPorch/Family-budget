const http = require('http');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const distDir = path.resolve(__dirname, '../dist');
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '/Family-budget/' || reqPath === '/Family-budget') {
    reqPath = '/index.html';
  } else if (reqPath.startsWith('/Family-budget/')) {
    reqPath = reqPath.replace('/Family-budget/', '/');
  }

  const filePath = path.join(distDir, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    const indexPath = path.join(distDir, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(indexPath).pipe(res);
  }
});

const PORT = 5198;
server.listen(PORT, async () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-test-header-'));
  
  const testWidths = [1024, 1280, 1440];
  let allPassed = true;

  for (const width of testWidths) {
    console.log(`\n--- Testing viewport width: ${width}px ---`);
    const chrome = cp.spawn(chromePath, [
      '--headless=new',
      `--window-size=${width},800`,
      '--remote-debugging-port=9228',
      '--user-data-dir=' + tempDir,
      `http://localhost:${PORT}/Family-budget/`
    ]);

    try {
      await new Promise(r => setTimeout(r, 2000));
      const list = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9228/json', res => {
          let raw = '';
          res.on('data', chunk => raw += chunk);
          res.on('end', () => resolve(JSON.parse(raw)));
        }).on('error', reject);
      });

      const page = list.find(t => t.type === 'page');
      const ws = new WebSocket(page.webSocketDebuggerUrl);

      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
      });

      let id = 1;
      const send = (method, params = {}) => {
        const msgId = id++;
        return new Promise(res => {
          const handler = (event) => {
            const parsed = JSON.parse(event.data);
            if (parsed.id === msgId) {
              ws.removeEventListener('message', handler);
              res(parsed.result);
            }
          };
          ws.addEventListener('message', handler);
          ws.send(JSON.stringify({ id: msgId, method, params }));
        });
      };

      await send('Runtime.enable');
      await new Promise(r => setTimeout(r, 1000));

      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const header = document.querySelector('header > div');
            const left = header.children[0];
            const nav = header.children[1];
            const right = header.children[2];
            console.log('MEASUREMENTS:', JSON.stringify({
              containerWidth: header.getBoundingClientRect().width,
              leftWidth: left.getBoundingClientRect().width,
              navWidth: nav.getBoundingClientRect().width,
              rightWidth: right.getBoundingClientRect().width,
              sum: left.getBoundingClientRect().width + nav.getBoundingClientRect().width + right.getBoundingClientRect().width
            }));

            const cw = document.documentElement.clientWidth;
            const elements = Array.from(document.querySelectorAll('*'));
            const overflowing = [];
            for (const el of elements) {
              const r = el.getBoundingClientRect();
              if (r.right > cw + 2) {
                overflowing.push({
                  tag: el.tagName,
                  className: el.className ? el.className.toString().slice(0, 50) : '',
                  id: el.id,
                  right: Math.round(r.right),
                  width: Math.round(r.width),
                  cw: cw
                });
              }
            }

            const headerDiv = document.querySelector('header > div');
            const main = document.querySelector('main');
            const diamond = document.querySelector('header .bg-stone-900.text-white');
            const plusBtn = document.querySelector('button[aria-label="Записать операцию"]');
            const hRect = headerDiv.getBoundingClientRect();
            const mRect = main.getBoundingClientRect();
            const dRect = diamond ? diamond.getBoundingClientRect() : null;
            const pRect = plusBtn ? plusBtn.getBoundingClientRect() : null;
            const nRect = nav ? nav.getBoundingClientRect() : null;

            return JSON.stringify({
              measurements: {
                containerWidth: Math.round(hRect.width),
                leftWidth: Math.round(left.getBoundingClientRect().width),
                navWidth: Math.round(nav.getBoundingClientRect().width),
                rightWidth: Math.round(right.getBoundingClientRect().width),
                sum: Math.round(left.getBoundingClientRect().width + nav.getBoundingClientRect().width + right.getBoundingClientRect().width)
              },
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
              overflowingElements: overflowing.slice(0, 5),
              headerWidth: Math.round(hRect.width),
              mainWidth: Math.round(mRect.width),
              aligned: Math.abs(hRect.left - mRect.left) < 2 && Math.abs(hRect.right - mRect.right) < 2,
              diamondVisible: dRect && dRect.width >= 38 && dRect.left >= hRect.left,
              plusBtnSquare: pRect && Math.abs(pRect.width - 40) <= 2 && Math.abs(pRect.height - 40) <= 2,
              plusBtnText: plusBtn ? plusBtn.innerText.trim() : null,
              navVisible: nRect && nRect.width > 300,
              badge: document.querySelector('header')?.innerText.includes('v0.7.7.1')
            });
          })()
        `
      });

      const result = JSON.parse(evalRes.result.value);
      console.log('Result:', result);

      if (result.hasHorizontalOverflow) {
        throw new Error(`FAIL: Horizontal overflow detected at ${width}px!`);
      }
      if (!result.aligned) {
        throw new Error(`FAIL: Header and Main are not aligned at ${width}px! Header: ${result.headerWidth}, Main: ${result.mainWidth}`);
      }
      if (!result.diamondVisible) {
        throw new Error(`FAIL: Diamond logo is crushed or shifted off at ${width}px!`);
      }
      if (!result.plusBtnSquare) {
        throw new Error(`FAIL: Plus button is not 40x40 at ${width}px!`);
      }
      if (result.plusBtnText !== '') {
        throw new Error(`FAIL: Plus button should not have text, got "${result.plusBtnText}"`);
      }

      console.log(`✅ ${width}px layout verified successfully!`);
      chrome.kill();
    } catch (err) {
      console.error(err);
      allPassed = false;
      chrome.kill();
      break;
    }
  }

  server.close();
  if (allPassed) {
    console.log('\n🎉 ALL VIEWPORT WIDTHS (1024px, 1280px, 1440px) PASSED WITH PERFECT ALIGNMENT!');
    process.exit(0);
  } else {
    process.exit(1);
  }
});
