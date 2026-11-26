import { useState } from 'react';
import { IconFaceId, IconAlertTriangle, IconCircleCheck, IconUserQuestion, IconCloudUpload, IconWifiOff, IconAntennaBars5, IconNetwork } from '@tabler/icons-react';
import { EXTRAS, MAIN_MEALS, mealLabel, pointName, pointSite, dateLabel, DEMO_DATE } from '../data.js';
import { hhmm, dayOf } from '../logic.js';
import * as S from '../store.js';
import { Button, Badge, Avatar, Modal, Logo, downloadSheet, Spinner } from '../ui.jsx';
import { Manual } from './Manual.jsx';

export function Tablet() {
  const s = S.useStore();
  if (!s.operator) return <div className="tab-screen"><TabLogin /></div>;
  return (
    <div className="tab-screen">
      <TabHeader />
      <TabBanner />
      {s.manual ? <Manual /> : (
        <div className="tab-grid">
          <TerminalPanel station="Т1" />
          <TerminalPanel station="Т2" />
          <LocalJournal />
        </div>
      )}
      {s.report && <Report />}
    </div>
  );
}

function TabLogin() {
  const s = S.useStore();
  const [login, setLogin] = useState('operator');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = (e) => { e.preventDefault(); const r = S.operatorLogin(login, password); setError(r ? 'Неверный логин или пароль' : ''); };
  return (
    <div className="tab-login">
      <form className="login-card" onSubmit={submit}>
        <Logo height={44} />
        <h1>Вход оператора</h1>
        <p className="muted">{pointName(1)} · {pointSite(1)}</p>
        {s.link === 'off' && <div className="note blue">Центр недоступен. Вход проверяется на сервере точки.</div>}
        {error && <div className="note red" role="alert">{error}</div>}
        <label className="field"><span>Логин</span><input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" /></label>
        <label className="field"><span>Пароль</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="demo" /></label>
        <Button kind="primary" size="lg" type="submit">Войти</Button>
      </form>
    </div>
  );
}

function TabHeader() {
  const s = S.useStore();
  const pending = S.pendingCount(s);
  const sending = s.local.some((r) => r.syncStatus === 'sending');
  const interval = S.pointSettings(s).syncInterval;
  const link = {
    lan: { cls: '', icon: IconNetwork, label: 'Связь', value: 'LAN · ping 12 мс' },
    sim: { cls: 'warn', icon: IconAntennaBars5, label: 'Резервный канал', value: 'SIM · ping 84 мс' },
    off: { cls: 'bad', icon: IconWifiOff, label: 'Связь с центром', value: 'Нет LAN и SIM' },
  }[s.link];
  let sync;
  if (s.link === 'off') sync = { cls: 'bad', label: 'Синхронизация остановлена', value: `Последняя в ${s.lastSync}` };
  else if (sending) sync = { cls: 'info', label: 'Синхронизация', value: `Отправляется ${pending} ${S.plural(pending, 'запись', 'записи', 'записей')}` };
  else if (s.syncNote) sync = { cls: '', label: 'Последняя синхронизация', value: `${s.lastSync} · ${s.syncNote}` };
  else sync = { cls: '', label: 'Последняя синхронизация', value: `${s.lastSync} · каждые ${interval} мин` };
  return (
    <header className="tab-head">
      <Logo height={40} />
      <div className="tab-clock" title="Время задаётся в демо-пульте">{s.time}</div>
      <Button size="lg" onClick={S.manualOpen} disabled={!!s.manual}>Ручная операция</Button>
      <Button size="lg" kind="primary" onClick={() => S.setReport(true)}>Отчёт</Button>
      <div className={`chip ${link.cls}`}><small>{link.label}</small><b>{link.value}</b></div>
      <button type="button" className={`chip ${sync.cls}`} onClick={S.syncNow} title="Нажмите, чтобы синхронизировать сейчас">
        <small>{sync.label}</small><b>{sending && <Spinner size={12} />} {sync.value}</b>
      </button>
    </header>
  );
}

function TabBanner() {
  const s = S.useStore();
  if (s.link === 'off') return <div className="banner red">Нет связи с центром. Выдача продолжается: записи сохраняются на точке и ждут отправки.</div>;
  if (s.recovering) return <div className="banner blue"><Spinner size={14} /> Связь восстановлена. Отправляем сохранённые записи.</div>;
  if (s.sentBanner) return <div className="banner green">Центр подтвердил приём: {s.sentBanner} {S.plural(s.sentBanner, 'запись', 'записи', 'записей')}. Ожидающих нет.</div>;
  if (s.link === 'sim') return <div className="banner yellow">Основной канал LAN недоступен. Связь с центром идёт через резервный SIM.</div>;
  return null;
}

