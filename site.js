// Lusides — gemeinsame Interaktionen und Effekte für alle Seiten.
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var header = document.querySelector('.ls-header');
  var root = document.documentElement;

  // ---------- Intro: Schriftzug + schräger Strich, Seiten klappen weg ----------
  var intro = document.querySelector('.ls-intro');
  var introRunning = !!(intro && root.classList.contains('intro-on'));
  var introDone = [];
  function whenIntroOpen(fn){ introRunning ? introDone.push(fn) : fn(); }
  if(intro && !introRunning && intro.parentNode) intro.parentNode.removeChild(intro);
  if(introRunning){
    // Schnittlinie exakt durch den Schnitt im Logo-L legen (Logo-Einheiten 0–100)
    var placeCut = function(){
      var mark = intro.querySelector('.li-mark');
      if(!mark) return;
      var r = mark.getBoundingClientRect();
      var k = 0.675;                       // Steigung des Schnitts (dx/dy)
      var x0 = r.left + 0.485 * r.width;   // Punkt in der Mitte des Spalts
      var y0 = r.top + 0.67 * r.height;
      var H = window.innerHeight;
      intro.style.setProperty('--xt', (x0 - k * y0) + 'px');
      intro.style.setProperty('--xb', (x0 + k * (H - y0)) + 'px');
    };
    placeCut();
    window.addEventListener('resize', placeCut);
    var timers = [];
    var openIntro = function(){
      timers.forEach(clearTimeout);
      intro.classList.add('go', 'cut', 'open');
      root.classList.add('intro-open');
      introRunning = false;
      introDone.splice(0).forEach(function(fn){ fn(); });
      setTimeout(function(){
        if(intro.parentNode) intro.parentNode.removeChild(intro);
        root.classList.remove('intro-on', 'intro-open');
      }, 1500);
    };
    var start = function(){
      if(intro.classList.contains('go')) return;
      placeCut();
      intro.classList.add('go');
      timers.push(setTimeout(function(){ intro.classList.add('cut'); }, 1150));
      timers.push(setTimeout(openIntro, 1950));
    };
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(function(r){ setTimeout(r, 700); })]).then(function(){ requestAnimationFrame(start); });
    intro.addEventListener('click', openIntro);
    window.addEventListener('keydown', function onKey(){ window.removeEventListener('keydown', onKey); if(intro.parentNode && !intro.classList.contains('open')) openIntro(); });
  }

  // ---------- Sanftes Scrollen (Lenis, falls geladen) ----------
  var lenis = null;
  if(!reduce && window.Lenis){
    lenis = new window.Lenis({ duration: 1.15, easing: function(t){ return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    (function raf(time){ lenis.raf(time); requestAnimationFrame(raf); })(0);
    if(introRunning){ lenis.stop(); whenIntroOpen(function(){ lenis.start(); }); }
    document.addEventListener('click', function(e){
      var a = e.target.closest('a[href^="#"]');
      if(!a) return;
      var id = a.getAttribute('href');
      if(id.length < 2) return;
      var target = document.querySelector(id);
      if(!target) return;
      e.preventDefault();
      if(header) header.classList.remove('menu-open');
      lenis.scrollTo(target, { offset: -70 });
    });
  }

  // ---------- Header: ein-/ausblenden, Menü, aktueller Link ----------
  var lastY = window.scrollY;
  var progress = document.querySelector('.ls-progress');
  function onScroll(){
    var y = window.scrollY;
    if(header && !header.classList.contains('menu-open')){
      header.classList.toggle('is-hidden', y > 260 && y > lastY + 4);
      if(y < lastY - 4 || y < 260) header.classList.remove('is-hidden');
    }
    lastY = y;
    if(progress){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (h > 0 ? y / h : 0) + ')';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if(header){
    var burger = header.querySelector('.ls-burger');
    if(burger){
      burger.addEventListener('click', function(){
        var open = header.classList.toggle('menu-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
        if(lenis){ open ? lenis.stop() : lenis.start(); }
      });
      header.querySelectorAll('.ls-links a').forEach(function(a){
        a.addEventListener('click', function(){ header.classList.remove('menu-open'); if(lenis) lenis.start(); });
      });
    }
    var here = location.pathname.split('/').pop() || 'index.html';
    header.querySelectorAll('.ls-links a').forEach(function(a){
      var file = (a.getAttribute('href') || '').split('#')[0];
      if(file && file === here) a.classList.add('is-current');
    });
  }

  // ---------- Reveal beim Scrollen ----------
  var revealEls = document.querySelectorAll('.ls-reveal');
  if('IntersectionObserver' in window && !reduce){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('is-in'); });
  }

  // ---------- Hero: Zeilen gleiten aus der Maske ----------
  document.querySelectorAll('[data-split]').forEach(function(el){
    whenIntroOpen(function(){ setTimeout(function(){ requestAnimationFrame(function(){ el.classList.add('is-in'); }); }, introRunning ? 0 : 350); });
  });

  // ---------- Magnetische Buttons ----------
  if(fine && !reduce){
    document.querySelectorAll('.ls-magnetic').forEach(function(el){
      var strength = parseFloat(el.getAttribute('data-strength') || '0.35');
      el.addEventListener('mousemove', function(e){
        var r = el.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        el.style.transform = 'translate(' + (x * strength) + 'px,' + (y * strength) + 'px)';
      });
      el.addEventListener('mouseleave', function(){ el.style.transform = ''; });
    });
  }

  // ---------- Lichtkegel folgt der Maus (Kacheln, Hero) ----------
  if(fine){
    document.querySelectorAll('[data-spotlight]').forEach(function(el){
      el.addEventListener('pointermove', function(e){
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  // ---------- Hero-Orb: Parallax zur Maus ----------
  var orb = document.querySelector('.h-orb');
  if(orb && fine && !reduce){
    var tx = 0, ty = 0, cx = 0, cy = 0;
    window.addEventListener('pointermove', function(e){
      tx = (e.clientX / window.innerWidth - 0.5) * 80;
      ty = (e.clientY / window.innerHeight - 0.5) * 60;
    });
    (function loop(){
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      orb.style.translate = cx + 'px ' + cy + 'px';
      requestAnimationFrame(loop);
    })();
  }

  // ---------- Statement: Wörter leuchten beim Scrollen auf ----------
  var scrub = document.querySelector('[data-scrub]');
  if(scrub){
    var nodes = [];
    var wrapWords = function(){
      nodes = [];
      var text = scrub.textContent;
      scrub.textContent = '';
      text.split(/(\s+)/).forEach(function(part){
        if(!part) return;
        if(/^\s+$/.test(part)){ scrub.appendChild(document.createTextNode(part)); return; }
        var s = document.createElement('span'); s.className = 'w'; s.textContent = part; scrub.appendChild(s); nodes.push(s);
      });
      scrubUpdate();
    };
    var scrubUpdate = function(){
      if(reduce){ nodes.forEach(function(n){ n.classList.add('on'); }); return; }
      var r = scrub.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      var lit = Math.round(p * nodes.length);
      for(var i = 0; i < nodes.length; i++) nodes[i].classList.toggle('on', i < lit);
    };
    wrapWords();
    window.addEventListener('lusides:langchange', wrapWords);
    if(!reduce) window.addEventListener('scroll', scrubUpdate, { passive: true });
  }

  // ---------- Ablauf: Linie füllt sich, Schritte werden aktiv ----------
  var track = document.querySelector('[data-steps]');
  if(track){
    var fill = track.querySelector('.st-fill');
    var steps = track.querySelectorAll('.st');
    var stepsUpdate = function(){
      var r = track.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (r.height * 0.9)));
      if(fill) fill.style.transform = 'scaleX(' + p + ')';
      steps.forEach(function(s, i){ s.classList.toggle('on', p >= (i / steps.length) + 0.02); });
    };
    if(reduce){ if(fill) fill.style.transform = 'scaleX(1)'; steps.forEach(function(s){ s.classList.add('on'); }); }
    else { window.addEventListener('scroll', stepsUpdate, { passive: true }); stepsUpdate(); }
  }

  // ---------- Zahlen zählen hoch ----------
  document.querySelectorAll('[data-count-to]').forEach(function(el){
    var to = parseInt(el.getAttribute('data-count-to'), 10);
    if(reduce || !('IntersectionObserver' in window)){ el.textContent = to; return; }
    var o = new IntersectionObserver(function(en){
      if(!en[0].isIntersecting) return; o.disconnect();
      var start = performance.now();
      (function tick(now){
        var t = Math.min(1, (now - start) / 1400);
        el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
        if(t < 1) requestAnimationFrame(tick);
      })(start);
    });
    o.observe(el);
  });
})();
