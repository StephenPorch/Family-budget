const http = require('http');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Simple static server for dist
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
    // fallback to index.html for SPA
    const indexPath = path.join(distDir, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(indexPath).pipe(res);
  }
});

const PORT = 5199;
server.listen(PORT, async () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-test-backdrop-'));
  const chrome = cp.spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--user-data-dir=' + tempDir,
    `http://localhost:${PORT}/Family-budget/`
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9226/json', res => {
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
    await new Promise(r => setTimeout(r, 1500));

    // 1. Open Profile Settings Modal
    const openRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('button[aria-label="Настроить профили и владельца телефона"]');
          if (btn) {
            btn.click();
            return 'OK';
          }
          return 'NOT_FOUND';
        })()
      `
    });
    console.log('1. Open Modal:', openRes.result.value);

    await new Promise(r => setTimeout(r, 500));

    // 2. Measure input position
    const rectRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const input = document.querySelector('[role="dialog"] input[type="text"]');
          if (!input) return null;
          const rect = input.getBoundingClientRect();
          return JSON.stringify({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
        })()
      `
    });
    const rect = JSON.parse(rectRes.result.value);
    console.log('2. Input bounding rect:', rect);

    // 3. Simulate text selection drag that leaves input and modal onto backdrop:
    // Mousedown inside input (x: rect.x + 100, y: rect.y + 15)
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: rect.x + 100,
      y: rect.y + 15,
      button: 'left',
      clickCount: 1
    });

    // Move mouse leftwards far beyond modal edge (x: rect.x - 120)
    for (let dx = 80; dx >= -120; dx -= 20) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: rect.x + dx,
        y: rect.y + 15,
        button: 'left'
      });
      await new Promise(r => setTimeout(r, 30));
    }

    // Release mouse outside modal over the backdrop
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: rect.x - 120,
      y: rect.y + 15,
      button: 'left',
      clickCount: 1
    });

    await new Promise(r => setTimeout(r, 500));

    // Verify modal is STILL OPEN!
    const checkOpenAfterDrag = await send('Runtime.evaluate', {
      expression: `!!document.querySelector('[role="dialog"]')`
    });
    console.log('3. Modal still open after dragging left onto backdrop:', checkOpenAfterDrag.result.value);
    if (!checkOpenAfterDrag.result.value) {
      throw new Error('FAILED: Modal closed when dragging cursor left over backdrop!');
    }

    // 4. Verify that normal click ON THE BACKDROP ITSELF still closes the modal
    // Click on x: 10, y: 10 (top left corner backdrop)
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: 10,
      y: 10,
      button: 'left',
      clickCount: 1
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 10,
      y: 10,
      button: 'left',
      clickCount: 1
    });

    await new Promise(r => setTimeout(r, 500));

    const checkClosedAfterBackdropClick = await send('Runtime.evaluate', {
      expression: `!document.querySelector('[role="dialog"]')`
    });
    console.log('4. Modal closed on intentional backdrop click:', checkClosedAfterBackdropClick.result.value);
    if (!checkClosedAfterBackdropClick.result.value) {
      throw new Error('FAILED: Modal did not close on intentional backdrop click!');
    }

    console.log('✅ ALL BACKDROP DISMISS TESTS PASSED WITH 100% SUCCESS!');
    chrome.kill();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    chrome.kill();
    server.close();
    process.exit(1);
  }
});