function TerminalPanel({ station }) {
  const s = S.useStore();
  const t = s.term[station];
  const main = S.mainMealNow(s);
  const win = S.pointSettings(s, 'Т1');
  const extrasOn = S.pointSettings(s, 'Т2').extras;
  const isT1 = station === 'Т1';
  const tone = t?.phase === 'done' ? (t.ok ? (t.offline ? 'blue' : 'green') : 'yellow') : t?.phase === 'pending' ? 'blue' : '';
  const badge = isT1 ? (main ? <Badge tone="blue">Авто</Badge> : <Badge tone="yellow">Вне окна</Badge>)
    : (s.extra ? <Badge tone="navy">{mealLabel(s.extra)}</Badge> : <Badge>Не выбрано</Badge>);
  return (
    <section className={`panel term ${tone && 'ring-' + tone}`} aria-label={`Терминал ${station}`} aria-live="polite">
      <header className="term-head">
        <span className={`term-tag ${isT1 ? '' : 'navy'}`}>{station}</span>
        <div><h2>{isT1 ? 'Основное питание' : 'Дополнительное'}</h2></div>
        {badge}
      </header>
      <div className="term-top">
        {isT1 ? (main
          ? <div className="slot"><b>{main.label} · сейчас</b><span>{main.start} – {main.end}</span></div>
          : <div className="slot yellow"><b>Вне основного приёма</b><span>{MAIN_MEALS.map((m) => `${m.label} ${win[m.id].start}`).join(' · ')}</span></div>)
          : (
            <div className="extras" role="group" aria-label="Позиция Т2">
              {EXTRAS.filter((e) => extrasOn[e.id]).map((e) => (
                <button type="button" key={e.id} className={`extra ${s.extra === e.id ? 'on' : ''}`} aria-pressed={s.extra === e.id} onClick={() => S.pickExtra(e.id)} disabled={t?.phase === 'pending'}>{e.label}</button>
              ))}
            </div>
          )}
      </div>
      <div className="term-body">
        <TermState t={t} station={station} idle={isT1
          ? { title: main ? 'Подойдите к терминалу Т1' : 'Основной приём не идёт' }
          : { title: s.extra ? 'Подойдите к терминалу Т2' : 'Выберите позицию' }} />
      </div>
    </section>
  );
}

function TermState({ t, idle }) {
  const s = S.useStore();
  if (!t) return (
    <div className="idle">
      <span className="scan"><IconFaceId size={64} stroke={1.4} /></span>
      <h3>{idle.title}</h3>
    </div>
  );
  const p = t.employeeId ? S.person(s, t.employeeId) : null;
  if (t.phase === 'pending') return (
    <div className="result">
      {p ? <img className="photo ring-blue pulse" src={p.photo} alt="" /> : <span className="photo unknown pulse"><IconUserQuestion size={70} stroke={1.3} /></span>}
      <Badge tone="blue"><Spinner size={11} /> Распознавание</Badge>
      <h3 className="r-title">Проверка права{t.meal ? `: ${mealLabel(t.meal).toLowerCase()}` : ''}</h3>
    </div>
  );
  const tone = t.ok ? (t.offline ? 'blue' : 'green') : 'yellow';
  const badge = t.pass ? 'Лицо распознано' : t.ok ? (t.offline ? 'Выдано · сохранено локально' : 'Разрешено') : 'Отказ';
  const title = t.pass ? 'Событие терминала' : t.ok ? `Выдано: ${mealLabel(t.meal).toLowerCase()}` : t.reason;
  const detail = t.ok && t.offline && !t.pass ? 'Запись сохранена на точке и будет отправлена после восстановления связи.' : t.detail;
  return (
    <div className="result">
      {p ? <img className={`photo ring-${tone}`} src={p.photo} alt={`Фото: ${p.short}`} /> : <span className="photo unknown ring-yellow"><IconUserQuestion size={70} stroke={1.3} /></span>}
      <Badge tone={tone}>{badge}</Badge>
      <div className="r-name">{p ? p.short : 'Сотрудник не определён'}</div>
      {p && <div className="r-id">{p.id}</div>}
      <h3 className="r-title">{title}</h3>
      {(!t.ok || t.offline || !p) && <div className={`r-detail ${tone}`}>{t.ok ? <IconCircleCheck size={18} /> : <IconAlertTriangle size={18} />}<span>{detail}</span></div>}
    </div>
  );
}

const SYNC_LABEL = { local: ['Ожидает отправки', 'blue'], sending: ['Отправляется', 'blue'], accepted: null };

