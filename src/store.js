// Общее состояние прототипа. Хранится в localStorage и синхронизируется между вкладками
// одного браузера через BroadcastChannel: планшет, настенный дисплей и админка видят одно и то же.
import { useSyncExternalStore } from 'react';
import { DEMO_DATE, PEOPLE, POINTS, SYSTEM_SETTINGS, ADMIN_USERS, OPERATORS, RESULT_MS, mealLabel } from './data.js';
import { uuid, at, hhmm, seedLocal, seedCenter, sortJournal, acceptBatch, currentMainMeal, checkEligibility, effectiveSettings, validateSettings, settingsSummaryError } from './logic.js';

const KEY = 'asup-prototype-v1';
const RECOGNIZE_MS = 900;
const DELIVERY_MS = 1500;

export function initialState() {
  return {
    time: '13:10',
    link: 'lan', // lan | sim | off
    lastSync: '13:05',
    syncNote: '', // текст после успешной отправки
    recovering: false, // отправка записей, накопленных без связи
    sentBanner: 0,
    operator: null,
    station: 'Т1',
    extra: '',
    term: { 'Т1': null, 'Т2': null },
    manual: null,
    report: false,
    local: seedLocal(),
    center: seedCenter(),
    centerEmpty: false,
    receiving: [],
    highlight: [],
    people: structuredClone(PEOPLE),
    settings: { system: structuredClone(SYSTEM_SETTINGS), overrides: {}, version: 12, savedNote: null },
    points: structuredClone(POINTS),
    monitorUpdated: '13:10',
    admin: null,
    returnTo: null,
    faults: { load: false, save: false, session: false, stale: false, centerDown: false },
    hold: false, // для презентации: результат не сбрасывается через 8 секунд
    journalFilter: 'all',
    log: ['Начните: войдите как оператор и выберите сотрудника в демо-пульте.'],
  };
}

let state = load();
const listeners = new Set();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(KEY) : null;
const timers = {};

function load() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return { ...initialState(), ...JSON.parse(raw) };
  } catch { /* повреждённые данные — начинаем заново */ }
  return initialState();
}

function emit() { listeners.forEach((l) => l()); }

export function set(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(state)); } catch { /* квота */ }
  channel?.postMessage(state);
  emit();
}

if (channel) { channel.onmessage = (e) => { state = e.data; emit(); }; channel.unref?.(); } // unref: не держать процесс в тестах

export const getState = () => state;
export function useStore(selector = (s) => s) {
  return selector(useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state));
}

function later(key, ms, fn) { clearTimeout(timers[key]); timers[key] = setTimeout(fn, ms); }
function stopAll() { Object.values(timers).forEach(clearTimeout); }
function say(msg) { set((s) => ({ log: [msg, ...s.log].slice(0, 30) })); }
const nowSec = () => String(new Date().getSeconds()).padStart(2, '0');
export const person = (s, id) => s.people.find((p) => p.id === id);
const knownRecords = (s) => {
  const ids = new Set(s.local.map((r) => r.eventId));
  return [...s.local, ...s.center.filter((r) => !ids.has(r.eventId))];
};

export function resetAll() { stopAll(); state = initialState(); set({}); }

// ---------- Точка: настройки, связь, доставка ----------
export const pointSettings = (s, terminal = 'Т1') => effectiveSettings(s.settings, `term:1:${terminal}`).values;
export const mainMealNow = (s) => currentMainMeal(s.time, pointSettings(s, 'Т1'));
export const pendingCount = (s) => s.local.filter((r) => r.syncStatus !== 'accepted').length;

export function setTime(time) {
  clearTimeout(timers['Т1']); clearTimeout(timers['Т2']);
  set({ time, term: { 'Т1': null, 'Т2': null }, extra: '' });
  say(`Время на точке: ${time}.`);
}

