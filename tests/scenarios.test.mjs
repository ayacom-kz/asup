// Сценарии приёмки из CLAUDE.md, проверяются на логике прототипа (без браузера).
import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from '../src/store.js';
import { acceptBatch, checkEligibility, validateSettings, effectiveSettings, markConflicts, seedCenter, at } from '../src/logic.js';
import { PEOPLE, SYSTEM_SETTINGS } from '../src/data.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fresh = () => { S.resetAll(); S.operatorLogin('operator', 'demo'); };
const centerHas = (id) => S.getState().center.filter((r) => r.eventId === id).length;

test('1. Событие терминала → в центре одна запись с той же точкой и сотрудником, выдачи нет', async () => {
  fresh();
  const before = S.getState().center.length;
  S.terminalEvent('P10003');
  const rec = S.getState().local[0];
  assert.equal(rec.kind, 'terminal');
  await sleep(1700);
  const s = S.getState();
  assert.equal(s.center.length, before + 1);
  const inCenter = s.center.find((r) => r.eventId === rec.eventId);
  assert.equal(inCenter.pointId, 1);
  assert.equal(inCenter.employeeId, 'P10003');
  assert.equal(s.center.filter((r) => r.employeeId === 'P10003' && r.kind === 'meal' && r.occurredAt === rec.occurredAt).length, 0, 'выдача не создана');
});

test('2. Окно и вне окна: результат на планшете совпадает с журналом центра', async () => {
  fresh();
  S.recognize('P10006', 'Т1'); // 13:10 — обед, сегодня обеда ещё не было
  await sleep(1000);
  let s = S.getState();
  assert.equal(s.term['Т1'].ok, true);
  assert.equal(s.local[0].result, 'issued');
  S.setTime('23:30');
  S.recognize('P10001', 'Т1');
  await sleep(1000);
  s = S.getState();
  assert.equal(s.term['Т1'].ok, false);
  assert.equal(s.term['Т1'].reason, 'Вне времени основного приёма');
  await sleep(1700);
  s = S.getState();
  const [refused, issued] = s.local;
  assert.equal(s.center.find((r) => r.eventId === refused.eventId).result, 'refused');
  assert.equal(s.center.find((r) => r.eventId === refused.eventId).reason, 'Вне времени основного приёма');
  assert.equal(s.center.find((r) => r.eventId === issued.eventId).result, 'issued');
});

test('3. Нет связи → записи локально → восстановление и повторная доставка: ровно одна запись на UUID', async () => {
  fresh();
  S.setLink('off');
  S.recognize('P10001', 'Т1');
  await sleep(1000);
  S.pickExtra('water');
  S.recognize('P10003', 'Т2');
  await sleep(1000);
  let s = S.getState();
  const ids = s.local.filter((r) => r.createdOffline).map((r) => r.eventId);
  assert.equal(ids.length, 2);
  assert.equal(S.pendingCount(s), 2);
  ids.forEach((id) => assert.equal(centerHas(id), 0, 'пока нет связи, центр записей не видит'));
  S.setLink('lan');
  await sleep(1700);
  S.redeliver();
  S.redeliver();
  s = S.getState();
  assert.equal(S.pendingCount(s), 0);
  ids.forEach((id) => assert.equal(centerHas(id), 1, `ровно одна запись ${id}`));
  const localIds = s.local.map((r) => r.eventId).sort();
  const centerIds = s.center.filter((r) => r.pointId === 1 && localIds.includes(r.eventId)).map((r) => r.eventId).sort();
  assert.deepEqual(centerIds, localIds, 'количество и ID точки и центра совпадают');
});

test('Повтор UUID не создаёт дубль (T-007)', () => {
  const center = seedCenter();
  const rec = { eventId: 'x-1', pointId: 1, employeeId: 'P10001', occurredAt: at('13:10:00'), kind: 'meal', result: 'issued', meal: 'lunch' };
  const a = acceptBatch(center, [rec], at('13:10:01'));
  const b = acceptBatch(a.center, [rec, rec], at('13:10:02'));
  assert.equal(a.accepted.length, 1);
  assert.equal(b.accepted.length, 0);
  assert.equal(b.duplicates, 2);
  assert.equal(b.center.length, center.length + 1);
});

test('Лимит: повторный обед и общий лимит сухого пайка', () => {
  const center = seedCenter();
  const viktor = PEOPLE.find((p) => p.id === 'P10002');
  assert.equal(checkEligibility(viktor, 'lunch', center).reason, 'Лимит питания уже использован');
  assert.equal(checkEligibility(viktor, 'dry', center).ok, false);
  assert.equal(checkEligibility(viktor, 'dry', center, { dryReplacesLunch: false }).ok, true);
  assert.equal(checkEligibility({ ...viktor, status: 'blocked' }, 'dinner', center).reason, 'Доступ заблокирован');
});

test('Ручная операция не обходит лимит', () => {
  fresh();
  S.manualOpen();
  S.manualPatch({ step: 3, employeeId: 'P10002', meal: 'lunch', basis: 'face', verified: true });
  S.manualConfirm();
  assert.equal(S.getState().manual.step, 'limit');
});

test('Корректировка хранит связь с исходной записью и не меняет её результат', () => {
  fresh();
  const src = S.getState().center.find((r) => r.kind === 'meal' && r.result === 'issued');
  const corr = S.createCorrection(src, { type: 'cancel', basis: 'Тест' });
  const s = S.getState();
  assert.equal(corr.sourceEventId, src.eventId);
  const after = s.center.find((r) => r.eventId === src.eventId);
  assert.equal(after.result, 'issued');
  assert.equal(after.eventId, src.eventId);
});

test('Офлайн-конфликт: две выдачи в одном окне на разных точках видны обе (T-008)', () => {
  const base = [
    { eventId: 'a', pointId: 2, employeeId: 'P10003', occurredAt: at('12:20:11'), kind: 'meal', result: 'issued', meal: 'lunch' },
    { eventId: 'b', pointId: 3, employeeId: 'P10003', occurredAt: at('12:47:32'), kind: 'meal', result: 'issued', meal: 'lunch' },
  ];
  const marked = markConflicts(base);
  assert.ok(marked.every((r) => r.conflict));
});

test('Настройки: пересечение окон и интервал меньше 5 минут не сохраняются', () => {
  const v = structuredClone(SYSTEM_SETTINGS);
  v.lunch.end = '18:30';
  v.syncInterval = 3;
  const e = validateSettings(v);
  assert.match(e.lunch, /Пересекается с окном «Ужин»/);
  assert.ok(e.syncInterval);
});

test('Настройки: нижний уровень наследует и переопределяет верхний', () => {
  const settings = { system: structuredClone(SYSTEM_SETTINGS), overrides: { 'point:1': { lunch: { start: '11:30', end: '15:00' } } } };
  const t1 = effectiveSettings(settings, 'term:1:Т1');
  assert.equal(t1.values.lunch.start, '11:30');
  assert.equal(t1.source.lunch, 'point:1');
  assert.equal(t1.source.breakfast, 'system');
});
