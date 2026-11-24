/* =========================================================
   Shared (multi-person) mode for the DMX calculator.
   Only active when the page is opened with ?ws=<id> from the B-Box website,
   and the visitor is signed in. Everything else (the Android app, the standalone
   web app) never loads this file and behaves exactly as before.

   Fixtures, rigs, saved addresses, photos and the rig being edited are kept in
   Firestore and pushed/pulled live. This file reuses the calculator's own
   globals: saved, fixtures, store, saveWork, photoDB, render*(), calc() ...
   ========================================================= */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const wsId = params.get('ws');
  if (!wsId) return;

  const seedRequested = params.get('seed') === '1';
  if (seedRequested) {            // one-shot: a reload must never re-seed
    params.delete('seed');
    try { history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '')); } catch (e) { /* ignore */ }
  }

  /* ---------- overlay + status line ---------- */
  const style = document.createElement('style');
  style.textContent = `
    #shareOverlay{position:fixed;inset:0;z-index:60;background:rgba(15,13,20,.96);display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
    #shareOverlay .box{max-width:360px}
    #shareOverlay h3{margin:0 0 8px;font-size:18px}
    #shareOverlay p{margin:0 0 16px;color:var(--muted)}
    #shareOverlay a{display:inline-block;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:10px}
    #status.shared{color:var(--ok)} #status.shared.warn{color:var(--warn)}`;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'shareOverlay';
  overlay.innerHTML = '<div class="box"><h3>Opening shared calculator…</h3><p>One moment.</p></div>';
  document.body.appendChild(overlay);

  function block(title, text, linkHref, linkText) {
    overlay.hidden = false;
    overlay.innerHTML = `<div class="box"><h3></h3><p></p>${linkHref ? '<a></a>' : ''}</div>`;
    overlay.querySelector('h3').textContent = title;
    overlay.querySelector('p').textContent = text;
    if (linkHref) { const a = overlay.querySelector('a'); a.href = linkHref; a.textContent = linkText; a.target = '_top'; }
  }

  let statusState = 'connecting';
  function setBanner(kind, text) {
    statusState = kind;
    const s = document.getElementById('status'); if (!s) return;
    s.className = 'status shared' + (kind === 'ok' ? '' : ' warn');
    s.textContent = text;
  }
  window.setStatus = function () { /* the shared banner owns this line */ };

  const norm = s => String(s == null ? '' : s).trim().toLowerCase();
  const clone = o => JSON.parse(JSON.stringify(o));
  const photoIds = o => (Array.isArray(o && o.photos) ? o.photos : []);

  // 53-bit string hash -> stable, slash-free Firestore document ids
  function hash53(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  const docIdFor = key => 'i' + hash53(key).toString(36);

  const KEY = {
    library: f => 'L|' + norm(f.name) + '|' + (+f.ch),
    rig: r => 'R|' + norm(r.name),
    address: a => 'A|' + a.t + '|' + a.uni + '|' + a.addr
  };
  const TYPE_OF = { library: 'library', rigs: 'rig', addresses: 'address' };

  function itemsOf(s) {
    const m = new Map();
    (s.library || []).forEach(f => m.set(KEY.library(f), { type: 'library', data: f }));
    (s.rigs || []).forEach(r => m.set(KEY.rig(r), { type: 'rig', data: r }));
    (s.addresses || []).forEach(a => m.set(KEY.address(a), { type: 'address', data: a }));
    return m;
  }

  /* ---------- start ---------- */
  const ready = window.BBoxFBReady;
  if (!ready) { block('Sharing isn’t available', 'This copy of the calculator can’t open shared calculators.'); return; }
  const nextURL = 'calculator.html?ws=' + encodeURIComponent(wsId);
  const signInHref = '../account.html?tab=up&next=' + encodeURIComponent(nextURL);

  ready.then(B => {
    if (!B) { block('Sharing isn’t available', 'Shared calculators aren’t switched on for this site yet.'); return; }
    const user = B.getUser();
    if (!user) { block('Sign in to continue', 'This calculator is shared. Sign in to open and edit it.', signInHref, 'Sign in or create account'); return; }
    run(B, user);
  });

  function run(B, user) {
    /* ----- take over from the personal (on-device) data ----- */
    const personal = { saved: clone(saved), fixtures: clone(fixtures) };
    let applying = false;
    let loaded = false;
    let remoteJson = new Map();          // key -> json currently in Firestore
    let lastDocs = [];                   // newest items snapshot
    let pushTimer = 0, pushing = false, dirty = false;
    let writeSeq = 0, docsSeq = 0;       // lets us tell whether the newest snapshot is newer than our newest write
    let workTimer = 0, lastWork = '';
    const synced = new Set();            // photo ids known to exist remotely
    const fetching = new Set();
    const retries = new Map();

    // In shared mode nothing is written to this device's personal storage.
    store.save = function () { schedulePush(); return Promise.resolve(); };
    window.saveWork = function () { if (!applying) scheduleWork(); };

    if (!seedRequested) {
      applying = true;
      saved = { library: [], rigs: [], addresses: [] };
      fixtures = [{ name: 'Fixture', ch: 1, qty: 1 }];
      document.getElementById('uni').value = 1;
      document.getElementById('start').value = 1;
      document.getElementById('nosplit').checked = true;
      try { renderLibrary(); renderRows(); renderRigs(); renderAddresses(); calc(); } catch (e) { /* ignore */ }
      applying = false;
    }

    setBanner('warn', 'Shared calculator · connecting…');

    /* ----- local state helpers ----- */
    const rerender = () => {
      try {
        renderLibrary(); renderRows(); renderRigs(); renderAddresses(); calc();
        if (typeof sheetTarget !== 'undefined' && sheetTarget && document.getElementById('sheet').classList.contains('show')) renderSheet();
      } catch (e) { console.log('[share] render failed', e); }
    };
    const workState = () => ({
      fixtures: fixtures.map(f => ({ name: f.name, ch: f.ch, qty: f.qty })),
      uni: document.getElementById('uni').value,
      start: document.getElementById('start').value,
      nosplit: document.getElementById('nosplit').checked
    });

    /* ----- photos ----- */
    async function compress(blob) {
      if (blob.size <= 300000) return blob;
      const steps = [[1280, 0.72], [900, 0.6]];
      let out = blob;
      for (const [max, q] of steps) {
        out = await new Promise(res => {
          const url = URL.createObjectURL(blob), img = new Image();
          img.onload = () => {
            const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
            const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url); c.toBlob(b => res(b || blob), 'image/jpeg', q);
          };
          img.onerror = () => { URL.revokeObjectURL(url); res(blob); };
          img.src = url;
        });
        if (out.size < 600000) break;
      }
      return out;
    }
    async function uploadPhoto(id) {
      try {
        const blob = await photoDB.get(id); if (!blob) return;
        const url = await blobToDataURL(await compress(blob));
        await B.data.setPhoto(wsId, id, url);
        synced.add(id);
      } catch (e) { console.log('[share] photo upload failed', id, e); }
    }
    async function downloadPhoto(id) {
      if (fetching.has(id)) return; fetching.add(id);
      try {
        if (await photoDB.get(id)) { synced.add(id); return; }
        const url = await B.data.getPhoto(wsId, id);
        if (!url) throw new Error('missing');
        const blob = await dataURLToBlob(url);
        await photoDB.tx('readwrite', st => st.put(blob, id));
        synced.add(id); retries.delete(id);
        if (!applying) { renderLibrary(); renderAddresses(); if (typeof sheetTarget !== 'undefined' && sheetTarget) renderSheet(); }
      } catch (e) {
        const n = (retries.get(id) || 0) + 1; retries.set(id, n);
        if (n <= 6) setTimeout(() => { fetching.delete(id); downloadPhoto(id); }, 2000 * n);
        return;
      } finally { if ((retries.get(id) || 0) === 0 || synced.has(id)) fetching.delete(id); }
    }
    function fetchMissingPhotos() {
      const want = new Set();
      itemsOf(saved).forEach(it => photoIds(it.data).forEach(id => want.add(id)));
      want.forEach(id => { if (!synced.has(id)) downloadPhoto(id); });
    }

    /* ----- push local changes up ----- */
    function schedulePush() {
      if (applying || !loaded) return;
      dirty = true; clearTimeout(pushTimer); pushTimer = setTimeout(push, 300);
      setBanner('warn', 'Shared calculator · saving…');
    }
    async function push() {
      if (pushing) { dirty = true; return; }
      pushing = true; dirty = false; pushTimer = 0;
      let failed = false;
      try {
        const local = itemsOf(saved);
        const refs = new Set();
        local.forEach(it => photoIds(it.data).forEach(id => refs.add(id)));
        await Promise.all([...refs].filter(id => !synced.has(id) && !fetching.has(id)).map(uploadPhoto));

        for (const [key, it] of local) {
          const json = JSON.stringify(it.data);
          if (remoteJson.get(key) === json) continue;
          writeSeq++;
          await B.data.setItem(wsId, docIdFor(key), { type: it.type, key, json, by: user.uid, t: Date.now() });
          remoteJson.set(key, json);
        }
        for (const key of [...remoteJson.keys()]) {
          if (local.has(key)) continue;
          writeSeq++;
          await B.data.deleteItem(wsId, docIdFor(key));
          remoteJson.delete(key);
        }
        for (const id of [...synced]) {            // photos nobody references any more
          if (!refs.has(id) && !fetching.has(id)) { synced.delete(id); try { await B.data.deletePhoto(wsId, id); } catch (e) { /* ignore */ } }
        }
      } catch (e) {
        failed = true; console.log('[share] push failed', e);
        setBanner('warn', 'Shared calculator · couldn’t save — will retry');
        dirty = true;
      } finally {
        pushing = false;
        if (dirty) { clearTimeout(pushTimer); pushTimer = setTimeout(push, failed ? 4000 : 300); }
        else {
          setBanner('ok', 'Shared calculator · live, all changes saved');
          // Catch up on other people's edits that arrived while we were saving — but only from a
          // snapshot taken after our last write; otherwise the next snapshot (our own write) will do it.
          if (docsSeq === writeSeq) applyRemote(lastDocs);
        }
      }
    }

    /* ----- pull remote changes down ----- */
    function applyRemote(docs) {
      lastDocs = docs; docsSeq = writeSeq;
      const L = [], R = [], A = [], rj = new Map();
      docs.forEach(d => {
        let data; try { data = JSON.parse(d.json); } catch (e) { return; }
        rj.set(d.key, d.json);
        (d.type === 'library' ? L : d.type === 'rig' ? R : A).push(data);
      });
      remoteJson = rj;
      if (pushTimer || pushing || dirty) return;              // our own edits go first; we re-apply after the push
      A.sort((a, b) => (a.t || 0) - (b.t || 0));

      const local = itemsOf(saved);
      let same = local.size === rj.size;
      if (same) for (const [k, it] of local) { if (rj.get(k) !== JSON.stringify(it.data)) { same = false; break; } }
      if (same) { fetchMissingPhotos(); return; }

      // keep the photo/notes sheet pointing at the live object
      let sheetKey = null;
      if (typeof sheetTarget !== 'undefined' && sheetTarget) {
        for (const [k, it] of local) if (it.data === sheetTarget) sheetKey = k;
      }
      applying = true;
      saved = { library: L, rigs: R, addresses: A };
      if (sheetKey) {
        const next = itemsOf(saved).get(sheetKey);
        sheetTarget = next ? next.data : null;
        if (!next) { document.getElementById('sheet').classList.remove('show'); document.getElementById('viewer').classList.remove('show'); }
      }
      rerender();
      applying = false;
      fetchMissingPhotos();
    }

    /* ----- the rig being edited ----- */
    function scheduleWork() {
      if (!loaded) return;
      clearTimeout(workTimer);
      workTimer = setTimeout(async () => {
        workTimer = 0;
        const json = JSON.stringify(workState());
        if (json === lastWork) return;
        lastWork = json;
        try { await B.data.setWork(wsId, { json, by: user.uid, t: Date.now() }); } catch (e) { console.log('[share] work push failed', e); }
      }, 400);
    }
    function applyWork(doc) {
      if (!doc || doc.json === lastWork || workTimer) return;
      let w; try { w = JSON.parse(doc.json); } catch (e) { return; }
      lastWork = doc.json;
      applying = true;
      fixtures = (w.fixtures || []).map(f => ({ name: f.name, ch: f.ch, qty: f.qty }));
      if (!fixtures.length) fixtures = [{ name: 'Fixture', ch: 1, qty: 1 }];
      document.getElementById('uni').value = w.uni || 1;
      document.getElementById('start').value = w.start || 1;
      document.getElementById('nosplit').checked = w.nosplit !== false;
      try { renderRows(); calc(); } catch (e) { console.log('[share] work render failed', e); }
      applying = false;
    }

    /* ----- subscribe ----- */
    let firstItems = true, firstWork = true;
    const fail = err => {
      console.log('[share] subscription error', err);
      block('No access to this calculator', 'You’re not a member of this shared calculator. Ask the owner to send you a new invite link.', '../calculator.html', 'Back to the calculator page');
    };

    B.data.subscribeItems(wsId, docs => {
      if (firstItems) {
        firstItems = false; loaded = true; overlay.hidden = true;
        if (seedRequested && docs.length === 0) {         // brand-new shared calculator: upload what was on this device
          remoteJson = new Map(); lastDocs = [];
          setBanner('warn', 'Shared calculator · uploading your fixtures…');
          dirty = true; push(); return;
        }
        if (seedRequested) { saved = { library: [], rigs: [], addresses: [] }; }
        setBanner('ok', 'Shared calculator · live, all changes saved');
      }
      applyRemote(docs);
    }, fail);

    B.data.subscribeWork(wsId, doc => {
      if (firstWork) {
        firstWork = false;
        if (!doc && seedRequested) { lastWork = ''; scheduleWorkSoon(); return; }
      }
      applyWork(doc);
    }, () => { /* the items subscription reports access problems */ });
    function scheduleWorkSoon() { const t = setInterval(() => { if (loaded) { clearInterval(t); scheduleWork(); } }, 200); }

    // If the connection never answers, say so instead of spinning forever.
    setTimeout(() => { if (!loaded) block('Still connecting…', 'This is taking longer than usual. Check your connection, then reload.'); }, 20000);
  }
})();
