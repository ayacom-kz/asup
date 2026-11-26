import { useState } from 'react';
import { IconCircleCheck, IconAlertTriangle, IconCloudOff } from '@tabler/icons-react';
import { EXTRAS, MAIN_MEALS, SETTINGS_LEVELS, can } from '../data.js';
import { effectiveSettings, validateSettings, settingsSummaryError } from '../logic.js';
import * as S from '../store.js';
import { go } from '../router.js';
import { Badge, Button, Checkbox, Spinner } from '../ui.jsx';
import { PageHead } from './AdminApp.jsx';


export function Settings({ level, demo }) {
  const s = S.useStore();
  const lv = SETTINGS_LEVELS.find((l) => l.id === level) ?? SETTINGS_LEVELS[0];
  return <SettingsForm key={lv.id + JSON.stringify(s.settings.overrides[lv.id] ?? {}) + s.settings.version} lv={lv} demo={lv.id === 'system' ? demo : null} />;
}

function SettingsForm({ lv, demo }) {
  const s = S.useStore();
  const eff = effectiveSettings(s.settings, lv.id);
  const overlap = demo === 'overlap' ? { ...eff.values, lunch: { ...eff.values.lunch, end: '18:30' } } : null;
  const [v, setV] = useState(overlap ?? eff.values);
  const [touched, setTouched] = useState(overlap ? { lunch: true } : {});
  const [result, setResult] = useState(overlap ? { errors: validateSettings(overlap), summary: settingsSummaryError(validateSettings(overlap)) } : null);
  const [saving, setSaving] = useState(false);
  const editable = can(s.admin.role, 'settings', 'edit');
  const isSystem = lv.id === 'system';
  const dirty = JSON.stringify(v) !== JSON.stringify(eff.values);
  const liveErrors = validateSettings(v);
  const errors = result?.errors ?? {};
  const summary = result?.summary ?? '';
  const up = (k, val) => { setV((x) => ({ ...x, [k]: val })); setTouched((t) => ({ ...t, [k]: true })); setResult(null); S.clearSavedNote(); };

  const tag = (k) => {
    if (touched[k] && dirty) return <Badge tone="yellow">Изменено</Badge>;
    if (!isSystem && eff.source[k] === lv.id) return <Badge tone="blue">Переопределено</Badge>;
    return null;
  };
  const save = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      const r = S.saveSettings(lv.id, v);
      setResult(r.ok ? null : r);
      if (r.ok) setTouched({});
    }, 500);
  };
  const note = s.settings.savedNote;
  const levelName = lv.depth === 2 ? 'столовой №1' : lv.label.toLowerCase();

  return (
    <>
      <PageHead title="Настройки питания" />
      {summary && <div className="note red row"><IconAlertTriangle size={20} /><span>{summary}</span></div>}
      {result?.error === 'save' && <div className="note red row"><IconCloudOff size={20} /><span>Не удалось сохранить: центр не ответил. Значения остались в форме — повторите сохранение.</span></div>}
      {note?.version && isSystem && !dirty && (
        <div className="note green row"><IconCircleCheck size={20} /><span>Версия {note.version} сохранена в центре. Получили {note.got} из 32 точек{note.offline ? `, ${note.offline} ${S.plural(note.offline, 'точка получит', 'точки получат', 'точек получат')} после восстановления связи` : ''}.</span><Button size="sm" onClick={() => go('/admin/monitor')}>Открыть мониторинг</Button></div>
      )}
      {note?.level === lv.id && !dirty && <div className="note green row"><IconCircleCheck size={20} /><span>Сохранено: {lv.label}.</span></div>}
      {!editable && <div className="note blue">Ваша роль позволяет только просматривать настройки.</div>}
      <div className="settings-grid">
        <aside className="panel levels">
          <h3>Уровень настройки</h3>
          <ul>
            {SETTINGS_LEVELS.map((l) => (
              <li key={l.id}><a href={`#/admin/settings?level=${encodeURIComponent(l.id)}`} className={l.id === lv.id ? 'on' : ''} style={{ paddingLeft: 10 + l.depth * 18 }}>{l.label}{s.settings.overrides[l.id] && Object.keys(s.settings.overrides[l.id]).length > 0 && <i className="dot" title="Есть переопределения" />}</a></li>
            ))}
          </ul>
        </aside>
        <div className="settings-main">
          <section className="panel">
            <h3>Окна основного питания · Т1</h3>
            {MAIN_MEALS.map((m) => {
              const err = errors[m.id] || (touched[m.id] && liveErrors[m.id]);
              return (
                <div className={`win-row ${err ? 'has-err' : ''}`} key={m.id}>
                  <b>{m.label}</b>
                  <label className="field"><span>Начало</span><input type="time" value={v[m.id].start} disabled={!editable} className={err ? 'invalid' : ''} onChange={(e) => up(m.id, { ...v[m.id], start: e.target.value })} /></label>
                  <label className="field"><span>Окончание</span><input type="time" value={v[m.id].end} disabled={!editable} className={err ? 'invalid' : ''} onChange={(e) => up(m.id, { ...v[m.id], end: e.target.value })} /></label>
                  <span className="win-tag">{tag(m.id)}</span>
                  {err && <em className="field-error">{err}</em>}
                </div>
              );
            })}
          </section>
          <section className="panel">
            <h3>Дополнительное питание · Т2</h3>
            <div className="row-gap wrap">
              {EXTRAS.map((e) => <Checkbox key={e.id} disabled={!editable} checked={v.extras[e.id]} onChange={(c) => up('extras', { ...v.extras, [e.id]: c })}>{e.label}</Checkbox>)}
              <span className="win-tag">{tag('extras')}</span>
            </div>
            <div className="row-gap"><Checkbox disabled={!editable} checked={v.dryReplacesLunch} onChange={(c) => up('dryReplacesLunch', c)}>Сухой паёк заменяет обед</Checkbox><span className="win-tag">{tag('dryReplacesLunch')}</span></div>
          </section>
          <section className="panel">
            <h3>Синхронизация и часовой пояс</h3>
            <div className="form-grid">
              <label className="field"><span>Интервал синхронизации, мин {tag('syncInterval')}</span><input type="number" min={5} value={v.syncInterval} disabled={!editable} className={(errors.syncInterval || liveErrors.syncInterval) ? 'invalid' : ''} onChange={(e) => up('syncInterval', Number(e.target.value))} />{(errors.syncInterval || liveErrors.syncInterval) && <em className="field-error">{errors.syncInterval || liveErrors.syncInterval}</em>}</label>
              <label className="field"><span>Часовой пояс точки {tag('tz')}</span><select value={v.tz} disabled={!editable} onChange={(e) => up('tz', e.target.value)}><option>UTC+05:00</option><option>UTC+06:00</option></select></label>
            </div>
          </section>
          {editable && (
            <div className="form-foot">
              {isSystem
                ? <Button onClick={() => { setV(eff.values); setTouched({}); setResult(null); }} disabled={!dirty}>Отменить изменения</Button>
                : <Button onClick={() => { S.resetLevel(lv.id); setTouched({}); setResult(null); }} disabled={!s.settings.overrides[lv.id]}>Вернуть значения верхнего уровня</Button>}
              <Button kind="primary" onClick={save} disabled={saving}>{saving ? <><Spinner /> Сохраняем</> : isSystem ? 'Сохранить' : `Сохранить для ${levelName}`}</Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
