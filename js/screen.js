/* Interactive B-Box controller screen on the home page. */
(function () {
  'use strict';
  var dev = document.getElementById('dev');
  if (!dev) return;
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var demo = dev.closest('.demo');
  var used = function () { demo.classList.add('is-used'); };

  /* ----- master: drag, wheel, arrow keys ----- */
  var master = $('dMaster'), bar = $('dMasterBar'), val = $('dMasterVal');
  var level = 100;
  function setMaster(v) {
    level = Math.max(0, Math.min(100, Math.round(v)));
    val.textContent = level;
    bar.style.width = level + '%';
    master.setAttribute('aria-valuenow', level);
    master.setAttribute('aria-valuetext', level + ' percent');
  }
  function fromPointer(e) {
    var r = bar.parentNode.getBoundingClientRect();
    setMaster(((e.clientX - r.left) / r.width) * 100);
  }
  var dragging = false;
  master.addEventListener('pointerdown', function (e) {
    dragging = true; used();
    master.setPointerCapture(e.pointerId);
    fromPointer(e);
  });
  master.addEventListener('pointermove', function (e) { if (dragging) fromPointer(e); });
  ['pointerup', 'pointercancel'].forEach(function (t) {
    master.addEventListener(t, function () { dragging = false; });
  });
  master.addEventListener('wheel', function (e) {
    e.preventDefault(); used();
    setMaster(level + (e.deltaY < 0 ? 2 : -2));
  }, { passive: false });
  master.addEventListener('keydown', function (e) {
    var d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (e.key === 'Home') setMaster(0);
    else if (e.key === 'End') setMaster(100);
    else if (d) setMaster(level + d);
    else return;
    e.preventDefault(); used();
  });

  /* ----- cues ----- */
  var cues = [['Q1', 'Opening'], ['Q2', 'Preset'], ['Q3', 'Act 1 wash'], ['Q4', 'Sunset'], ['Q5', 'Night']];
  var cueIx = 1, fade = null;
  var cueBar = $('dCueBar'), cuePct = $('dCuePct');
  function showCue(pct) {
    cueBar.style.width = pct + '%';
    cuePct.textContent = Math.round(pct) + '%';
  }
  function labelCue() {
    var c = cues[cueIx], n = cues[(cueIx + 1) % cues.length];
    $('dCueQ').textContent = c[0];
    $('dCueName').textContent = c[1];
    $('dCueNext').textContent = n[0] + ' ' + n[1];
  }
  $('dCue').addEventListener('click', function () {
    used();
    cueIx = (cueIx + 1) % cues.length;
    labelCue();
    if (fade) cancelAnimationFrame(fade);
    if (reduce) { showCue(100); return; }
    var t0 = performance.now(), dur = 3000;
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      showCue(p * 100);
      fade = p < 1 ? requestAnimationFrame(step) : null;
    })(t0);
  });

  /* ----- universes, input, transmitter ----- */
  var onA = true, onB = true, txOn = true;
  function toggle(btn, flag) {
    var v = !flag;
    btn.classList.toggle('is-off', !v);
    btn.setAttribute('aria-pressed', v);
    return v;
  }
  $('dUnivA').addEventListener('click', function () { used(); onA = toggle(this, onA); paint(); });
  $('dUnivB').addEventListener('click', function () { used(); onB = toggle(this, onB); paint(); });
  $('dTx').addEventListener('click', function () {
    used(); txOn = toggle(this, txOn);
    $('dTxVal').textContent = txOn ? 'Active' : 'Off';
    $('dTxChip').classList.toggle('is-off', !txOn);
    paint();
  });
  var inputs = ['Art-Net', 'sACN', 'DMX in'], inIx = 0;
  $('dInput').addEventListener('click', function () {
    used(); inIx = (inIx + 1) % inputs.length; $('dInputVal').textContent = inputs[inIx];
  });

  /* ----- live readouts: levels, fps, signal ----- */
  var fillA = $('dFillA'), fillB = $('dFillB');
  var sigB = 78, rx1 = 64, rx2 = 41;
  function paint() {
    var t = performance.now() / 1000, m = level / 100;
    var a = onA ? m * (0.42 + 0.22 * Math.sin(t * 1.3)) : 0;
    var b = onB && txOn ? m * (0.5 + 0.2 * Math.sin(t * 0.9 + 1.7)) : 0;
    if (reduce) { a = onA ? m * 0.18 : 0; b = onB && txOn ? m * 0.4 : 0; }
    fillA.style.width = (a * 100).toFixed(1) + '%';
    fillB.style.width = (b * 100).toFixed(1) + '%';
    $('dUnivAsub').innerHTML = onA ? 'Wired &middot; 40 fps' : 'Wired &middot; off';
    $('dUnivBsub').innerHTML = !onB ? 'CRMX &middot; off'
      : txOn ? 'CRMX &middot; signal ' + Math.round(sigB) + '%' : 'CRMX &middot; no transmitter';
    $('dRxVal').innerHTML = txOn ? Math.round(rx1) + '% &nbsp;' + Math.round(rx2) + '%' : '&ndash;';
    $('dRxVal').closest('.d-mini').classList.toggle('is-off', !txOn);
    $('dUnivB').classList.toggle('is-off', !onB || !txOn);
  }
  function wander() {
    sigB = Math.max(68, Math.min(88, sigB + (Math.random() - 0.5) * 3));
    rx1 = Math.max(55, Math.min(80, rx1 + (Math.random() - 0.5) * 4));
    rx2 = Math.max(30, Math.min(55, rx2 + (Math.random() - 0.5) * 4));
  }
  var raf = null, last = 0, visible = true;
  function loop(now) {
    if (!visible) { raf = null; return; }
    if (now - last > 66) { last = now; if (Math.random() < 0.12) wander(); paint(); }
    raf = requestAnimationFrame(loop);
  }
  paint();
  if (!reduce) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(loop);
      }).observe(dev);
    } else { raf = requestAnimationFrame(loop); }
  }
})();
