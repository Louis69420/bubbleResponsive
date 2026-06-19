(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- scroll-scrub video ---------------- */
  var VIDEO_URL = 'Video_wash.mp4';
  var canvas = document.getElementById('video-canvas');
  var videoEl = document.getElementById('video-el');
  var ctx = canvas.getContext('2d');
  var frames = [], framesReady = false, lastIdx = -1, seeking = false;

  function resizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(window.innerWidth * dpr);
    var h = Math.round(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    lastIdx = -1;
  }

  function bounds() {
    var vh = window.innerHeight;
    return { start: vh * 0.5, end: document.documentElement.scrollHeight - vh };
  }
  function progress() {
    var b = bounds(), range = b.end - b.start;
    if (range <= 0) return 0;
    return Math.max(0, Math.min(1, (window.scrollY - b.start) / range));
  }
  function draw(frame) {
    var cw = canvas.width, ch = canvas.height;
    var s = Math.max(cw / frame.width, ch / frame.height);
    var dw = frame.width * s, dh = frame.height * s;
    ctx.drawImage(frame, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  async function extractFrames() {
    try {
      var res = await fetch(VIDEO_URL, { mode: 'cors' });
      var url = URL.createObjectURL(await res.blob());
      var v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto'; v.src = url;
      await new Promise(function (ok, no) { v.onloadedmetadata = ok; v.onerror = no; setTimeout(no, 15000); });
      var scale = Math.min(1, 1280 / v.videoWidth);
      var sw = Math.round(v.videoWidth * scale), sh = Math.round(v.videoHeight * scale);
      var count = Math.max(40, Math.min(120, Math.round(v.duration * 24)));
      for (var i = 0; i < count; i++) {
        v.currentTime = (i / (count - 1)) * (v.duration - 0.05);
        await new Promise(function (ok, no) {
          var on = function () { v.removeEventListener('seeked', on); ok(); };
          v.addEventListener('seeked', on); setTimeout(function () { v.removeEventListener('seeked', on); no(); }, 3000);
        });
        frames.push(await createImageBitmap(v, { resizeWidth: sw, resizeHeight: sh }));
      }
      if (frames.length) { framesReady = true; canvas.style.visibility = 'visible'; videoEl.style.display = 'none'; }
      URL.revokeObjectURL(url);
    } catch (e) { /* fall back to live seeking on the <video> */ }
  }

  function videoTick() {
    var p = progress();
    if (framesReady && frames.length) {
      var idx = Math.round(p * (frames.length - 1));
      if (idx !== lastIdx) { lastIdx = idx; if (frames[idx]) draw(frames[idx]); }
    } else if (videoEl.duration && isFinite(videoEl.duration) && videoEl.readyState >= 1) {
      var target = p * videoEl.duration;
      if (!seeking && Math.abs(videoEl.currentTime - target) > 0.001) { seeking = true; videoEl.currentTime = target; }
    }
    requestAnimationFrame(videoTick);
  }

  // prime first frame so the hero is never blank, even before extraction
  function prime() { try { if (videoEl.readyState >= 2) videoEl.currentTime = 0.0001; } catch (e) {} }
  videoEl.addEventListener('seeked', function () { seeking = false; });
  videoEl.addEventListener('stalled', function () { seeking = false; });
  videoEl.addEventListener('loadeddata', prime);
  prime();
  canvas.style.visibility = 'hidden';
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  requestAnimationFrame(videoTick);
  extractFrames();

  /* ---------------- nav frosted on scroll + poster handoff ---------------- */
  var nav = document.getElementById('nav');
  var heroPoster = document.getElementById('hero-poster');
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 40);
    // The attached photo is the first frame; as you scroll it fades, handing off
    // to the scroll-scrub wash video (the second frame onward).
    if (heroPoster) {
      var vh = window.innerHeight || 1;
      heroPoster.style.opacity = Math.max(0, Math.min(1, 1 - window.scrollY / (vh * 0.6)));
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- reveal on scroll (stagger ~60ms) ---------------- */
  if (reduce) {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var sibs = Array.prototype.slice.call(e.target.parentNode.children).filter(function (c) { return c.classList.contains('reveal'); });
          var i = sibs.indexOf(e.target);
          e.target.style.transitionDelay = (Math.max(0, i) * 0.06) + 's';
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }

  /* ---------------- packages toggle (sliding glow + crossfade) ---------------- */
  var tBtns = Array.prototype.slice.call(document.querySelectorAll('.toggle button'));
  var glow = document.getElementById('toggleGlow');
  var vSingle = document.getElementById('view-single');
  var vBundle = document.getElementById('view-bundle');
  function moveGlow(btn) {
    if (!glow) return;
    glow.style.left = btn.offsetLeft + 'px';
    glow.style.width = btn.offsetWidth + 'px';
  }
  function fadeIn(el) {
    el.style.opacity = 0; el.style.transform = 'translateY(10px)';
    requestAnimationFrame(function () {
      el.style.transition = 'opacity .3s var(--ease-out), transform .3s var(--ease-out)';
      requestAnimationFrame(function () { el.style.opacity = 1; el.style.transform = 'none'; });
    });
  }
  tBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      tBtns.forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-selected', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-selected', 'true');
      moveGlow(b);
      var single = b.dataset.view === 'single';
      vSingle.hidden = !single; vBundle.hidden = single;
      if (!reduce) fadeIn(single ? vSingle : vBundle);
    });
  });
  var onBtn = document.querySelector('.toggle button.on');
  if (onBtn) requestAnimationFrame(function () { moveGlow(onBtn); });
  window.addEventListener('resize', function () { var b = document.querySelector('.toggle button.on'); if (b) moveGlow(b); });

  /* ---------------- before / after slider ---------------- */
  (function beforeAfter() {
    var ba = document.getElementById('ba');
    var before = document.getElementById('baBefore');
    var handle = document.getElementById('baHandle');
    if (!ba || !before || !handle) return;
    var dragging = false;
    function set(pct) {
      pct = Math.max(0, Math.min(100, pct));
      before.style.width = pct + '%';
      handle.style.left = pct + '%';
      handle.setAttribute('aria-valuenow', Math.round(pct));
    }
    function fromEvent(clientX) {
      var r = ba.getBoundingClientRect();
      set(((clientX - r.left) / r.width) * 100);
    }
    ba.addEventListener('pointerdown', function (e) { dragging = true; ba.setPointerCapture(e.pointerId); fromEvent(e.clientX); });
    ba.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e.clientX); });
    ba.addEventListener('pointerup', function () { dragging = false; });
    ba.addEventListener('pointercancel', function () { dragging = false; });
    handle.addEventListener('keydown', function (e) {
      var cur = parseFloat(handle.getAttribute('aria-valuenow')) || 50;
      if (e.key === 'ArrowLeft') { set(cur - 4); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { set(cur + 4); e.preventDefault(); }
      else if (e.key === 'Home') { set(0); e.preventDefault(); }
      else if (e.key === 'End') { set(100); e.preventDefault(); }
    });
    // subtle invitation: nudge once when it scrolls into view
    if (!reduce && 'IntersectionObserver' in window) {
      var seen = false;
      new IntersectionObserver(function (es, ob) {
        es.forEach(function (en) {
          if (en.isIntersecting && !seen) {
            seen = true;
            var t0 = performance.now();
            (function nudge(now) {
              var k = Math.min(1, (now - t0) / 1100);
              var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // easeInOutCubic
              set(50 + Math.sin(e * Math.PI) * 14);
              if (k < 1) requestAnimationFrame(nudge); else set(50);
            })(t0);
            ob.disconnect();
          }
        });
      }, { threshold: 0.45 }).observe(ba);
    }
  })();

  /* ---------------- magnetic buttons ---------------- */
  if (!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.magnet').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var mx = e.clientX - (r.left + r.width / 2);
        var my = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + mx * 0.18 + 'px,' + (my * 0.28 - 2) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------------- pillar cursor glow ---------------- */
  document.querySelectorAll('.pillar').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
    });
  });

  /* ---------------- graceful gallery placeholders ---------------- */
  document.querySelectorAll('.gallery .shot img').forEach(function (img) {
    img.addEventListener('error', function () { img.style.opacity = '0'; });
  });

  /* ---------------- particles (ambient mist) ---------------- */
  var pc = document.getElementById('particles');
  var px = pc.getContext('2d');
  var dots = [];
  function sizeP() { pc.width = window.innerWidth; pc.height = window.innerHeight; makeDots(); }
  function makeDots() {
    dots = [];
    var n = Math.floor((pc.width * pc.height) / 16000);
    for (var i = 0; i < n; i++) dots.push({ x: Math.random() * pc.width, y: Math.random() * pc.height, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: Math.random() * 1.4 + 0.4, o: Math.random() * 0.5 + 0.15 });
  }
  function drawDots() {
    px.clearRect(0, 0, pc.width, pc.height);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      px.beginPath(); px.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      px.fillStyle = 'rgba(226,240,239,' + d.o + ')'; px.fill();
    }
  }
  function stepDots() {
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i]; d.x += d.vx; d.y += d.vy;
      if (d.x < 0) d.x = pc.width; if (d.x > pc.width) d.x = 0;
      if (d.y < 0) d.y = pc.height; if (d.y > pc.height) d.y = 0;
    }
    drawDots(); requestAnimationFrame(stepDots);
  }
  sizeP();
  window.addEventListener('resize', sizeP);
  if (reduce) drawDots(); else requestAnimationFrame(stepDots);

  /* ---------------- hero wash-reveal (wipe the dust off the live video) ----
     The hero background is the live scroll-scrub video. A procedural dust
     film is painted over it on the ink canvas; moving the cursor anywhere
     across the hero carves wobbly holes out of the film (destination-out),
     revealing the video frame beneath. Holes heal, and the whole film lifts
     as you scroll — handing off to the video wash with no frame jump. */
  (function washReveal() {
    var hero = document.getElementById('hero');
    var stage = document.getElementById('heroReveal');
    var ink = document.getElementById('heroInk');
    if (!hero || !stage || !ink) return;

    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduce || !fine) { stage.classList.add('is-static'); return; }

    var BRUSH = 132, LIFETIME = 600, R_START = 10, R_VARY = 0.45;
    var STAMP_STEP = 10, MAX_STAMPS = 200, SEGMENTS = 36;
    var WOBBLE = [0.14, 0.08, 0.05];
    var GRAD_STOPS = [0.95, 0.88, 0];
    var GRAD_INNER = 0.2;
    var FADE_VH = 0.85;

    var ictx = ink.getContext('2d');
    var stamps = [], running = false, lastPos = null, heroVisible = true;
    var dims = { w: 0, h: 0 };
    var dustTex = null;

    function buildDust() {
      var w = dims.w, h = dims.h;
      if (w <= 0 || h <= 0) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var c = document.createElement('canvas');
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      var g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var base = g.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, 'rgba(78,66,49,0.55)');
      base.addColorStop(0.5, 'rgba(88,75,56,0.64)');
      base.addColorStop(1, 'rgba(58,50,39,0.72)');
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      var motes = Math.floor(w * h / 900);
      for (var i = 0; i < motes; i++) {
        var t = 45 + Math.random() * 70;
        g.beginPath();
        g.arc(Math.random() * w, Math.random() * h, Math.random() * 2.1 + 0.3, 0, Math.PI * 2);
        g.fillStyle = 'rgba(' + ((t + 35) | 0) + ',' + ((t + 24) | 0) + ',' + ((t + 10) | 0) + ',' + (Math.random() * 0.22 + 0.05) + ')';
        g.fill();
      }
      for (var j = 0; j < Math.floor(motes / 45) + 4; j++) {
        var sx = Math.random() * w, sy = Math.random() * h, sr = Math.random() * 130 + 50;
        var rg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
        rg.addColorStop(0, 'rgba(36,30,22,0.2)'); rg.addColorStop(1, 'rgba(36,30,22,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
      }
      dustTex = c;
    }

    function paintDust(alpha) {
      ictx.globalCompositeOperation = 'source-over';
      ictx.clearRect(0, 0, dims.w, dims.h);
      if (alpha <= 0 || !dustTex) return;
      ictx.globalAlpha = alpha;
      ictx.drawImage(dustTex, 0, 0, dims.w, dims.h);
      ictx.globalAlpha = 1;
    }

    function sizeInk() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = stage.getBoundingClientRect();
      dims.w = rect.width; dims.h = rect.height;
      ink.width = Math.round(dims.w * dpr);
      ink.height = Math.round(dims.h * dpr);
      ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildDust();
    }

    function dustAlpha() {
      var vh = window.innerHeight || 1;
      return Math.max(0, 1 - window.scrollY / (vh * FADE_VH));
    }

    function carve(x, y, r, seed, alpha) {
      var g = ictx.createRadialGradient(x, y, r * GRAD_INNER, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,' + GRAD_STOPS[0] * alpha + ')');
      g.addColorStop(0.5, 'rgba(0,0,0,' + GRAD_STOPS[1] * alpha + ')');
      g.addColorStop(1, 'rgba(0,0,0,' + GRAD_STOPS[2] * alpha + ')');
      ictx.fillStyle = g;
      ictx.beginPath();
      for (var i = 0; i <= SEGMENTS; i++) {
        var a = (i / SEGMENTS) * Math.PI * 2;
        var wob = 0.78
          + WOBBLE[0] * Math.sin(a * 3 + seed)
          + WOBBLE[1] * Math.sin(a * 5 + seed * 2.1)
          + WOBBLE[2] * Math.sin(a * 7 + seed * 0.7);
        var pxx = x + Math.cos(a) * r * wob;
        var pyy = y + Math.sin(a) * r * wob;
        if (i === 0) ictx.moveTo(pxx, pyy); else ictx.lineTo(pxx, pyy);
      }
      ictx.closePath();
      ictx.fill();
    }

    function addStamp(x, y) {
      if (stamps.length >= MAX_STAMPS) stamps.shift();
      stamps.push({ x: x, y: y, born: performance.now(), seed: Math.random() * Math.PI * 2, rmax: BRUSH * (1 - R_VARY + Math.random() * R_VARY) });
    }
    function stampAlong(x, y) {
      if (!lastPos) { addStamp(x, y); }
      else {
        var dx = x - lastPos.x, dy = y - lastPos.y;
        var dist = Math.hypot(dx, dy);
        var steps = Math.max(1, Math.ceil(dist / STAMP_STEP));
        for (var i = 1; i <= steps; i++) addStamp(lastPos.x + dx * i / steps, lastPos.y + dy * i / steps);
      }
      lastPos = { x: x, y: y };
    }

    function loop() {
      var now = performance.now();
      var da = dustAlpha();
      paintDust(da);
      if (da > 0 && stamps.length) {
        ictx.globalCompositeOperation = 'destination-out';
        for (var i = stamps.length - 1; i >= 0; i--) {
          var t = (now - stamps[i].born) / LIFETIME;
          if (t >= 1) { stamps.splice(i, 1); continue; }
          var ease = 1 - Math.pow(1 - t, 3);
          var r = R_START + (stamps[i].rmax - R_START) * ease;
          carve(stamps[i].x, stamps[i].y, r, stamps[i].seed, 1 - t * t);
        }
        ictx.globalCompositeOperation = 'source-over';
      } else if (da <= 0) {
        stamps.length = 0;
      }
      if (heroVisible) requestAnimationFrame(loop); else running = false;
    }
    function start() { if (!running && heroVisible) { running = true; requestAnimationFrame(loop); } }

    function pos(e) { var r = ink.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    hero.addEventListener('mouseenter', function (e) { var p = pos(e); lastPos = p; stampAlong(p.x, p.y); start(); });
    hero.addEventListener('mousemove', function (e) { var p = pos(e); stampAlong(p.x, p.y); start(); });
    hero.addEventListener('mouseleave', function () { lastPos = null; });
    window.addEventListener('scroll', start, { passive: true });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { heroVisible = e.isIntersecting; if (heroVisible) start(); });
      }).observe(stage);
    }

    sizeInk();
    window.addEventListener('resize', sizeInk);
    start();
  })();

  /* ---------------- footer year ---------------- */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------------- ready (triggers hero entrance) ---------------- */
  window.addEventListener('load', function () { document.body.classList.add('loaded'); });
  if (document.readyState === 'complete') document.body.classList.add('loaded');
})();
