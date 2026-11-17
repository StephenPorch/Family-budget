import { buildSyncDelta } from './deltaSync.js';

export const isValidGasWebhookUrl = (url) => {
  const s = String(url || '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
};

export const generateRandomSyncSecret = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = 'fb-';
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};

export const generateGasCodeScript = (syncSecret = 'fb-family-secret') => {
  const safeSecretLiteral = JSON.stringify(String(syncSecret || 'fb-family-secret'));
  return `// Google Apps Script для синхронизации «Семейного Бюджета» (FB-10)
// 1. Вставьте этот код в Расширения -> Apps Script вашей Google Таблицы
// 2. Нажмите «Начать развертывание» -> «Новое развертывание» -> «Веб-приложение»
// 3. Выполнять от имени: Меня | У кого есть доступ: Все (Anyone)

const SYNC_SECRET = ${safeSecretLiteral};
const STORE_SHEET = 'Sync_Store';
const VIEW_SHEET = 'Операции';
const ENTITY_KEYS = ['transactions', 'goals', 'recurringPayments', 'debts', 'customCategories'];

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse({ ok: true, status: 'Family Budget GAS Sync Ready', serverTime: new Date().toISOString() });
}

function parseMs(iso) {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return isNaN(ms) ? 0 : ms;
}

function ensureSheets(ss) {
  let view = ss.getSheetByName(VIEW_SHEET);
  if (!view) {
    view = ss.getSheets()[0] || ss.insertSheet(VIEW_SHEET);
    view.setName(VIEW_SHEET);
  }
  let store = ss.getSheetByName(STORE_SHEET);
  if (!store) {
    store = ss.insertSheet(STORE_SHEET);
    store.getRange(1, 1, 1, 5).setValues([['EntityType', 'Id', 'UpdatedAt', 'DeletedAt', 'JsonPayload']]);
  }
  return { store, view };
}

function readStoreMap(store) {
  const lastRow = store.getLastRow();
  const map = {};
  if (lastRow < 2) return map;
  const rows = store.getRange(2, 1, lastRow - 1, 5).getValues();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const entityType = String(r[0] || '');
    const id = String(r[1] || '');
    if (!entityType || !id) continue;
    map[entityType + ':' + id] = {
      entityType: entityType,
      id: id,
      updatedAt: String(r[2] || ''),
      deletedAt: String(r[3] || ''),
      jsonPayload: String(r[4] || ''),
    };
  }
  return map;
}

function writeStoreMap(store, map) {
  const rows = [['EntityType', 'Id', 'UpdatedAt', 'DeletedAt', 'JsonPayload']];
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i++) {
    const item = map[keys[i]];
    rows.push([item.entityType, item.id, item.updatedAt, item.deletedAt, item.jsonPayload]);
  }
  store.clearContents();
  store.getRange(1, 1, rows.length, 5).setValues(rows);
}

function refreshReadableView(view, map) {
  const txRows = [];
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i++) {
    const rec = map[keys[i]];
    if (rec.entityType !== 'transactions' || rec.deletedAt) continue;
    try {
      const tx = JSON.parse(rec.jsonPayload);
      const typeLabel = tx.isOpeningBalance ? 'Начальный остаток' : (tx.type === 'transfer' ? 'Перевод' : (tx.type === 'income' ? 'Доход' : 'Расход'));
      const accLabel = tx.type === 'transfer' ? ((tx.fromWallet || tx.account) + ' -> ' + (tx.transferTo || 'shared')) : (tx.account === 'personal' ? 'Личный' : 'Общий');
      txRows.push([tx.date || '', typeLabel, tx.category || '', tx.title || '', Number(tx.amount) || 0, accLabel, tx.author || '']);
    } catch (err) {}
  }
  txRows.sort(function(a, b) { return String(b[0]).localeCompare(String(a[0])); });
  const output = [['Дата', 'Тип', 'Категория', 'Название', 'Сумма', 'Счет', 'Автор']].concat(txRows);
  view.clearContents();
  view.getRange(1, 1, output.length, 7).setValues(output);
}

function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Некорректный JSON в запросе' });
  }

  if (String(payload.secret || '') !== SYNC_SECRET) {
    return jsonResponse({ ok: false, error: 'Неверный секретный ключ семьи (SYNC_SECRET)' });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ensureSheets(ss);
    const map = readStoreMap(sheets.store);
    const serverTime = new Date().toISOString();

    if (payload.action === 'ping') {
      return jsonResponse({ ok: true, serverTime: serverTime, recordsCount: Object.keys(map).length });
    }

    if (payload.action !== 'sync' || !payload.delta) {
      return jsonResponse({ ok: false, error: 'Неизвестное действие синхронизации' });
    }

    const delta = payload.delta;
    let changed = false;

    for (let k = 0; k < ENTITY_KEYS.length; k++) {
      const eKey = ENTITY_KEYS[k];
      const list = (delta.entities && delta.entities[eKey]) || [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || item.id === undefined || item.id === null) continue;
        const mapKey = eKey + ':' + String(item.id);
        const cur = map[mapKey];
        const inTs = parseMs(item.updatedAt);
        const curTs = cur ? Math.max(parseMs(cur.updatedAt), parseMs(cur.deletedAt)) : -1;
        if (!cur || inTs > curTs) {
          map[mapKey] = {
            entityType: eKey,
            id: String(item.id),
            updatedAt: item.updatedAt || serverTime,
            deletedAt: '',
            jsonPayload: JSON.stringify(item),
          };
          changed = true;
        }
      }
    }

    const tombstones = delta.tombstones || [];
    for (let i = 0; i < tombstones.length; i++) {
      const t = tombstones[i];
      if (!t || !t.entityType || t.id === undefined || t.id === null) continue;
      const mapKey = t.entityType + ':' + String(t.id);
      const cur = map[mapKey];
      const delTs = parseMs(t.deletedAt);
      const curActiveTs = cur ? parseMs(cur.updatedAt) : -1;
      const curDelTs = cur ? parseMs(cur.deletedAt) : -1;
      if (!cur || delTs >= Math.max(curActiveTs, curDelTs)) {
        map[mapKey] = {
          entityType: t.entityType,
          id: String(t.id),
          updatedAt: '',
          deletedAt: t.deletedAt || serverTime,
          jsonPayload: '',
        };
        changed = true;
      }
    }

    const settings = delta.settings || {};
    const sMeta = delta.settingsMeta || {};
    ['userProfiles', 'safeLimitConfig'].forEach(function(sKey) {
      if (settings[sKey] && sMeta[sKey]) {
        const mapKey = 'settings:' + sKey;
        const cur = map[mapKey];
        if (!cur || parseMs(sMeta[sKey]) > parseMs(cur.updatedAt)) {
          map[mapKey] = {
            entityType: 'settings',
            id: sKey,
            updatedAt: sMeta[sKey],
            deletedAt: '',
            jsonPayload: JSON.stringify(settings[sKey]),
          };
          changed = true;
        }
      }
    });

    if (sMeta.plannedCategoryLimits) {
      const pMeta = sMeta.plannedCategoryLimits;
      const pVals = settings.plannedCategoryLimits || {};
      const cats = Object.keys(pMeta);
      for (let i = 0; i < cats.length; i++) {
        const cat = cats[i];
        const m = pMeta[cat];
        if (!m || !m.updatedAt) continue;
        const mapKey = 'plannedLimit:' + cat;
        const cur = map[mapKey];
        const curTs = cur ? Math.max(parseMs(cur.updatedAt), parseMs(cur.deletedAt)) : -1;
        if (!cur || parseMs(m.updatedAt) > curTs) {
          map[mapKey] = {
            entityType: 'plannedLimit',
            id: cat,
            updatedAt: m.deleted ? '' : m.updatedAt,
            deletedAt: m.deleted ? m.updatedAt : '',
            jsonPayload: m.deleted ? '' : JSON.stringify(pVals[cat]),
          };
          changed = true;
        }
      }
    }

    if (changed) {
      writeStoreMap(sheets.store, map);
      refreshReadableView(sheets.view, map);
    }

    const sinceMs = payload.since ? parseMs(payload.since) : -1;
    const outEntities = {};
    for (let k = 0; k < ENTITY_KEYS.length; k++) outEntities[ENTITY_KEYS[k]] = [];
    const outTombstones = [];
    const outSettings = {};
    const outSettingsMeta = { plannedCategoryLimits: {} };
    const outLimits = {};

    const allKeys = Object.keys(map);
    for (let i = 0; i < allKeys.length; i++) {
      const rec = map[allKeys[i]];
      const recTs = Math.max(parseMs(rec.updatedAt), parseMs(rec.deletedAt));
      if (sinceMs >= 0 && recTs <= sinceMs) continue;

      if (rec.entityType === 'settings') {
        try {
          outSettings[rec.id] = JSON.parse(rec.jsonPayload);
          outSettingsMeta[rec.id] = rec.updatedAt;
        } catch (err) {}
      } else if (rec.entityType === 'plannedLimit') {
        if (rec.deletedAt) {
          outSettingsMeta.plannedCategoryLimits[rec.id] = { updatedAt: rec.deletedAt, deleted: true };
        } else {
          try {
            outLimits[rec.id] = JSON.parse(rec.jsonPayload);
            outSettingsMeta.plannedCategoryLimits[rec.id] = { updatedAt: rec.updatedAt, deleted: false };
          } catch (err) {}
        }
      } else if (rec.deletedAt) {
        outTombstones.push({ entityType: rec.entityType, id: rec.id, deletedAt: rec.deletedAt });
      } else if (outEntities[rec.entityType]) {
        try {
          outEntities[rec.entityType].push(JSON.parse(rec.jsonPayload));
        } catch (err) {}
      }
    }

    if (Object.keys(outSettingsMeta.plannedCategoryLimits).length > 0) {
      outSettings.plannedCategoryLimits = outLimits;
    } else {
      delete outSettingsMeta.plannedCategoryLimits;
    }

    return jsonResponse({
      ok: true,
      serverTime: serverTime,
      delta: {
        v: 1,
        kind: 'fb_sync_delta',
        generatedAt: serverTime,
        since: payload.since || null,
        entities: outEntities,
        tombstones: outTombstones,
        settings: outSettings,
        settingsMeta: outSettingsMeta,
      },
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}
`;
};