export function setLink(link) {
  if (link === 'off') {
    clearTimeout(timers.send);
    set((s) => ({ link, receiving: [], local: s.local.map((r) => (r.syncStatus === 'sending' ? { ...r, syncStatus: 'local' } : r)) }));
    say('Оба канала отключены: записи сохраняются на точке.');
  } else {
    set({ link });
    say(link === 'sim' ? 'LAN недоступен, работает резервный SIM.' : 'LAN доступен.');
    flush();
  }
}

// Отправить в центр всё, что ещё не принято
export function flush() {
  const s = getState();
  if (s.link === 'off') return;
  const batch = s.local.filter((r) => r.syncStatus !== 'accepted');
  if (!batch.length) return;
  const ids = batch.map((r) => r.eventId);
  const recovering = batch.some((r) => r.createdOffline);
  set((st) => ({ local: st.local.map((r) => (ids.includes(r.eventId) ? { ...r, syncStatus: 'sending' } : r)), receiving: ids, syncNote: '', recovering, sentBanner: 0 }));
  later('send', DELIVERY_MS, () => {
    const st = getState();
    if (st.link === 'off') return;
    const sending = st.local.filter((r) => r.syncStatus === 'sending');
    const res = acceptBatch(st.center, sending, at(`${st.time}:${nowSec()}`));
    set({
      center: res.center, centerEmpty: false,
      local: st.local.map((r) => (r.syncStatus === 'sending' ? { ...r, syncStatus: 'accepted' } : r)),
      receiving: [], highlight: res.accepted, lastSync: st.time,
      syncNote: `отправлено ${sending.length}`, recovering: false, sentBanner: st.recovering ? sending.length : 0,
    });
    if (st.recovering) later('sent', 7000, () => set({ sentBanner: 0 }));
    say(`Центр подтвердил приём: ${sending.length} ${plural(sending.length, 'запись', 'записи', 'записей')}.`);
    later('hl', 6000, () => set({ highlight: [] }));
  });
}

// Повторная доставка уже отправленных записей: центр не создаёт дублей по eventId
export function redeliver() {
  const s = getState();
  if (s.link === 'off') { say('Нет связи: повторная доставка невозможна.'); return; }
  const before = s.center.length;
  const res = acceptBatch(s.center, s.local.map((r) => ({ ...r, syncStatus: 'accepted' })), at(`${s.time}:${nowSec()}`));
  set({ center: res.center, local: s.local.map((r) => ({ ...r, syncStatus: 'accepted' })), lastSync: s.time });
  say(`Повторно отправлено ${s.local.length}. Новых в центре: ${res.center.length - before}, дублей отклонено: ${res.duplicates}.`);
}

export function syncNow() {
  const s = getState();
  if (s.link === 'off') { say('Синхронизация недоступна: нет связи.'); return; }
  if (pendingCount(s)) flush(); else { set({ lastSync: s.time, syncNote: '' }); say('Синхронизация выполнена, новых записей нет.'); }
}

function addRecord(rec) {
  const s = getState();
  const full = { eventId: uuid(), pointId: 1, occurredAt: at(`${s.time}:${nowSec()}`), syncStatus: 'local', operator: s.operator?.name, createdOffline: s.link === 'off', ...rec };
  set((st) => ({ local: [full, ...st.local] }));
  flush();
  return full;
}

// ---------- Терминалы ----------
export function selectStation(station) { set({ station }); }
export function pickExtra(id) {
  const s = getState();
  if (s.term['Т2']?.phase === 'pending') return;
  clearTimeout(timers['Т2']);
  set({ extra: s.extra === id ? '' : id, term: { ...s.term, 'Т2': null }, station: 'Т2' });
}

