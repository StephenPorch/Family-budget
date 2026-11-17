import React, { useState, useEffect, useRef } from 'react';
import {
  X, RefreshCw, Cloud, Check, Copy, QrCode, Share2, AlertCircle, ShieldCheck, Upload
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useBackdropDismiss } from '../../hooks/useBackdropDismiss.js';
import {
  buildSyncDelta,
  encodeDeltaPacket,
  decodeDeltaPacket,
  encodePairingPayload,
} from '../../utils/deltaSync.js';
import {
  generateGasCodeScript,
  generateRandomSyncSecret,
  isValidGasWebhookUrl,
} from '../../utils/gasSyncTransport.js';
import { encodeQrMatrix, buildQrSvgPath } from '../../utils/qrGenerator.js';

const getShareBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return '';
};

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return true;
};

export const FamilySyncModal = React.memo(function FamilySyncModal({
  isOpen,
  onClose,
  syncConfig,
  onSaveSyncConfig,
  lastSyncAt,
  hasUnsyncedChanges,
  isSyncing,
  syncError,
  onSyncNow,
  onTestConnection,
  localState,
  pendingIncomingPair,
  onClearPendingPair,
  pendingIncomingDeltaToken,
  onClearPendingDeltaToken,
  onApplyDecodedDelta,
  showToast,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  const backdropDismiss = useBackdropDismiss(onClose);

  const [tab, setTab] = useState('cloud'); // 'cloud' | 'p2p'
  const [webhookUrl, setWebhookUrl] = useState(syncConfig?.webhookUrl || '');
  const [syncSecret, setSyncSecret] = useState(syncConfig?.syncSecret || '');
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showPairQr, setShowPairQr] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // Вкладка P2P-дельты
  const [deltaScope, setDeltaScope] = useState('since'); // 'since' | 'full'
  const [outgoingToken, setOutgoingToken] = useState('');
  const [outgoingSummary, setOutgoingSummary] = useState(null);
  const [showDeltaQr, setShowDeltaQr] = useState(false);
  const [incomingInput, setIncomingInput] = useState('');
  const [incomingPreview, setIncomingPreview] = useState(null);
  const [incomingError, setIncomingError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTestResult(null);
    setIncomingError('');

    if (pendingIncomingPair) {
      setTab('cloud');
      setWebhookUrl(pendingIncomingPair.webhookUrl || '');
      setSyncSecret(pendingIncomingPair.syncSecret || '');
      setShowSetupGuide(false);
    } else {
      setWebhookUrl(syncConfig?.webhookUrl || '');
      setSyncSecret(syncConfig?.syncSecret || generateRandomSyncSecret());
    }

    if (pendingIncomingDeltaToken) {
      setTab('p2p');
      setIncomingInput(pendingIncomingDeltaToken);
    } else {
      setIncomingInput('');
      setIncomingPreview(null);
    }

    setOutgoingToken('');
    setOutgoingSummary(null);
    setShowDeltaQr(false);
    setShowPairQr(false);
  }, [isOpen, syncConfig, pendingIncomingPair, pendingIncomingDeltaToken]);

  // Авто-предпросмотр входящей дельты
  useEffect(() => {
    let cancelled = false;
    const raw = incomingInput.trim();
    if (!raw) {
      setIncomingPreview(null);
      setIncomingError('');
      return;
    }

    decodeDeltaPacket(raw)
      .then((delta) => {
        if (cancelled) return;
        const txsCount = (delta.entities?.transactions || []).length;
        const otherCount =
          (delta.entities?.goals || []).length +
          (delta.entities?.recurringPayments || []).length +
          (delta.entities?.debts || []).length +
          (delta.entities?.customCategories || []).length;
        const delCount = (delta.tombstones || []).length;
        setIncomingPreview({ delta, txsCount, otherCount, delCount });
        setIncomingError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setIncomingPreview(null);
        setIncomingError(err?.message || 'Не удалось распознать код синхронизации');
      });

    return () => {
      cancelled = true;
    };
  }, [incomingInput]);

  if (!isOpen) return null;

  const isUrlValid = isValidGasWebhookUrl(webhookUrl);
  const canCloudSync = isUrlValid && syncSecret.trim().length >= 4;

  const buildPairShareString = () => {
    const token = encodePairingPayload({ webhookUrl, syncSecret });
    const base = getShareBaseUrl();
    return base ? `${base}?pair=${encodeURIComponent(token)}` : token;
  };

  const pairQrResult = showPairQr && canCloudSync ? encodeQrMatrix(buildPairShareString()) : null;
  const deltaQrResult = showDeltaQr && outgoingToken ? encodeQrMatrix(outgoingToken) : null;

  const handleSaveAndSync = async (e) => {
    e?.preventDefault();
    const cfg = { webhookUrl: webhookUrl.trim(), syncSecret: syncSecret.trim() };
    onSaveSyncConfig(cfg);
    if (pendingIncomingPair) onClearPendingPair();
    await onSyncNow(cfg);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection({ webhookUrl: webhookUrl.trim(), syncSecret: syncSecret.trim() });
      setTestResult({ ok: true, msg: `Связь работает! Записей в таблице: ${res.recordsCount ?? 0}` });
      onSaveSyncConfig({ webhookUrl: webhookUrl.trim(), syncSecret: syncSecret.trim() });
    } catch (err) {
      setTestResult({ ok: false, msg: err?.message || 'Ошибка соединения' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyGasScript = async () => {
    const code = generateGasCodeScript(syncSecret.trim() || 'fb-family-secret');
    await copyTextToClipboard(code);
    showToast('Код Google Apps Script (Code.gs) скопирован в буфер!');
  };

  const handleSharePairing = async () => {
    const link = buildPairShareString();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Подключение Семейного Бюджета',
          text: 'Откройте ссылку, чтобы подключить телефон к нашему семейному бюджету:',
          url: link,
        });
        return;
      } catch {
        // Пользователь отменил или Web Share недоступен — копируем
      }
    }
    await copyTextToClipboard(link);
    showToast('Ссылка подключения второго телефона скопирована!');
  };

  const handleBuildAndShareDelta = async (shareViaSystem = false) => {
    const since = deltaScope === 'since' ? lastSyncAt : null;
    const delta = buildSyncDelta(localState, since);
    const token = await encodeDeltaPacket(delta);
    const base = getShareBaseUrl();
    const payloadStr = base ? `${base}?sync=${encodeURIComponent(token)}` : token;

    setOutgoingToken(payloadStr);
    setOutgoingSummary({
      txs: (delta.entities?.transactions || []).length,
      others:
        (delta.entities?.goals || []).length +
        (delta.entities?.recurringPayments || []).length +
        (delta.entities?.debts || []).length +
        (delta.entities?.customCategories || []).length,
      tombstones: (delta.tombstones || []).length,
      bytes: new TextEncoder().encode(payloadStr).length,
    });

    if (shareViaSystem && navigator.share && base) {
      try {
        await navigator.share({
          title: 'Обновление Семейного Бюджета',
          text: 'Новые операции для синхронизации нашего бюджета:',
          url: payloadStr,
        });
        return;
      } catch {
        // Fallback в буфер обмена
      }
    }
    await copyTextToClipboard(payloadStr);
    showToast('Дельта синхронизации скопирована! Отправьте ее супругу в Telegram.');
  };

  const handleApplyIncoming = () => {
    if (!incomingPreview?.delta) return;
    onApplyDecodedDelta(incomingPreview.delta);
    setIncomingInput('');
    setIncomingPreview(null);
    if (pendingIncomingDeltaToken) onClearPendingDeltaToken();
    onClose();
  };

  return (
    <div
      {...backdropDismiss}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[94vh] overflow-y-auto space-y-4"
      >
        <div className="w-10 h-1 rounded-full bg-stone-300 mx-auto mb-1 sm:hidden shrink-0" />

        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0">
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </span>
            <div>
              <span id="sync-modal-title" className="font-semibold text-stone-900 text-sm block">
                Синхронизация супругов (FB-10)
              </span>
              <span className="text-[11px] text-stone-500">
                {lastSyncAt
                  ? `Последний синк: ${new Date(lastSyncAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                  : 'Синхронизация еще не проводилась'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно синхронизации"
            className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Переключатель вкладок */}
        <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl h-10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('cloud')}
            className={`h-8 rounded-lg transition flex items-center justify-center gap-1.5 ${
              tab === 'cloud' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Google Таблица</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('p2p')}
            className={`h-8 rounded-lg transition flex items-center justify-center gap-1.5 ${
              tab === 'p2p' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Ссылка / QR</span>
          </button>
        </div>

        {tab === 'cloud' ? (
          <form onSubmit={handleSaveAndSync} className="space-y-4">
            {pendingIncomingPair && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                <div className="font-bold">Получены настройки с телефона партнера!</div>
                <p className="text-[11px] text-emerald-800">
                  Нажмите «Синхронизировать сейчас», чтобы подключиться к общей Google Таблице и объединить базы.
                </p>
              </div>
            )}

            {hasUnsyncedChanges && canCloudSync && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Есть локальные изменения с момента последнего синка. Нажмите «Синхронизировать сейчас».</span>
              </div>
            )}

            {syncError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                Ошибка синка: {syncError}
              </div>
            )}

            <div className="space-y-3 p-3.5 bg-stone-50 rounded-xl border border-stone-200/80">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  URL веб-приложения Google Apps Script
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full h-9 text-xs font-mono px-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-stone-700">
                    Секретный ключ семьи (SYNC_SECRET)
                  </label>
                  <button
                    type="button"
                    onClick={() => setSyncSecret(generateRandomSyncSecret())}
                    className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 underline"
                  >
                    Сгенерировать
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Минимум 4 символа"
                  value={syncSecret}
                  onChange={(e) => setSyncSecret(e.target.value)}
                  className="w-full h-9 text-xs font-mono px-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                />
              </div>

              {testResult && (
                <div className={`p-2.5 rounded-lg text-xs font-medium ${
                  testResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {testResult.msg}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={!canCloudSync || isTesting}
                  onClick={handleTest}
                  className="h-10 px-3 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 disabled:opacity-50 text-xs font-semibold text-stone-700 transition shrink-0"
                >
                  {isTesting ? 'Проверка...' : 'Проверить'}
                </button>
                <button
                  type="submit"
                  disabled={!canCloudSync || isSyncing}
                  className="flex-1 h-10 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Синхронизация...' : 'Синхронизировать сейчас'}</span>
                </button>
              </div>
            </div>

            {/* Спаривание второго телефона */}
            {canCloudSync && (
              <div className="p-3.5 bg-indigo-50/60 border border-indigo-200/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-indigo-950 block">Подключить второй телефон</span>
                    <span className="text-[11px] text-indigo-800">Передайте настройки супругу без ручного ввода URL</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSharePairing}
                    className="flex-1 h-9 px-3 bg-white border border-indigo-200 hover:bg-indigo-100/60 text-indigo-900 rounded-lg text-xs font-semibold transition inline-flex items-center justify-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Отправить ссылку</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPairQr(!showPairQr)}
                    className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>{showPairQr ? 'Скрыть QR' : 'QR-код'}</span>
                  </button>
                </div>
                {showPairQr && pairQrResult?.ok && (
                  <div className="p-3 bg-white rounded-xl border border-indigo-100 flex flex-col items-center gap-2 animate-fade-in">
                    <svg
                      viewBox={`0 0 ${pairQrResult.size + 4} ${pairQrResult.size + 4}`}
                      className="w-44 h-44 bg-white"
                      shapeRendering="crispEdges"
                      aria-label="QR-код для подключения второго телефона"
                    >
                      <rect width={pairQrResult.size + 4} height={pairQrResult.size + 4} fill="#ffffff" />
                      <g transform="translate(2, 2)">
                        <path d={buildQrSvgPath(pairQrResult.matrix)} fill="#1c1917" />
                      </g>
                    </svg>
                    <span className="text-[11px] text-stone-500 text-center">
                      Отсканируйте камерой телефона супруга — откроется приложение с готовой настройкой
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Инструкция настройки Google Таблицы */}
            <div className="border border-stone-200/80 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                className="w-full px-3.5 py-2.5 bg-stone-50 hover:bg-stone-100 text-left text-xs font-semibold text-stone-800 flex items-center justify-between transition"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Как подключить личную Google Таблицу (3 шага, без OAuth)</span>
                </span>
                <span className="text-stone-400">{showSetupGuide ? '▲' : '▼'}</span>
              </button>
              {showSetupGuide && (
                <div className="p-3.5 bg-white text-xs text-stone-600 space-y-2.5 border-t border-stone-100 leading-relaxed">
                  <p><b>Шаг 1.</b> Создайте новую Google Таблицу на Google Диске и откройте меню <b>Расширения → Apps Script</b>.</p>
                  <div>
                    <p className="mb-1.5"><b>Шаг 2.</b> Удалите стандартный текст и вставьте наш скрипт (ваш секретный ключ уже вшит внутрь):</p>
                    <button
                      type="button"
                      onClick={handleCopyGasScript}
                      className="h-8 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Скопировать код Code.gs</span>
                    </button>
                  </div>
                  <p>
                    <b>Шаг 3.</b> Нажмите <b>Начать развертывание → Новое развертывание → Веб-приложение</b>.
                    В поле <i>«У кого есть доступ»</i> обязательно выберите <b>Все (Anyone)</b>, сохраните, выдайте доступ таблице и вставьте полученный URL выше.
                  </p>
                </div>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Секция 1: Отправить изменения */}
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-stone-900">1. Передать свои изменения супругу</span>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-stone-200 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDeltaScope('since')}
                    className={`px-2 py-1 rounded-md font-semibold transition ${
                      deltaScope === 'since' ? 'bg-stone-900 text-white' : 'text-stone-600'
                    }`}
                  >
                    Новые
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeltaScope('full')}
                    className={`px-2 py-1 rounded-md font-semibold transition ${
                      deltaScope === 'full' ? 'bg-stone-900 text-white' : 'text-stone-600'
                    }`}
                  >
                    Все
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBuildAndShareDelta(true)}
                  className="flex-1 h-9 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Отправить / Скопировать</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!outgoingToken) await handleBuildAndShareDelta(false);
                    setShowDeltaQr(prev => !prev);
                  }}
                  className="h-9 px-3 bg-white border border-stone-200 hover:bg-stone-100 text-stone-800 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>QR</span>
                </button>
              </div>

              {outgoingSummary && (
                <div className="text-[11px] text-stone-600 bg-white p-2.5 rounded-lg border border-stone-200/70 tabular-nums">
                  Сформирован пакет ({outgoingSummary.bytes} байт): операций — <b>{outgoingSummary.txs}</b>, целей/счетов — <b>{outgoingSummary.others}</b>, удалений — <b>{outgoingSummary.tombstones}</b>.
                </div>
              )}

              {showDeltaQr && outgoingToken && (
                deltaQrResult?.ok ? (
                  <div className="p-3 bg-white rounded-xl border border-stone-200 flex flex-col items-center gap-2 animate-fade-in">
                    <svg
                      viewBox={`0 0 ${deltaQrResult.size + 4} ${deltaQrResult.size + 4}`}
                      className="w-48 h-48 bg-white"
                      shapeRendering="crispEdges"
                      aria-label="QR-код с дельтой синхронизации"
                    >
                      <rect width={deltaQrResult.size + 4} height={deltaQrResult.size + 4} fill="#ffffff" />
                      <g transform="translate(2, 2)">
                        <path d={buildQrSvgPath(deltaQrResult.matrix)} fill="#1c1917" />
                      </g>
                    </svg>
                    <span className="text-[11px] text-stone-500">Отсканируйте камерой второго смартфона</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                    Пакет слишком большой для QR-кода ({deltaQrResult?.byteLength || ''} байт, лимит 858 байт). Отправьте скопированной ссылкой в Telegram.
                  </div>
                )
              )}
            </div>

            {/* Секция 2: Принять от супруга */}
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2.5">
              <label className="text-xs font-bold text-stone-900 block">
                2. Принять изменения от супруга
              </label>
              <textarea
                rows={3}
                placeholder="Вставьте ссылку (?sync=...) или код (fbz1:...) из мессенджера..."
                value={incomingInput}
                onChange={(e) => setIncomingInput(e.target.value)}
                className="w-full text-xs font-mono p-2.5 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
              {incomingError && (
                <div className="text-[11px] text-rose-700 font-medium">{incomingError}</div>
              )}
              {incomingPreview && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1 tabular-nums">
                  <div className="font-bold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Пакет готов к объединению:</span>
                  </div>
                  <div className="text-[11px]">
                    Операций: <b>{incomingPreview.txsCount}</b> • Целей/счетов/долгов: <b>{incomingPreview.otherCount}</b> • Удалений: <b>{incomingPreview.delCount}</b>
                  </div>
                </div>
              )}
              <button
                type="button"
                disabled={!incomingPreview}
                onClick={handleApplyIncoming}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Применить и объединить с базой</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