const postGasRequest = async (webhookUrl, bodyObj, timeoutMs = 20000) => {
  if (!isValidGasWebhookUrl(webhookUrl)) {
    throw new Error('Укажите корректный HTTPS-адрес веб-приложения Google Apps Script');
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: {
        // Используем text/plain, чтобы избежать CORS preflight OPTIONS в Google Apps Script
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(bodyObj),
      ...(controller ? { signal: controller.signal } : {}),
    });

    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Google Apps Script вернул HTML вместо JSON. Проверьте доступ: «Все (Anyone)» при развертывании.');
    }
    if (!parsed.ok) {
      throw new Error(parsed.error || 'Ошибка синхронизации на стороне Google Таблицы');
    }
    return parsed;
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error('Превышено время ожидания ответа от Google Таблицы');
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const testGasWebhookConnection = async ({ webhookUrl, syncSecret }) => {
  return postGasRequest(webhookUrl, {
    action: 'ping',
    secret: String(syncSecret || '').trim(),
  }, 15000);
};

export const syncWithGasWebhook = async ({
  webhookUrl,
  syncSecret,
  localState,
  lastSyncAt,
}) => {
  const delta = buildSyncDelta(localState, lastSyncAt || null);
  return postGasRequest(webhookUrl, {
    action: 'sync',
    secret: String(syncSecret || '').trim(),
    since: lastSyncAt || null,
    delta,
  }, 25000);
};
