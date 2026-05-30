import puppeteer from 'puppeteer';
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
const extensionPath = '/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension';

const browser = await puppeteer.launch({ headless: false, pipe: true, enableExtensions: [extensionPath] });
try {
  const workerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker' && target.url().endsWith('background.js'),
    { timeout: 30000 }
  );
  const worker = await workerTarget.worker();
  if (!worker) throw new Error('service worker handle unavailable');
  const extensionId = await worker.evaluate(() => chrome.runtime.id);
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);

  const result = await page.evaluate(async () => {
    const sessionId = await window.__vsbrainActionJournal.ensureSessionId();

    // IPC
    const ipcMissingSession = window.__vsbrainIPC.validate({ protocol_version: window.__vsbrainIPC.PROTOCOL_VERSION, phase_version: 0 }, 0);
    const ipcStale = window.__vsbrainIPC.validate({ protocol_version: window.__vsbrainIPC.PROTOCOL_VERSION, session_id: sessionId, phase_version: 1 }, 2);
    const ipcBadProto = window.__vsbrainIPC.validate({ protocol_version: 'bad.proto', session_id: sessionId, phase_version: 2 }, 2);

    // Action dedup
    const fp = 'matrix_fp_same';
    const act1 = await window.__vsbrainActionJournal.createAction({ actionType: 'auto_send', payloadFingerprint: fp, phaseVersion: 9, target: { targetId: 1 } });
    const act2 = await window.__vsbrainActionJournal.createAction({ actionType: 'auto_send', payloadFingerprint: fp, phaseVersion: 9, target: { targetId: 1 } });
    if (act1?.action?.actionId) await window.__vsbrainActionJournal.unknownCommit(act1.action.actionId, 'matrix_unknown_commit');
    const act3 = await window.__vsbrainActionJournal.createAction({ actionType: 'auto_send', payloadFingerprint: fp, phaseVersion: 9, target: { targetId: 1 } });

    // Lease
    const lease1 = await window.__vsbrainLease.acquire({ sessionId, ownerId: 'matrix:tab-1', currentPhase: 9 });
    const lease2 = await window.__vsbrainLease.acquire({ sessionId, ownerId: 'matrix:tab-2', currentPhase: 9 });
    const renewBad = await window.__vsbrainLease.renew({ sessionId, leaseToken: 'wrong_token', currentPhase: 9 });
    let blockedCheck = { ok: true };
    if (lease1.ok && lease1.lease?.leaseToken) {
      await window.__vsbrainLease.block({ sessionId, reason: 'matrix_unknown_finalize' });
      blockedCheck = await window.__vsbrainLease.validate({ sessionId, leaseToken: lease1.lease.leaseToken });
    }

    // UI / safe release snapshots
    const autoSendDefaultOff = !document.getElementById('autoSendToggle')?.checked;
    const finalizeGlow = document.getElementById('finalizeBtn')?.classList.contains('glow-save');
    const stopDisabled = !!document.getElementById('stopLoopBtn')?.disabled;

    return {
      ipc01: ipcMissingSession.code,
      ipc02: ipcStale.code,
      ipc05: ipcBadProto.code,
      act05_firstCreated: !!act1.created,
      act05_secondBlocked: act2.reason,
      act02_thirdBlockedAfterUnknown: act3.reason,
      lease01_conflict: lease2.code,
      lease05_wrongRenew: renewBad.code,
      lease04_blockedAfterUnknown: blockedCheck.code,
      ux04_autoSendDefaultOff: autoSendDefaultOff,
      ux03_stopDisabledWhenIdle: stopDisabled,
      finalizeGlowVisible: finalizeGlow
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sleep(1000);
  await browser.close();
}
