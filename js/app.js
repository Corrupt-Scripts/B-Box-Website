/* =========================================================
   B-Box website — behaviour
   No build step, no dependencies.
   ========================================================= */

/* ---------- EDIT ME: site settings ---------- */
const CONFIG = {
  email: 'support@b-boxuk.co.uk',          // shown in Contact + used for the contact form
  phone: '07979 962839',
  address: '',                              // leave blank to hide the address on the Contact page
  formEndpoint: '',                         // e.g. a Formspree URL. Leave blank to open the visitor's email app instead.
  vatRate: 0.20,                            // UK VAT. Prices in PRODUCTS below already include it.
  demoCheckout: false,                       // true = the basket makes demo orders on this device only (no payment). Set false when you go live.
  portalUrl: 'https://polar.sh/b-box/portal'                             // your Polar customer portal link: where buyers see their real licence keys and downloads
};

/* ---------- EDIT ME: products ----------
   Names, prices and specs below are placeholders — replace with your real ones. */
const PRODUCTS = [
  {
    id: 'bbox-dmx', kind: 'hardware', art: 'dmx', tag: 'Wired & wireless DMX', name: 'B-Box DMX',
    price: 350, unit: 'inc VAT',
    blurb: 'One controller for wired and wireless DMX. Cable it up, or cut the cable runs.',
    specs: ['Wired DMX512 over 5-pin XLR', 'Wireless DMX, no cable runs', 'Hands-on faders with scene memory']
  },
  {
    id: 'bbox-crmx', kind: 'hardware', art: 'crmx', tag: 'CRMX', cool: true, name: 'B-Box CRMX',
    price: 450, unit: 'inc VAT',
    blurb: 'Everything in the B-Box DMX, plus CRMX for CRMX-ready film lights.',
    specs: ['CRMX wireless for compatible fixtures', 'Works with CRMX-ready lights and receivers', 'Wired and wireless DMX included']
  },
  {
    id: 'bbox-desk-app', checkoutUrl: 'https://buy.polar.sh/polar_cl_Z0IGPFazSTXuJTo9n91RJTtRh1eQIThCVf8VQ3sTW0J',   // paste the Polar checkout link here
    kind: 'software', art: 'app', tag: 'Software', name: 'B-Box Lighting Desk',
    price: 99, unit: 'per licence, inc VAT',
    blurb: 'A lighting desk app for your computer: programmer, layout, cues and effects.',
    specs: ['Programmer, layout, patch, cues and effects', 'Command line with Art-Net output', 'Licence key lives in your B-Box account']
  },
  {
    id: 'bbox-pixel-mapper', checkoutUrl: 'https://buy.polar.sh/polar_cl_GtzM16xAPNSZs3YHGIXWHVc6IeCBZYKwH853w2qoi5F',
    kind: 'software', art: 'pixel', tag: 'Software', name: 'B-Box Pixel Mapper',
    price: 150, unit: 'one-off, inc VAT',
    blurb: 'Turns LED strips into a live canvas. Draw your fixtures on a stage, mix and layer 14 built-in effects live, and send the result to your lights over Art-Net or sACN.',
    specs: ['Windows now, macOS coming soon', 'Up to 32,768 universes over Art-Net or sACN', 'One licence key activates on up to 3 computers', 'Checked each time it starts, and works offline for 7 days', 'Sign out of a computer in Settings to move your key']
  },
  {
    id: 'bbox-android', checkoutUrl: 'https://buy.polar.sh/polar_cl_mG9rPaEXeJ9bWudzxwmwg4Q0pCt2NdRYdzqG61ebJR1',   // paste the Polar checkout link here
    kind: 'software', art: 'android', tag: 'Android app', name: 'B-Box Android',
    price: 19.99, unit: 'per licence, inc VAT',
    blurb: 'Control Art-Net and sACN DMX adaptors from your Android phone or tablet, over Bluetooth or Wi-Fi.',
    specs: ['Supports Art-Net and sACN adaptors', 'Connects over Bluetooth or Wi-Fi', 'Faders, scenes and cues on a touchscreen', 'Licence key lives in your B-Box account']
  },
  {
    id: 'bbox-calculator', kind: 'software', art: 'calc', tag: 'Free tool', name: 'DMX Calculator',
    price: 0, unit: 'free to use', free: true,
    blurb: 'Work out addresses, universes and a clean patch before you get to set.',
    specs: ['Patches across universes, never splitting a fixture', 'Saved fixtures and rigs, with photos and notes', 'PDF export, works offline']
  }
];

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const gbp = n => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem('bbox.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('bbox.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
};
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* =========================================================
   Header / nav
   ========================================================= */
