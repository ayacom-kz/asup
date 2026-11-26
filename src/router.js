import { useSyncExternalStore } from 'react';

const subscribe = (cb) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
const read = () => decodeURIComponent(window.location.hash.replace(/^#/, '')) || '/';

export function useRoute() {
  const path = useSyncExternalStore(subscribe, read);
  const [pathname, query = ''] = path.split('?');
  return { path, parts: pathname.split('/').filter(Boolean), query: new URLSearchParams(query) };
}
export function go(path) {
  if (read() === path) return;
  window.location.hash = path;
  window.scrollTo(0, 0);
}
export const currentPath = read;