function LocalJournal() {
  const s = S.useStore();
  const filter = s.journalFilter;
  const setFilter = (journalFilter) => S.set({ journalFilter });
  const rows = s.local.filter((r) => dayOf(r.occurredAt) === DEMO_DATE && r.kind === 'meal' && (filter === 'all' || r.result === 'refused'));
  const pending = S.pendingCount(s);
  return (
    <aside className="panel journal" aria-label="Локальный журнал">
      <header>
        <h2>Локальный журнал</h2>
        <p className="muted">{pointName(1)} · сегодня</p>
        <div className="seg">
          <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Все</button>
          <button type="button" className={filter === 'ref' ? 'on' : ''} onClick={() => setFilter('ref')}>Отказы</button>
        </div>
      </header>
      <ol className="j-list">
        {rows.map((r) => {
          const p = S.person(s, r.employeeId);
          const sync = SYNC_LABEL[r.syncStatus];
          return (
            <li key={r.eventId} className={r.result === 'refused' ? 'refused' : ''}>
              <Avatar person={p} size={38} />
              <div>
                <b>{p?.short}</b>
                <small>{hhmm(r.occurredAt)} · {r.source === 'manual' ? 'Вручную' : r.terminal} · {r.meal ? mealLabel(r.meal) : 'вне окна'}</small>
                {r.result === 'refused' && <em>{r.reason}</em>}
                <span className="j-badges">
                  <Badge tone={r.result === 'refused' ? 'yellow' : 'green'}>{r.result === 'refused' ? 'Отказ' : 'Выдано'}</Badge>
                  {sync && <Badge tone={sync[1]}>{sync[0]}</Badge>}
                </span>
              </div>
            </li>
          );
        })}
        {!rows.length && <li className="j-empty">{filter === 'ref' ? 'Отказов сегодня нет' : 'Записей пока нет'}</li>}
      </ol>
      <footer>
        <div><b>{s.operator.name}</b><small className="muted">{pending ? `Ожидают отправки: ${pending}` : 'Все записи отправлены'}</small></div>
        <Button onClick={S.operatorLogout}>Выйти</Button>
      </footer>
    </aside>
  );
}

function Report() {
  const s = S.useStore();
  const rows = s.local.filter((r) => dayOf(r.occurredAt) === DEMO_DATE && r.kind === 'meal');
  const issued = rows.filter((r) => r.result === 'issued');
  const byMeal = [...MAIN_MEALS, ...EXTRAS].map((m) => ({
    ...m, terminal: MAIN_MEALS.includes(m) ? 'Т1' : 'Т2',
    issued: issued.filter((r) => r.meal === m.id).length,
    refused: rows.filter((r) => r.result === 'refused' && r.meal === m.id).length,
  }));
  const outside = rows.filter((r) => r.result === 'refused' && !r.meal).length;
  const exportXls = () => downloadSheet(rows.map((r) => {
    const p = S.person(s, r.employeeId);
    return { 'Время': hhmm(r.occurredAt), 'Источник': r.source === 'manual' ? 'Вручную' : r.terminal, 'Табельный ID': r.employeeId, 'Сотрудник': p?.name, 'Организация': p?.org, 'Питание': r.meal ? mealLabel(r.meal) : 'Вне окна', 'Результат': r.result === 'issued' ? 'Выдано' : 'Отказ', 'Причина': r.reason, 'Доставка': r.syncStatus === 'accepted' ? 'Принято центром' : 'Ожидает отправки', 'eventId': r.eventId };
  }), 'Отчёт_Столовая1_ДЕМО');
  return (
    <Modal title="Отчёт за день" onClose={() => S.setReport(false)} width={620}>
      <p className="muted">{pointName(1)} · {pointSite(1)} · {dateLabel(DEMO_DATE)}</p>
      <div className="stats3">
        <div><small>Выдано</small><b>{issued.length}</b></div>
        <div className="warn"><small>Отказы</small><b>{rows.length - issued.length}</b></div>
        <div><small>Ожидают отправки</small><b>{S.pendingCount(s)}</b></div>
      </div>
      <table className="tbl compact">
        <thead><tr><th>Вид питания</th><th>Терминал</th><th>Выдано</th><th>Отказы</th></tr></thead>
        <tbody>
          {byMeal.map((m) => <tr key={m.id}><td><b>{m.label}</b></td><td>{m.terminal}</td><td>{m.issued}</td><td>{m.refused}</td></tr>)}
          {outside > 0 && <tr><td><b>Вне окна</b></td><td>Т1</td><td>0</td><td>{outside}</td></tr>}
        </tbody>
      </table>
      <div className="modal-actions"><Button onClick={() => S.setReport(false)}>Закрыть</Button><Button kind="primary" icon={IconCloudUpload} onClick={exportXls}>Скачать Excel</Button></div>
    </Modal>
  );
}

