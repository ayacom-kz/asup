import { useEffect, useRef, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { DEMO_DATE } from './data.js';

export const Logo = ({ height = 42 }) => <img className="logo" src="./assets/emba-logo.svg" alt="ЭмбаМунайГаз" style={{ height }} />;

export function Button({ children, kind = '', size = '', icon: Icon, ...props }) {
  return (
    <button type="button" className={`btn ${kind} ${size}`} {...props}>
      {Icon && <Icon size={18} stroke={1.8} aria-hidden />}
      {children}
    </button>
  );
}

export const Badge = ({ tone = 'grey', children, ...p }) => <span className={`badge ${tone}`} {...p}>{children}</span>;

export function Avatar({ person, size = 38 }) {
  if (!person?.photo) return <span className="avatar no-photo" style={{ width: size, height: size }} aria-label="Нет фото">{person?.short?.[0] ?? '?'}</span>;
  return <img className="avatar" src={person.photo} alt="" style={{ width: size, height: size }} />;
}

export function Modal({ title, onClose, children, width = 580, actions }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} style={{ width }}>
        <header className="modal-head">
          <h2>{title}</h2>
          {actions ?? <Button onClick={onClose}>Закрыть</Button>}
        </header>
        {children}
      </section>
    </div>
  );
}

export const Empty = ({ title, text, icon: Icon, children }) => (
  <div className="empty">
    {Icon && <span className="empty-icon"><Icon size={30} stroke={1.5} /></span>}
    <h3>{title}</h3>
    {text && <p>{text}</p>}
    {children}
  </div>
);

export const Spinner = ({ size = 18 }) => <span className="spinner" style={{ width: size, height: size }} aria-hidden />;

export function Checkbox({ checked, onChange, children, disabled }) {
  return (
    <label className={`check ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function useToast() {
  const [msg, setMsg] = useState('');
  const t = useRef();
  const show = (m) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(''), 3200); };
  const node = msg ? <div className="toast" role="status">{msg}</div> : null;
  return [node, show];
}

// Демо-таймер для «вернётся в ожидание через N секунд»
export function useCountdown(atMs, totalMs) {
  const [, tick] = useState(0);
  useEffect(() => { if (!atMs) return; const i = setInterval(() => tick((x) => x + 1), 250); return () => clearInterval(i); }, [atMs]);
  if (!atMs) return 0;
  return Math.max(0, Math.ceil((atMs + totalMs - Date.now()) / 1000));
}

export function downloadSheet(rows, name) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Нет данных': '' }]);
  ws['!cols'] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.min(45, Math.max(14, k.length + 3)) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Данные');
  XLSX.writeFile(wb, `${name}_${DEMO_DATE}.xlsx`);
}
