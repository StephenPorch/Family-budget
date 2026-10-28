const http = require('http');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-test-live-'));
const chrome = cp.spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9223',
  '--user-data-dir=' + tempDir,
  'https://stephenporch.github.io/Family-budget/'
]);

setTimeout(async () => {
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9223/json', (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          const list = JSON.parse(raw);
          const page = list.find(t => t.type === 'page') || list[0];
          resolve(page.webSocketDebuggerUrl);
        });
      }).on('error', reject);
    });

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
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

      (async () => {
        await send('Runtime.enable');
        // collect console messages
        ws.addEventListener('message', (event) => {
          const msg = JSON.parse(event.data);
          if (msg.method === 'Runtime.consoleAPICalled') {
            console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
          }
          if (msg.method === 'Runtime.exceptionThrown') {
            console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
          }
        });

        await new Promise(r => setTimeout(r, 4000));
        const res = await send('Runtime.evaluate', {
          expression: `JSON.stringify({
            rootChildren: document.getElementById('root') ? document.getElementById('root').children.length : -1,
            title: document.title,
            bodyText: document.body.innerText.slice(0, 200)
          })`
        });
        console.log('LIVE DOM EVALUATION:', res.result.value);
        chrome.kill();
        process.exit(0);
      })();
    };
  } catch (err) {
    console.error('Error:', err);
    chrome.kill();
    process.exit(1);
  }
}, 2500);
