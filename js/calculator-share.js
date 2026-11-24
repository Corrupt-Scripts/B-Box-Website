/* =========================================================
   calculator.html — "Share with others" bar.
   Signed-in users can turn their calculator into a shared one, send an invite
   link, see who is in it, and open the calculators they've been invited to.
   The live editing itself happens inside the calculator (calculator/share.js).
   ========================================================= */
(function () {
  'use strict';
  const bar = document.getElementById('shareBar');
  if (!bar) return;

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const status = $('shareStatus'), actions = $('shareActions'), panel = $('sharePanel');
  const frame = $('calcFrame'), full = $('calcFull');
  const q = new URLSearchParams(location.search);
  const isDev = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
  const baseURL = location.href.split(/[?#]/)[0];

  let B = null, user = null;
  let wsId = q.get('ws') || '';
  let joinParam = q.get('join') || '';
  let joinInfo = null, mine = [], members = [], unsub = null;
  let panelMode = null, inviteLink = '', msg = '', busy = false, runId = 0;

  /* ---------- calculator frame ---------- */
  function setFrame(id, seed) {
    const key = id || '';
    if (frame.dataset.ws === key) return;
    frame.dataset.ws = key;
    const qs = id ? '?ws=' + encodeURIComponent(id) + (seed ? '&seed=1' : '') : '';
    frame.src = 'calculator/index.html' + qs;
    full.href = 'calculator/index.html' + (id ? '?ws=' + encodeURIComponent(id) : '');
  }
  function syncURL() {
    const p = new URLSearchParams();
    if (wsId) p.set('ws', wsId);
    try { history.replaceState(null, '', baseURL + (p.toString() ? '?' + p : '')); } catch (e) { /* ignore */ }
  }
  const signInURL = () => 'account.html?tab=up&next=' + encodeURIComponent('calculator.html' + location.search);

  // Start on the visitor's own calculator straight away; switch if they open a shared one.
  if (!wsId) setFrame('');

  /* ---------- state ---------- */
  const wsName = id => (mine.find(w => w.id === id) || {}).name || 'Shared calculator';
  const isOwner = () => (mine.find(w => w.id === wsId) || {}).role === 'owner';

  function watchMembers() {
    if (unsub) { unsub(); unsub = null; }
    members = [];
    if (!B || !user || !wsId) return;
    const id = wsId;
    unsub = B.workspaces.subscribeMembers(id, list => { if (id === wsId) { members = list; render(); } }, async () => {
      // Not a member (any more): drop it from my list and fall back to my own calculator.
      try { await B.workspaces.forget(id); } catch (e) { /* ignore */ }
      if (id === wsId) { wsId = ''; msg = 'You no longer have access to that shared calculator.'; syncURL(); setFrame(''); await loadMine(); render(); }
    });
  }
  async function loadMine() { try { mine = await B.workspaces.listMine(); } catch (e) { mine = []; } }

  async function refresh() {
    const run = ++runId;
    if (!B) return;
    if (!user) {
      if (wsId) { wsId = ''; syncURL(); setFrame(''); }
      mine = []; members = []; joinInfo = null; watchMembers(); render(); return;
    }
    await loadMine();
    if (run !== runId) return;
    if (joinParam) {
      const [jw, jc] = joinParam.split('.');
      joinInfo = null;
      try { const info = await B.workspaces.inviteInfo(jw, jc); if (info) joinInfo = { id: jw, code: jc, name: info.name }; } catch (e) { /* invalid */ }
      if (run !== runId) return;
      if (joinInfo && mine.some(w => w.id === jw)) { openWs(jw); joinParam = ''; joinInfo = null; }
      else if (joinInfo) panelMode = 'join';
      else { msg = 'That invite link isn’t valid any more. Ask for a new one.'; joinParam = ''; }
    }
    if (wsId && !mine.some(w => w.id === wsId)) { msg = 'You don’t have access to that shared calculator.'; wsId = ''; syncURL(); setFrame(''); }
    else if (wsId) setFrame(wsId);
    watchMembers();
    render();
  }

  function openWs(id, seed) {
    wsId = id; panelMode = null; inviteLink = ''; msg = '';
    syncURL(); setFrame(id, seed); watchMembers(); render();
  }

  /* ---------- rendering ---------- */
  function render() {
    if (!B) {
      if (isDev) {
        bar.hidden = false;
        status.innerHTML = '<strong>Shared editing is switched off</strong><span>Add your Firebase settings (see FIREBASE-SETUP.md) to let people share a calculator. This note only shows on your own computer.</span>';
        actions.innerHTML = ''; panel.hidden = true;
      } else bar.hidden = true;
      return;
    }
    bar.hidden = false;

    if (!user) {
      status.innerHTML = '<strong>Share this calculator</strong><span>Sign in to invite other people to edit it with you.</span>';
      actions.innerHTML = `<a class="btn primary sm" href="${signInURL()}">Sign in or create account</a>`;
      panel.hidden = !msg && !joinParam;
      panel.innerHTML = joinParam ? '<p>You’ve been invited to a shared calculator. Sign in or create an account to join it.</p>' : msg ? `<p>${esc(msg)}</p>` : '';
      return;
    }

    if (!wsId) {
      status.innerHTML = `<strong>Your own calculator</strong><span>Saved on this device · signed in as ${esc(user.name)}</span>`;
      actions.innerHTML = '<button class="btn primary sm" data-act="share" type="button">Share with others</button>' +
        mine.map(w => `<button class="btn ghost sm" data-act="open" data-id="${esc(w.id)}" type="button">Open “${esc(w.name)}”</button>`).join('');
    } else {
      const n = members.length;
      status.innerHTML = `<strong>Shared: ${esc(wsName(wsId))}</strong><span>${n ? n + (n === 1 ? ' person' : ' people') + ' · ' : ''}changes sync live</span>`;
      actions.innerHTML = '<button class="btn primary sm" data-act="invite" type="button">Invite people</button>' +
        '<button class="btn ghost sm" data-act="members" type="button">People</button>' +
        (isOwner() ? '' : '<button class="btn ghost sm" data-act="leave" type="button">Leave</button>') +
        '<button class="btn ghost sm" data-act="own" type="button">My own calculator</button>';
    }

    let html = '';
    if (panelMode === 'create') {
      html = `<form class="share-form" data-form="create">
          <label for="shareName">Name this shared calculator</label>
          <div class="share-row"><input id="shareName" value="My rig" maxlength="60" autocomplete="off">
          <button class="btn primary sm" type="submit">${busy ? 'Creating…' : 'Create and invite'}</button>
          <button class="btn ghost sm" data-act="close" type="button">Cancel</button></div>
          <label class="share-check"><input type="checkbox" id="shareSeed" checked> Start with the fixtures, rigs and photos already on this device</label>
        </form>`;
    } else if (panelMode === 'invite') {
      html = `<p>Anyone you send this link to can sign in and <strong>edit</strong> this calculator with you.</p>
        <div class="share-row"><input id="inviteLink" readonly value="${esc(inviteLink)}" aria-label="Invite link">
        <button class="btn primary sm" data-act="copy" type="button">Copy link</button></div>
        <p class="share-small">Send it by message or email. <button class="linklike" data-act="revoke" type="button">Switch off all invite links</button></p>`;
    } else if (panelMode === 'members') {
      html = '<ul class="share-members">' + members.map(m =>
        `<li><span><strong>${esc(m.name)}</strong> <small>${m.role === 'owner' ? 'owner' : 'editor'}${user && m.uid === user.uid ? ' · you' : ''}</small></span>` +
        (isOwner() && m.role !== 'owner' ? `<button class="linklike" data-act="remove" data-uid="${esc(m.uid)}" type="button">Remove</button>` : '') + '</li>').join('') + '</ul>';
    } else if (panelMode === 'join' && joinInfo) {
      html = `<p>You’ve been invited to edit <strong>${esc(joinInfo.name)}</strong>.</p>
        <div class="share-row"><button class="btn primary sm" data-act="join" type="button">${busy ? 'Joining…' : 'Join and open'}</button>
        <button class="btn ghost sm" data-act="dismissjoin" type="button">Not now</button></div>`;
    }
    if (msg) html += `<p class="share-msg">${esc(msg)}</p>`;
    panel.innerHTML = html;
    panel.hidden = !html;
    if (panelMode === 'create' && !panel.dataset.focused) { panel.dataset.focused = '1'; const i = $('shareName'); if (i) { i.focus(); i.select(); } }
    if (panelMode !== 'create') delete panel.dataset.focused;
  }

  /* ---------- actions ---------- */
  async function makeInvite() {
    try { const code = await B.workspaces.createInvite(wsId, wsName(wsId)); inviteLink = `${baseURL}?join=${wsId}.${code}`; }
    catch (e) { msg = 'Couldn’t create an invite link. Please try again.'; }
  }

  bar.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act; msg = '';
    if (act === 'share') { panelMode = 'create'; render(); }
    else if (act === 'close') { panelMode = null; render(); }
    else if (act === 'open') openWs(b.dataset.id);
    else if (act === 'own') { wsId = ''; panelMode = null; syncURL(); setFrame(''); watchMembers(); render(); }
    else if (act === 'invite') { panelMode = 'invite'; render(); if (!inviteLink) { await makeInvite(); render(); } }
    else if (act === 'members') { panelMode = panelMode === 'members' ? null : 'members'; render(); }
    else if (act === 'copy') {
      try { await navigator.clipboard.writeText(inviteLink); msg = 'Link copied.'; }
      catch (err) { const i = $('inviteLink'); if (i) { i.select(); msg = 'Press Ctrl+C to copy the link.'; } }
      render();
    }
    else if (act === 'revoke') {
      try { await B.workspaces.revokeInvites(wsId); inviteLink = ''; msg = 'All invite links are switched off. People already in can still edit.'; } catch (err) { msg = 'Couldn’t switch the links off. Please try again.'; }
      render();
    }
    else if (act === 'remove') {
      try { await B.workspaces.removeMember(wsId, b.dataset.uid); } catch (err) { msg = 'Couldn’t remove that person.'; render(); }
    }
    else if (act === 'leave') {
      if (!confirm('Leave this shared calculator? You can rejoin later with an invite link.')) return;
      try { await B.workspaces.leave(wsId); } catch (err) { /* ignore */ }
      wsId = ''; panelMode = null; syncURL(); setFrame(''); await loadMine(); watchMembers(); render();
    }
    else if (act === 'join') {
      busy = true; render();
      try { await B.workspaces.join(joinInfo.id, joinInfo.code); await loadMine(); const id = joinInfo.id; joinParam = ''; joinInfo = null; busy = false; openWs(id); }
      catch (err) { busy = false; msg = 'Couldn’t join with that link. Ask for a new one.'; panelMode = null; render(); }
    }
    else if (act === 'dismissjoin') { joinParam = ''; joinInfo = null; panelMode = null; syncURL(); render(); }
  });

  bar.addEventListener('submit', async e => {
    const f = e.target.closest('[data-form="create"]'); if (!f) return;
    e.preventDefault();
    if (busy) return;
    const name = ($('shareName').value || '').trim() || 'My rig', seed = $('shareSeed').checked;
    busy = true; render();
    try {
      const id = await B.workspaces.create(name);
      await loadMine(); busy = false;
      wsId = id; panelMode = 'invite'; inviteLink = ''; msg = '';
      syncURL(); setFrame(id, seed); watchMembers(); render();
      await makeInvite(); render();
    } catch (err) { busy = false; msg = 'Couldn’t create the shared calculator. Please try again.'; render(); }
  });

  /* ---------- start ---------- */
  (window.BBoxFBReady || Promise.resolve(null)).then(backend => {
    B = backend;
    if (!B) { if (wsId) { wsId = ''; syncURL(); setFrame(''); } render(); return; }
    B.onUser(u => { user = u; refresh(); });
  });
})();
