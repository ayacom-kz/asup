import { useRef, useState } from 'react';
import { IconSearch, IconChevronRight, IconUserOff, IconCloudOff } from '@tabler/icons-react';
import { MEALS, ORGANIZATIONS, can, mealLabel, pointName, pointSite } from '../data.js';
import * as S from '../store.js';
import { go } from '../router.js';
import { Avatar, Badge, Button, Checkbox, Modal, Spinner, downloadSheet } from '../ui.jsx';
import { PageHead, NotFound } from './AdminApp.jsx';

const STATUS = { active: ['Активен', 'green'], blocked: ['Заблокирован', 'red'] };
const DIST = {
  applied: ['Применено', 'green'], pending: ['Ожидает отправки', 'blue'], error: ['Ошибка', 'red'],
  revoking: ['Отзывается', 'blue'], revoked: ['Отозвано', 'grey'],
};

export function Employees() {
  const s = S.useStore();
  const [q, setQ] = useState('');
  const [org, setOrg] = useState('all');
  const list = s.people.filter((p) => (org === 'all' || p.org === org) && `${p.name} ${p.id} ${p.department} ${p.card}`.toLowerCase().includes(q.toLowerCase()));
  const exportXls = () => downloadSheet(list.map((p) => ({ 'ID': p.id, 'ФИО': p.name, 'Организация': p.org, 'Подразделение': p.department, 'Карта': p.card, 'Статус': STATUS[p.status][0], 'Фото': p.photo ? `v${p.photoVersion}` : 'нет', 'Допуски': p.allowed.map(mealLabel).join(', ') })), 'Сотрудники_ДЕМО');
  return (
    <>
      <PageHead title="Реестр сотрудников"><Button onClick={exportXls}>Выгрузить в Excel</Button></PageHead>
      <div className="toolbar">
        <label className="search"><IconSearch size={19} /><input placeholder="ФИО, табельный ID, подразделение или карта" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск сотрудника" /></label>
        <select className="select" value={org} onChange={(e) => setOrg(e.target.value)} aria-label="Организация"><option value="all">Все организации</option>{ORGANIZATIONS.map((o) => <option key={o}>{o}</option>)}</select>
        <span className="spacer" /><span className="muted">{list.length} сотрудников</span>
      </div>
      <div className="panel table-wrap">
        <table className="tbl">
          <thead><tr><th>Сотрудник</th><th>Организация</th><th>Подразделение</th><th>Карта</th><th>Фото Face ID</th><th>Статус</th><th aria-label="Открыть" /></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} onClick={() => go(`/admin/employees/${p.id}`)}>
                <td><span className="who"><Avatar person={p} size={38} /><span><b>{p.name}</b><small>{p.id}</small></span></span></td>
                <td>{p.org}</td><td>{p.department}</td><td className="mono">{p.card || <span className="muted">не привязана</span>}</td>
                <td>{p.photo ? <Badge tone="green">v{p.photoVersion}</Badge> : p.consent ? <Badge>Нет фото</Badge> : <Badge tone="yellow">Нет согласия</Badge>}</td>
                <td><Badge tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge></td>
                <td><button type="button" className="row-btn" aria-label={`Открыть: ${p.short}`}><IconChevronRight size={18} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <p className="muted pad">Никого не найдено</p>}
      </div>
    </>
  );
}