export function recognize(employeeId, station = getState().station) {
  const s = getState();
  if (!s.operator) { say('Сначала войдите в АРМ оператора.'); return; }
  if (s.manual) { say('Идёт ручная операция — терминалы ждут.'); return; }
  if (s.term[station]?.phase === 'pending') return;
  const meal = station === 'Т1' ? mainMealNow(s)?.id ?? null : s.extra;
  if (station === 'Т2' && !meal) { say('Сначала оператор выбирает позицию на Т2.'); return; }
  set((st) => ({ term: { ...st.term, [station]: { phase: 'pending', employeeId, meal } } }));
  later(station, RECOGNIZE_MS, () => {
    const st = getState();
    const p = employeeId ? person(st, employeeId) : null;
    let result;
    if (!p) {
      result = { ok: false, reason: 'Сотрудник не найден', detail: 'В локальной базе точки нет такого сотрудника. Выдача не зарегистрирована.' };
    } else {
      result = checkEligibility(p, meal, knownRecords(st), { dryReplacesLunch: pointSettings(st, 'Т2').dryReplacesLunch });
      addRecord({ terminal: station, employeeId, kind: 'meal', result: result.ok ? 'issued' : 'refused', meal, reason: result.reason, detail: result.detail, source: 'terminal' });
    }
    const offline = getState().link === 'off';
    set((x) => ({
      term: { ...x.term, [station]: { phase: 'done', employeeId: p ? employeeId : null, meal, ...result, offline, at: Date.now() } },
      extra: station === 'Т2' && result.ok ? '' : x.extra,
    }));
    say(p ? `${station}: ${p.short} — ${result.ok ? 'выдано: ' + mealLabel(meal).toLowerCase() : 'отказ: ' + result.reason.toLowerCase()}${offline ? ' (сохранено локально)' : ''}.` : `${station}: лицо не найдено в базе точки.`);
    autoClear(station);
  });
}

function autoClear(station) {
  later(station, RESULT_MS, () => { if (!getState().hold) set((y) => ({ term: { ...y.term, [station]: null } })); });
}
export function setHold(hold) {
  set({ hold });
  if (!hold) ['Т1', 'Т2'].forEach((st) => { if (getState().term[st]?.phase === 'done') autoClear(st); });
}
export function clearScreens() { clearTimeout(timers['Т1']); clearTimeout(timers['Т2']); set({ term: { 'Т1': null, 'Т2': null } }); }

// Событие терминала без выдачи (сценарий 1 приёмки): в центре появляется одна запись «Лицо распознано»
export function terminalEvent(employeeId) {
  const s = getState();
  const p = person(s, employeeId);
  addRecord({ terminal: s.station, employeeId, kind: 'terminal', result: 'recognized', meal: null, test: true, source: 'terminal' });
  set((st) => ({ term: { ...st.term, [st.station]: { phase: 'done', pass: true, employeeId, ok: true, reason: '', detail: 'Событие терминала передано в журнал. Выдача не оформлена.', at: Date.now() } } }));
  autoClear(s.station);
  say(`Тестовое событие терминала: ${p.short}. Выдача не создаётся.`);
}

export function clearTerminal(station) { clearTimeout(timers[station]); set((s) => ({ term: { ...s.term, [station]: null } })); }

// ---------- Оператор и ручная операция ----------
export function operatorLogin(login, password) {
  const op = OPERATORS.find((o) => o.login === login.trim());
  if (!op || password !== 'demo') return 'invalid';
  set({ operator: op });
  say(`Вход оператора: ${op.name}.`);
  return null;
}
export function operatorLogout() { stopAll(); set({ operator: null, manual: null, term: { 'Т1': null, 'Т2': null }, extra: '', report: false }); }

export function manualOpen() {
  const s = getState();
  set({ manual: s.operator?.manual ? { step: 1, employeeId: null, meal: mainMealNow(s)?.id ?? '', basis: '', comment: '', verified: false } : { step: 'denied' } });
}
export const manualPatch = (patch) => set((s) => ({ manual: { ...s.manual, ...patch } }));
export const manualClose = () => set({ manual: null });
export function manualConfirm() {
  const s = getState();
  const m = s.manual;
  const p = person(s, m.employeeId);
  const res = checkEligibility(p, m.meal, knownRecords(s), { dryReplacesLunch: pointSettings(s, 'Т2').dryReplacesLunch });
  if (!res.ok) { manualPatch({ step: 'limit', reason: res.reason, detail: res.detail }); say(`Ручная операция: отказ — ${res.reason.toLowerCase()}.`); return; }
  const basis = m.basis === 'other' ? `Другое: ${m.comment}` : BASIS[m.basis];
  const r = addRecord({ terminal: null, employeeId: p.id, kind: 'meal', result: 'issued', meal: m.meal, reason: '', source: 'manual', manualBasis: basis });
  manualPatch({ step: 'done', eventId: r.eventId, time: hhmm(r.occurredAt), offline: getState().link === 'off' });
  say(`Ручная выдача: ${p.short}, ${mealLabel(m.meal).toLowerCase()}.`);
}
export const BASIS = { face: 'Терминал не распознал лицо', down: 'Терминал не работает', other: 'Другое (нужен комментарий)' };

