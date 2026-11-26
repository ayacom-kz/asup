// Тестовые данные прототипа. Персональные данные вымышленные.
export const DEMO_DATE = '2026-10-13';
export const DEMO_TIMES = ['07:40', '13:10', '19:20', '23:30'];
export const SYNC_MIN = 5;
export const RESULT_MS = 8000;

// Т1: основной приём пищи определяется автоматически по окну
export const MAIN_MEALS = [
  { id: 'breakfast', label: 'Завтрак', start: '06:00', end: '09:00' },
  { id: 'lunch', label: 'Обед', start: '12:00', end: '15:00' },
  { id: 'dinner', label: 'Ужин', start: '18:00', end: '21:00' },
];
// Т2: дополнительное питание выбирает оператор. Состав уточняется с заказчиком
export const EXTRAS = [
  { id: 'night', label: 'Ночное питание' },
  { id: 'water', label: 'Вода' },
  { id: 'dry', label: 'Сухой паёк' },
];
export const MEALS = [...MAIN_MEALS, ...EXTRAS];
export const mealLabel = (id) => MEALS.find((m) => m.id === id)?.label ?? '—';

export const ORGANIZATIONS = ['АО «Эмбамунайгаз»', 'ТОО «КазТрансСервис»', 'ТОО «БурСервис Восток»', 'ТОО «НефтеСпецСтрой»'];

const portrait = (id) => `./assets/portraits/${id}.jpg`;
const dist = (v, s3 = 'error') => [
  { pointId: 1, terminal: 'Т1', status: 'applied', version: v },
  { pointId: 1, terminal: 'Т2', status: 'applied', version: v },
  { pointId: 2, terminal: 'Т1', status: 'pending', version: v - 1 },
  { pointId: 3, terminal: 'Т1', status: s3, version: v - 1 },
];

export const PEOPLE = [
  { id: 'P10001', short: 'Арман Алиев', name: 'Алиев Арман Бауржанович', org: ORGANIZATIONS[0], department: 'ЦДНГ-1 · Добыча нефти', card: '0012458931' },
  { id: 'P10002', short: 'Виктор Сергеев', name: 'Сергеев Виктор Николаевич', org: ORGANIZATIONS[0], department: 'Служба главного механика', card: '0012458932' },
  { id: 'P10003', short: 'Данияр Жумабеков', name: 'Жумабеков Данияр Касымович', org: ORGANIZATIONS[1], department: 'Транспортный цех', card: '0012458933' },
  { id: 'P10004', short: 'Елена Кузнецова', name: 'Кузнецова Елена Павловна', org: ORGANIZATIONS[2], department: 'Буровая бригада №4', card: '0012458934' },
  { id: 'P10005', short: 'Бахтияр Нурланов', name: 'Нурланов Бахтияр Серикович', org: ORGANIZATIONS[3], department: 'Строительно-монтажный участок', card: '0012458935' },
  { id: 'P10006', short: 'Андрей Иванов', name: 'Иванов Андрей Михайлович', org: ORGANIZATIONS[0], department: 'Энергослужба', card: '0012458936' },
].map((p, i) => ({
  ...p,
  uuid: `5e1f0c2a-0000-4000-9000-00000000000${i + 1}`,
  photo: portrait(p.id),
  photoVersion: 2,
  consent: true,
  status: 'active',
  allowed: MEALS.map((m) => m.id),
  distribution: dist(2, i === 0 ? 'error' : 'applied'),
})).concat([{
  // Новый сотрудник без согласия на фото (макет EmployeeNoConsent)
  id: 'P10007', short: 'Сауле Омарова', name: 'Омарова Сауле Ериковна', org: ORGANIZATIONS[1], department: 'Хозяйственная служба', card: '',
  uuid: '5e1f0c2a-0000-4000-9000-000000000007', photo: null, photoVersion: 0, consent: false, status: 'active',
  allowed: ['breakfast', 'lunch', 'dinner'], distribution: [],
}]);

