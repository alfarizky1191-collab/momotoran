const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const fs = require('node:fs');
function setup() {
  const values = new Map();
  let task, running = false, options, allowed = true, hold, release;
  const writes = [], deletes = [];
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u' } } } }) },
    from: () => ({
      upsert: async point => { writes.push(point); if (hold) { const wait = hold; hold = null; await wait; } return { error: null }; },
      delete: () => ({ eq: () => ({ eq: async () => { deletes.push(true); return { error: null }; } }) }),
    }),
  };
  const location = {
    Accuracy: { High: 4 },
    hasServicesEnabledAsync: async () => true,
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    requestBackgroundPermissionsAsync: async () => ({ status: allowed ? 'granted' : 'denied' }),
    startLocationUpdatesAsync: async (_task, config) => { running = true; options = config; },
    stopLocationUpdatesAsync: async () => { running = false; },
    hasStartedLocationUpdatesAsync: async () => running,
  };
  const mocks = {
    'react-native-url-polyfill/auto': {},
    '@react-native-async-storage/async-storage': {
      getItem: async key => values.get(key) ?? null,
      setItem: async (key, val) => values.set(key, val),
      removeItem: async key => values.delete(key),
    },
    'expo-location': location,
    'expo-task-manager': { defineTask: (_name, fn) => { task = fn; }, isAvailableAsync: async () => true },
    './supabase': { supabase: client },
  };
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync('src/lib/tracking.ts','utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { exports, require: name => mocks[name], Date, Promise });
  const point = n => ({ timestamp: Date.now()+n, coords: { latitude: n, longitude: n, accuracy: 5, speed: 1, heading: 0 } });
  return { api: exports, writes, deletes, values,
    emit: n => task({ data: { locations: [point(n)] } }),
    deny: () => { allowed = false; },
    hold: () => { hold = new Promise(resolve => { release = resolve; }); },
    release: () => release(),
    config: () => options,
  };
}
test('background permission and foreground notification are required', async () => {
  const s = setup();
  s.deny();
  await assert.rejects(s.api.startTracking('g','u'), /sepanjang waktu/);
  assert.equal(await s.api.trackingActive('g'), false);
  const ok = setup();
  await ok.api.startTracking('g','u');
  assert.equal(await ok.api.trackingActive('g'), true);
  assert.ok(ok.config().foregroundService.notificationTitle);
  assert.equal(ok.config().pausesUpdatesAutomatically, false);
});
test('slow network retains only newest point', async () => {
  const s = setup();
  await s.api.startTracking('g','u');
  s.hold();
  const first = s.emit(1);
  await new Promise(setImmediate);
  await s.emit(2); await s.emit(3);
  s.release(); await first;
  assert.deepEqual(s.writes.map(p => p.latitude), [1,3]);
});
test('stop clears active task and cleans a late in-flight upload', async () => {
  const s = setup();
  await s.api.startTracking('g','u');
  s.hold(); const first = s.emit(1);
  await new Promise(setImmediate);
  await s.api.stopTracking();
  assert.equal(await s.api.trackingActive('g'), false);
  assert.ok(s.values.has('momotoran.tracking.delete'));
  s.release(); await first;
  assert.equal(s.deletes.length, 2);
  assert.equal(s.values.has('momotoran.tracking.delete'), false);
  await s.emit(2);
  assert.equal(s.writes.length, 1);
});