export const setReport = (report) => set({ report });

// ---------- Админка ----------
export function adminLogin(login, password) {
  const s = getState();
  if (s.faults.centerDown) return 'offline';
  const u = ADMIN_USERS.find((x) => x.login === login.trim());
  if (!u || password !== 'demo') return 'invalid';
  if (u.disabled) return 'disabled';
  set({ admin: { login: u.login, role: u.role, name: u.name }, faults: { ...s.faults, session: false } });
  return null;
}
export function adminLogout(returnTo = null) { set({ admin: null, returnTo }); }
export const setFault = (key, value) => set((s) => ({ faults: { ...s.faults, [key]: value } }));
export const setCenterEmpty = (v) => set({ centerEmpty: v });

export function createCorrection(source, { type, basis, newMeal }) {
  const s = getState();
  const rec = {
    eventId: uuid(), pointId: source.pointId, terminal: null, employeeId: source.employeeId, occurredAt: at(`${s.time}:${nowSec()}`),
    kind: 'correction', result: 'created', meal: newMeal ?? source.meal, source: 'admin', sourceEventId: source.eventId,
    author: s.admin?.name ?? 'Демо-администратор', basis, correctionType: type, syncStatus: 'accepted', receivedAt: at(`${s.time}:${nowSec()}`),
  };
  // Исходная запись не изменяется; отметка нужна только для расчёта лимита и разбора конфликта
  const center = s.center.map((r) => (r.eventId === source.eventId ? { ...r, cancelled: type === 'cancel' || r.cancelled, resolved: true, correctedBy: [...(r.correctedBy || []), rec.eventId] } : r.conflict && r.conflict === source.conflict ? { ...r, resolved: true } : r));
  set({ center: sortJournal([rec, ...center]), highlight: [rec.eventId] });
  later('hl', 6000, () => set({ highlight: [] }));
  return rec;
}

export function injectConflict() {
  const s = getState();
  const mk = (pointId, time) => ({ eventId: uuid(), pointId, terminal: 'Т1', employeeId: 'P10003', occurredAt: at(time), kind: 'meal', result: 'issued', meal: 'lunch', reason: '', source: 'terminal', syncStatus: 'accepted', offline: true });
  const res = acceptBatch(s.center.filter((r) => !(r.employeeId === 'P10003' && r.meal === 'lunch')), [mk(2, '12:20:11'), mk(3, '12:47:32')], at(`${s.time}:00`));
  set({ center: res.center, highlight: res.accepted });
}

// Сотрудники
export function saveEmployee(id, form) {
  const s = getState();
  if (s.faults.save) return { error: 'save' };
  const errors = {};
  if (form.card && s.people.some((p) => p.id !== id && p.card === form.card.trim() && p.status === 'active')) errors.card = 'Эта активная карта уже привязана к другому сотруднику';
  if (!form.department.trim()) errors.department = 'Укажите подразделение';
  if (Object.keys(errors).length) return { errors };
  set({ people: s.people.map((p) => (p.id === id ? { ...p, ...form, card: form.card.trim() } : p)) });
  return { ok: true };
}
export const patchEmployee = (id, patch) => set((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)) }));

