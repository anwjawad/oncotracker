// Click/change handlers registered by each module, dispatched by main.js.
// Kept dependency-free so view modules can import it without import cycles.
export const actions = {};
export const changes = {};
export const hooks = { rerender: () => {}, navigate: () => {} };

export function registerActions(map) { Object.assign(actions, map); }
export function registerChanges(map) { Object.assign(changes, map); }
export const rerender = () => hooks.rerender();
export const navigate = (route, params) => hooks.navigate(route, params);

// Per-view UI state that survives re-renders and route changes.
export const ui = {
  committeeDate: '',
  committeeFilter: 'all',
  committeeQuery: '',
  clinicDate: '',
  clinicDoctor: 'ALL',
  clinicQuery: '',
  clinicSelected: new Set(),
  fuType: 'ALL',
  fuDoctor: 'ALL',
  fuQuery: '',
  fuShow: 'open',
  patientsQuery: '',
  patientsFilter: 'all',
  patientsLimit: 200,
  qualityCode: 'ALL',
  reportsRange: '3m',
};