(function header() {
  const hdr = $('.site-header'), nav = $('#nav'), btn = $('#menuBtn');
  const onScroll = () => hdr.classList.toggle('scrolled', scrollY > 8);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });

  const close = () => { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  $('#year').textContent = new Date().getFullYear();
  if (!CONFIG.demoCheckout) { const c = $('#cartOpen'); if (c) c.hidden = true; }
  const pl = $('#portalLink');
  if (pl && CONFIG.portalUrl) { pl.hidden = false; $('a', pl).href = CONFIG.portalUrl; }
  const em = $('#contactEmail');
  if (em) {
    em.textContent = CONFIG.email; em.href = 'mailto:' + CONFIG.email;
    const ph = $('#contactPhone');
    ph.textContent = CONFIG.phone; ph.href = 'tel:' + CONFIG.phone.replace(/[^\d+]/g, '');
    const ad = $('#contactAddress');
    if (CONFIG.address) ad.textContent = CONFIG.address; else ad.closest('div').hidden = true;
  }
  // message carried over from the previous page (e.g. after checkout)
  try {
    const flash = sessionStorage.getItem('bbox.flash');
    if (flash) { sessionStorage.removeItem('bbox.flash'); setTimeout(() => toast(flash), 350); }
  } catch { /* ignore */ }
})();

/* =========================================================
   Hero: interactive fader rig
   ========================================================= */
