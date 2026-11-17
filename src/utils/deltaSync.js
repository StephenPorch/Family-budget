// Движок дельта-синхронизации LWW (Last-Write-Wins) с поддержкой soft-delete tombstones (FB-10)
export const SYNC_ENTITY_KEYS = [
  'transactions',
  'goals',
  'recurringPayments',
  'debts',
  'customCategories',
];

export const DEFAULT_FALLBACK_UPDATED_AT = '2026-01-01T00:00:00.000Z';
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const toValidIso = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

export const getDeterministicFallbackTimestamp = (item) => {
  const existing = toValidIso(item?.updatedAt);
  if (existing) return existing;
  if (item?.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
    return `${item.date}T00:00:00.000Z`;
  }
  return DEFAULT_FALLBACK_UPDATED_AT;
};

export const ensureItemTimestamp = (item, fallbackIso = null) => {
  if (!item || typeof item !== 'object') return item;
  const ts = toValidIso(item.updatedAt) || getDeterministicFallbackTimestamp(item) || fallbackIso || DEFAULT_FALLBACK_UPDATED_AT;
  if (item.updatedAt === ts) return item;
  return { ...item, updatedAt: ts };
};

export const ensureCollectionTimestamps = (list = []) => {
  if (!Array.isArray(list)) return [];
  return list.map(item => ensureItemTimestamp(item));
};

export const touchItemTimestamp = (item, nowIso = new Date().toISOString()) => {
  if (!item || typeof item !== 'object') return item;
  return { ...item, updatedAt: nowIso };
};

export const pruneOldTombstones = (tombstones = [], nowMs = Date.now()) => {
  if (!Array.isArray(tombstones)) return [];
  const cutoff = nowMs - TOMBSTONE_TTL_MS;
  const dedup = new Map();

  for (const t of tombstones) {
    if (!t || !t.entityType || t.id === undefined || t.id === null) continue;
    const iso = toValidIso(t.deletedAt);
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (ms < cutoff) continue;
    const key = `${t.entityType}:${String(t.id)}`;
    const prev = dedup.get(key);
    if (!prev || Date.parse(prev.deletedAt) < ms) {
      dedup.set(key, { entityType: t.entityType, id: String(t.id), deletedAt: iso });
    }
  }
  return Array.from(dedup.values());
};

export const recordDeletionTombstone = (
  tombstones = [],
  entityType,
  id,
  deletedAt = new Date().toISOString()
) => {
  if (!entityType || id === undefined || id === null) return pruneOldTombstones(tombstones);
  const strId = String(id);
  const filtered = (Array.isArray(tombstones) ? tombstones : []).filter(
    t => !(t && t.entityType === entityType && String(t.id) === strId)
  );
  filtered.push({ entityType, id: strId, deletedAt });
  return pruneOldTombstones(filtered);
};

export const removeDeletionTombstone = (tombstones = [], entityType, id) => {
  if (!entityType || id === undefined || id === null) return Array.isArray(tombstones) ? tombstones : [];
  const strId = String(id);
  return (Array.isArray(tombstones) ? tombstones : []).filter(
    t => !(t && t.entityType === entityType && String(t.id) === strId)
  );
};

const parseTsMs = (iso) => {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
};

