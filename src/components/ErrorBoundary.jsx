import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = async () => {
    try {
      localStorage.clear();
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) {
          await caches.delete(k);
        }
      }
    } catch (e) {
      console.error('Reset error:', e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 text-stone-900 font-sans">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-stone-200/80 shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-2xl">
              ⚠️
            </div>
            <div>
              <h1 className="text-base font-bold text-stone-900">Ошибка загрузки приложения</h1>
              <p className="text-xs text-stone-500 mt-1">
                Данные из старого кэша или памяти устройства вызвали сбой при отображении.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 bg-stone-100 rounded-xl text-left font-mono text-[11px] text-rose-700 overflow-x-auto max-h-32">
                {String(this.state.error?.message || this.state.error)}
              </div>
            )}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full h-10 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition shadow-sm flex items-center justify-center gap-1.5"
              >
                🔄 Очистить кэш и восстановить приложение
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full h-10 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