(function rig() {
  if (!$('#lamps')) return;
  const N = 8;
  const vals = new Array(N).fill(0);
  const lampsEl = $('#lamps'), fadersEl = $('#faders'), hint = $('#rigHint');
  const chaseBtn = $('#rigChase');
  let mode = reduceMotion ? 'manual' : 'chase';
  let raf = 0, t0 = performance.now();

  lampsEl.innerHTML = Array.from({ length: N }, () => '<div class="lamp"></div>').join('');
  fadersEl.innerHTML = Array.from({ length: N }, (_, i) => `
    <div class="fader" data-i="${i}">
      <div class="fader-track" role="slider" tabindex="0" aria-label="Channel ${i + 1}" aria-valuemin="0" aria-valuemax="255" aria-valuenow="0" aria-orientation="vertical">
        <div class="fader-cap"></div>
      </div>
      <div class="fader-val">0</div>
      <div class="fader-ch">CH${i + 1}</div>
    </div>`).join('');

  const lamps = $$('.lamp', lampsEl);
  const faders = $$('.fader', fadersEl);

  function paint(i) {
    const v = vals[i], p = v / 255;
    lamps[i].style.setProperty('--v', (p * p * 0.35 + p * 0.65).toFixed(3));
    faders[i].style.setProperty('--p', p.toFixed(3));
    $('.fader-val', faders[i]).textContent = Math.round(v);
    $('.fader-track', faders[i]).setAttribute('aria-valuenow', Math.round(v));
  }
  const set = (i, v) => { vals[i] = clamp(v, 0, 255); paint(i); };
  const setAll = v => vals.forEach((_, i) => set(i, v));

  function setMode(m) {
    mode = m;
    chaseBtn.setAttribute('aria-pressed', String(m === 'chase'));
    hint.textContent = m === 'chase' ? 'Drag the faders' : 'Manual control';
    cancelAnimationFrame(raf);
    if (m === 'chase') { t0 = performance.now(); loop(); }
  }
  function loop() {
    const t = (performance.now() - t0) / 1000;
    for (let i = 0; i < N; i++) set(i, 255 * (0.5 + 0.5 * Math.sin(t * 1.6 - i * 0.7)));
    raf = requestAnimationFrame(loop);
  }

  // pointer drag
  faders.forEach((f, i) => {
    const track = $('.fader-track', f);
    const fromY = y => {
      const r = track.getBoundingClientRect(), cap = 22;
      return clamp(1 - (y - r.top - cap / 2) / (r.height - cap), 0, 1) * 255;
    };
    track.addEventListener('pointerdown', e => {
      track.setPointerCapture(e.pointerId);
      if (mode !== 'manual') setMode('manual');
      set(i, fromY(e.clientY));
      const move = ev => set(i, fromY(ev.clientY));
      const up = () => { track.removeEventListener('pointermove', move); track.removeEventListener('pointerup', up); track.removeEventListener('pointercancel', up); };
      track.addEventListener('pointermove', move); track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up);
    });
    track.addEventListener('keydown', e => {
      const step = e.shiftKey ? 25 : 5; let d = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = step;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -step;
      else if (e.key === 'PageUp') d = 50; else if (e.key === 'PageDown') d = -50;
      else if (e.key === 'Home') { e.preventDefault(); setMode('manual'); return set(i, 0); }
      else if (e.key === 'End') { e.preventDefault(); setMode('manual'); return set(i, 255); }
      if (d) { e.preventDefault(); setMode('manual'); set(i, vals[i] + d); }
    });
  });

  $('#rigBlackout').addEventListener('click', () => { setMode('manual'); setAll(0); });
  $('#rigFull').addEventListener('click', () => { setMode('manual'); setAll(255); });
  chaseBtn.addEventListener('click', () => setMode(mode === 'chase' ? 'manual' : 'chase'));

  // pause the chase when the hero is off-screen or tab hidden
  const hero = $('#welcome');
  let visible = true;
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (mode === 'chase') { cancelAnimationFrame(raf); if (visible && !document.hidden) loop(); }
  }).observe(hero);
  document.addEventListener('visibilitychange', () => {
    if (mode !== 'chase') return;
    cancelAnimationFrame(raf);
    if (!document.hidden && visible) loop();
  });

  if (reduceMotion) [60, 140, 220, 255, 255, 220, 140, 60].forEach((v, i) => set(i, v));
  else setMode('chase');
  vals.forEach((_, i) => paint(i));
})();

/* =========================================================
   Products
   ========================================================= */
const artSvg = {
  dmx: `<img src="assets/b-box-screen.png" alt="B-Box controller screen showing a wired DMX universe and a CRMX universe side by side" loading="lazy">`,
  crmx: `<img src="assets/b-box-screen.png" alt="B-Box controller screen showing a wired DMX universe and a CRMX universe side by side" loading="lazy">`,
  app: `<img src="assets/desk-programmer.jpg" alt="B-Box Lighting Desk, Desk page: a programmer grid of fixtures, intensity and colour controls, and a record cue panel" loading="lazy">`,
  pixel: `<img src="assets/pixel-mapper.png" alt="B-Box Pixel Mapper app icon: a rainbow-coloured cube of LED pixels" loading="lazy">`,
  android: `<div class="shots"><img src="assets/android-live.webp" alt="B-Box Android app, Live screen showing the output of channels 1 to 512, a grand master and cue buttons" loading="lazy"><img src="assets/android-channels.webp" alt="B-Box Android app, Channels screen with a grid of channels and a command line reading 1 thru 12 at 80" loading="lazy"><img src="assets/android-effects.webp" alt="B-Box Android app, Effects screen with LED tape types and effects such as Chase, Rainbow and Candle" loading="lazy"></div>`,
  calc: `<div class="shots"><img src="assets/calc-main.webp" alt="DMX address calculator on a phone: start address, saved fixtures and the rig" loading="lazy"><img src="assets/calc-patch.webp" alt="DMX address calculator on a phone: the patch list and the saved list" loading="lazy"></div>`
};

const productById = id => PRODUCTS.find(p => p.id === id);

