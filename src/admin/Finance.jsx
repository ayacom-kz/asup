import { useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { DEMO_DATE, MEALS, ORGANIZATIONS, dateLabel, mealLabel, pointName } from '../data.js';
import { dayOf, timeOf } from '../logic.js';
import * as S from '../store.js';
import { Badge, Button, downloadSheet } from '../ui.jsx';
import { PageHead } from './AdminApp.jsx';

// Реестр списаний — существующий раздел демо, сохранён отдельным входом. Строится по центральному журналу.
export function Registry() {
  const s = S.useStore();
  const [q, setQ] = useState('');
  const [org, setOrg] = useState('all');
  const [status, setStatus] = useState('all');
  const rows = s.center.filter((r) => r.kind === 'meal').map((r) => ({ r, p: S.person(s, r.employeeId) }))
    .filter(({ r, p }) => (org === 'all' || p?.org === org) && (status === 'all' || r.result === status) && `${p?.name} ${r.employeeId}`.toLowerCase().includes(q.toLowerCase()));
  const exportXls = () => downloadSheet(rows.map(({ r, p }) => ({ 'Дата': dateLabel(dayOf(r.occurredAt)), 'Время': timeOf(r.occurredAt), 'Столовая': pointName(r.pointId), 'Терминал': r.source === 'manual' ? 'Вручную' : r.terminal, 'Табельный ID': r.employeeId, 'Сотрудник': p?.name, 'Организация': p?.org, 'Рацион': r.meal ? mealLabel(r.meal) : 'Вне окна', 'Статус': r.result === 'issued' ? (r.cancelled ? 'Отменено' : 'Выдано') : 'Отказ', 'Причина отказа': r.reason, 'eventId': r.eventId })), 'Реестр_списаний_ДЕМО');
  return (
    <>
      <PageHead title="Реестр списаний"><Button kind="primary" onClick={exportXls}>Выгрузить в Excel</Button></PageHead>
      <div className="toolbar">
        <label className="search"><IconSearch size={19} /><input placeholder="Сотрудник или табельный ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск" /></label>
        <select className="select" value={org} onChange={(e) => setOrg(e.target.value)} aria-label="Организация"><option value="all">Все организации</option>{ORGANIZATIONS.map((o) => <option key={o}>{o}</option>)}</select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Статус"><option value="all">Все статусы</option><option value="issued">Выдано</option><option value="refused">Отказ</option></select>
        <span className="spacer" /><span className="muted">{rows.length} записей</span>
      </div>
      <div className="panel table-wrap">
        <table className="tbl">
          <thead><tr><th>Дата и время</th><th>Столовая</th><th>Терминал</th><th>Сотрудник</th><th>Организация</th><th>Рацион</th><th>Статус</th></tr></thead>
          <tbody>
            {rows.map(({ r, p }) => (
              <tr key={r.eventId} onClick={() => { window.location.hash = `/admin/journal/${r.eventId}`; }}>
                <td><b>{dateLabel(dayOf(r.occurredAt))}</b><small>{timeOf(r.occurredAt)}</small></td>
                <td>№{r.pointId}</td>
                <td><span className="term-mini">{r.source === 'manual' ? 'Вручную' : r.terminal}</span></td>
                <td><b>{p?.name}</b><small>{r.employeeId}</small></td>
                <td>{p?.org}</td>
                <td>{r.meal ? mealLabel(r.meal) : '—'}</td>
                <td><Badge tone={r.result === 'issued' ? (r.cancelled ? 'red' : 'green') : 'yellow'}>{r.result === 'issued' ? (r.cancelled ? 'Отменено' : 'Выдано') : 'Отказ'}</Badge>{r.reason && <small>{r.reason}</small>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="muted pad">Записей по выбранному фильтру нет</p>}
      </div>
    </>
  );
}

export function Finance() {
  const s = S.useStore();
  const [period, setPeriod] = useState('all');
  const issued = s.center.filter((r) => r.kind === 'meal' && r.result === 'issued' && !r.cancelled && (period === 'all' || dayOf(r.occurredAt) === DEMO_DATE));
  const totals = ORGANIZATIONS.map((org, i) => {
    const rows = issued.filter((r) => S.person(s, r.employeeId)?.org === org);
    return { org, own: i === 0, ...Object.fromEntries(MEALS.map((m) => [m.id, rows.filter((r) => r.meal === m.id).length])), total: rows.length };
  });
  const own = totals[0].total;
  const exportXls = () => downloadSheet(totals.map((t) => ({ 'Организация': t.org, 'Тип': t.own ? 'Заказчик' : 'Субподрядчик', ...Object.fromEntries(MEALS.map((m) => [m.label, t[m.id]])), 'Всего порций': t.total })), 'Акт_сверки_ДЕМО');
  return (
    <>
      <PageHead title="Взаиморасчёты">
        <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Период"><option value="all">За всё время</option><option value="today">Сегодня, {dateLabel(DEMO_DATE)}</option></select>
        <Button kind="primary" onClick={exportXls}>Скачать акт сверки</Button>
      </PageHead>
      <div className="stats5 four">
        <div className="stat"><small>Всего выдано порций</small><b>{issued.length}</b></div>
        <div className="stat"><small>Персонал заказчика</small><b>{own}</b></div>
        <div className="stat"><small>Субподрядные организации</small><b>{issued.length - own}</b></div>
        <div className="stat"><small>Отменено корректировкой</small><b className="t-yellow">{s.center.filter((r) => r.cancelled).length}</b></div>
      </div>
      <div className="panel table-wrap">
        <table className="tbl">
          <thead><tr><th>Организация</th><th>Тип</th>{MEALS.map((m) => <th key={m.id}>{m.label}</th>)}<th>Всего</th></tr></thead>
          <tbody>{totals.map((t) => <tr key={t.org}><td><b>{t.org}</b></td><td><Badge tone={t.own ? 'blue' : 'grey'}>{t.own ? 'Заказчик' : 'Субподрядчик'}</Badge></td>{MEALS.map((m) => <td key={m.id}>{t[m.id]}</td>)}<td><b>{t.total}</b></td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