// LWW-слияние одной коллекции с учетом tombstones
export const mergeEntityCollection = (
  localActive = [],
  localTombstones = [],
  remoteActive = [],
  remoteTombstones = [],
  entityType = 'transactions'
) => {
  const localMap = new Map();
  const remoteMap = new Map();
  const localTombMap = new Map();
  const remoteTombMap = new Map();
  const allIds = new Set();

  for (const item of Array.isArray(localActive) ? localActive : []) {
    if (!item || item.id === undefined || item.id === null) continue;
    const sid = String(item.id);
    const norm = ensureItemTimestamp(item);
    localMap.set(sid, norm);
    allIds.add(sid);
  }

  for (const item of Array.isArray(remoteActive) ? remoteActive : []) {
    if (!item || item.id === undefined || item.id === null) continue;
    const sid = String(item.id);
    const norm = ensureItemTimestamp(item);
    remoteMap.set(sid, norm);
    allIds.add(sid);
  }

  for (const t of Array.isArray(localTombstones) ? localTombstones : []) {
    if (!t || t.entityType !== entityType || t.id === undefined || t.id === null) continue;
    const sid = String(t.id);
    localTombMap.set(sid, t);
    allIds.add(sid);
  }

  for (const t of Array.isArray(remoteTombstones) ? remoteTombstones : []) {
    if (!t || t.entityType !== entityType || t.id === undefined || t.id === null) continue;
    const sid = String(t.id);
    remoteTombMap.set(sid, t);
    allIds.add(sid);
  }

  const mergedActive = [];
  const mergedTombstones = [];
  let added = 0;
  let updated = 0;
  let deleted = 0;

  for (const sid of allIds) {
    const la = localMap.get(sid);
    const ra = remoteMap.get(sid);
    const lt = localTombMap.get(sid);
    const rt = remoteTombMap.get(sid);

    const laTs = la ? parseTsMs(la.updatedAt) : -1;
    const raTs = ra ? parseTsMs(ra.updatedAt) : -1;
    const ltTs = lt ? parseTsMs(lt.deletedAt) : -1;
    const rtTs = rt ? parseTsMs(rt.deletedAt) : -1;

    let bestActive = null;
    let bestActiveTs = -1;
    if (la && ra) {
      if (raTs > laTs) {
        bestActive = ra;
        bestActiveTs = raTs;
      } else {
        bestActive = la;
        bestActiveTs = laTs;
      }
    } else if (la) {
      bestActive = la;
      bestActiveTs = laTs;
    } else if (ra) {
      bestActive = ra;
      bestActiveTs = raTs;
    }

    let bestTomb = null;
    let bestTombTs = -1;
    if (lt && rt) {
      if (rtTs >= ltTs) {
        bestTomb = rt;
        bestTombTs = rtTs;
      } else {
        bestTomb = lt;
        bestTombTs = ltTs;
      }
    } else if (lt) {
      bestTomb = lt;
      bestTombTs = ltTs;
    } else if (rt) {
      bestTomb = rt;
      bestTombTs = rtTs;
    }

    // При равенстве таймстампов удаление побеждает правку для защиты от «зомби»
    if (bestTomb && bestTombTs >= bestActiveTs) {
      mergedTombstones.push(bestTomb);
      if (la) deleted++;
    } else if (bestActive) {
      mergedActive.push(bestActive);
      if (!la && ra) {
        added++;
      } else if (la && bestActive === ra && JSON.stringify(la) !== JSON.stringify(ra)) {
        updated++;
      }
    }
  }

  if (entityType === 'transactions') {
    mergedActive.sort((a, b) => {
      const cmp = (b.date || '').localeCompare(a.date || '');
      if (cmp !== 0) return cmp;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  return {
    active: mergedActive,
    tombstones: mergedTombstones,
    stats: { added, updated, deleted },
  };
};

// Сборка инкрементальной дельты (или полного снимка при sinceIso === null)
export const buildSyncDelta = (state = {}, sinceIso = null, nowIso = new Date().toISOString()) => {
  const sinceMs = sinceIso ? parseTsMs(sinceIso) : -1;
  const entities = {};

  for (const key of SYNC_ENTITY_KEYS) {
    const list = ensureCollectionTimestamps(state[key] || []);
    entities[key] = sinceMs >= 0
      ? list.filter(item => parseTsMs(item.updatedAt) > sinceMs)
      : list;
  }

  const allTombstones = pruneOldTombstones(state.syncTombstones || []);
  const tombstones = sinceMs >= 0
    ? allTombstones.filter(t => parseTsMs(t.deletedAt) > sinceMs)
    : allTombstones;

  const meta = state.settingsSyncMeta || {};
  const settings = {};
  const settingsMeta = {};

  const profTs = meta.userProfiles || DEFAULT_FALLBACK_UPDATED_AT;
  if (state.userProfiles && (sinceMs < 0 || parseTsMs(profTs) > sinceMs)) {
    settings.userProfiles = state.userProfiles;
    settingsMeta.userProfiles = profTs;
  }

  const limitCfgTs = meta.safeLimitConfig || DEFAULT_FALLBACK_UPDATED_AT;
  if (state.safeLimitConfig && (sinceMs < 0 || parseTsMs(limitCfgTs) > sinceMs)) {
    settings.safeLimitConfig = state.safeLimitConfig;
    settingsMeta.safeLimitConfig = limitCfgTs;
  }

  const localLimits = state.plannedCategoryLimits || {};
  const localLimitsMeta = meta.plannedCategoryLimits || {};
  const allLimitCats = new Set([...Object.keys(localLimits), ...Object.keys(localLimitsMeta)]);
  const deltaLimits = {};
  const deltaLimitsMeta = {};
  let hasLimitsDelta = false;

  for (const cat of allLimitCats) {
    const entryMeta = localLimitsMeta[cat] || { updatedAt: DEFAULT_FALLBACK_UPDATED_AT, deleted: false };
    const ts = entryMeta.updatedAt || DEFAULT_FALLBACK_UPDATED_AT;
    if (sinceMs < 0 || parseTsMs(ts) > sinceMs) {
      hasLimitsDelta = true;
      deltaLimitsMeta[cat] = entryMeta;
      if (!entryMeta.deleted && localLimits[cat] !== undefined) {
        deltaLimits[cat] = localLimits[cat];
      }
    }
  }

  if (hasLimitsDelta) {
    settings.plannedCategoryLimits = deltaLimits;
    settingsMeta.plannedCategoryLimits = deltaLimitsMeta;
  }

  return {
    v: 1,
    kind: 'fb_sync_delta',
    generatedAt: nowIso,
    since: sinceIso || null,
    entities,
    tombstones,
    settings,
    settingsMeta,
  };
};

// Применение входящей дельты/снимка к локальному состоянию
export const mergeSyncPayload = (localState = {}, remoteDelta = {}) => {
  const localTombstones = pruneOldTombstones(localState.syncTombstones || []);
  const remoteTombstones = pruneOldTombstones(remoteDelta.tombstones || []);

  const nextEntities = {};
  let nextTombstones = [];
  const totalStats = { added: 0, updated: 0, deleted: 0, settingsUpdated: 0 };

  for (const key of SYNC_ENTITY_KEYS) {
    const res = mergeEntityCollection(
      localState[key] || [],
      localTombstones,
      remoteDelta.entities?.[key] || [],
      remoteTombstones,
      key
    );
    nextEntities[key] = res.active;
    nextTombstones = nextTombstones.concat(res.tombstones);
    totalStats.added += res.stats.added;
    totalStats.updated += res.stats.updated;
    totalStats.deleted += res.stats.deleted;
  }

  // Сохранение любых tombstones с неизвестными/будущими entityType
  for (const t of [...localTombstones, ...remoteTombstones]) {
    if (!SYNC_ENTITY_KEYS.includes(t.entityType)) {
      nextTombstones.push(t);
    }
  }
  nextTombstones = pruneOldTombstones(nextTombstones);

  const localMeta = localState.settingsSyncMeta || {};
  const remoteMeta = remoteDelta.settingsMeta || {};
  const remoteSettings = remoteDelta.settings || {};
  const nextMeta = {
    userProfiles: localMeta.userProfiles || DEFAULT_FALLBACK_UPDATED_AT,
    safeLimitConfig: localMeta.safeLimitConfig || DEFAULT_FALLBACK_UPDATED_AT,
    plannedCategoryLimits: { ...(localMeta.plannedCategoryLimits || {}) },
  };

  let nextUserProfiles = localState.userProfiles;
  if (remoteSettings.userProfiles && remoteMeta.userProfiles) {
    if (parseTsMs(remoteMeta.userProfiles) > parseTsMs(nextMeta.userProfiles)) {
      nextUserProfiles = remoteSettings.userProfiles;
      nextMeta.userProfiles = remoteMeta.userProfiles;
      totalStats.settingsUpdated++;
    }
  }

  let nextSafeLimitConfig = localState.safeLimitConfig;
  if (remoteSettings.safeLimitConfig && remoteMeta.safeLimitConfig) {
    if (parseTsMs(remoteMeta.safeLimitConfig) > parseTsMs(nextMeta.safeLimitConfig)) {
      nextSafeLimitConfig = remoteSettings.safeLimitConfig;
      nextMeta.safeLimitConfig = remoteMeta.safeLimitConfig;
      totalStats.settingsUpdated++;
    }
  }

  const nextLimits = { ...(localState.plannedCategoryLimits || {}) };
  const remoteLimits = remoteSettings.plannedCategoryLimits || {};
  const remoteLimitsMeta = remoteMeta.plannedCategoryLimits || {};
  const allCats = new Set([...Object.keys(nextLimits), ...Object.keys(remoteLimits), ...Object.keys(remoteLimitsMeta)]);

  for (const cat of allCats) {
    const lMeta = nextMeta.plannedCategoryLimits[cat] || {
      updatedAt: DEFAULT_FALLBACK_UPDATED_AT,
      deleted: nextLimits[cat] === undefined,
    };
    const rMeta = remoteLimitsMeta[cat];
    if (!rMeta) continue;

    if (parseTsMs(rMeta.updatedAt) > parseTsMs(lMeta.updatedAt)) {
      nextMeta.plannedCategoryLimits[cat] = rMeta;
      if (rMeta.deleted || remoteLimits[cat] === undefined) {
        delete nextLimits[cat];
      } else {
        nextLimits[cat] = remoteLimits[cat];
      }
      totalStats.settingsUpdated++;
    }
  }

  totalStats.totalChanged = totalStats.added + totalStats.updated + totalStats.deleted + totalStats.settingsUpdated;

  return {
    nextState: {
      ...nextEntities,
      syncTombstones: nextTombstones,
      userProfiles: nextUserProfiles,
      safeLimitConfig: nextSafeLimitConfig,
      plannedCategoryLimits: nextLimits,
      settingsSyncMeta: nextMeta,
    },
    stats: totalStats,
  };
};

// Компактное Base64URL кодирование / декодирование для ссылок и буфера обмена
const bytesToBase64Url = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const b64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64UrlToBytes = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const full = b64 + pad;
  if (typeof atob === 'function') {
    const bin = atob(full);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(full, 'base64'));
};

const compressUtf8Bytes = async (utf8Bytes) => {
  if (typeof CompressionStream === 'undefined') return null;
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(utf8Bytes);
  writer.close();
  const ab = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(ab);
};

const decompressUtf8Bytes = async (compressedBytes) => {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Браузер не поддерживает DecompressionStream');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compressedBytes);
  writer.close();
  const ab = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(ab);
};

export const encodeDeltaPacket = async (deltaObj) => {
  const jsonStr = JSON.stringify(deltaObj);
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  try {
    const compressed = await compressUtf8Bytes(utf8Bytes);
    if (compressed && compressed.length < utf8Bytes.length) {
      return `fbz1:${bytesToBase64Url(compressed)}`;
    }
  } catch {
    // Fallback на несжатый формат
  }
  return `fb1:${bytesToBase64Url(utf8Bytes)}`;
};

export const decodeDeltaPacket = async (rawInput) => {
  let token = String(rawInput || '').trim();
  if (!token) throw new Error('Пустой код синхронизации');

  // Извлекаем параметр ?sync=... или #sync=... если передан полный URL
  if (/^https?:\/\//i.test(token) || token.includes('?sync=') || token.includes('&sync=')) {
    try {
      const urlObj = new URL(token.startsWith('http') ? token : `https://local.invalid/${token}`);
      const syncParam = urlObj.searchParams.get('sync');
      if (syncParam) token = syncParam.trim();
    } catch {
      const m = token.match(/[?&#]sync=([^&#]+)/);
      if (m) token = decodeURIComponent(m[1]).trim();
    }
  }

  if (token.startsWith('{')) {
    const parsed = JSON.parse(token);
    if (!parsed || parsed.kind !== 'fb_sync_delta') {
      throw new Error('Неверный формат JSON-дельты');
    }
    return parsed;
  }

  if (token.startsWith('fbz1:')) {
    const compressed = base64UrlToBytes(token.slice(5));
    const utf8 = await decompressUtf8Bytes(compressed);
    const parsed = JSON.parse(new TextDecoder().decode(utf8));
    if (!parsed || parsed.kind !== 'fb_sync_delta') {
      throw new Error('Поврежденная дельта синхронизации');
    }
    return parsed;
  }

  if (token.startsWith('fb1:')) {
    const utf8 = base64UrlToBytes(token.slice(4));
    const parsed = JSON.parse(new TextDecoder().decode(utf8));
    if (!parsed || parsed.kind !== 'fb_sync_delta') {
      throw new Error('Поврежденная дельта синхронизации');
    }
    return parsed;
  }

  throw new Error('Неподдерживаемый формат кода синхронизации');
};

export const encodePairingPayload = ({ webhookUrl, syncSecret }) => {
  const payload = {
    v: 1,
    kind: 'fb_pair',
    u: String(webhookUrl || '').trim(),
    s: String(syncSecret || '').trim(),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return `fbp1:${bytesToBase64Url(bytes)}`;
};

export const decodePairingPayload = (rawInput) => {
  let token = String(rawInput || '').trim();
  if (!token) throw new Error('Пустая ссылка подключения');

  if (/^https?:\/\//i.test(token) || token.includes('?pair=') || token.includes('&pair=')) {
    try {
      const urlObj = new URL(token.startsWith('http') ? token : `https://local.invalid/${token}`);
      const pairParam = urlObj.searchParams.get('pair');
      if (pairParam) token = pairParam.trim();
    } catch {
      const m = token.match(/[?&#]pair=([^&#]+)/);
      if (m) token = decodeURIComponent(m[1]).trim();
    }
  }

  if (!token.startsWith('fbp1:')) {
    throw new Error('Неверный формат ссылки подключения');
  }
  const bytes = base64UrlToBytes(token.slice(5));
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || parsed.kind !== 'fb_pair' || !parsed.u) {
    throw new Error('Некорректные данные подключения');
  }
  return {
    webhookUrl: String(parsed.u).trim(),
    syncSecret: String(parsed.s || '').trim(),
  };
};