// One place decides what a product's buy button does:
//   checkoutUrl set  -> "Buy now" (signed-in visitors only; then opens the payment platform)
//   demoCheckout on  -> "Add to basket" (demo only)
//   otherwise        -> "Enquire to order" (goes to the contact form, product filled in)
function buyButton(p, cls = 'btn primary sm') {
  if (p.free) return '<a class="btn ghost sm" href="calculator.html">Open calculator</a>';
  if (p.checkoutUrl) return `<button class="${cls}" type="button" data-buy-now="${p.id}">Buy now</button>`;
  if (CONFIG.demoCheckout) return `<button class="${cls}" type="button" data-add="${p.id}">Add to basket</button>`;
  return `<a class="${cls}" href="contact.html?product=${encodeURIComponent(p.name)}">Enquire to order</a>`;
}

(function products() {
  const grid = $('#productGrid');
  if (!grid) return;
  grid.innerHTML = PRODUCTS.map(p => `
    <article class="pcard" data-kind="${p.kind}">
      <div class="pcard-art">${artSvg[p.art]}</div>
      <div class="pcard-body">
        <span class="ptag ${p.cool ? 'cool' : ''}">${esc(p.tag)}</span>
        <h3>${esc(p.name)}</h3>
        <p class="blurb">${esc(p.blurb)}</p>
        <ul class="specs">${p.specs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        <div class="pfoot">
          <div class="price">${p.free ? 'Free' : gbp(p.price)}<small>${esc(p.unit)}</small></div>
          ${buyButton(p)}
        </div>
      </div>
    </article>`).join('');

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-add]');
    if (b) { Cart.add(b.dataset.add); toast(productById(b.dataset.add).name + ' added to basket'); }
  });

  $$('[data-buy]').forEach(el => { const p = productById(el.dataset.buy); if (p) el.innerHTML = buyButton(p, 'btn primary'); });
  $$('[data-price-of]').forEach(el => { const p = productById(el.dataset.priceOf); if (p) el.innerHTML = `${gbp(p.price)}<small>${esc(p.unit)}</small>`; });

  $$('.filters .chip').forEach(chip => chip.addEventListener('click', () => {
    const f = chip.dataset.filter;
    $$('.filters .chip').forEach(c => { const on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', String(on)); });
    $$('.pcard', grid).forEach(c => c.classList.toggle('hide', f !== 'all' && c.dataset.kind !== f));
  }));
})();

/* =========================================================
   Basket
   ========================================================= */
const Cart = (function () {
  let items = store.get('cart', []);      // [{id, qty}]
  const drawer = $('#cart'), backdrop = $('#backdrop');
  let lastFocus = null;

  const save = () => store.set('cart', items);
  const count = () => items.reduce((s, i) => s + i.qty, 0);
  const totals = () => {
    const total = items.reduce((s, i) => s + productById(i.id).price * i.qty, 0);   // prices include VAT
    const vat = total - total / (1 + CONFIG.vatRate);                                  // the VAT inside that total
    return { vat, total };
  };

  function render() {
    items = items.filter(i => productById(i.id) && i.qty > 0);
    const c = count(), cc = $('#cartCount');
    cc.textContent = c; cc.hidden = !c;
    $('#cartList').innerHTML = items.map(i => {
      const p = productById(i.id);
      return `<li data-id="${p.id}">
        <div><div class="nm">${esc(p.name)}</div><div class="un">${gbp(p.price)} ${esc(p.unit)}</div>
          <div class="qty"><button data-q="-1" aria-label="Decrease quantity">&minus;</button><span aria-live="polite">${i.qty}</span><button data-q="1" aria-label="Increase quantity">+</button></div></div>
        <div class="lt">${gbp(p.price * i.qty)}</div>
        <span></span><button class="rm" data-rm>Remove</button>
      </li>`;
    }).join('');
    const empty = !items.length;
    $('#cartEmpty').hidden = !empty; $('#cartList').hidden = empty; $('#cartFoot').hidden = empty;
    const t = totals();
    $('#tVat').textContent = gbp(t.vat); $('#tTot').textContent = gbp(t.total);
    $('#shipNote').hidden = !items.some(i => productById(i.id).kind === 'hardware');
    save();
  }

  function open() {
    lastFocus = document.activeElement;
    drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    backdrop.hidden = false; document.body.style.overflow = 'hidden';
    setTimeout(() => $('#cartClose').focus(), 50);
  }
  function close() {
    drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true; document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  $('#cartOpen').addEventListener('click', open);
  $('#cartClose').addEventListener('click', close);
  $('#cartShop').addEventListener('click', close);
  backdrop.addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) close(); });

  $('#cartList').addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    const it = items.find(i => i.id === li.dataset.id);
    if (e.target.closest('[data-rm]')) it.qty = 0;
    const q = e.target.closest('[data-q]'); if (q) it.qty = clamp(it.qty + Number(q.dataset.q), 0, 99);
    render();
  });

  $('#checkout').addEventListener('click', () => {
    if (!CONFIG.demoCheckout) { toast('Checkout isn’t connected yet'); return; }
    const flash = m => { try { sessionStorage.setItem('bbox.flash', m); } catch { /* ignore */ } };
    const user = Auth.current();
    if (!user) {
      flash('Sign in or create an account to check out. Your basket is saved.');
      location.href = 'account.html?tab=up'; return;
    }
    Auth.placeOrder(items.map(i => ({ id: i.id, qty: i.qty })), totals());
    items = []; render();
    flash('Demo order placed — your licences and order are below.');
    location.href = 'account.html';
  });

  render();
  return {
    add(id) { const it = items.find(i => i.id === id); it ? it.qty = Math.min(99, it.qty + 1) : items.push({ id, qty: 1 }); render(); }
  };
})();

