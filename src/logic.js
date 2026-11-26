// Чистая логика прототипа: без React и без браузера, проверяется тестами (tests/logic.test.mjs)
import { DEMO_DATE, MAIN_MEALS, EXTRAS, PEOPLE, SETTINGS_LEVELS, SYSTEM_SETTINGS, mealLabel, pointName } from './data.js';

export function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
export const seedId = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const shortId = (id) => (id ? `${id.slice(0, 8)}…${id.slice(-4)}` : '—');

export const at = (time, day = DEMO_DATE) => `${day}T${time.length === 5 ? time + ':00' : time}`;
export const timeOf = (iso) => iso.slice(11, 19);
export const hhmm = (iso) => iso.slice(11, 16);
export const dayOf = (iso) => iso.slice(0, 10);

// ---------- Сиды журнала ----------
const rec = (n, employeeId, pointId, terminal, time, meal, extra = {}) => ({
  eventId: typeof n === 'string' ? n : seedId(n),
  pointId, terminal, employeeId, occurredAt: at(time, extra.day), kind: 'meal', result: 'issued', meal,
  reason: '', source: 'terminal', syncStatus: 'accepted', ...extra,
});

export function seedLocal() {
  // Локальный журнал столовой №1 за сегодня
  return [
    rec(5, 'P10002', 1, 'Т1', '12:31:56', 'lunch', { result: 'refused', reason: 'Лимит питания уже использован', detail: 'Обед уже получен сегодня в столовой №1 в 12:18.' }),
    rec(2, 'P10005', 1, 'Т2', '12:27:10', 'water'),
    rec(3, 'P10002', 1, 'Т1', '12:18:04', 'lunch'),
    rec(1, 'P10001', 1, 'Т1', '06:40:12', 'breakfast'),
  ];
}

export function seedCenter() {
  const today = [
    { ...rec(8, 'P10003', 2, 'Т1', '13:02:04', null), kind: 'terminal', result: 'recognized', test: true },
    { ...rec(7, 'P10005', 1, null, '13:01:20', null), kind: 'correction', result: 'created', source: 'admin', sourceEventId: seedId(2), author: 'Демо-администратор', basis: 'Тестовая проверка связи с исходной записью', correctionType: 'note' },
    ...seedLocal(),
    rec(4, 'P10004', 2, 'Т1', '12:25:41', 'lunch'),
    rec(6, 'P10006', 3, 'Т1', '06:45:00', 'breakfast'),
  ];
  const history = [];
  let n = 100;
  PEOPLE.slice(0, 6).forEach((p, i) => {
    history.push(rec(n++, p.id, 1 + (i % 3), 'Т1', `18:${30 + i}:00`, 'dinner', { day: '2026-10-12' }));
    history.push(rec(n++, p.id, 1 + (i % 3), 'Т1', `07:${10 + i}:00`, 'breakfast', { day: '2026-10-12' }));
    if (i < 4) history.push(rec(n++, p.id, 1 + (i % 3), 'Т1', `12:${20 + i}:00`, 'lunch', { day: '2026-10-12' }));
  });
  return sortJournal([...today, ...history]);
}

export const sortJournal = (list) => [...list].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

// ---------- Окна питания и права ----------
export const currentMainMeal = (time, windows) =>
  MAIN_MEALS.map((m) => ({ ...m, ...windows[m.id] })).find((m) => time >= m.start && time < m.end) ?? null;

const SHARED = ['lunch', 'dry'];
export function checkEligibility(person, meal, records, { dryReplacesLunch = true, day = DEMO_DATE } = {}) {
  if (!person) return { ok: false, reason: 'Сотрудник не найден', detail: 'В локальной базе точки нет такого сотрудника. Выдача не зарегистрирована.' };
  if (person.status === 'blocked') return { ok: false, reason: 'Доступ заблокирован', detail: 'Сотрудник заблокирован в центре. Обратитесь к администратору.' };
  if (!meal) return { ok: false, reason: 'Вне времени основного приёма', detail: 'Сейчас нет активного окна. Дополнительное питание оформляется на Т2.' };
  if (!person.allowed.includes(meal)) return { ok: false, reason: 'Рацион недоступен', detail: 'Этот вид питания не входит в допуски сотрудника.' };
  const prev = records.find((r) => r.kind === 'meal' && r.result === 'issued' && !r.cancelled && dayOf(r.occurredAt) === day && r.employeeId === person.id
    && (r.meal === meal || (dryReplacesLunch && SHARED.includes(r.meal) && SHARED.includes(meal))));
  if (prev) {
    const where = `в столовой №${prev.pointId} в ${hhmm(prev.occurredAt)}`;
    return { ok: false, reason: 'Лимит питания уже использован', detail: prev.meal === meal ? `${mealLabel(meal)} уже получен сегодня ${where}.` : `${mealLabel(prev.meal)} уже учтён сегодня ${where}. Сухой паёк и обед используют общий лимит.` };
  }
  return { ok: true, reason: '', detail: 'Выдача записана в журнал.' };
}

