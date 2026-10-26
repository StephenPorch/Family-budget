import React, { useRef } from 'react';
import { FileSpreadsheet, Download, Copy, Upload, Trash2, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

export const ExportBackupModal = React.memo(function ExportBackupModal({
  isOpen,
  onClose,
  importMode,
  setImportMode,
  onDownloadXlsx,
  onDownloadCsv,
  onCopyAiReport,
  onDownloadJson,
  onImportFile,
  onClearAllData,
  onRestoreDemoData,
}) {
  const modalRef = useRef(null);
  const fileInputRef = useRef(null);
  useFocusTrap(isOpen, modalRef);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto space-y-5"
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            <span id="export-modal-title" className="font-semibold text-stone-900 text-sm">
              Экспорт в XLSX / CSV, анализ для ИИ и резервная копия
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="text-stone-500 hover:text-stone-800 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Выгрузка в таблицы и для нейронки */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            1. Выгрузка для личного анализа, Excel и нейросетей
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onDownloadXlsx}
              className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-left transition flex items-start gap-3"
            >
              <Download className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-stone-900">Скачать Excel (.xlsx)</div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  5 листов: Сводка, Операции, План/Прогноз, Постоянные счета, Долги и Копилки
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={onDownloadCsv}
              className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-left transition flex items-start gap-3"
            >
              <FileSpreadsheet className="w-5 h-5 text-stone-800 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-stone-900">Универсальный CSV (.csv)</div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  Понятная таблица для Excel и ИИ + 100% полный бэкап для обратной загрузки
                </div>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onCopyAiReport}
              className="p-3.5 rounded-2xl border border-violet-200 bg-violet-50/70 hover:bg-violet-100/80 text-left transition flex items-start gap-3"
            >
              <Copy className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-stone-900">Скопировать отчёт для ИИ</div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  Готовый промпт + сводка и таблица операций для вставки в чат нейросети
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={onDownloadJson}
              className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-left transition flex items-start gap-3"
            >
              <Download className="w-5 h-5 text-stone-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-stone-900">Технический бэкап (.json)</div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  Слепок всех коллекций LocalStorage для переноса между устройствами
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* 2. Восстановление из файла с выбором режима Merge / Replace */}
        <div className="space-y-2.5 pt-2 border-t border-stone-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            2. Импорт банковской выписки или бэкапа (.csv / .json)
          </h3>

          <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-2xl text-xs">
            <button
              type="button"
              onClick={() => setImportMode('merge')}
              className={`py-2 px-2 rounded-xl font-semibold transition ${
                importMode === 'merge' ? 'bg-white text-emerald-800 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              ➕ Дополнить базу (Merge)
            </button>
            <button
              type="button"
              onClick={() => setImportMode('replace')}
              className={`py-2 px-2 rounded-xl font-semibold transition ${
                importMode === 'replace' ? 'bg-white text-rose-700 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              🔄 Заменить всю базу
            </button>
          </div>
          <p className="text-[11px] text-stone-600">
            {importMode === 'merge'
              ? 'Безопасный режим: новые записи из CSV/выписки (поддерживаются даты DD.MM.YYYY и YYYY-MM-DD) добавятся к вашим операциям без удаления текущих данных.'
              : 'Режим полной перезаписи: текущие данные будут заменены данными из загружаемого файла бэкапа.'}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={onImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-stone-300 hover:border-stone-900 bg-stone-50 hover:bg-stone-100 text-xs font-semibold text-stone-800 transition flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>
              {importMode === 'merge'
                ? 'Выбрать файл (.csv / .json) для добавления к текущей базе'
                : 'Выбрать файл бэкапа (.csv / .json) для полной замены'}
            </span>
          </button>
        </div>

        {/* 3. Управление демо-данными */}
        <div className="space-y-2 pt-2 border-t border-stone-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            3. Старт с чистого листа / Демо-режим
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onClearAllData}
              className="flex-1 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистить демо-данные (с нуля)</span>
            </button>
            <button
              type="button"
              onClick={onRestoreDemoData}
              className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition"
            >
              Вернуть демо-пример
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