/* =========================================================
   Contact form
   ========================================================= */
(function contact() {
  const form = $('#contactForm'), note = $('#contactNote');
  if (!form) return;
  const wanted = new URLSearchParams(location.search).get('product');
  if (wanted) {
    const m = $('#cMsg'); if (m && !m.value) m.value = `I'd like to order the ${wanted}. Please let me know how to pay and the delivery time.`;
    const t = $('#cTopic'); if (t) t.value = 'Sales enquiry';
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    let ok = true;
    $$('input[required], textarea[required]', form).forEach(el => {
      const valid = el.checkValidity() && el.value.trim() !== '';
      el.closest('.field').classList.toggle('invalid', !valid);
      if (!valid) ok = false;
    });
    note.className = 'form-note';
    if (!ok) { note.textContent = ''; $('.invalid input, .invalid textarea', form)?.focus(); return; }

    const d = Object.fromEntries(new FormData(form));
    if (CONFIG.formEndpoint) {
      try {
        const r = await fetch(CONFIG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(d) });
        if (!r.ok) throw new Error();
        note.textContent = 'Thanks — your message has been sent. We’ll reply as soon as we can.';
        form.reset();
      } catch { note.classList.add('bad'); note.textContent = `Sorry, that didn’t send. Please email ${CONFIG.email} instead.`; }
    } else {
      const body = `${d.message}\n\n— ${d.name} (${d.email})`;
      location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('[Website] ' + d.topic)}&body=${encodeURIComponent(body)}`;
      note.textContent = 'Opening your email app with your message ready to send…';
    }
  });
  $$('input, textarea', form).forEach(el => el.addEventListener('input', () => el.closest('.field').classList.remove('invalid')));
})();

/* =========================================================
   Account
   - Firebase configured (js/firebase-config.js): real sign-in, which also powers shared calculators.
   - Not configured: demo accounts that live in this browser only.
   Orders and licences are demo data until a payment provider is connected.
   ========================================================= */
const Auth = (function () {
  const out = $('#authOut'), inn = $('#authIn');
  const tabIn = $('#tabIn'), tabUp = $('#tabUp'), formIn = $('#formIn'), formUp = $('#formUp');
  let backend = null, fbUser = null, ready = false;
  let resolveReady; const readyP = new Promise(r => { resolveReady = r; });

  async function hash(email, pass) {
    const data = new TextEncoder().encode('bbox:' + email + ':' + pass);
    if (crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return btoa(unescape(encodeURIComponent(email + pass)));
  }
  const LICENSED = ['bbox-desk-app', 'bbox-pixel-mapper', 'bbox-android'];
  const users = () => store.get('users', {});
  const demoCurrent = () => { const e = store.get('session', null); return e && users()[e] ? { email: e, ...users()[e] } : null; };
  const current = () => backend ? fbUser : demoCurrent();
  const ordersFor = e => store.get('orders.' + e, []);

  function fbMessage(e) {
    const m = {
      'auth/email-already-in-use': 'An account with that email already exists. Try signing in.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/weak-password': 'Password must be at least 8 characters.',
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/wrong-password': 'Email or password is incorrect.',
      'auth/user-not-found': 'Email or password is incorrect.',
      'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
      'auth/network-request-failed': 'Couldn’t reach the sign-in service. Check your connection.'
    };
    return m[e && e.code] || 'Something went wrong. Please try again.';
  }

  // After signing in, return to the page the visitor came from (only our own calculator page).
  function goNext() {
    const n = new URLSearchParams(location.search).get('next');
    if (n && /^(calculator\.html(\?[\w=.%&-]*)?|products\.html\?buy=[\w-]+)$/.test(n)) { location.href = n; return true; }
    return false;
  }

  function licKey() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = crypto.getRandomValues(new Uint8Array(12));
    const g = i => [...b.slice(i, i + 4)].map(x => A[x % A.length]).join('');
    return `BBOX-${g(0)}-${g(4)}-${g(8)}`;
  }

  function show(which) {
    if (!out) return;
    const up = which === 'up';
    tabIn.setAttribute('aria-selected', String(!up)); tabUp.setAttribute('aria-selected', String(up));
    tabIn.tabIndex = up ? -1 : 0; tabUp.tabIndex = up ? 0 : -1;
    formIn.hidden = up; formUp.hidden = !up;
  }
  tabIn?.addEventListener('click', () => show('in'));
  tabUp?.addEventListener('click', () => show('up'));
  $('.tabs')?.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const up = tabIn.getAttribute('aria-selected') === 'true'; show(up ? 'up' : 'in'); (up ? tabUp : tabIn).focus(); }
  });

  function render() {
    if (!out) return;
    if (!ready) { out.hidden = true; inn.hidden = true; return; }
    const u = current();
    out.hidden = !!u; inn.hidden = !u;
    const dn = $('.demo-note', out);
    if (dn) dn.textContent = backend
      ? (CONFIG.portalUrl ? 'Purchases, licence keys and downloads are handled by our payment partner, Polar.' : 'Orders and licences below are demo data until a payment provider is connected.')
      : 'Demo mode: accounts are stored on this device only until the site is connected to a live back end.';
    if (!u) return;
    $$('#authIn .dash-block').forEach(b => { b.hidden = !!CONFIG.portalUrl; });
    $('#dashName').textContent = `Welcome back, ${u.name.split(' ')[0]}`;
    $('#dashEmail').textContent = u.email;
    const orders = ordersFor(u.email);
    const lics = orders.flatMap(o => o.licences.map(k => typeof k === 'string' ? { key: k, name: 'B-Box Lighting Desk', date: o.date } : { ...k, date: o.date }));
    $('#licList').innerHTML = lics.length
      ? lics.map(l => `<li><div><code>${esc(l.key)}</code><small>${esc(l.name)} · ${esc(l.date)}</small></div><button class="btn ghost sm" data-copy="${esc(l.key)}" type="button">Copy</button></li>`).join('')
      : '<li class="empty-state" style="display:block">No licences yet. Your app licences will appear here after you buy them.</li>';
    $('#orderList').innerHTML = orders.length
      ? orders.map(o => `<li><div><strong>${esc(o.id)}</strong><small>${esc(o.date)} · ${o.lines.map(l => `${l.qty}× ${esc(l.name)}`).join(', ')}</small></div><span class="amt">${gbp(o.total)}</span></li>`).join('')
      : '<li class="empty-state" style="display:block">No orders yet.</li>';
  }

  formUp?.addEventListener('submit', async e => {
    e.preventDefault();
    const note = $('#upNote'); note.className = 'form-note bad';
    const name = $('#upName').value.trim(), email = $('#upEmail').value.trim().toLowerCase(), pass = $('#upPass').value;
    if (!name) return note.textContent = 'Please enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(email)) return note.textContent = 'Please enter a valid email address.';
    if (pass.length < 8) return note.textContent = 'Password must be at least 8 characters.';
    if (backend) {
      try { await backend.signUp({ name, email, password: pass }); }
      catch (err) { return note.textContent = fbMessage(err); }
      formUp.reset(); note.textContent = ''; toast('Account created');
      if (!goNext()) render();
      return;
    }
    const all = users();
    if (all[email]) return note.textContent = 'An account with that email already exists. Try signing in.';
    all[email] = { name, hash: await hash(email, pass) };
    store.set('users', all); store.set('session', email);
    formUp.reset(); note.textContent = ''; toast('Account created');
    if (!goNext()) render();
  });

  formIn?.addEventListener('submit', async e => {
    e.preventDefault();
    const note = $('#inNote'); note.className = 'form-note bad';
    const email = $('#inEmail').value.trim().toLowerCase(), pass = $('#inPass').value;
    if (backend) {
      try { await backend.signIn(email, pass); }
      catch (err) { return note.textContent = fbMessage(err); }
      formIn.reset(); note.textContent = ''; toast('Signed in');
      if (!goNext()) render();
      return;
    }
    const u = users()[email];
    if (!u || u.hash !== await hash(email, pass)) return note.textContent = 'Email or password is incorrect.';
    store.set('session', email); formIn.reset(); note.textContent = ''; toast('Signed in');
    if (!goNext()) render();
  });

  $('#signOut')?.addEventListener('click', async () => {
    if (backend) await backend.signOut(); else store.set('session', null);
    render(); toast('Signed out');
  });
  inn?.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Licence key copied'); } catch { toast('Select the key to copy it'); }
  });

  function placeOrder(lines, totals) {
    const u = current(); if (!u) return;
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const licences = [];
    lines.forEach(l => { if (LICENSED.includes(l.id)) for (let i = 0; i < l.qty; i++) licences.push({ key: licKey(), name: productById(l.id).name }); });
    const order = {
      id: 'BB-' + Date.now().toString(36).toUpperCase(), date, total: totals.total, licences,
      lines: lines.map(l => ({ qty: l.qty, name: productById(l.id).name }))
    };
    store.set('orders.' + u.email, [order, ...ordersFor(u.email)]);
    render();
  }

  if (new URLSearchParams(location.search).get('tab') === 'up') show('up');

  // Wait to learn whether Firebase is set up, then draw the right state.
  (window.BBoxFBReady || Promise.resolve(null)).then(b => {
    backend = b;
    if (backend) backend.onUser(u => { fbUser = u; ready = true; resolveReady(); render(); });
    else { ready = true; resolveReady(); render(); }
  });
  render();
  return { current, show, placeOrder, whenReady: () => readyP };
})();

/* =========================================================
   Buying: visitors must be signed in first.
   Not signed in -> account page (then straight back to checkout).
   Signed in     -> the payment page, with their name and email filled in.
   Note: this guides the normal route. The payment link itself is still a public Polar link.
   ========================================================= */
async function startPurchase(id) {
  const p = productById(id);
  if (!p || !p.checkoutUrl) return;
  await Auth.whenReady();
  const user = Auth.current();
  if (!user) {
    try { sessionStorage.setItem('bbox.flash', 'Please sign in or create an account to buy. You’ll go straight to checkout afterwards.'); } catch { /* ignore */ }
    location.href = 'account.html?tab=up&next=' + encodeURIComponent('products.html?buy=' + id);
    return;
  }
  const url = new URL(p.checkoutUrl);
  if (user.email) url.searchParams.set('customer_email', user.email);
  if (user.name) url.searchParams.set('customer_name', user.name);
  location.href = url.toString();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-buy-now]');
  if (b) { e.preventDefault(); startPurchase(b.dataset.buyNow); }
});
(function resumePurchase() {
  const id = new URLSearchParams(location.search).get('buy');
  if (!id || !productById(id)) return;
  try { history.replaceState(null, '', location.pathname); } catch { /* ignore */ }   // so Back doesn't loop
  startPurchase(id);
})();