export function Employee({ id, mode, query }) {
  const s = S.useStore();
  const p = s.people.find((x) => x.id === id);
  const [confirmDel, setConfirmDel] = useState(query?.get('confirm') === 'delete');
  const [confirmBlock, setConfirmBlock] = useState(false);
  const file = useRef(null);
  if (!p) return <NotFound />;
  const role = s.admin.role;
  const edit = can(role, 'employees', 'edit');
  const photoRight = can(role, 'photo', 'edit');
  const editing = mode === 'edit' && edit;
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => S.replacePhoto(p.id, reader.result);
    reader.readAsDataURL(f);
    e.target.value = '';
  };
  return (
    <>
      <PageHead title="Карточка сотрудника" back={['#/admin/employees', 'К списку сотрудников']}>
        {edit && !editing && <>
          <Button onClick={() => setConfirmBlock(true)}>{p.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}</Button>
          <Button kind="primary" onClick={() => go(`/admin/employees/${p.id}/edit`)}>Изменить</Button>
        </>}
      </PageHead>
      <div className="emp-grid">
        <aside className="panel emp-card">
          {p.photo ? <img className="emp-photo" src={p.photo} alt={`Фото: ${p.short}`} /> : <div className="emp-photo none"><IconUserOff size={48} stroke={1.3} /><span>Нет фото</span></div>}
          <h2>{p.name}</h2>
          <p className="muted">Табельный ID {p.id}</p>
          <Badge tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge>
          <dl className="kv">
            <div><dt>Организация</dt><dd>{p.org}</dd></div>
            <div><dt>Подразделение</dt><dd>{p.department}</dd></div>
            <div><dt>Номер карты</dt><dd>{p.card || 'Не привязана'}</dd></div>
            <div><dt>UUID</dt><dd className="mono small">{p.uuid}</dd></div>
          </dl>
        </aside>
        <div className="emp-main">
          {editing ? <EditForm p={p} demoCard={query?.get('card')} /> : (
            <>
              <section className="panel">
                <div className="sec-head">
                  <div><h3>Фото для Face ID</h3><p className="muted">{p.photo ? `Активная версия v${p.photoVersion} · согласие получено` : p.consent ? 'Фото не загружено · согласие получено' : 'Фото не загружено'}</p></div>
                  {photoRight && p.photo && <div className="row-gap"><Button onClick={() => file.current.click()}>Заменить фото</Button><Button onClick={() => setConfirmDel(true)}>Удалить фото</Button></div>}
                </div>
                <input ref={file} type="file" accept="image/*" hidden onChange={onFile} />
                {!p.photo && (
                  <div className="photo-upload">
                    {!p.consent && <div className="note yellow">Нет письменного согласия на обработку фото лица. Загрузка недоступна, пока согласие не отмечено.</div>}
                    <Checkbox checked={p.consent} disabled={!photoRight} onChange={(v) => S.patchEmployee(p.id, { consent: v })}>Письменное согласие получено</Checkbox>
                    <div className="row-gap">
                      <Button kind="primary" disabled={!p.consent || !photoRight} onClick={() => file.current.click()}>Загрузить фото</Button>
                      {p.consent && photoRight && <Button onClick={() => S.replacePhoto(p.id, './assets/portraits/P10004.jpg')}>Демо: взять тестовое фото</Button>}
                    </div>
                  </div>
                )}
                {p.distribution.length > 0 && (
                  <div className="table-wrap inner">
                    <table className="tbl compact">
                      <thead><tr><th>Терминал</th><th>Распространение</th><th>Версия на нём</th><th aria-label="Действие" /></tr></thead>
                      <tbody>
                        {p.distribution.map((d, i) => (
                          <tr key={i}>
                            <td><b>{pointName(d.pointId)} · {d.terminal}</b><small>{pointSite(d.pointId)}</small></td>
                            <td><Badge tone={DIST[d.status][1]}>{(d.status === 'pending' || d.status === 'revoking') && <Spinner size={10} />} {DIST[d.status][0]}</Badge>{d.status === 'error' && <small>Терминал не отвечает</small>}</td>
                            <td>{d.status === 'revoked' ? '—' : `v${d.version}`}</td>
                            <td>{d.status === 'error' && photoRight && <Button size="sm" onClick={() => S.retryDistribution(p.id, i)}>Повторить</Button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className="panel">
                <h3>Допуски к питанию</h3>
                <div className="allow-grid">{MEALS.map((m) => <Checkbox key={m.id} checked={p.allowed.includes(m.id)} disabled>{m.label}</Checkbox>)}</div>
              </section>
            </>
          )}
        </div>
      </div>
      {confirmDel && (
        <Modal title="Удалить фото?" onClose={() => setConfirmDel(false)} actions={<span />} width={520}>
          <p>{p.name}, {p.id}. Центр отправит отзыв фото на терминалы. Пока терминал не подтвердил отзыв, фото на нём может оставаться активным.</p>
          <div className="modal-actions"><Button onClick={() => setConfirmDel(false)}>Отмена</Button><Button kind="danger" onClick={() => { S.deletePhoto(p.id); setConfirmDel(false); }}>Удалить и отозвать</Button></div>
        </Modal>
      )}
      {confirmBlock && (
        <Modal title={p.status === 'blocked' ? 'Разблокировать сотрудника?' : 'Заблокировать сотрудника?'} onClose={() => setConfirmBlock(false)} actions={<span />} width={520}>
          <p>{p.name}, {p.id}. {p.status === 'blocked' ? 'Сотрудник снова сможет получать питание по своим допускам.' : 'Терминалы будут отказывать с причиной «Доступ заблокирован». Записи журнала сохраняются.'}</p>
          <div className="modal-actions"><Button onClick={() => setConfirmBlock(false)}>Отмена</Button><Button kind={p.status === 'blocked' ? 'primary' : 'danger'} onClick={() => { S.patchEmployee(p.id, { status: p.status === 'blocked' ? 'active' : 'blocked' }); setConfirmBlock(false); }}>{p.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}</Button></div>
        </Modal>
      )}
    </>
  );
}

function EditForm({ p, demoCard }) {
  const [form, setForm] = useState({ card: demoCard ?? p.card, department: p.department, org: p.org, status: p.status, allowed: [...p.allowed] });
  const [errors, setErrors] = useState(demoCard ? { card: 'Эта активная карта уже привязана к другому сотруднику' } : {});
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const up = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      const r = S.saveEmployee(p.id, form);
      if (r.error) { setSaveError(true); setErrors({}); return; }
      setSaveError(false);
      if (r.errors) { setErrors(r.errors); return; }
      go(`/admin/employees/${p.id}`);
    }, 500);
  };
  return (
    <section className="panel form">
      <h3>Редактирование</h3>
      {saveError && (
        <div className="note red row"><IconCloudOff size={20} /><span>Не удалось сохранить: центр не ответил. Введённые данные остались в форме.</span></div>
      )}
      {Object.keys(errors).length > 0 && <div className="note red">Изменения не сохранены. Исправьте поле с ошибкой.</div>}
      <div className="form-grid">
        <label className="field"><span>Табельный ID</span><input value={p.id} disabled /></label>
        <label className="field"><span>Номер карты</span><input value={form.card} onChange={(e) => up({ card: e.target.value })} className={errors.card ? 'invalid' : ''} placeholder="Не привязана" />{errors.card && <em className="field-error">{errors.card}</em>}</label>
        <label className="field"><span>Организация</span><select value={form.org} onChange={(e) => up({ org: e.target.value })}>{ORGANIZATIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label className="field"><span>Подразделение</span><input value={form.department} onChange={(e) => up({ department: e.target.value })} className={errors.department ? 'invalid' : ''} />{errors.department && <em className="field-error">{errors.department}</em>}</label>
      </div>
      <Checkbox checked={form.status === 'active'} onChange={(v) => up({ status: v ? 'active' : 'blocked' })}>Сотрудник активен</Checkbox>
      <h4>Допуски к питанию</h4>
      <div className="allow-grid">{MEALS.map((m) => <Checkbox key={m.id} checked={form.allowed.includes(m.id)} onChange={(v) => up({ allowed: v ? [...form.allowed, m.id] : form.allowed.filter((x) => x !== m.id) })}>{m.label}</Checkbox>)}</div>
      <div className="form-foot">
        <Button onClick={() => go(`/admin/employees/${p.id}`)}>Отмена</Button>
        <Button kind="primary" onClick={save} disabled={saving}>{saving ? <><Spinner /> Сохраняем</> : saveError ? 'Повторить сохранение' : 'Сохранить'}</Button>
      </div>
    </section>
  );
}
