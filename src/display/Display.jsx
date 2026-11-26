import { IconCheck, IconX, IconScan, IconQuestionMark, IconWifiOff } from '@tabler/icons-react';
import { mealLabel, pointName, RESULT_MS } from '../data.js';
import * as S from '../store.js';
import { Logo, useCountdown } from '../ui.jsx';

// Настенный дисплей у терминала: показывает сотруднику только результат — можно или нельзя.
// Без меню и кнопок, читается с 2–3 метров. Имя — с инициалом фамилии, без фото (персональные данные).
const shortName = (p) => { const [first, last] = p.short.split(' '); return `${first} ${last?.[0] ?? ''}.`; };

const SHORT_REASON = {
  'Лимит питания уже использован': (m) => `${mealLabel(m)} уже получен сегодня`,
  'Вне времени основного приёма': () => 'Сейчас нет основного приёма',
  'Рацион недоступен': () => 'Этот вид питания вам недоступен',
  'Доступ заблокирован': () => 'Доступ заблокирован',
};

export function Display({ station }) {
  const s = S.useStore();
  const t = s.term[station];
  const left = useCountdown(t?.phase === 'done' ? t.at : null, RESULT_MS);
  const main = S.mainMealNow(s);
  const isT1 = station === 'Т1';
  const p = t?.employeeId ? S.person(s, t.employeeId) : null;

  let tone = 'idle', icon = <IconScan size={150} stroke={1.2} />, title, sub, hint;
  if (!t) {
    if (isT1) {
      title = main ? 'Посмотрите в камеру' : 'Основной приём не идёт';
      sub = main ? `${main.label} · ${main.start}–${main.end}` : 'Дополнительное питание — у терминала Т2';
    } else {
      title = s.extra ? 'Посмотрите в камеру' : 'Назовите позицию оператору';
      sub = s.extra ? `Выбрано: ${mealLabel(s.extra).toLowerCase()}` : 'Ночное питание · вода · сухой паёк';
    }
  } else if (t.phase === 'pending') {
    tone = 'pending'; title = 'Проверяем…'; sub = 'Не отходите от терминала';
  } else if (t.pass) {
    tone = 'ok'; icon = <IconCheck size={170} stroke={2.2} />; title = 'Лицо распознано'; sub = p ? shortName(p) : ''; hint = 'Тестовое событие терминала';
  } else if (!p) {
    tone = 'unknown'; icon = <IconQuestionMark size={170} stroke={2} />; title = 'Не удалось распознать'; sub = 'Обратитесь к оператору столовой';
  } else if (t.ok) {
    tone = 'ok'; icon = <IconCheck size={170} stroke={2.2} />; title = 'Можно'; sub = shortName(p); hint = `${mealLabel(t.meal)} · приятного аппетита`;
  } else {
    tone = 'no'; icon = <IconX size={170} stroke={2.2} />; title = 'Нельзя'; sub = shortName(p);
    hint = SHORT_REASON[t.reason]?.(t.meal) ?? t.reason;
  }

  return (
    <div className={`wall tone-${tone}`} aria-live="assertive">
      <header className="wall-head">
        <Logo height={38} />
        <span className="wall-where">{pointName(1)} · {isT1 ? 'Т1 · основное питание' : 'Т2 · дополнительное'}</span>
        <span className="wall-time">{s.time}</span>
      </header>
      <main className="wall-main">
        <div className={`wall-icon ${tone === 'pending' ? 'spin' : ''}`}>{icon}</div>
        <h1>{title}</h1>
        {sub && <p className="wall-sub">{sub}</p>}
        {hint && <p className="wall-hint">{hint}</p>}
      </main>
      <footer className="wall-foot">
        {s.link === 'off' ? <span><IconWifiOff size={18} /> Работа без связи с центром — запись сохраняется на точке</span> : <span />}
        {t?.phase === 'done' && !s.hold && <span>{left} с</span>}
      </footer>
    </div>
  );
}
