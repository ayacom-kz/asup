import { useState } from 'react';
import { IconLock, IconSearch, IconClockOff, IconAdjustments, IconX } from '@tabler/icons-react';
import { ROLE_LABEL, RIGHTS, can } from '../data.js';
import * as S from '../store.js';
import { go, currentPath } from '../router.js';
import { Button, Logo, Empty } from '../ui.jsx';
import { Journal, JournalConflict } from './Journal.jsx';
import { Employees, Employee } from './Employees.jsx';
import { Settings } from './Settings.jsx';
import { Monitor, MonitorPoint } from './Monitor.jsx';
import { Registry, Finance } from './Finance.jsx';

const NAV = [
  { id: 'journal', label: 'Журнал событий', right: 'journal' },
  { id: 'employees', label: 'Сотрудники', right: 'employees' },
  { id: 'settings', label: 'Настройки', right: 'settings' },
  { id: 'monitor', label: 'Мониторинг', right: 'monitor' },
  { id: 'registry', label: 'Реестр списаний', right: 'finance' },
  { id: 'finance', label: 'Взаиморасчёты', right: 'finance' },
];

export function AdminApp({ parts, query }) {
  const s = S.useStore();
  const [section = 'journal', id, sub] = parts;
  if (section === 'login' || !s.admin) return <Login key={query.get('e') || ''} initialError={query.get('e')} />;
  const role = s.admin.role;
  const navItem = NAV.find((n) => n.id === section);

  let content;
  if (s.faults.session) content = <SessionExpired section={section} />;
  else if (section === 'roles') content = <Roles />;
  else if (!navItem) content = <NotFound />;
  else if (!can(role, navItem.right)) content = <Forbidden />;
  else if (section === 'journal') content = id === 'conflict' ? <JournalConflict /> : <Journal openId={id} />;
  else if (section === 'employees') content = id ? <Employee key={id + (sub || '')} id={id} mode={sub} query={query} /> : <Employees />;
  else if (section === 'settings') content = <Settings level={query.get('level') || 'system'} demo={query.get('demo')} />;
  else if (section === 'monitor') content = id ? <MonitorPoint id={Number(id)} tab={sub} /> : <Monitor />;
  else if (section === 'registry') content = <Registry />;
  else if (section === 'finance') content = <Finance />;

  return (
    <div className="admin">
      <div className="admin-wrap">
        <header className="admin-head">
          <a href="#/admin/journal" aria-label="На главную"><Logo /></a>
          <div className="admin-user">
            <div><b>{s.admin.name}</b><small>{ROLE_LABEL[role]}</small></div>
            <Button onClick={() => go('/admin/roles')}>Роли</Button>
            <Button onClick={() => { S.adminLogout(); go('/admin/login'); }}>Выйти</Button>
          </div>
        </header>
        {section !== 'roles' && (
          <nav className="admin-nav" aria-label="Разделы">
            {NAV.filter((n) => can(role, n.right)).map((n) => (
              <a key={n.id} href={`#/admin/${n.id}`} className={section === n.id ? 'on' : ''} aria-current={section === n.id ? 'page' : undefined}>{n.label}</a>
            ))}
          </nav>
        )}
        <main className="admin-main">{content}</main>
      </div>
      <DemoPanel />
    </div>
  );
}

export function PageHead({ title, sub, children, back }) {
  return (
    <>
      {back && <a className="back-link" href={back[0]}>← {back[1]}</a>}
      <div className="page-head">
        <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
        {children && <div className="page-actions">{children}</div>}
      </div>
    </>
  );
}

function Login({ initialError }) {
  const s = S.useStore();
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError || '');
  const submit = (e) => {
    e.preventDefault();
    const r = S.adminLogin(login, password);
    setError(r || '');
    if (!r) {
      const back = s.returnTo;
      S.set({ returnTo: null });
      // Открыли ссылку на раздел без входа — остаёмся на ней
      if (!currentPath().startsWith('/admin/login') && currentPath() !== '/admin') return;
      go(back && !back.includes('login') ? back : '/admin/journal');
    }
  };
  const msg = {
    invalid: <div className="field-error" role="alert">Неверный логин или пароль</div>,
    disabled: <div className="note red" role="alert">Доступ для этой учётной записи отключён. Обратитесь к администратору системы.</div>,
    offline: <div className="note red" role="alert">Сервер не отвечает. Проверьте подключение и повторите вход.</div>,
  };
  return (
    <div className="admin-login">
      <form className="login-card" onSubmit={submit} noValidate>
        <Logo height={44} />
        <h1>Вход в систему учёта</h1>
        <p className="muted">Центральная административная панель</p>
        {s.returnTo && <div className="note blue">Сессия завершена. После входа откроется та же страница.</div>}
        {error === 'disabled' && msg.disabled}
        {error === 'offline' && msg.offline}
        <label className="field"><span>Логин</span><input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" className={error === 'invalid' ? 'invalid' : ''} /></label>
        <label className="field"><span>Пароль</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="demo" className={error === 'invalid' ? 'invalid' : ''} /></label>
        {error === 'invalid' && msg.invalid}
        <Button kind="primary" size="lg" type="submit">{error === 'offline' ? 'Повторить вход' : 'Войти'}</Button>
        <p className="muted small">Нет доступа или забыли пароль — обратитесь к администратору системы.</p>
      </form>
      <DemoPanel />
    </div>
  );
}

