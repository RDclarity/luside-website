(function(){
  if(!window.lusidesSupabaseReady) return;

  function detectDevice(){
    var ua = navigator.userAgent || '';
    if(/iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'Tablet';
    if(/Mobi|iPhone|Android/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  function genId(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  var sessionId = genId();
  var startTime = Date.now();
  window.LUSIDES_SESSION_ID = sessionId;

  window.lusidesLogConversion = function(eventType){
    if(!window.LUSIDES_SUPABASE) return;
    fetch(window.LUSIDES_SUPABASE.url + '/rest/v1/conversion_events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.LUSIDES_SUPABASE.anonKey,
        'Authorization': 'Bearer ' + window.LUSIDES_SUPABASE.anonKey
      },
      body: JSON.stringify({ session_id: sessionId, event_type: eventType, page: location.pathname }),
      keepalive: true
    }).catch(function(){});
  };

  window.lusidesSupabaseReady(function(client){
    if(!client) return;
    client.from('page_visits').insert({
      session_id: sessionId,
      page: location.pathname,
      referrer: document.referrer || null,
      device_type: detectDevice()
    }).then(function(res){
      if(res.error) console.warn('analytics: insert failed', res.error);
    });
  });

  function sendDuration(){
    var duration = Math.round((Date.now() - startTime) / 1000);
    if(duration < 1) return;
    fetch(window.LUSIDES_SUPABASE.url + '/rest/v1/page_visit_durations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.LUSIDES_SUPABASE.anonKey,
        'Authorization': 'Bearer ' + window.LUSIDES_SUPABASE.anonKey
      },
      body: JSON.stringify({ session_id: sessionId, duration_seconds: duration }),
      keepalive: true
    }).catch(function(){});
  }

  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden'){ sendDuration(); }
  });
  window.addEventListener('pagehide', sendDuration);

  // Track clicks on any booking button present on the page
  document.querySelectorAll('.booking-btn').forEach(function(el){
    el.addEventListener('click', function(){ window.lusidesLogConversion('booking_click'); });
  });
})();

