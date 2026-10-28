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

const PORT = 5197;
server.listen(PORT, async () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-test-limit-'));
  const chrome = cp.spawn(chromePath, [
    '--headless=new',
    '--window-size=1280,800',
    '--remote-debugging-port=9231',
    '--user-data-dir=' + tempDir,
    `http://localhost:${PORT}/Family-budget/`
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9231/json', res => {
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
    await new Promise(r => setTimeout(r, 1200));

    // 1. Check initial subtitle of 4th card (should mention payday calculation)
    const initialText = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('main .grid > div'));
          const limitCard = cards[3];
          return limitCard ? limitCard.innerText : 'CARD NOT FOUND';
        })()
      `
    });
    console.log('1. Initial Safe Limit Card Text:\n', initialText.result.value);
    if (!initialText.result.value.includes('до ЗП') && !initialText.result.value.includes('дн.')) {
      throw new Error('FAIL: Initial card does not show payday horizon text!');
    }

    // 2. Click the settings button on 4th card
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('button[aria-label="Настроить горизонт лимита и дни зарплаты"]');
          if (btn) {
            btn.click();
            return 'CLICKED';
          }
          return 'BUTTON NOT FOUND';
        })()
      `
    });
    console.log('2. Click Settings Button:', clickRes.result.value);

    await new Promise(r => setTimeout(r, 500));

    // 3. Verify modal opened
    const modalTitle = await send('Runtime.evaluate', {
      expression: `document.getElementById('safe-limit-modal-title') ? document.getElementById('safe-limit-modal-title').innerText : 'NOT FOUND'`
    });
    console.log('3. Modal Title:', modalTitle.result.value);
    if (modalTitle.result.value !== 'Горизонт безопасного лимита') {
      throw new Error('FAIL: SafeLimitConfigModal did not open!');
    }

    // 4. Switch mode to "Срок в днях" and select 7 days
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
          const daysTab = buttons.find(b => b.innerText.includes('Срок в днях'));
          if (daysTab) daysTab.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 300));

    // Click "7 дней" button
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
          const btn7 = buttons.find(b => b.innerText.trim() === '7 дней');
          if (btn7) btn7.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 300));

    // Click "Сохранить горизонт"
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const submitBtn = document.querySelector('[role="dialog"] button[type="submit"]');
          if (submitBtn) submitBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    // 5. Check updated 4th card text
    const updatedText = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('main .grid > div'));
          const limitCard = cards[3];
          return limitCard ? limitCard.innerText : '';
        })()
      `
    });
    console.log('4. Updated Safe Limit Card Text:\n', updatedText.result.value);
    if (!updatedText.result.value.includes('на 7 дн.')) {
      throw new Error('FAIL: Card text was not updated to 7 days!');
    }

    console.log('✅ CUSTOMIZABLE SAFE LIMIT HORIZON FULLY VERIFIED IN HEADLESS CHROME!');
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
