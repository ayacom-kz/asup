import { useEffect, useState } from 'react';
import { IconScan, IconToolsKitchen2, IconPencil, IconAlertTriangle, IconInbox, IconCloudOff, IconChevronRight } from '@tabler/icons-react';
import { MEALS, can, dateLabel, mealLabel, pointName, pointSite } from '../data.js';
import { conflictGroups, dayOf, hhmm, shortId, timeOf, recordTitle } from '../logic.js';
import * as S from '../store.js';
import { go } from '../router.js';
import { Avatar, Badge, Button, Empty, Modal, Spinner } from '../ui.jsx';
import { PageHead, NotFound } from './AdminApp.jsx';

const FILTERS = [['all', 'Все'], ['terminal', 'Терминал'], ['meal', 'Выдача'], ['correction', 'Корректировка']];
const KIND_ICON = { terminal: IconScan, meal: IconToolsKitchen2, correction: IconPencil };
const CORR_TYPE = { cancel: 'Отменить выдачу', change: 'Изменить вид питания', note: 'Пометка без изменения записи' };

export function Journal({ openId }) {
  const s = S.useStore();
  const [filter, setFilter] = useState('all');
  const [phase, setPhase] = useState(s.faults.load ? 'error' : 'ready');
  const [creating, setCreating] = useState(null);
  const list = s.centerEmpty ? [] : s.center;
  const rows = list.filter((r) => filter === 'all' || r.kind === filter);
  const conflicts = conflictGroups(list);
  const open = openId ? s.center.find((r) => r.eventId === openId) : null;

  const reload = () => {
    setPhase('loading');
    setTimeout(() => {
      const fail = S.getState().faults.load;
      setPhase(fail ? 'error' : 'ready');
    }, 700);
  };
  const retry = () => { S.setFault('load', false); reload(); };
  useEffect(() => { if (s.faults.load) setPhase('error'); }, [s.faults.load]);

  return (
    <>
      <PageHead title="Журнал событий" />
      {conflicts.length > 0 && phase === 'ready' && (
        <div className="note yellow row">
          <IconAlertTriangle size={20} />
          <span><b>Конфликт повторной выдачи.</b> {conflicts[0].length} записи оформлены на точках без связи и требуют разбора.</span>
          <Button size="sm" onClick={() => go('/admin/journal/conflict')}>Открыть</Button>
        </div>
      )}
      <div className="toolbar">
        <div className="seg big">
          {FILTERS.map(([id, label]) => <button type="button" key={id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
        <span className="spacer" />
        <span className="muted">{phase === 'error' ? '—' : `Записей: ${rows.length}`}</span>
        <Button onClick={reload} disabled={phase === 'loading'}>{phase === 'loading' ? <><Spinner /> Обновляем</> : 'Обновить'}</Button>
      </div>

      {phase === 'error' ? (
        <div className="panel"><Empty icon={IconCloudOff} title="Не удалось загрузить журнал" text="Центр не ответил на запрос. Повторите загрузку."><Button kind="primary" onClick={retry}>Повторить</Button></Empty></div>
      ) : !rows.length && !s.receiving.length ? (
        <div className="panel"><Empty icon={IconInbox} title={list.length ? 'Нет записей этого типа' : 'В журнале пока нет записей'} /></div>
      ) : (
        <div className={`panel table-wrap ${phase === 'loading' ? 'loading' : ''}`}>
          <table className="tbl journal-tbl">
            <thead><tr><th>Время</th><th>Сотрудник</th><th>Точка</th><th>Тип события</th><th>Результат</th><th aria-label="Открыть" /></tr></thead>
            <tbody>
              {s.receiving.length > 0 && !s.centerEmpty && (
                <tr className="receiving"><td colSpan={6}><Spinner /> Получаем {s.receiving.length > 1 ? `${s.receiving.length} записи` : 'запись'} от точки «{pointName(1)}»…</td></tr>
              )}
              {rows.map((r) => <Row key={r.eventId} r={r} hl={s.highlight.includes(r.eventId)} />)}
            </tbody>
          </table>
        </div>
      )}
      {openId && (open ? <Details r={open} onCorrect={() => setCreating(open)} /> : <Modal title="Запись журнала" onClose={() => go('/admin/journal')}><NotFound /></Modal>)}
      {creating && <CorrectionForm source={creating} onClose={() => setCreating(null)} />}
    </>
  );
}

function Row({ r, hl }) {
  const s = S.useStore();
  const p = S.person(s, r.employeeId);
  const Icon = KIND_ICON[r.kind];
  return (
    <tr className={hl ? 'hl' : ''} onClick={() => go(`/admin/journal/${r.eventId}`)}>
      <td><b>{timeOf(r.occurredAt)}</b><small>{dateLabel(dayOf(r.occurredAt))}</small></td>
      <td><span className="who"><Avatar person={p} size={38} /><span><b>{p?.short ?? '—'}</b><small>{r.employeeId}</small></span></span></td>
      <td><b>{pointName(r.pointId)}</b><small>{pointSite(r.pointId)}</small></td>
      <td>
        <span className={`kind k-${r.kind}`}><Icon size={17} />{recordTitle(r)}</span>
        {r.test && <span className="tag dashed">Тестовое</span>}
        {r.kind === 'correction' && <a className="src-link" href={`#/admin/journal/${r.sourceEventId}`} onClick={(e) => e.stopPropagation()}>Исходная запись {shortId(r.sourceEventId)}</a>}
        {r.kind === 'meal' && r.terminal && <small>{r.source === 'manual' ? 'Вручную' : r.terminal}</small>}
        {r.source === 'manual' && <small>Вручную · {r.manualBasis}</small>}
      </td>
      <td><Result r={r} /></td>
      <td><button type="button" className="row-btn" aria-label="Открыть запись" onClick={(e) => { e.stopPropagation(); go(`/admin/journal/${r.eventId}`); }}><IconChevronRight size={18} /></button></td>
    </tr>
  );
}

function Result({ r }) {
  if (r.kind === 'terminal') return <span className="res-text">Лицо распознано</span>;
  if (r.kind === 'correction') return <><Badge>Корректировка создана</Badge><small>{CORR_TYPE[r.correctionType] ?? ''}</small></>;
  return (
    <>
      <span className="res-badges">
        <Badge tone={r.result === 'issued' ? 'green' : 'yellow'}>{r.result === 'issued' ? 'Выдано' : 'Отказ'}</Badge>
        {r.cancelled && <Badge tone="red">Отменено корректировкой</Badge>}
        {r.conflict && !r.resolved && <Badge tone="red">Требует разбора</Badge>}
        {(r.offline || r.createdOffline) && <span className="tag">оформлено без связи</span>}
      </span>
      <small>{r.meal ? mealLabel(r.meal) : 'Вне окна'}{r.reason ? ` · ${r.reason}` : ''}</small>
    </>
  );
}

function Details({ r, onCorrect }) {
  const s = S.useStore();
  const p = S.person(s, r.employeeId);
  const close = () => go('/admin/journal');
  const canCorrect = can(s.admin.role, 'correction') && r.kind === 'meal';
  const rows = [
    ['Тип события', `${recordTitle(r)}${r.test ? ' · тестовые данные' : ''}`],
    ['Время', `${dateLabel(dayOf(r.occurredAt))} ${timeOf(r.occurredAt)}`],
    ['Сотрудник', p ? `${p.name} · ${p.id}` : '—'],
    ['Точка', `${pointName(r.pointId)} · ${pointSite(r.pointId)}`],
    r.kind !== 'correction' && ['Источник', r.source === 'manual' ? `Планшет, вручную · ${r.operator ?? ''}` : `Терминал ${r.terminal}`],
    ['Результат', r.kind === 'terminal' ? 'Лицо распознано (выдача не оформлена)' : r.kind === 'correction' ? 'Корректировка создана' : `${r.result === 'issued' ? 'Выдано' : 'Отказ'} · ${r.meal ? mealLabel(r.meal) : 'вне окна'}${r.reason ? ' · ' + r.reason : ''}`],
    r.manualBasis && ['Основание', r.manualBasis],
    r.kind === 'correction' && ['Вид корректировки', CORR_TYPE[r.correctionType]],
    r.kind === 'correction' && ['Автор', r.author],
    r.kind === 'correction' && ['Основание', r.basis],
    ['Доставка', (r.offline || r.createdOffline) ? 'Оформлено без связи, принято центром позже' : 'Принята центром'],
    ['eventId', <code key="e">{r.eventId}</code>],
    r.kind === 'correction' && ['Исходная запись', <code key="s">{r.sourceEventId}</code>],
    r.correctedBy?.length && ['Корректировки', r.correctedBy.map((id) => <a key={id} href={`#/admin/journal/${id}`}>{shortId(id)} </a>)],
  ].filter(Boolean);
  return (
    <Modal title="Запись журнала" onClose={close} width={620}>
      <dl className="kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <div className="modal-actions stack">
        {r.kind === 'correction' && <Button size="lg" onClick={() => go(`/admin/journal/${r.sourceEventId}`)}>Открыть исходную запись</Button>}
        {canCorrect && <Button size="lg" kind="primary" icon={IconPencil} onClick={onCorrect}>Создать корректировку</Button>}
      </div>
    </Modal>
  );
}

export function CorrectionForm({ source, onClose, onDone }) {
  const [type, setType] = useState(source.result === 'issued' ? 'cancel' : 'note');
  const [basis, setBasis] = useState('');
  const [meal, setMeal] = useState(source.meal ?? 'lunch');
  const [tried, setTried] = useState(false);
  const save = () => {
    setTried(true);
    if (!basis.trim()) return;
    const rec = S.createCorrection(source, { type, basis: basis.trim(), newMeal: type === 'change' ? meal : undefined });
    onClose();
    onDone?.(rec);
    go(`/admin/journal/${rec.eventId}`);
  };
  const s = S.useStore();
  const p = S.person(s, source.employeeId);
  return (
    <Modal title="Новая корректировка" onClose={onClose} width={560}>
      <dl className="kv"><div><dt>Исходная запись</dt><dd>{p?.short} · {pointName(source.pointId)} · {hhmm(source.occurredAt)} · {source.meal ? mealLabel(source.meal) : '—'}</dd></div></dl>
      <fieldset className="radios">
        <legend>Вид корректировки</legend>
        {Object.entries(CORR_TYPE).filter(([k]) => source.result === 'issued' || k === 'note').map(([k, l]) => <label key={k} className={`radio-row ${type === k ? 'on' : ''}`}><input type="radio" checked={type === k} onChange={() => setType(k)} />{l}</label>)}
      </fieldset>
      {type === 'change' && <label className="field"><span>Новый вид питания</span><select value={meal} onChange={(e) => setMeal(e.target.value)}>{MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>}
      <label className="field"><span>Основание · обязательно</span><textarea rows={3} value={basis} onChange={(e) => setBasis(e.target.value)} className={tried && !basis.trim() ? 'invalid' : ''} placeholder="Например: служебная записка №… от …" /></label>
      {tried && !basis.trim() && <div className="field-error">Укажите основание корректировки</div>}
      <div className="modal-actions"><Button onClick={onClose}>Отмена</Button><Button kind="primary" onClick={save}>Создать корректировку</Button></div>
    </Modal>
  );
}

export function JournalConflict() {
  const s = S.useStore();
  const groups = conflictGroups(s.center);
  const [pick, setPick] = useState(null);
  const [creating, setCreating] = useState(false);
  if (!groups.length) return (
    <>
      <PageHead title="Конфликт повторной выдачи" back={['#/admin/journal', 'Назад в журнал']} />
      <div className="panel"><Empty icon={IconInbox} title="Неразобранных конфликтов нет" /></div>
    </>
  );
  const rows = groups[0];
  const chosen = pick ?? rows[rows.length - 1].eventId;
  return (
    <>
      <PageHead title="Конфликт повторной выдачи" sub="Две выдачи одному сотруднику в одном окне, оформленные на точках без связи" back={['#/admin/journal', 'Назад в журнал']} />
      <div className="panel table-wrap">
        <table className="tbl">
          <thead><tr><th aria-label="Выбор" /><th>Время</th><th>Сотрудник</th><th>Точка</th><th>Результат</th><th>Состояние</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const p = S.person(s, r.employeeId);
              return (
                <tr key={r.eventId} className={chosen === r.eventId ? 'sel' : ''} onClick={() => setPick(r.eventId)}>
                  <td><input type="radio" aria-label="Выбрать запись для корректировки" checked={chosen === r.eventId} onChange={() => setPick(r.eventId)} /></td>
                  <td><b>{timeOf(r.occurredAt)}</b><small>{dateLabel(dayOf(r.occurredAt))}</small></td>
                  <td><span className="who"><Avatar person={p} size={38} /><span><b>{p?.short}</b><small>{p?.id}</small></span></span></td>
                  <td><b>{pointName(r.pointId)}</b><small>{pointSite(r.pointId)}</small></td>
                  <td><Badge tone="green">Выдано</Badge><small>{mealLabel(r.meal)} · оформлено без связи</small></td>
                  <td><Badge tone="red">Требует разбора</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="page-foot">
        <Button onClick={() => go('/admin/journal')}>Назад в журнал</Button>
        {can(s.admin.role, 'correction') && <Button kind="primary" onClick={() => setCreating(true)}>Создать корректировку для выбранной</Button>}
      </div>
      {creating && <CorrectionForm source={rows.find((r) => r.eventId === chosen)} onClose={() => setCreating(false)} />}
    </>
  );
}
