import { IconDeviceDesktop, IconDeviceTablet, IconDeviceTv, IconPresentation, IconExternalLink, IconRefresh } from '@tabler/icons-react';
import * as S from '../store.js';
import { go } from '../router.js';
import { Logo, Button } from '../ui.jsx';
import { GROUPS } from './presets.js';

const DEVICES = {
  admin: { icon: IconDeviceDesktop, label: 'ПК в центре · админка T-056' },
  tablet: { icon: IconDeviceTablet, label: 'Планшет оператора · T-058' },
  display: { icon: IconDeviceTv, label: 'Настенный дисплей у терминала' },
};

export function Catalog() {
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="catalog">
      <header className="cat-head">
        <Logo />
        <div>
          <h1>АСУП · прототип админки и планшета</h1>
          <p className="muted">Кликабельный прототип на тестовых данных. Все экраны работают на общих данных: событие на планшете появляется в журнале админки. {total} состояний.</p>
        </div>
        <Button icon={IconRefresh} onClick={() => S.resetAll()}>Сбросить демо-данные</Button>
      </header>

      <section className="cat-entry">
        <a className="entry primary" href="#/stand" onClick={(e) => { e.preventDefault(); if (!S.getState().operator) S.operatorLogin('operator', 'demo'); go('/stand'); }}>
          <IconPresentation size={30} /><b>Стенд для презентации</b><span>Планшет оператора + настенные дисплеи Т1/Т2 + демо-пульт на одном экране</span>
        </a>
        <a className="entry" href="#/admin/journal"><IconDeviceDesktop size={30} /><b>Админка</b><span>Вход: admin / demo · engineer · buh</span></a>
        <a className="entry" href="#/tablet"><IconDeviceTablet size={30} /><b>Планшет оператора</b><span>operator / demo · пульт под экраном</span></a>
        <a className="entry" href="#/display/t1"><IconDeviceTv size={30} /><b>Настенный дисплей</b><span>Для сотрудников: можно / нельзя</span></a>
      </section>
      <p className="muted small">Совет: откройте админку и стенд в двух вкладках рядом — проведите сотрудника на стенде, запись появится в журнале.</p>

      {GROUPS.map((g) => {
        const D = DEVICES[g.device];
        return (
          <section key={g.id} className="cat-group">
            <h2><D.icon size={20} /> {g.title}</h2>
            <div className="cat-items">
              {g.items.map((it) => (
                <article key={it.title} className="cat-item">
                  <div>
                    <b>{it.title}</b>
                    {it.note && <small>{it.note}</small>}
                  </div>
                  <div className="cat-actions">
                    <Button size="sm" kind="primary" onClick={() => it.run()}>Открыть</Button>
                    {it.file && <a className="btn sm ghost" href={`./mockups/${it.file}.dc.html`} target="_blank" rel="noreferrer" title="Исходный макет для сравнения">Макет <IconExternalLink size={13} /></a>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
      <footer className="muted small cat-foot">Демо-данные хранятся в этом браузере и сбрасываются кнопкой выше. Реальное оборудование и персональные данные не используются.</footer>
    </div>
  );
}