// ---------- Besucher-Statistik + Live-Tracker (public.track) ----------
// Pseudonym: Sitzungs-ID nur im sessionStorage (endet mit dem Tab bzw. nach 30 Min. Inaktivität),
// keine IP, keine Cookies, keine Formularinhalte. Browser mit "Do Not Track"/GPC werden nicht erfasst.
(function(){
  var cfg = window.LUSIDES_SUPABASE;
  if(!cfg || !window.fetch || navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  var URL_TRACK = cfg.url + '/rest/v1/rpc/track';
  var IDLE_MS = 30 * 60 * 1000;
  function ss(k, v){ try{ if(v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); }catch(e){ return null; } }
  function uuid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }

  // Sitzung
  var now = Date.now(), sid = ss('ls_sid'), last = parseInt(ss('ls_seen') || '0', 10);
  if(!sid || now - last > IDLE_MS){ sid = uuid(); ss('ls_sid', sid); ss('ls_src', ''); }
  ss('ls_seen', String(now));

  // Herkunft (nur beim ersten Seitenaufruf der Sitzung)
  var source = ss('ls_src');
  if(!source){
    var utm = (location.search.match(/[?&]utm_source=([^&#]+)/) || [])[1];
    var ref = ''; try{ ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; }catch(e){}
    if(utm) source = decodeURIComponent(utm).slice(0, 60);
    else if(ref && ref !== location.hostname) source = /google\./.test(ref) ? 'Google' : /bing\./.test(ref) ? 'Bing' : /(facebook|fb)\./.test(ref) ? 'Facebook' : /instagram\./.test(ref) ? 'Instagram' : /linkedin\./.test(ref) ? 'LinkedIn' : /chatgpt|openai/.test(ref) ? 'ChatGPT' : ref;
    else source = 'Direkt';
    ss('ls_src', source);
  }
  var ua = navigator.userAgent || '';
  var device = /iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'Tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'Mobile' : 'Desktop';
  var page = location.pathname.replace(/\/index\.html$/, '/');
  function lang(){ return document.documentElement.lang || ''; }

  // Aktueller Abschnitt + Scrolltiefe
  function sectionOf(el){
    var s = el && el.closest ? el.closest('section, header, footer, nav, [data-track-section]') : null;
    if(!s) return '';
    if(s.getAttribute('data-track-section')) return s.getAttribute('data-track-section');
    if(s.id) return s.id;
    var cls = (s.className && typeof s.className === 'string') ? s.className.split(/\s+/)[0] : '';
    return cls || s.tagName.toLowerCase();
  }
  var current = '', maxScroll = 0;
  function scrollPct(){
    var h = document.documentElement.scrollHeight - window.innerHeight;
    return h <= 0 ? 100 : Math.min(100, Math.round(window.scrollY / h * 100));
  }
  function updatePos(){
    var p = scrollPct(); if(p > maxScroll) maxScroll = p;
    var el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    var s = sectionOf(el); if(s) current = s;
  }
  window.addEventListener('scroll', function(){ if(!updatePos.t) updatePos.t = setTimeout(function(){ updatePos.t = 0; updatePos(); }, 250); }, { passive: true });

  // Versand
  var queue = [];
  function payload(){
    return { s: sid, page: page, section: current, scroll: scrollPct(), lang: lang(), device: device, source: source, e: queue.splice(0, 50) };
  }
  function send(beacon){
    ss('ls_seen', String(Date.now()));
    var body = JSON.stringify({ p: payload() });
    try{
      fetch(URL_TRACK, { method: 'POST', keepalive: !!beacon, headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey }, body: body }).catch(function(){});
    }catch(e){}
  }
  function push(ev){ ev.page = ev.page || page; queue.push(ev); if(queue.length >= 20) send(); }

  // Seitenaufruf
  updatePos();
  push({ t: 'pageview', section: current });
  setTimeout(send, 400);

  // Klicks
  document.addEventListener('click', function(e){
    var el = e.target && e.target.closest ? e.target.closest('a, button, summary, [role="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], select, [data-track]') : null;
    if(!el || el.closest('.ls-intro')) return;
    var label = el.getAttribute('data-track') || el.getAttribute('aria-label') || (el.innerText || el.value || el.title || '').replace(/\s+/g, ' ').trim();
    if(el.type === 'checkbox' || el.type === 'radio'){ label = (el.name || 'Auswahl') + ': ' + (el.value || ''); }
    var href = el.tagName === 'A' ? (el.getAttribute('href') || '') : '';
    push({ t: 'click', label: (label || href || el.tagName.toLowerCase()).slice(0, 160), href: href, section: sectionOf(el) });
    if(href && !/^#/.test(href) && !el.target) send(true);
  }, true);

  // Formulare: begonnen / abgeschickt
  var started = {};
  function formName(f){ return f.getAttribute('data-track') || f.id || f.getAttribute('name') || 'formular'; }
  document.addEventListener('focusin', function(e){
    var f = e.target && e.target.form; if(!f) return;
    var n = formName(f); if(started[n]) return; started[n] = 1;
    push({ t: 'form_start', label: n, section: sectionOf(f) }); send();
  });
  document.addEventListener('submit', function(e){ var f = e.target; push({ t: 'form_submit', label: formName(f), section: sectionOf(f) }); send(); }, true);

  // Conversions (Buchung, Anfrage, Datenblatt …) – bestehende Aufrufe mitnutzen
  var prevConv = window.lusidesLogConversion;
  window.lusidesLogConversion = function(type){
    if(prevConv) try{ prevConv(type); }catch(e){}
    push({ t: 'conversion', label: String(type || '').slice(0, 60) }); send();
  };

  // Verlassen: Verweildauer (nur sichtbare Zeit) + maximale Scrolltiefe
  var visibleSince = Date.now(), visibleMs = 0, left = false;
  function leave(){
    if(left) return; left = true;
    visibleMs += Date.now() - visibleSince;
    updatePos();
    push({ t: 'leave', seconds: Math.round(visibleMs / 1000), scroll: maxScroll, section: current });
    visibleMs = 0;   // kommt der Besucher zurück, zählt nur die neue Zeit
    send(true);
  }
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden'){ leave(); }
    else { visibleSince = Date.now(); if(left){ left = false; send(); } }
  });
  window.addEventListener('pagehide', leave);

  // Live: Herzschlag alle 15 s, solange der Tab sichtbar ist
  setInterval(function(){ if(document.visibilityState === 'visible'){ updatePos(); send(); } }, 15000);
})();
