import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const src = readFileSync(resolve(repoRoot, 'apps/extension/runtime-recovery.js'), 'utf8');

// Mock chrome.storage.local
const mockStorage = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (keys) => {
        const k = typeof keys === 'string' ? keys : Array.isArray(keys) ? keys[0] : Object.keys(keys)[0];
        const val = mockStorage[k];
        return val !== undefined ? { [k]: val } : {};
      },
      set: async (val) => {
        Object.assign(mockStorage, val);
      },
      remove: async (key) => {
        delete mockStorage[key];
      },
    },
  },
};

globalThis.window = {};
const __filename = fileURLToPath(import.meta.url);
const vm = await import('node:vm');
const script = new vm.Script(src);
const ctx = vm.createContext({ ...globalThis, console, String, Math, Date, RegExp, Error, setTimeout });
script.runInContext(ctx);
const { parseTerminationEnvelope } = ctx.window.__vsbrainRecovery;

let passed = 0, failed = 0;
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL: ${name}: ${e.message}`);
  }
}

// 1. JSON envelope — all fields valid (boolean false)
test('JSON envelope parse — boolean false', () => {
  const r = parseTerminationEnvelope(
    '```vsbrain-termination\n{"status":"ready_to_finalize","session_nonce":"n123","should_continue":false,"critical_remaining":false}\n```'
  );
  assert(r.ok === true, 'ok');
  assert(r.envelope.parser === 'json', 'parser=json');
  assert(r.envelope.status === 'ready_to_finalize', 'status');
  assert(r.envelope.session_nonce === 'n123', 'nonce');
  assert(r.envelope.should_continue === false, 'should_continue=false');
  assert(r.envelope.critical_remaining === false, 'critical_remaining=false');
});

// 2. JSON envelope — boolean true + string coerce
test('JSON envelope parse — boolean true / string coerce', () => {
  const r = parseTerminationEnvelope(
    '```vsbrain-termination\n{"status":"ready_to_finalize","session_nonce":"nc","should_continue":"true","critical_remaining":1}\n```'
  );
  assert(r.ok === true, 'ok');
  assert(r.envelope.should_continue === true, 'should_continue coerced true');
  assert(r.envelope.critical_remaining === true, 'critical_remaining coerced 1→true');
});

// 3. JSON envelope — status not ready_to_finalize → ERR
test('JSON envelope — invalid status', () => {
  const r = parseTerminationEnvelope(
    '```vsbrain-termination\n{"status":"in_progress","session_nonce":"x","should_continue":true,"critical_remaining":false}\n```'
  );
  assert(r.ok === false, 'not ok');
  assert(r.code === 'ERR_TERMINATION_STATUS_INVALID', 'ERR_TERMINATION_STATUS_INVALID');
});

// 4. JSON envelope — missing required field
test('JSON envelope — missing field', () => {
  const r = parseTerminationEnvelope(
    '```vsbrain-termination\n{"status":"ready_to_finalize","session_nonce":"x"}\n```'
  );
  assert(r.ok === false, 'not ok');
  assert(r.code === 'ERR_TERMINATION_FIELD_SHOULD_CONTINUE_MISSING', 'missing should_continue');
});

// 5. Key-value fallback (JSON parse fails)
test('Key-value fallback — backwards compat', () => {
  const r = parseTerminationEnvelope(
    '```vsbrain-termination\nstatus: ready_to_finalize\nsession_nonce: fallback_99\nshould_continue: false\ncritical_remaining: false\n```'
  );
  assert(r.ok === true, 'ok');
  assert(r.envelope.parser === 'key-value', 'parser=key-value');
  assert(r.envelope.session_nonce === 'fallback_99', 'nonce');
  assert(r.envelope.should_continue === false, 'should_continue');
});

// 6. Key-value fallback — boolean coerce (yes/1/có)
test('Key-value fallback — boolean coerce yes/1/có', () => {
  const r = parseTerminationEnvelope(
    '```vsbrain-termination\nstatus: ready_to_finalize\nsession_nonce: x\nshould_continue: yes\ncritical_remaining: 1\n```'
  );
  assert(r.ok === true, 'ok');
  assert(r.envelope.should_continue === true, 'should_continue=yes→true');
  assert(r.envelope.critical_remaining === true, 'critical_remaining=1→true');
});

// 7. Missing envelope
test('Missing envelope', () => {
  const r = parseTerminationEnvelope('random text no envelope');
  assert(r.ok === false, 'not ok');
  assert(r.code === 'ERR_TERMINATION_ENVELOPE_MISSING', 'missing');
});

// 8. Multiple envelopes
test('Multiple envelopes', () => {
  const r = parseTerminationEnvelope(
    '```vsbrain-termination\n{}\n```\n```vsbrain-termination\n{}\n```'
  );
  assert(r.ok === false, 'not ok');
  assert(r.code === 'ERR_TERMINATION_ENVELOPE_MULTIPLE', 'multiple');
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed > 0 ? 1 : 0);