function rollout(id, finalStatus) {
  // Имитация распространения по терминалам: по очереди применяется, терминал №3 не отвечает
  const step = (i) => later(`photo-${id}-${i}`, 900 + i * 700, () => patchEmployee(id, (p) => ({
    distribution: p.distribution.map((d, j) => (j === i ? { ...d, status: d.pointId === 3 ? 'error' : finalStatus, version: finalStatus === 'applied' ? p.photoVersion : d.version } : d)),
  })));
  getState().people.find((p) => p.id === id).distribution.forEach((_, i) => step(i));
}
export function replacePhoto(id, dataUrl) {
  patchEmployee(id, (p) => ({
    photo: dataUrl || p.photo, photoVersion: p.photoVersion + 1,
    distribution: (p.distribution.length ? p.distribution : [{ pointId: 1, terminal: 'Т1' }, { pointId: 1, terminal: 'Т2' }, { pointId: 2, terminal: 'Т1' }, { pointId: 3, terminal: 'Т1' }]).map((d) => ({ ...d, status: 'pending', version: d.version ?? 0 })),
  }));
  rollout(id, 'applied');
}
export function deletePhoto(id) {
  patchEmployee(id, (p) => ({ photo: null, deletedPhoto: p.photo, distribution: p.distribution.map((d) => ({ ...d, status: 'revoking' })) }));
  rollout(id, 'revoked');
}
export function retryDistribution(id, idx) {
  patchEmployee(id, (p) => ({ distribution: p.distribution.map((d, j) => (j === idx ? { ...d, status: p.photo ? 'pending' : 'revoking' } : d)) }));
  later(`retry-${id}-${idx}`, 1400, () => patchEmployee(id, (p) => ({ distribution: p.distribution.map((d, j) => (j === idx ? { ...d, status: p.photo ? 'applied' : 'revoked', version: p.photo ? p.photoVersion : d.version } : d)) })));
}

// Настройки
export function saveSettings(levelId, values) {
  const s = getState();
  const errors = validateSettings(values);
  if (Object.keys(errors).length) return { errors, summary: settingsSummaryError(errors) };
  if (s.faults.save) return { error: 'save' };
  if (levelId === 'system') {
    const version = s.settings.version + 1;
    const offline = s.points.filter((p) => p.pc === 'offline').length + (s.link === 'off' ? 1 : 0);
    set({
      settings: { ...s.settings, system: values, version, savedNote: { version, got: 32 - offline, offline } },
      points: s.points.map((p) => (p.pc === 'offline' || (p.id === 1 && s.link === 'off') ? p : { ...p, dict: version })),
    });
    return { ok: true };
  }
  // Нижний уровень хранит только отличия от верхнего
  const parent = effectiveSettings(s.settings, levelChainParent(levelId)).values;
  const diff = {};
  for (const k of Object.keys(values)) if (JSON.stringify(values[k]) !== JSON.stringify(parent[k])) diff[k] = values[k];
  set({ settings: { ...s.settings, overrides: { ...s.settings.overrides, [levelId]: diff }, savedNote: { level: levelId } } });
  return { ok: true };
}
function levelChainParent(levelId) {
  if (levelId.startsWith('term:')) return 'point:1';
  if (levelId.startsWith('point:')) return 'field:Прорва';
  return 'system';
}
export const resetLevel = (levelId) => set((s) => { const o = { ...s.settings.overrides }; delete o[levelId]; return { settings: { ...s.settings, overrides: o, savedNote: null } }; });
export const clearSavedNote = () => set((s) => ({ settings: { ...s.settings, savedNote: null } }));

// Мониторинг: точка №1 отражает реальное состояние планшета
export function livePoints(s) {
  return s.points.map((p) => {
    if (p.id !== 1) return p;
    const queue = pendingCount(s);
    if (s.link === 'off') return { ...p, pc: 'offline', channel: null, contact: s.lastSync, queue, terminals: { 'Т1': 'unknown', 'Т2': 'unknown' } };
    return { ...p, channel: s.link === 'sim' ? 'SIM' : 'LAN', contact: s.time, queue };
  });
}
export const refreshMonitor = () => set((s) => ({ monitorUpdated: s.time }));

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
export { DEMO_DATE };
