import { useEffect } from 'react';
import { useRoute } from './router.js';
import { Catalog } from './catalog/Catalog.jsx';
import { Stand } from './stand/Stand.jsx';
import { Tablet } from './tablet/Tablet.jsx';
import { Pult } from './tablet/Pult.jsx';
import { Display } from './display/Display.jsx';
import { AdminApp } from './admin/AdminApp.jsx';

const TITLES = { admin: 'Админка', tablet: 'Планшет оператора', display: 'Настенный дисплей', stand: 'Стенд' };

export function App() {
  const { parts, query } = useRoute();
  const [root, ...rest] = parts;
  useEffect(() => { document.title = `${TITLES[root] ?? 'Каталог экранов'} · АСУП Эмбамунайгаз`; }, [root]);
  if (root === 'admin') return <AdminApp parts={rest} query={query} />;
  if (root === 'stand') return <Stand />;
  if (root === 'display') return <Display station={rest[0] === 't2' ? 'Т2' : 'Т1'} />;
  // ?pult=0 — только экран оператора во весь экран, для настоящего планшета
  if (root === 'tablet' && query.get('pult') === '0') return <div className="tablet-full"><Tablet /></div>;
  if (root === 'tablet') return (
    <div className="tablet-page">
      <div className="device-frame"><Tablet /></div>
      <Pult />
    </div>
  );
  return <Catalog />;
}
