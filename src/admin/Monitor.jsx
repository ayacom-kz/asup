import { useState } from 'react';
import { IconChevronRight, IconCloudOff } from '@tabler/icons-react';
import { DEMO_DATE, dateLabel, mealLabel } from '../data.js';
import { dayOf, timeOf } from '../logic.js';
import * as S from '../store.js';
import { go } from '../router.js';
import { Avatar, Badge, Button, Spinner } from '../ui.jsx';
import { PageHead, NotFound } from './AdminApp.jsx';

const PC = { online: ['На связи', 'green'], offline: ['Нет связи с ПК', 'red'], lagging: ['Отстаёт по данным', 'yellow'] };
const attention = (p) => p.pc !== 'online' || Object.values(p.terminals).some((t) => t !== 'online');
const termText = (p) => {
  if (p.pc === 'offline') return ['Неизвестно', 'grey'];
  const off = Object.entries(p.terminals).filter(([, v]) => v !== 'online').map(([k]) => k);
  return off.length ? [`${off.join(', ')} не отвечает`, 'red'] : ['Т1, Т2 на связи', 'green'];
};

export function Monitor() {
  const s = S.useStore();
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const points = S.livePoints(s);
  const stale = s.faults.stale;
  const sorted = [...points].sort((a, b) => (attention(b) - attention(a)) || ((b.channel === 'SIM') - (a.channel === 'SIM')) || a.id - b.id);
  const list = sorted.filter((p) => filter === 'all' || (filter === 'att' ? attention(p) : p.channel === 'SIM'));
  const shown = list;
  const count = (f) => points.filter(f).length;
  const refresh = () => { setBusy(true); setTimeout(() => { setBusy(false); if (!S.getState().faults.stale) S.refreshMonitor(); }, 600); };
  return (
    <>
      <PageHead title="Мониторинг ПК точек">
        <Button onClick={refresh} disabled={busy}>{busy ? <><Spinner /> Обновляем</> : 'Обновить'}</Button>
      </PageHead>
      {stale && <div className="note yellow row"><IconCloudOff size={20} /><span>Нет связи с сервером. Показаны данные на 13:05, они могли измениться.</span><Button size="sm" onClick={() => { S.setFault('stale', false); refresh(); }}>Повторить</Button></div>}
      {!stale && (
        <div className="stats5">
          <div className="stat"><small>ПК на связи</small><b className="t-green">{count((p) => p.pc !== 'offline')} из 32</b></div>
          <div className="stat"><small>Нет связи с ПК</small><b className="t-red">{count((p) => p.pc === 'offline')}</b></div>
          <div className="stat"><small>Терминал не отвечает</small><b className="t-red">{count((p) => p.pc !== 'offline' && Object.values(p.terminals).some((t) => t === 'offline'))}</b></div>
          <div className="stat"><small>Отстают по данным</small><b className="t-yellow">{count((p) => p.pc === 'lagging')}</b></div>
          <div className="stat"><small>Работают через SIM</small><b className="t-yellow">{count((p) => p.channel === 'SIM')}</b></div>
        </div>
      )}
      <div className="toolbar">
        <div className="seg big">
          {[['all', 'Все'], ['att', 'Требуют внимания'], ['sim', 'Резерв SIM']].map(([id, l]) => <button type="button" key={id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{l}</button>)}
        </div>
      </div>
      <div className={`panel table-wrap ${busy ? 'loading' : ''}`}>
        <table className="tbl">
          <thead><tr><th>Точка</th><th>ПК точки</th><th>Канал</th><th>Последний контакт</th><th>Справочник</th><th>Очередь</th><th>Терминалы</th><th aria-label="Открыть" /></tr></thead>
          <tbody>
            {shown.map((p) => {
              const [pcl, pct] = stale ? ['Нет свежих данных', 'grey'] : PC[p.pc];
              const [tt, ttt] = stale ? ['Нет свежих данных', 'grey'] : termText(p);
              const off = p.pc === 'offline';
              return (
                <tr key={p.id} onClick={() => go(`/admin/monitor/${p.id}`)}>
                  <td><b>{p.name}</b><small>{p.site}</small></td>
                  <td><Badge tone={pct}>{pcl}</Badge></td>
                  <td>{stale || off ? '—' : p.channel === 'SIM' ? <Badge tone="yellow">SIM · резерв</Badge> : <b>LAN</b>}</td>
                  <td>{stale ? '13:04' : p.contact}</td>
                  <td>v{p.dict}</td>
                  <td>{off ? '—' : p.queue}</td>
                  <td><Badge tone={ttt}>{tt}</Badge></td>
                  <td><button type="button" className="row-btn" aria-label={`Открыть ${p.name}`}><IconChevronRight size={18} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MonitorPoint({ id, tab }) {
  const s = S.useStore();
  const p = S.livePoints(s).find((x) => x.id === id);
  if (!p) return <NotFound />;
  const off = p.pc === 'offline';
  const deadTerm = Object.entries(p.terminals).find(([, v]) => v === 'offline');
  const records = s.center.filter((r) => r.pointId === id && dayOf(r.occurredAt) === DEMO_DATE);
  const TS = { online: ['На связи', 'green'], offline: ['Не отвечает', 'red'], unknown: ['Неизвестно', 'grey'] };
  return (
    <>
      <PageHead title={p.name} sub={p.site} back={['#/admin/monitor', 'Все точки']} />
      <div className="tabs">
        <a href={`#/admin/monitor/${id}`} className={!tab ? 'on' : ''}>Состояние точки</a>
        <a href={`#/admin/monitor/${id}/journal`} className={tab === 'journal' ? 'on' : ''}>Журнал этой точки</a>
      </div>
      {tab === 'journal' ? (
        <div className="panel table-wrap">
          <table className="tbl">
            <thead><tr><th>Время</th><th>Сотрудник</th><th>Источник</th><th>Результат</th></tr></thead>
            <tbody>
              {records.map((r) => { const per = S.person(s, r.employeeId); return (
                <tr key={r.eventId} onClick={() => go(`/admin/journal/${r.eventId}`)}>
                  <td><b>{timeOf(r.occurredAt)}</b><small>{dateLabel(dayOf(r.occurredAt))}</small></td>
                  <td><span className="who"><Avatar person={per} size={34} /><b>{per?.short}</b></span></td>
                  <td>{r.kind === 'correction' ? 'Корректировка' : r.source === 'manual' ? 'Вручную' : r.terminal}</td>
                  <td>{r.kind === 'meal' ? <><Badge tone={r.result === 'issued' ? 'green' : 'yellow'}>{r.result === 'issued' ? 'Выдано' : 'Отказ'}</Badge><small>{r.meal ? mealLabel(r.meal) : 'Вне окна'}{r.reason && ` · ${r.reason}`}</small></> : r.kind === 'terminal' ? 'Лицо распознано' : 'Корректировка создана'}</td>
                </tr>); })}
            </tbody>
          </table>
          {!records.length && <p className="muted pad">За сегодня центр не получил записей от этой точки.</p>}
        </div>
      ) : (
        <>
          {off && <div className="note red">Центр не получает данные от ПК с {p.contact}.</div>}
          {!off && deadTerm && <div className="note yellow">ПК точки на связи. Терминал {deadTerm[0]} не отвечает ПК с {p.terminalLast[deadTerm[0]]}.</div>}
          {!off && p.channel === 'SIM' && <div className="note yellow">Основной канал LAN недоступен, точка работает через резервный SIM.</div>}
          <div className="detail-grid">
            <section className="panel">
              <h3>ПК точки</h3>
              <dl className="kv">
                <div><dt>ПК точки</dt><dd><Badge tone={PC[p.pc][1]}>{off ? 'Нет связи' : PC[p.pc][0]}</Badge></dd></div>
                <div><dt>{off ? 'Каналы' : 'Канал'}</dt><dd>{off ? 'LAN и SIM: связи с центром нет' : p.channel === 'SIM' ? 'SIM · резерв' : 'LAN'}</dd></div>
                <div><dt>Последний контакт</dt><dd>{dateLabel(DEMO_DATE)} {p.contact}</dd></div>
                <div><dt>Последняя синхронизация</dt><dd>{dateLabel(DEMO_DATE)} {id === 1 ? s.lastSync : p.contact}</dd></div>
                <div><dt>Версия справочника</dt><dd>v{p.dict}</dd></div>
                <div><dt>Очередь</dt><dd>{off ? '—' : p.queue}</dd></div>
              </dl>
            </section>
            <section className="panel">
              <h3>Терминалы</h3>
              <table className="tbl compact">
                <thead><tr><th>Терминал</th><th>Состояние</th><th>Последнее событие</th></tr></thead>
                <tbody>{Object.entries(p.terminals).map(([k, v]) => <tr key={k}><td><b>{k}</b></td><td><Badge tone={TS[v][1]}>{TS[v][0]}</Badge></td><td>{p.terminalLast[k]}</td></tr>)}</tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </>
  );
}