// ---------- Доставка в центр ----------
// Центр принимает пакет. Запись с уже известным eventId не создаёт дубль (T-007, T-033).
export function acceptBatch(center, batch, receivedAt) {
  const known = new Set(center.map((r) => r.eventId));
  const fresh = [];
  let duplicates = 0;
  for (const r of batch) {
    if (known.has(r.eventId)) { duplicates += 1; continue; }
    known.add(r.eventId);
    fresh.push({ ...r, syncStatus: 'accepted', receivedAt });
  }
  let next = [...fresh, ...center];
  next = markConflicts(next);
  return { center: sortJournal(next), accepted: fresh.map((r) => r.eventId), duplicates };
}

// Политика повторных выдач (T-008): две выдачи одному сотруднику одного вида в один день на разных точках
export function markConflicts(list) {
  const issued = list.filter((r) => r.kind === 'meal' && r.result === 'issued' && !r.cancelled);
  const groups = {};
  for (const r of issued) {
    const key = `${r.employeeId}|${dayOf(r.occurredAt)}|${SHARED.includes(r.meal) ? 'lunch' : r.meal}`;
    (groups[key] ||= []).push(r);
  }
  const byId = {};
  Object.entries(groups).forEach(([key, rows]) => {
    if (rows.length > 1 && new Set(rows.map((r) => r.pointId)).size > 1) rows.forEach((r) => { byId[r.eventId] = key; });
  });
  return list.map((r) => (byId[r.eventId] && !r.resolved && !r.conflict ? { ...r, conflict: byId[r.eventId] } : r));
}

export const conflictGroups = (list) => {
  const g = {};
  list.filter((r) => r.conflict && !r.resolved).forEach((r) => (g[r.conflict] ||= []).push(r));
  return Object.values(g).map((rows) => sortJournal(rows).reverse());
};

// ---------- Настройки с наследованием ----------
const KEYS = ['breakfast', 'lunch', 'dinner', 'extras', 'dryReplacesLunch', 'syncInterval', 'tz'];
export const levelChain = (levelId) => {
  const chain = [];
  let l = SETTINGS_LEVELS.find((x) => x.id === levelId);
  while (l) { chain.unshift(l); l = SETTINGS_LEVELS.find((x) => x.id === l.parent); }
  return chain;
};
export function effectiveSettings(settings, levelId) {
  const values = {};
  const source = {};
  for (const level of levelChain(levelId)) {
    const layer = level.id === 'system' ? settings.system : settings.overrides[level.id] || {};
    for (const k of KEYS) {
      if (layer[k] !== undefined) { values[k] = structuredClone(layer[k]); source[k] = level.id; }
    }
  }
  return { values, source };
}

export function validateSettings(v) {
  const errors = {};
  const wins = MAIN_MEALS.map((m) => ({ ...m, ...v[m.id] }));
  for (const w of wins) if (!(w.start < w.end)) errors[w.id] = 'Окончание должно быть позже начала';
  for (let i = 0; i < wins.length; i++) for (let j = 0; j < wins.length; j++) {
    if (i === j || errors[wins[i].id]) continue;
    const a = wins[i], b = wins[j];
    if (a.start < b.end && b.start < a.end) errors[a.id] = `Пересекается с окном «${b.label}» (${b.start}–${b.end})`;
  }
  if (!(Number(v.syncInterval) >= 5)) errors.syncInterval = 'Не меньше 5 минут';
  return errors;
}

export const settingsSummaryError = (errors) => {
  const overlap = MAIN_MEALS.filter((m) => errors[m.id]?.startsWith('Пересекается')).map((m) => `«${m.label}»`);
  if (overlap.length >= 2) return `Не сохранено: окна ${overlap.join(' и ')} пересекаются.`;
  if (Object.keys(errors).length) return 'Не сохранено: исправьте поля с ошибкой.';
  return '';
};

export const EXTRA_IDS = EXTRAS.map((e) => e.id);
export const SETTINGS_KEYS = KEYS;
export const recordTitle = (r) => ({ terminal: 'Событие терминала', meal: 'Выдача питания', correction: 'Корректировка' })[r.kind];
export const recordPoint = (r) => pointName(r.pointId);
export { SYSTEM_SETTINGS };
