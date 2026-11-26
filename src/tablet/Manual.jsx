import { useState } from 'react';
import { IconSearch, IconCircleCheck, IconAlertTriangle, IconLock } from '@tabler/icons-react';
import { EXTRAS, mealLabel, pointName, pointSite } from '../data.js';
import * as S from '../store.js';
import { Button, Avatar, Checkbox } from '../ui.jsx';

const STEPS = ['Сотрудник', 'Питание и основание', 'Подтверждение'];

export function Manual() {
  const s = S.useStore();
  const m = s.manual;
  const finished = typeof m.step !== 'number';
  return (
    <section className="panel manual" aria-label="Ручная операция">
      <header className="manual-head">
        <h2>Ручная операция</h2>
        <Button onClick={S.manualClose}>{finished ? 'Вернуться к терминалам' : 'Закрыть без выдачи'}</Button>
      </header>
      {!finished && (
        <ol className="steps">
          {STEPS.map((label, i) => <li key={label} className={m.step === i + 1 ? 'on' : m.step > i + 1 ? 'done' : ''}>{i + 1} · {label}</li>)}
        </ol>
      )}
      {m.step === 1 && <StepPerson />}
      {m.step === 2 && <StepMeal />}
      {m.step === 3 && <StepConfirm />}
      {m.step === 'done' && <Done />}
      {m.step === 'limit' && <Limit />}
      {m.step === 'denied' && <Denied />}
    </section>
  );
}

function StepPerson() {
  const s = S.useStore();
  const [q, setQ] = useState('');
  const list = s.people.filter((p) => p.photo && p.status === 'active' && `${p.short} ${p.name} ${p.id}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="manual-body">
        <label className="search"><IconSearch size={20} /><input placeholder="Фамилия или табельный ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск сотрудника" /></label>
        <div className="people-grid" role="radiogroup" aria-label="Сотрудник">
          {list.map((p) => (
            <button type="button" role="radio" aria-checked={s.manual.employeeId === p.id} key={p.id} className={`person-pick ${s.manual.employeeId === p.id ? 'on' : ''}`} onClick={() => S.manualPatch({ employeeId: p.id })}>
              <Avatar person={p} size={64} /><span><b>{p.short}</b><small>{p.id}</small></span>
            </button>
          ))}
          {!list.length && <p className="muted">Никого не найдено</p>}
        </div>
      </div>
      <footer className="manual-foot"><span /><Button kind="primary" size="xl" disabled={!s.manual.employeeId} onClick={() => S.manualPatch({ step: 2 })}>Далее</Button></footer>
    </>
  );
}

function StepMeal() {
  const s = S.useStore();
  const m = s.manual;
  const main = S.mainMealNow(s);
  const options = [...(main ? [main] : []), ...EXTRAS];
  const ok = m.meal && m.basis && (m.basis !== 'other' || m.comment.trim());
  return (
    <>
      <div className="manual-body two">
        <fieldset>
          <legend>Вид питания</legend>
          {options.map((o) => (
            <label key={o.id} className={`radio-row ${m.meal === o.id ? 'on' : ''}`}><input type="radio" name="meal" checked={m.meal === o.id} onChange={() => S.manualPatch({ meal: o.id })} />{o.label}</label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Основание · обязательно</legend>
          {Object.entries(S.BASIS).map(([id, label]) => (
            <label key={id} className={`radio-row ${m.basis === id ? 'on' : ''}`}><input type="radio" name="basis" checked={m.basis === id} onChange={() => S.manualPatch({ basis: id })} />{label}</label>
          ))}
          <label className="field"><span>Комментарий{m.basis === 'other' ? ' · обязательно' : ''}</span><input placeholder="Что произошло" value={m.comment} onChange={(e) => S.manualPatch({ comment: e.target.value })} /></label>
        </fieldset>
      </div>
      <footer className="manual-foot"><Button size="xl" onClick={() => S.manualPatch({ step: 1 })}>Назад</Button><Button kind="primary" size="xl" disabled={!ok} onClick={() => S.manualPatch({ step: 3 })}>Далее</Button></footer>
    </>
  );
}

function Summary({ extra = [] }) {
  const s = S.useStore();
  const m = s.manual;
  const p = S.person(s, m.employeeId);
  const basis = m.basis === 'other' ? `Другое: ${m.comment}` : S.BASIS[m.basis];
  const rows = [
    ['Сотрудник', <><b>{p?.short}</b> · {p?.id}</>],
    ['Вид питания', mealLabel(m.meal)],
    ['Основание', basis],
    ['Оператор', s.operator.name],
    ['Точка', `${pointName(1)} · ${pointSite(1)}`],
    ['Источник', 'Планшет, вручную · без события терминала'],
    ...extra,
  ];
  return (
    <div className="summary">
      <Avatar person={p} size={120} />
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>
  );
}

function StepConfirm() {
  const s = S.useStore();
  return (
    <>
      <div className="manual-body">
        <Summary />
        <Checkbox checked={s.manual.verified} onChange={(v) => S.manualPatch({ verified: v })}>Личность сотрудника проверена</Checkbox>
      </div>
      <footer className="manual-foot"><Button size="xl" onClick={() => S.manualPatch({ step: 2 })}>Назад</Button><Button kind="primary" size="xl" disabled={!s.manual.verified} onClick={S.manualConfirm}>Подтвердить выдачу</Button></footer>
    </>
  );
}

function Done() {
  const s = S.useStore();
  const m = s.manual;
  return (
    <>
      <div className="manual-body">
        <div className="outcome green"><IconCircleCheck size={30} /><div><h3>Выдано вручную: {mealLabel(m.meal).toLowerCase()}</h3><p>{m.offline ? 'Операция записана в локальный журнал и ждёт отправки в центр.' : 'Операция записана в локальный журнал и отправлена в центр.'}</p></div></div>
        <Summary extra={[['Время', m.time], ['ID записи', <code key="id">{m.eventId}</code>]]} />
      </div>
      <footer className="manual-foot"><span /><Button kind="primary" size="xl" onClick={S.manualClose}>Готово</Button></footer>
    </>
  );
}

function Limit() {
  const s = S.useStore();
  const m = s.manual;
  const p = S.person(s, m.employeeId);
  return (
    <>
      <div className="manual-body">
        <div className="outcome yellow"><IconAlertTriangle size={30} /><div><h3>Ручная выдача невозможна</h3><p>{m.detail} Предложение: ручная операция не обходит лимит.</p></div></div>
        <dl className="kv">
          <div><dt>Сотрудник</dt><dd><b>{p?.short}</b> · {p?.id}</dd></div>
          <div><dt>Вид питания</dt><dd>{mealLabel(m.meal)}</dd></div>
          <div><dt>Результат</dt><dd>Отказано</dd></div>
        </dl>
      </div>
      <footer className="manual-foot"><span /><Button kind="primary" size="xl" onClick={S.manualClose}>Вернуться к терминалам</Button></footer>
    </>
  );
}

function Denied() {
  const s = S.useStore();
  return (
    <>
      <div className="manual-body">
        <div className="outcome red"><IconLock size={30} /><div><h3>Ручная операция недоступна</h3><p>У вашей учётной записи нет права на ручную выдачу. Обратитесь к ответственному на точке.</p></div></div>
        <dl className="kv">
          <div><dt>Пользователь</dt><dd>{s.operator.name}</dd></div>
          <div><dt>Точка</dt><dd>{pointName(1)} · {pointSite(1)}</dd></div>
        </dl>
      </div>
      <footer className="manual-foot"><span /><Button kind="primary" size="xl" onClick={S.manualClose}>Понятно</Button></footer>
    </>
  );
}
