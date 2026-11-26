// Каталог состояний: каждый макет .dc.html → живой прототип в этом состоянии.
// Пресет сбрасывает демо-данные, готовит состояние и открывает нужный экран.
import * as S from '../store.js';
import { seedId } from '../logic.js';
import { go } from '../router.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = (role = 'admin') => S.adminLogin({ admin: 'admin', engineer: 'engineer', accountant: 'buh' }[role], 'demo');
const operator = (login = 'operator') => S.operatorLogin(login, 'demo');
const fresh = () => { S.resetAll(); };

export const GROUPS = [
  {
    id: 'journal', device: 'admin', title: 'Админка · Журнал событий', items: [
      { file: 'Main', title: 'Записи и новое событие', run: () => { fresh(); admin(); go('/admin/journal'); } },
      { file: 'Receiving', title: 'Получение записи от точки', note: 'Запись приходит с планшета через 2 секунды', run: async () => { fresh(); admin(); operator(); go('/admin/journal'); await wait(400); S.recognize('P10003', 'Т1'); } },
      { file: 'Details', title: 'Связь корректировки с исходной', run: () => { fresh(); admin(); go(`/admin/journal/${seedId(7)}`); } },
      { file: 'Empty', title: 'Пустой журнал', run: () => { fresh(); admin(); S.setCenterEmpty(true); go('/admin/journal'); } },
      { file: 'Error', title: 'Ошибка загрузки и повтор', run: () => { fresh(); admin(); S.setFault('load', true); go('/admin/journal'); } },
      { file: 'JournalConflict', title: 'Офлайн-конфликт', run: () => { fresh(); admin(); S.injectConflict(); go('/admin/journal/conflict'); } },
    ],
  },
  {
    id: 'login', device: 'admin', title: 'Админка · Вход и роли', items: [
      { file: 'Login', title: 'Вход', run: () => { fresh(); go('/admin/login'); } },
      { file: 'LoginError', title: 'Неверные данные', run: () => { fresh(); go('/admin/login?e=invalid'); } },
      { file: 'LoginDisabled', title: 'Доступ отключён', run: () => { fresh(); go('/admin/login?e=disabled'); } },
      { file: 'LoginOffline', title: 'Центр недоступен', run: () => { fresh(); S.setFault('centerDown', true); go('/admin/login?e=offline'); } },
      { file: 'Roles', title: 'Роли · предложение', run: () => { fresh(); admin(); go('/admin/roles'); } },
    ],
  },
  {
    id: 'emp', device: 'admin', title: 'Админка · Карточка сотрудника', items: [
      { file: 'Employee', title: 'Карточка', run: () => { fresh(); admin(); go('/admin/employees/P10001'); } },
      { file: 'EmployeeEdit', title: 'Ошибка: карта занята', run: () => { fresh(); admin(); go('/admin/employees/P10001/edit?card=0012458932'); } },
      { file: 'EmployeeNoConsent', title: 'Нет согласия на фото', run: () => { fresh(); admin(); go('/admin/employees/P10007'); } },
      { file: 'EmployeePhotoDelete', title: 'Удаление фото', run: () => { fresh(); admin(); go('/admin/employees/P10001?confirm=delete'); } },
    ],
  },
  {
    id: 'set', device: 'admin', title: 'Админка · Настройки питания', items: [
      { file: 'Settings', title: 'Уровень системы', run: () => { fresh(); admin(); go('/admin/settings'); } },
      { file: 'SettingsPoint', title: 'Столовая и наследование', run: () => { fresh(); admin(); S.set((s) => ({ settings: { ...s.settings, overrides: { 'point:1': { lunch: { start: '11:30', end: '15:00' } } } } })); go('/admin/settings?level=point:1'); } },
      { file: 'SettingsOverlap', title: 'Пересечение окон', run: () => { fresh(); admin(); go('/admin/settings?demo=overlap'); } },
      { file: 'SettingsSaved', title: 'Сохранено', run: () => { fresh(); admin(); S.saveSettings('system', S.getState().settings.system); go('/admin/settings'); } },
    ],
  },
  {
    id: 'mon', device: 'admin', title: 'Админка · Мониторинг ПК', items: [
      { file: 'Monitor', title: 'Список точек', run: () => { fresh(); admin(); go('/admin/monitor'); } },
      { file: 'MonitorPcOffline', title: 'Нет связи с ПК', run: () => { fresh(); admin(); go('/admin/monitor/12'); } },
      { file: 'MonitorTerminalOffline', title: 'Терминал не отвечает', run: () => { fresh(); admin(); go('/admin/monitor/4'); } },
    ],
  },
  {
    id: 'err', device: 'admin', title: 'Админка · Ошибки', items: [
      { file: 'ErrorSession', title: 'Сессия завершена', run: () => { fresh(); admin(); S.setFault('session', true); go('/admin/employees'); } },
      { file: 'ErrorForbidden', title: 'Нет доступа (бухгалтерия → настройки)', run: () => { fresh(); admin('accountant'); go('/admin/settings'); } },
      { file: 'ErrorNotFound', title: 'Не найдено', run: () => { fresh(); admin(); go('/admin/no-such-page'); } },
      { file: 'ErrorSave', title: 'Не сохранено', note: 'Нажмите «Сохранить» в форме', run: () => { fresh(); admin(); S.setFault('save', true); go('/admin/employees/P10001/edit'); } },
      { file: 'ErrorStale', title: 'Данные устарели', run: () => { fresh(); admin(); S.setFault('stale', true); go('/admin/monitor'); } },
    ],
  },
  {
    id: 'tmain', device: 'tablet', title: 'Планшет · Вход, ожидание и выдача', items: [
      { file: 'TabPrototype', title: 'Кликабельный прототип со стендом', run: () => { fresh(); operator(); go('/stand'); } },
      { file: 'TabLogin', title: 'Вход оператора (центр недоступен)', run: () => { fresh(); S.setLink('off'); go('/tablet'); } },
      { file: 'TabWait', title: 'Ожидание', run: () => { fresh(); operator(); go('/tablet'); } },
      { file: 'TabRecognize', title: 'Распознавание', note: 'Статичное состояние: «Сбросить экраны» в пульте', run: () => { fresh(); operator(); S.set({ term: { 'Т1': { phase: 'pending', employeeId: 'P10001', meal: 'lunch' }, 'Т2': null } }); go('/tablet'); } },
      { file: 'TabIssued', title: 'Выдано', run: () => { fresh(); operator(); S.setHold(true); S.recognize('P10001', 'Т1'); go('/tablet'); } },
      { file: 'TabExtra', title: 'Т2: выбрана вода', run: () => { fresh(); operator(); S.pickExtra('water'); go('/tablet'); } },
    ],
  },
  {
    id: 'tref', device: 'tablet', title: 'Планшет · Отказы и повторная попытка', items: [
      { file: 'TabOutside', title: 'Вне окна', run: () => { fresh(); operator(); S.setTime('23:30'); S.setHold(true); S.recognize('P10001', 'Т1'); go('/tablet'); } },
      { file: 'TabRepeat', title: 'Повторная попытка', run: () => { fresh(); operator(); S.setHold(true); S.recognize('P10002', 'Т1'); go('/tablet'); } },
      { file: 'TabUnknown', title: 'Не найден', run: () => { fresh(); operator(); S.setHold(true); S.recognize(null, 'Т1'); go('/tablet'); } },
      { file: 'TabRefusals', title: 'Фильтр отказов', run: () => { fresh(); operator(); S.set({ journalFilter: 'ref' }); go('/tablet'); } },
    ],
  },
  {
    id: 'tnet', device: 'tablet', title: 'Планшет · Связь и офлайн', items: [
      { file: 'TabSim', title: 'Резерв SIM', run: () => { fresh(); operator(); S.setLink('sim'); go('/tablet'); } },
      { file: 'TabOfflineWait', title: 'Офлайн: ожидание', run: () => { fresh(); operator(); S.setLink('off'); go('/tablet'); } },
      { file: 'TabOfflineIssued', title: 'Офлайн: выдано', run: () => { fresh(); operator(); S.setLink('off'); S.setHold(true); S.recognize('P10001', 'Т1'); go('/tablet'); } },
      { file: 'TabSending', title: 'Отправка после восстановления', note: 'Связь восстанавливается через 2 секунды', run: async () => { fresh(); operator(); S.setLink('off'); S.recognize('P10001', 'Т1'); go('/tablet'); await wait(2000); S.setLink('lan'); } },
      { file: 'TabSent', title: 'Отправлено', run: async () => { fresh(); operator(); S.setLink('off'); S.recognize('P10001', 'Т1'); go('/tablet'); await wait(1100); S.setLink('lan'); } },
    ],
  },
  {
    id: 'tman', device: 'tablet', title: 'Планшет · Ручная операция', items: [
      { file: 'TabManual1', title: '1 · Сотрудник', run: () => { fresh(); operator(); S.manualOpen(); go('/tablet'); } },
      { file: 'TabManual2', title: '2 · Основание', run: () => { fresh(); operator(); S.manualOpen(); S.manualPatch({ step: 2, employeeId: 'P10003', meal: 'lunch', basis: 'face' }); go('/tablet'); } },
      { file: 'TabManual3', title: '3 · Подтверждение', run: () => { fresh(); operator(); S.manualOpen(); S.manualPatch({ step: 3, employeeId: 'P10003', meal: 'lunch', basis: 'face', verified: true }); go('/tablet'); } },
      { file: 'TabManualDone', title: 'Выдано вручную', run: () => { fresh(); operator(); S.manualOpen(); S.manualPatch({ step: 3, employeeId: 'P10003', meal: 'lunch', basis: 'face', verified: true }); S.manualConfirm(); go('/tablet'); } },
      { file: 'TabManualLimit', title: 'Отказ по лимиту', run: () => { fresh(); operator(); S.manualOpen(); S.manualPatch({ step: 3, employeeId: 'P10002', meal: 'lunch', basis: 'face', verified: true }); S.manualConfirm(); go('/tablet'); } },
      { file: 'TabManualDenied', title: 'Нет права', run: () => { fresh(); operator('operator2'); S.manualOpen(); go('/tablet'); } },
    ],
  },
  {
    id: 'wall', device: 'display', title: 'Настенный дисплей для сотрудников (новый)', items: [
      { title: 'Т1 · ожидание', run: () => { fresh(); operator(); go('/display/t1'); } },
      { title: 'Т1 · Можно', run: () => { fresh(); operator(); S.setHold(true); S.recognize('P10001', 'Т1'); go('/display/t1'); } },
      { title: 'Т1 · Нельзя: обед уже получен', run: () => { fresh(); operator(); S.setHold(true); S.recognize('P10002', 'Т1'); go('/display/t1'); } },
      { title: 'Т1 · Нельзя: вне окна', run: () => { fresh(); operator(); S.setTime('23:30'); S.setHold(true); S.recognize('P10001', 'Т1'); go('/display/t1'); } },
      { title: 'Т1 · Не распознано', run: () => { fresh(); operator(); S.setHold(true); S.recognize(null, 'Т1'); go('/display/t1'); } },
      { title: 'Т1 · Можно, без связи', run: () => { fresh(); operator(); S.setLink('off'); S.setHold(true); S.recognize('P10006', 'Т1'); go('/display/t1'); } },
      { title: 'Т2 · выбрана вода', run: () => { fresh(); operator(); S.pickExtra('water'); go('/display/t2'); } },
      { title: 'Турникет офиса · лицо распознано', run: () => { fresh(); operator(); S.setHold(true); S.terminalEvent('P10003'); go('/display/t1'); } },
    ],
  },
];
