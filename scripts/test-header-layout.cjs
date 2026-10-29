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
  if (reqPath === '/test-frame') {
    const w = req.url.includes('w=') ? req.url.split('w=')[1].split('&')[0] : '375';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#333;"><iframe id="f" src="/Family-budget/" style="width:${w}px;height:844px;border:0;display:block;margin:0 auto;background:#fff;"></iframe></body></html>`);
    return;
  }
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
  
  const mobileWidths = [360, 375, 390, 412];
  const desktopWidths = [1024, 1280, 1440];
  let allPassed = true;

  // 1. Mobile viewports verification
  for (const width of mobileWidths) {
    console.log(`\n--- Testing mobile viewport: ${width}px ---`);
    const chrome = cp.spawn(chromePath, [
      '--headless=new',
      '--window-size=1200,1000',
      '--remote-debugging-port=9228',
      '--user-data-dir=' + tempDir,
      `http://localhost:${PORT}/test-frame?w=${width}`
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
            const iframe = document.getElementById('f');
            const doc = iframe.contentDocument;
            const win = iframe.contentWindow;

            const winWidth = win.innerWidth;
            const docWidth = doc.documentElement.scrollWidth;
            const header = doc.querySelector('header');
            const headerInner = header ? header.querySelector('div') : null;
            const headerScrollWidth = headerInner ? headerInner.scrollWidth : 0;
            const headerClientWidth = headerInner ? headerInner.clientWidth : 0;

            const plusBtn = header ? header.querySelector('button[aria-label="Записать операцию"]') : null;
            const plusBtnVisible = plusBtn ? window.getComputedStyle(plusBtn).display !== 'none' : false;

            const mobileNav = doc.querySelector('nav[aria-label="Мобильная навигация"]');
            const mobileNavVisible = mobileNav ? window.getComputedStyle(mobileNav).display !== 'none' : false;

            const overflowing = [];
            doc.querySelectorAll('*').forEach(el => {
              const r = el.getBoundingClientRect();
              if (r.right > winWidth + 1) {
                overflowing.push({
                  tag: el.tagName,
                  className: (el.className || '').toString().slice(0, 40),
                  right: Math.round(r.right),
                  winWidth
                });
              }
            });

            return JSON.stringify({
              width: ${width},
              winWidth,
              docWidth,
              hasHorizontalOverflow: docWidth > winWidth,
              headerHasOverflow: headerScrollWidth > headerClientWidth,
              headerScrollWidth,
              headerClientWidth,
              plusBtnInHeaderHidden: !plusBtnVisible,
              mobileNavVisible,
              overflowingCount: overflowing.length,
              overflowing: overflowing.slice(0, 3)
            });
          })()
        `
      });

      const result = JSON.parse(evalRes.result.value);
      console.log('Result:', result);

      if (result.hasHorizontalOverflow) {
        throw new Error(`FAIL: Mobile horizontal overflow detected at ${width}px! Overflow amount: ${result.docWidth - result.winWidth}px`);
      }
      if (result.headerHasOverflow) {
        throw new Error(`FAIL: Header elements overflow container at ${width}px!`);
      }
      if (!result.plusBtnInHeaderHidden) {
        throw new Error(`FAIL: Header plus button must be hidden on mobile at ${width}px!`);
      }
      if (!result.mobileNavVisible) {
        throw new Error(`FAIL: Mobile bottom navigation must be visible at ${width}px!`);
      }

      console.log(`✅ Mobile ${width}px layout verified with 0px overflow!`);
      chrome.kill();
    } catch (err) {
      console.error(err);
      allPassed = false;
      chrome.kill();
      break;
    }
  }

  // 2. Desktop viewports verification
  if (allPassed) {
    for (const width of desktopWidths) {
      console.log(`\n--- Testing desktop viewport width: ${width}px ---`);
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
                diamondVisible: dRect && dRect.width >= 36 && dRect.left >= hRect.left,
                plusBtnSquare: pRect && Math.abs(pRect.width - 40) <= 2 && Math.abs(pRect.height - 40) <= 2,
                plusBtnText: plusBtn ? plusBtn.innerText.trim() : null,
                navVisible: nRect && nRect.width > 300,
                badge: document.querySelector('header')?.innerText.includes('v0.8.0')
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

        console.log(`✅ Desktop ${width}px layout verified successfully!`);
        chrome.kill();
      } catch (err) {
        console.error(err);
        allPassed = false;
        chrome.kill();
        break;
      }
    }
  }

  server.close();
  if (allPassed) {
    console.log('\n🎉 ALL VIEWPORTS (360px, 375px, 390px, 412px, 1024px, 1280px, 1440px) PASSED WITH 0px OVERFLOW!');
    process.exit(0);
  } else {
    process.exit(1);
  }
});
