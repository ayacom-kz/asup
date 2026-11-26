import { useEffect, useRef, useState } from 'react';
import { Tablet } from '../tablet/Tablet.jsx';
import { Pult } from '../tablet/Pult.jsx';
import { Display } from '../display/Display.jsx';

// Рисует экран в его настоящем размере и масштабирует под ширину колонки
export function Scaled({ width, height, children, label }) {
  const box = useRef(null);
  const [k, setK] = useState(1);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setK(Math.min(1, e.contentRect.width / width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [width]);
  return (
    <figure className="scaled" ref={box} style={{ height: height * k }}>
      <div className="device" style={{ width, height, transform: `scale(${k})` }}>{children}</div>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  );
}

export function Stand() {
  return (
    <div className="stand">
      <div className="stand-main">
        <Scaled width={1280} height={800}><Tablet /></Scaled>
        <p className="stand-cap">Планшет оператора · стойка выдачи · 1280×800</p>
      </div>
      <aside className="stand-side">
        <Scaled width={1280} height={800}><Display station="Т1" /></Scaled>
        <p className="stand-cap">Настенный дисплей у Т1 · для сотрудников</p>
        <Scaled width={1280} height={800}><Display station="Т2" /></Scaled>
        <p className="stand-cap">Настенный дисплей у Т2</p>
      </aside>
      <div className="stand-pult"><Pult /></div>
    </div>
  );
}