function SessionExpired({ section }) {
  return (
    <>
      <PageHead title={NAV.find((n) => n.id === section)?.label ?? 'Раздел'} />
      <div className="panel blurred-wrap">
        <Empty icon={IconClockOff} title="Сессия завершена" text="Войдите снова, чтобы продолжить.">
          <Button kind="primary" onClick={() => { S.adminLogout(currentPath()); S.setFault('session', false); go('/admin/login'); }}>Войти снова</Button>
        </Empty>
      </div>
    </>
  );
}

export function Forbidden() {
  return (
    <div className="panel center-page">
      <Empty icon={IconLock} title="Нет доступа к разделу" text="Ваша роль не позволяет открыть эту страницу.">
        <Button kind="primary" onClick={() => go('/admin/journal')}>Вернуться в журнал</Button>
      </Empty>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="panel center-page">
      <Empty icon={IconSearch} title="Страница или запись не найдена">
        <Button kind="primary" onClick={() => go('/admin/journal')}>Вернуться в журнал</Button>
      </Empty>
    </div>
  );
}

function Roles() {
  const s = S.useStore();
  const tone = (v) => (v === 'Нет' ? 'no' : v === 'Просмотр' ? 'view' : 'full');
  return (
    <>
      <PageHead title="Доступ по ролям" sub="Предложение · не утверждено" back={['#/admin/journal', 'Вернуться в журнал']} />
      <div className="panel table-wrap">
        <table className="tbl roles">
          <thead><tr><th>Раздел или действие</th>{Object.entries(ROLE_LABEL).map(([k, v]) => <th key={k} className={s.admin.role === k ? 'me' : ''}>{v}{s.admin.role === k && <small> · вы</small>}</th>)}</tr></thead>
          <tbody>{RIGHTS.map((r) => <tr key={r.id}><td><b>{r.label}</b></td>{['admin', 'engineer', 'accountant'].map((k) => <td key={k}><span className={`right ${tone(r[k])}`}>{r[k]}</span></td>)}</tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

// Панель демо-сбоев: не часть интерфейса админки
function DemoPanel() {
  const s = S.useStore();
  const [open, setOpen] = useState(false);
  const f = s.faults;
  const toggles = [
    ['load', 'Центр не отвечает на загрузку журнала'],
    ['save', 'Ошибка сохранения (карточка, настройки)'],
    ['session', 'Сессия истекла'],
    ['stale', 'Мониторинг: нет связи с сервером'],
    ['centerDown', 'Вход: центр недоступен'],
  ];
  if (!open) return <button type="button" className="demo-fab" onClick={() => setOpen(true)}><IconAdjustments size={18} /> Демо</button>;
  return (
    <aside className="demo-panel" aria-label="Демо-управление">
      <header><b>Демо · не часть интерфейса</b><button type="button" className="icon-btn" aria-label="Закрыть" onClick={() => setOpen(false)}><IconX size={18} /></button></header>
      {toggles.map(([k, label]) => (
        <label key={k} className="switch-row"><input type="checkbox" checked={!!f[k]} onChange={(e) => S.setFault(k, e.target.checked)} />{label}</label>
      ))}
      <label className="switch-row"><input type="checkbox" checked={s.centerEmpty} onChange={(e) => S.setCenterEmpty(e.target.checked)} />Пустой журнал</label>
      <div className="demo-actions">
        <Button size="sm" onClick={() => { S.injectConflict(); go('/admin/journal'); }}>Добавить офлайн-конфликт</Button>
        <Button size="sm" onClick={() => window.open('#/stand', '_blank')}>Открыть стенд (планшет)</Button>
      </div>
    </aside>
  );
}
