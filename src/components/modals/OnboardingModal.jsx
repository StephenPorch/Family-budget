import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Users, Wallet, Calendar, ShieldCheck } from 'lucide-react';
import { QUICK_USER_AVATARS } from '../../utils/storage.js';
import { getLocalDateString } from '../../utils/dateUtils.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useBackdropDismiss } from '../../hooks/useBackdropDismiss.js';

export const OnboardingModal = React.memo(function OnboardingModal({
  isOpen,
  onClose,
  userProfiles,
  deviceOwner,
  safeLimitConfig,
  onComplete,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  const backdropDismiss = useBackdropDismiss(onClose);

  const [step, setStep] = useState(1);
  const [p1Name, setP1Name] = useState(userProfiles?.husband?.name || 'Партнер 1');
  const [p1Emoji, setP1Emoji] = useState(userProfiles?.husband?.emoji || '🧔🏻‍♂️');
  const [p2Name, setP2Name] = useState(userProfiles?.wife?.name || 'Партнер 2');
  const [p2Emoji, setP2Emoji] = useState(userProfiles?.wife?.emoji || '👩🏼');
  const [owner, setOwner] = useState(deviceOwner || 'husband');

  const [myStartBalance, setMyStartBalance] = useState('');
  const [partnerStartBalance, setPartnerStartBalance] = useState('');
  const [sharedStartBalance, setSharedStartBalance] = useState('');
  const [startDate, setStartDate] = useState(getLocalDateString);
  const [payday1, setPayday1] = useState(String(safeLimitConfig?.paydays?.[0] ?? 10));
  const [payday2, setPayday2] = useState(String(safeLimitConfig?.paydays?.[1] ?? 25));

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setP1Name(userProfiles?.husband?.name && userProfiles.husband.name !== 'Партнер 1' ? userProfiles.husband.name : '');
    setP1Emoji(userProfiles?.husband?.emoji || '🧔🏻‍♂️');
    setP2Name(userProfiles?.wife?.name && userProfiles.wife.name !== 'Партнер 2' ? userProfiles.wife.name : '');
    setP2Emoji(userProfiles?.wife?.emoji || '👩🏼');
    setOwner(deviceOwner || 'husband');
    setMyStartBalance('');
    setPartnerStartBalance('');
    setSharedStartBalance('');
    setStartDate(getLocalDateString());
    setPayday1(String(safeLimitConfig?.paydays?.[0] ?? 10));
    setPayday2(String(safeLimitConfig?.paydays?.[1] ?? 25));
  }, [isOpen, userProfiles, deviceOwner, safeLimitConfig]);

  if (!isOpen) return null;

  const cleanP1 = p1Name.trim() || 'Партнер 1';
  const cleanP2 = p2Name.trim() || 'Партнер 2';
  const myLabel = owner === 'wife' ? `${p2Emoji} ${cleanP2}` : `${p1Emoji} ${cleanP1}`;
  const partnerLabel = owner === 'wife' ? `${p1Emoji} ${cleanP1}` : `${p2Emoji} ${cleanP2}`;

  const handleFinish = (e) => {
    e.preventDefault();
    const myVal = parseFloat(myStartBalance) || 0;
    const partnerVal = parseFloat(partnerStartBalance) || 0;
    const sharedVal = parseFloat(sharedStartBalance) || 0;

    const paydays = [];
    const d1 = Number(payday1);
    const d2 = Number(payday2);
    if (d1 >= 1 && d1 <= 31) paydays.push(d1);
    if (d2 >= 1 && d2 <= 31 && d2 !== d1) paydays.push(d2);
    if (paydays.length === 0) paydays.push(10, 25);

    onComplete({
      userProfiles: {
        husband: { id: 'husband', name: cleanP1, emoji: p1Emoji, color: 'blue' },
        wife: { id: 'wife', name: cleanP2, emoji: p2Emoji, color: 'rose' },
      },
      deviceOwner: owner,
      paydays: paydays.sort((a, b) => a - b),
      startDate: startDate || getLocalDateString(),
      balances: {
        husband: owner === 'husband' ? myVal : partnerVal,
        wife: owner === 'wife' ? myVal : partnerVal,
        shared: sharedVal,
      },
    });
  };

  return (
    <div
      {...backdropDismiss}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[94vh] overflow-y-auto"
      >
        <div className="w-10 h-1 rounded-full bg-stone-300 mx-auto mb-3 sm:hidden shrink-0" />

        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </span>
            <div>
              <span id="onboarding-modal-title" className="font-semibold text-stone-900 text-sm block">
                Настройка семейного бюджета
              </span>
              <span className="text-[11px] text-stone-500">
                Шаг {step} из 2 • {step === 1 ? 'Участники и телефон' : 'Начальные остатки и дни ЗП'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть мастер настройки"
            className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Индикатор шага */}
        <div className="grid grid-cols-2 gap-1.5 pt-3">
          <div className={`h-1.5 rounded-full transition ${step >= 1 ? 'bg-stone-900' : 'bg-stone-200'}`} />
          <div className={`h-1.5 rounded-full transition ${step >= 2 ? 'bg-stone-900' : 'bg-stone-200'}`} />
        </div>

        {step === 1 ? (
          <div className="pt-4 space-y-4">
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900">Партнер 1</span>
                <span className="text-lg">{p1Emoji}</span>
              </div>
              <input
                type="text"
                placeholder="Имя (например: Алексей)"
                autoFocus
                value={p1Name}
                onChange={(e) => setP1Name(e.target.value)}
                className="w-full h-9 text-xs font-semibold px-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_USER_AVATARS.slice(0, 8).map(av => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setP1Emoji(av)}
                    className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center border transition ${
                      p1Emoji === av ? 'border-stone-900 bg-stone-200 font-bold' : 'border-stone-200 bg-white hover:bg-stone-100'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900">Партнер 2</span>
                <span className="text-lg">{p2Emoji}</span>
              </div>
              <input
                type="text"
                placeholder="Имя (например: Мария)"
                value={p2Name}
                onChange={(e) => setP2Name(e.target.value)}
                className="w-full h-9 text-xs font-semibold px-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_USER_AVATARS.slice(8).map(av => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setP2Emoji(av)}
                    className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center border transition ${
                      p2Emoji === av ? 'border-stone-900 bg-stone-200 font-bold' : 'border-stone-200 bg-white hover:bg-stone-100'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/70 space-y-2">
              <span className="text-xs font-bold text-amber-950 block">Чей это телефон?</span>
              <p className="text-[11px] text-amber-900/80 leading-relaxed">
                Личный кошелек владельца этого устройства будет открываться первым на главном экране.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOwner('husband')}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 border ${
                    owner === 'husband'
                      ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                      : 'bg-white text-stone-700 border-amber-200/80'
                  }`}
                >
                  <span>{p1Emoji}</span>
                  <span className="truncate">{cleanP1}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOwner('wife')}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 border ${
                    owner === 'wife'
                      ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                      : 'bg-white text-stone-700 border-amber-200/80'
                  }`}
                >
                  <span>{p2Emoji}</span>
                  <span className="truncate">{cleanP2}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full h-11 bg-stone-900 text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition flex items-center justify-center"
            >
              Далее: остатки счетов и дни ЗП →
            </button>
          </div>
        ) : (
          <form onSubmit={handleFinish} className="pt-4 space-y-4">
            <div className="p-3.5 bg-sky-50/70 rounded-xl border border-sky-200/80 space-y-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-stone-900 block">Сколько денег на картах сейчас?</span>
                  <span className="text-[11px] text-stone-600 leading-snug block mt-0.5">
                    Начальные остатки зададут точный баланс счетов, но не раздуют доходы месяца и графики. Оставьте пустым, если пока 0 ₽.
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                    Мой счет ({myLabel})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={myStartBalance}
                      onChange={(e) => setMyStartBalance(e.target.value)}
                      className="w-full h-9 text-xs font-bold pl-3 pr-8 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">₽</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                    Счет партнера ({partnerLabel})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={partnerStartBalance}
                      onChange={(e) => setPartnerStartBalance(e.target.value)}
                      className="w-full h-9 text-xs font-bold pl-3 pr-8 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">₽</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-700 flex items-center gap-1 mb-1">
                    <Users className="w-3.5 h-3.5 text-stone-500" />
                    <span>Семейный резерв (общий котел)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={sharedStartBalance}
                      onChange={(e) => setSharedStartBalance(e.target.value)}
                      className="w-full h-9 text-xs font-bold pl-3 pr-8 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">₽</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-700 flex items-center gap-1 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Дата точки отсчета</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-9 text-xs font-semibold px-3 bg-white border border-stone-200 rounded-lg focus:outline-none text-stone-900 tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2.5">
              <span className="text-xs font-bold text-stone-900 block">Дни зарплаты и аванса (для безопасного лимита)</span>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-stone-600 block mb-1">1-я выплата (число)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={payday1}
                    onChange={(e) => setPayday1(e.target.value)}
                    className="w-full h-9 text-xs font-semibold px-3 bg-white border border-stone-200 rounded-lg focus:outline-none text-stone-900 tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-stone-600 block mb-1">2-я выплата (число)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={payday2}
                    onChange={(e) => setPayday2(e.target.value)}
                    placeholder="Необязательно"
                    className="w-full h-9 text-xs font-semibold px-3 bg-white border border-stone-200 rounded-lg focus:outline-none text-stone-900 tabular-nums"
                  />
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: '10 и 25', d1: '10', d2: '25' },
                  { label: '5 и 20', d1: '5', d2: '20' },
                  { label: '1 и 15', d1: '1', d2: '15' },
                  { label: 'Только 10-е', d1: '10', d2: '' },
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setPayday1(p.d1); setPayday2(p.d2); }}
                    className="px-2 py-1 rounded-md text-[11px] font-medium bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-11 px-4 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-xl font-semibold text-xs transition shrink-0"
              >
                ← Назад
              </button>
              <button
                type="submit"
                className="flex-1 h-11 bg-stone-900 text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Начать учет</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
});