const SITES = ['Прорва', 'Кенбай', 'Доссор', 'Макат', 'Кульсары', 'Центральный узел'];
export const POINTS = Array.from({ length: 32 }, (_, i) => {
  const id = i + 1;
  const base = { id, name: `Столовая №${id}`, site: SITES[i % 6], pc: 'online', channel: 'LAN', contact: `13:${String(5 + (i % 5)).padStart(2, '0')}`, dict: 13, queue: 0, terminals: { 'Т1': 'online', 'Т2': 'online' }, terminalLast: { 'Т1': '13:06', 'Т2': '13:02' } };
  if (id === 12) return { ...base, pc: 'offline', channel: null, contact: '12:41', dict: 12, queue: 14, terminals: { 'Т1': 'unknown', 'Т2': 'unknown' }, terminalLast: { 'Т1': '12:39', 'Т2': '12:22' } };
  if (id === 4) return { ...base, contact: '13:09', terminals: { 'Т1': 'offline', 'Т2': 'online' }, terminalLast: { 'Т1': '12:58', 'Т2': '13:02' } };
  if (id === 23) return { ...base, pc: 'lagging', contact: '13:08', dict: 11, queue: 6 };
  if (id === 7 || id === 19) return { ...base, channel: 'SIM', contact: id === 7 ? '13:09' : '13:08' };
  return base;
});
export const pointName = (id) => POINTS.find((p) => p.id === id)?.name ?? `Точка ${id}`;
export const pointSite = (id) => POINTS.find((p) => p.id === id)?.site ?? '';

// Учётные записи демо. Пароль у всех: demo
export const ADMIN_USERS = [
  { login: 'admin', role: 'admin', name: 'Демо-администратор' },
  { login: 'engineer', role: 'engineer', name: 'Демо-инженер' },
  { login: 'buh', role: 'accountant', name: 'Демо-бухгалтер' },
  { login: 'blocked', role: 'admin', name: 'Отключённая учётка', disabled: true },
];
export const OPERATORS = [
  { login: 'operator', name: 'Демо-оператор', manual: true },
  { login: 'operator2', name: 'Оператор без права ручной выдачи', manual: false },
];
export const ROLE_LABEL = { admin: 'Администратор', engineer: 'Инженер', accountant: 'Бухгалтерия' };

// Матрица прав — предложение на согласование (макет Roles)
export const RIGHTS = [
  { id: 'journal', label: 'Журнал событий', admin: 'Просмотр', engineer: 'Просмотр', accountant: 'Просмотр' },
  { id: 'correction', label: 'Корректировка записи', admin: 'Создание', engineer: 'Нет', accountant: 'Нет' },
  { id: 'employees', label: 'Карточка сотрудника', admin: 'Полный', engineer: 'Нет', accountant: 'Просмотр' },
  { id: 'photo', label: 'Фото для Face ID', admin: 'Полный', engineer: 'Нет', accountant: 'Нет' },
  { id: 'settings', label: 'Настройки питания', admin: 'Полный', engineer: 'Просмотр', accountant: 'Нет' },
  { id: 'monitor', label: 'Мониторинг точек', admin: 'Просмотр', engineer: 'Просмотр', accountant: 'Нет' },
  { id: 'finance', label: 'Реестр и взаиморасчёты', admin: 'Просмотр', engineer: 'Нет', accountant: 'Просмотр' },
];
export const can = (role, right, level = 'any') => {
  const v = RIGHTS.find((r) => r.id === right)?.[role];
  if (!v || v === 'Нет') return false;
  if (level === 'edit') return v === 'Полный' || v === 'Создание';
  return true;
};

export const SETTINGS_LEVELS = [
  { id: 'system', label: 'Вся система', depth: 0 },
  { id: 'field:Прорва', label: 'Месторождение Прорва', depth: 1, parent: 'system' },
  { id: 'point:1', label: 'Столовая №1', depth: 2, parent: 'field:Прорва' },
  { id: 'term:1:Т1', label: 'Терминал Т1', depth: 3, parent: 'point:1' },
  { id: 'term:1:Т2', label: 'Терминал Т2', depth: 3, parent: 'point:1' },
  { id: 'field:Кенбай', label: 'Месторождение Кенбай', depth: 1, parent: 'system' },
];
export const SYSTEM_SETTINGS = {
  breakfast: { start: '06:00', end: '09:00' },
  lunch: { start: '12:00', end: '15:00' },
  dinner: { start: '18:00', end: '21:00' },
  extras: { night: true, water: true, dry: true },
  dryReplacesLunch: true,
  syncInterval: 5,
  tz: 'UTC+05:00',
};

export const dateLabel = (d) => d.split('-').reverse().join('.');
