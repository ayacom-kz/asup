import { IconExternalLink, IconUserQuestion } from '@tabler/icons-react';
import { DEMO_TIMES } from '../data.js';
import * as S from '../store.js';

// Демо-пульт: имитирует терминалы, время и связь. Не входит в интерфейс оператора.
export function Pult({ links = true }) {
  const s = S.useStore();
  const mode = s.pultMode ?? 'meal';
  const local = s.local.length;
  const inCenter = s.center.filter((r) => s.local.some((l) => l.eventId === r.eventId)).length;
  const pending = S.pendingCount(s);
  const people = s.people.filter((p) => p.photo);
  const busy = s.term[s.station]?.phase === 'pending';
  const tap = (id) => (mode === 'pass' ? S.terminalEvent(id) : S.recognize(id));
  return (
    <section className="pult" aria-label="Демо-пульт">
      <div className="pult-head">
        <b>Демо-пульт · не часть экрана оператора</b>
        <span className="pult-count" title="Сверка точки и центра по eventId">На точке: {local} · в центре: {inCenter} · ожидают: {pending}</span>
      </div>
      <div className="pult-row">
        <span className="pult-label">Терминал</span>
        <div className="seg">
          {['Т1', 'Т2'].map((t) => <button type="button" key={t} className={s.station === t ? 'on' : ''} onClick={() => S.selectStation(t)}>{t}</button>)}
        </div>
        <span className="pult-label">Событие</span>
        <div className="seg">
          <button type="button" className={mode === 'meal' ? 'on' : ''} onClick={() => S.set({ pultMode: 'meal' })} title="Распознавание и проверка права на питание">Выдача</button>
          <button type="button" className={mode === 'pass' ? 'on' : ''} onClick={() => S.set({ pultMode: 'pass' })} title="Тестовое событие терминала без выдачи (сценарий 1)">Только событие терминала</button>
        </div>
      </div>
      <div className="pult-row">
        <span className="pult-label">Подходит к {s.station}:</span>
        {people.map((p) => (
          <button type="button" key={p.id} className="face-btn" onClick={() => tap(p.id)} disabled={busy || !s.operator} title={`${p.short} · ${p.id}`} aria-label={`Подходит: ${p.short}`}>
            <img src={p.photo} alt="" /><span>{p.short.split(' ')[0]}</span>
          </button>
        ))}
        <button type="button" className="face-btn unknown" onClick={() => S.recognize(null)} disabled={busy || !s.operator || mode === 'pass'} aria-label="Неизвестное лицо">
          <span className="q"><IconUserQuestion size={26} /></span><span>Неизвестный</span>
        </button>
      </div>
      <div className="pult-row">
        <span className="pult-label">Время</span>
        <div className="seg">{DEMO_TIMES.map((t) => <button type="button" key={t} className={s.time === t ? 'on' : ''} onClick={() => S.setTime(t)}>{t}</button>)}</div>
        <span className="pult-label">Связь</span>
        <div className="seg">
          {[['lan', 'LAN'], ['sim', 'Только SIM'], ['off', 'Нет связи']].map(([id, l]) => <button type="button" key={id} className={s.link === id ? 'on' : ''} onClick={() => S.setLink(id)}>{l}</button>)}
        </div>
        <button type="button" className="btn" onClick={S.redeliver}>Повторить доставку</button>
        <label className="pult-check"><input type="checkbox" checked={!!s.hold} onChange={(e) => S.setHold(e.target.checked)} />Держать результат</label>
        <button type="button" className="btn" onClick={S.clearScreens}>Сбросить экраны</button>
        <button type="button" className="btn" onClick={() => { if (confirmReset()) S.resetAll(); }}>Начать заново</button>
      </div>
      {!s.operator && <p className="pult-warn">Оператор не вошёл: войдите на экране планшета (operator / demo).</p>}
      <ol className="pult-log">{s.log.slice(0, 3).map((l, i) => <li key={i + l}>{l}</li>)}</ol>
      {links && (
        <div className="pult-links">
          <a href="#/admin/journal" target="_blank" rel="noreferrer">Админка: журнал <IconExternalLink size={14} /></a>
          <a href="#/display/t1" target="_blank" rel="noreferrer">Настенный дисплей Т1 <IconExternalLink size={14} /></a>
          <a href="#/display/t2" target="_blank" rel="noreferrer">Настенный дисплей Т2 <IconExternalLink size={14} /></a>
          <a href="#/stand">Стенд: всё на одном экране</a>
          <a href="#/">Каталог экранов</a>
        </div>
      )}
    </section>
  );
}

// Сброс без системного диалога: двойное нажатие в течение 3 секунд
let armed = 0;
function confirmReset() {
  if (Date.now() - armed < 3000) { armed = 0; return true; }
  armed = Date.now();
  S.set((s) => ({ log: ['Нажмите «Начать заново» ещё раз, чтобы сбросить все демо-данные.', ...s.log] }));
  return false;
}
