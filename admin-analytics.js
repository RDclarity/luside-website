// Admin: Besucher-Statistik und Live-Tracker (Daten aus public.track, siehe 20261006110000_tracking.sql).
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var client = null, days = 7, liveTimer = null;
  function esc(str){ return String(str == null ? '' : str).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n){ return Number(n || 0).toLocaleString('de-AT'); }
  function dur(sec){
    sec = Math.round(sec || 0); if(!sec) return '0 s';
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? h + ' h ' + m + ' min' : m ? m + ' min ' + s + ' s' : s + ' s';
  }
  function time(iso){ return new Date(iso).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function dateTime(iso){ return new Date(iso).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }

  // Lesbare Namen für Seiten und Abschnitte
  var PAGES = { '': 'Startseite', 'index.html': 'Startseite', 'termin.html': 'Termin buchen', 'team.html': 'Team', 'seminar.html': 'Seminar',
    'projektbogen.html': 'Projektdatenblatt', 'erstberatung.html': 'Erstberatung', 'datenschutz.html': 'Datenschutz', 'impressum.html': 'Impressum',
    'leistungen-prozesse-systeme.html': 'Leistung: Prozesse & Systeme', 'leistungen-marketing.html': 'Leistung: Marketing',
    'leistungen-finanzen.html': 'Leistung: Finanzen', 'leistungen-digitalisierung-ki.html': 'Leistung: Digitalisierung & KI',
    'leistungen-onlineshop-entwicklung.html': 'Leistung: Onlineshop' };
  var SECTIONS = { hero: 'Einstieg (oben)', statement: 'Aussage', leistungen: 'Leistungen', services: 'Leistungen', ablauf: 'Ablauf', process: 'Ablauf',
    inhaber: 'Inhaber', owners: 'Inhaber', termin: 'Termin', book: 'Termin', kontakt: 'Kontakt', duo: 'Kontakt', footer: 'Fußzeile', 'ls-footer': 'Fußzeile',
    'ls-header': 'Kopfzeile / Menü', header: 'Kopfzeile / Menü', nav: 'Menü', faq: 'FAQ', 'fuer-wen': 'Für wen', ueberblick: 'Überblick',
    aufbau: 'Aufbau', verwandt: 'Verwandte Leistungen', 'mid-cta': 'Zwischen-Aufruf (CTA)', 'band-dim': 'Infoband', legal: 'Rechtstext',
    'worum-es-geht': 'Worum es geht', vortragende: 'Vortragende', 'termin-ort': 'Termin & Ort', agenda: 'Agenda', signup: 'Anmeldung',
    team: 'Team', onlineshop: 'Onlineshop', 'tm-section': 'Terminbuchung', 'pds-result': 'Bestätigung', pdsResult: 'Bestätigung', top: 'Oben' };
  function pageName(p){ var f = String(p || '').split('/').pop(); return PAGES[f] || f || p; }
  function secName(s){ return s ? (SECTIONS[s] || s) : '—'; }
  var CONV = { appointment_booked: 'Termin gebucht', form_submit: 'Anfrage gesendet', project_sheet: 'Projektdatenblatt gesendet', booking_click: 'Klick auf Termin buchen' };

  function rpc(name, args){ return client.rpc(name, args || {}).then(function(r){ if(r.error) throw r.error; return r.data; }); }
  function range(){
    var to = new Date(Date.now() + 60000), from = new Date();
    if(days === 1){ from.setHours(0, 0, 0, 0); } else { from = new Date(Date.now() - days * 86400000); }
    return { p_from: from.toISOString(), p_to: to.toISOString() };
  }

  // ---------- Statistik ----------
  function hbars(el, rows, key, label){
    var max = Math.max.apply(null, rows.map(function(r){ return r.n; }).concat([1]));
    var total = rows.reduce(function(a, r){ return a + r.n; }, 0) || 1;
    $(el).innerHTML = rows.length ? rows.map(function(r){
      return '<div class="hbar"><span>' + esc(label ? label(r[key]) : r[key]) + '</span><b>' + num(r.n) + ' <small style="color:var(--slate);font-weight:400">' + Math.round(r.n / total * 100) + ' %</small></b><div class="t"><i style="width:' + (r.n / max * 100) + '%"></i></div></div>';
    }).join('') : '<p class="an-empty">Noch keine Daten.</p>';
  }
  function funnel(el, steps){
    var first = (steps && steps[0] && steps[0].n) || 0;
    $(el).innerHTML = (steps || []).map(function(s, i){
      var prev = i ? steps[i - 1].n : s.n, pct = first ? Math.round(s.n / first * 100) : 0;
      var drop = i && prev ? Math.round((prev - s.n) / prev * 100) : 0;
      return '<div class="fn-step"><div class="fn-top"><span>' + esc(s.step) + '</span><b>' + num(s.n) + ' · ' + pct + ' %</b></div>'
        + '<div class="fn-track"><div class="fn-fill" style="width:' + pct + '%"></div></div>'
        + (i && drop > 0 ? '<div class="fn-drop">− ' + drop + ' % steigen hier aus</div>' : '') + '</div>';
    }).join('');
  }
  function renderOverview(d){
    var t = d.totals || {};
    var conv = t.sessions ? (t.converted / t.sessions * 100).toFixed(1).replace('.', ',') : '0';
    $('anTotals').innerHTML = [
      ['Besuche', num(t.sessions)], ['Seitenaufrufe', num(t.pageviews)], ['Ø Besuchsdauer', dur(t.avg_seconds)],
      ['Nur eine Seite angesehen', (t.bounce || 0) + ' %'], ['Klicks', num(t.clicks)], ['Conversions', num(t.converted), 1], ['Conversion-Rate', conv + ' %', 1]
    ].map(function(x){ return '<div class="stat' + (x[2] ? ' hl' : '') + '"><div class="num">' + x[1] + '</div><div class="lbl">' + x[0] + '</div></div>'; }).join('');

    // Besuche pro Tag (fehlende Tage mit 0 auffüllen)
    var byDay = {}; (d.daily || []).forEach(function(r){ byDay[r.day] = r.sessions; });
    var list = [], n = Math.max(days, 1);
    for(var i = n - 1; i >= 0; i--){
      var dt = new Date(Date.now() - i * 86400000);
      var key = dt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' });
      list.push({ key: key, n: byDay[key] || 0, label: dt.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' }) });
    }
    var max = Math.max.apply(null, list.map(function(x){ return x.n; }).concat([1]));
    $('anDaily').innerHTML = list.map(function(x){ return '<div class="an-bar" style="height:' + Math.max(x.n / max * 100, x.n ? 4 : 1) + '%"><span>' + x.label + ': ' + x.n + '</span></div>'; }).join('');
    var axis = $('anDaily').nextElementSibling;
    if(!axis || !axis.classList.contains('an-axis')){ axis = document.createElement('div'); axis.className = 'an-axis'; $('anDaily').after(axis); }
    axis.innerHTML = '<span>' + list[0].label + '</span><span>' + list[list.length - 1].label + '</span>';

    funnel('anFunnelBooking', d.funnel_booking);
    funnel('anFunnelContact', d.funnel_contact);

    var pages = d.pages || [];
    $('anPages').innerHTML = pages.length ? pages.map(function(p){
      var reach = [p.r25, p.r50, p.r75, p.r100].map(function(v){ return '<i style="height:' + Math.max(v || 0, 3) + '%" title="' + (v || 0) + ' %"></i>'; }).join('');
      return '<tr><td class="primary" data-label="Seite">' + esc(pageName(p.page)) + '</td>'
        + '<td class="num" data-label="Aufrufe">' + num(p.views) + '</td>'
        + '<td class="num" data-label="Ø Zeit">' + (p.avg_seconds != null ? dur(p.avg_seconds) : '—') + '</td>'
        + '<td data-label="Gelesen bis">' + (p.r25 != null ? '<div style="display:flex;gap:10px;align-items:flex-end"><div class="reach">' + reach + '</div><span class="reach-l">' + [p.r25, p.r50, p.r75, p.r100].map(function(v){ return (v || 0) + '%'; }).join(' · ') + '</span></div>' : '—') + '</td>'
        + '<td class="num" data-label="Ausstiege">' + num(p.exits) + ' <small style="color:var(--slate)">(' + (p.exit_rate || 0) + ' %)</small></td></tr>';
    }).join('') : '<tr class="empty-row"><td colspan="5">Noch keine Daten in diesem Zeitraum.</td></tr>';

    var ex = d.exit_sections || [];
    $('anExits').innerHTML = ex.length ? ex.map(function(r){
      return '<tr><td class="primary" data-label="Seite">' + esc(pageName(r.page)) + '</td><td data-label="Abschnitt">' + esc(secName(r.section)) + '</td><td class="num" data-label="Besucher">' + num(r.n) + '</td></tr>';
    }).join('') : '<tr class="empty-row"><td colspan="3">Noch keine Daten.</td></tr>';

    var cl = d.clicks || [];
    $('anClicks').innerHTML = cl.length ? cl.map(function(r){
      return '<tr><td class="primary" data-label="Element" title="' + esc(r.href || '') + '">' + esc(r.label) + '</td><td data-label="Seite">' + esc(pageName(r.page)) + '</td><td class="num" data-label="Klicks">' + num(r.n) + '</td></tr>';
    }).join('') : '<tr class="empty-row"><td colspan="3">Noch keine Klicks.</td></tr>';

    hbars('anSources', d.sources || [], 'source');
    hbars('anDevices', d.devices || [], 'device');
    hbars('anLangs', d.langs || [], 'lang', function(l){ return l === 'de' ? 'Deutsch (EUR)' : l === 'en' ? 'Englisch (USD)' : l; });
  }

  function trailHtml(events, withLeave){
    if(!events.length) return '<p class="an-empty">Keine Ereignisse.</p>';
    return '<ul class="trail">' + events.filter(function(e){ return withLeave || e.type !== 'leave'; }).map(function(e){
      var cls = e.type === 'pageview' ? 'pv' : e.type === 'conversion' ? 'cv' : e.type === 'leave' ? 'lv' : '';
      var txt = e.type === 'pageview' ? '<b>' + esc(pageName(e.page)) + '</b> geöffnet'
        : e.type === 'click' ? 'Klick: „' + esc(e.label) + '“' + (e.section ? ' <small>in ' + esc(secName(e.section)) + '</small>' : '')
        : e.type === 'form_start' ? 'Formular begonnen (' + esc(e.label) + ')'
        : e.type === 'form_submit' ? 'Formular abgeschickt (' + esc(e.label) + ')'
        : e.type === 'conversion' ? '<b>' + esc(CONV[e.label] || e.label) + '</b>'
        : 'Seite verlassen nach ' + dur(e.seconds) + ', ' + (e.scroll || 0) + ' % gescrollt' + (e.section ? ', zuletzt bei ' + esc(secName(e.section)) : '');
      return '<li class="' + cls + '"><small>' + time(e.at) + '</small>' + txt + '</li>';
    }).join('') + '</ul>';
  }

  function renderSessions(rows){
    $('anSessions').innerHTML = rows.length ? rows.map(function(s){
      var secs = (new Date(s.last_seen) - new Date(s.started_at)) / 1000;
      return '<tr data-sid="' + esc(s.session_id) + '" style="cursor:pointer"><td class="primary nowrap" data-label="">' + dateTime(s.started_at) + (s.converted ? ' <span class="pill bezahlt">Conversion</span>' : '') + '</td>'
        + '<td data-label="Einstieg">' + esc(pageName(s.entry_page)) + '</td>'
        + '<td data-label="Ausstieg">' + esc(pageName(s.page)) + (s.section ? ' <small style="color:var(--slate)">· ' + esc(secName(s.section)) + '</small>' : '') + '</td>'
        + '<td class="num" data-label="Seiten">' + num(s.pages) + '</td><td class="num" data-label="Dauer">' + dur(secs) + '</td>'
        + '<td data-label="Herkunft">' + esc(s.source || 'Direkt') + '</td><td data-label="Gerät">' + esc(s.device || '') + ' · ' + esc((s.lang || '').toUpperCase()) + '</td>'
        + '<td data-label=""><button class="btn btn-sm">Klickpfad</button></td></tr>';
    }).join('') : '<tr class="empty-row"><td colspan="8">Noch keine Besuche in diesem Zeitraum.</td></tr>';
  }
  $('anSessions').addEventListener('click', function(e){
    var tr = e.target.closest('tr[data-sid]'); if(!tr) return;
    var next = tr.nextElementSibling;
    if(next && next.classList.contains('an-detail')){ next.remove(); return; }
    var row = document.createElement('tr'); row.className = 'an-detail';
    row.innerHTML = '<td colspan="8" data-label="">Lade…</td>';
    tr.after(row);
    rpc('analytics_session', { p_session: tr.getAttribute('data-sid') }).then(function(ev){ row.firstChild.innerHTML = trailHtml(ev || [], true); })
      .catch(function(){ row.firstChild.textContent = 'Fehler beim Laden.'; });
  });

  function loadStats(){
    var r = range();
    $('anRangeLabel').textContent = days === 1 ? 'Heute' : 'Letzte ' + days + ' Tage';
    rpc('analytics_overview', r).then(renderOverview).catch(function(err){
      console.error(err);
      $('anTotals').innerHTML = '<p class="an-empty">Statistik noch nicht verfügbar – Migration 20261006110000_tracking.sql ausführen und Benutzer in admin_users eintragen.</p>';
    });
    rpc('analytics_sessions', Object.assign({ p_limit: 150 }, r)).then(function(rows){ renderSessions(rows || []); })
      .catch(function(){ $('anSessions').innerHTML = '<tr class="empty-row"><td colspan="8">Fehler beim Laden.</td></tr>'; });
  }
  $('anRange').addEventListener('click', function(e){
    var b = e.target.closest('[data-days]'); if(!b) return;
    days = parseInt(b.getAttribute('data-days'), 10);
    $('anRange').querySelectorAll('.chip-f').forEach(function(c){ c.classList.toggle('active', c === b); });
    loadStats();
  });

  // ---------- Live ----------
  function renderLive(d){
    var act = d.active || [];
    var badge = $('bLive'); badge.hidden = !act.length; badge.textContent = act.length;
    $('liveTotals').innerHTML = [['Gerade online', act.length, 1], ['In der letzten Stunde', d.last_hour], ['Heute', d.today]]
      .map(function(x){ return '<div class="stat' + (x[2] ? ' hl' : '') + '"><div class="num">' + num(x[1]) + '</div><div class="lbl">' + x[0] + '</div></div>'; }).join('');
    $('liveMeta').textContent = 'Stand ' + time(d.now) + ' · aktualisiert alle 5 Sekunden';
    $('liveList').innerHTML = act.length ? act.map(function(s){
      var secs = (new Date(d.now) - new Date(s.started_at)) / 1000;
      return '<div class="lv-card"><div class="lv-head"><div><div class="lv-page">' + esc(pageName(s.page)) + '</div>'
        + '<div class="lv-sec">' + (s.section ? 'liest gerade: ' + esc(secName(s.section)) : '&nbsp;') + '</div></div>'
        + '<span class="lv-time">seit ' + dur(secs) + '</span></div>'
        + '<div class="lv-scroll" title="' + (s.scroll || 0) + ' % gescrollt"><i style="width:' + (s.scroll || 0) + '%"></i></div>'
        + '<div class="lv-meta"><span class="pill">' + esc(s.device || '?') + '</span><span class="pill">' + esc((s.lang || '?').toUpperCase()) + '</span>'
        + '<span class="pill">' + esc(s.source || 'Direkt') + '</span><span class="pill">' + num(s.pages) + ' Seite' + (s.pages === 1 ? '' : 'n') + '</span>'
        + (s.converted ? '<span class="pill bezahlt">Conversion</span>' : '') + '</div>'
        + trailHtml(s.trail || [], false) + '</div>';
    }).join('') : '<p class="an-empty">Gerade ist niemand auf der Website.</p>';
  }
  function pollLive(){
    rpc('analytics_live').then(renderLive).catch(function(err){
      console.error(err);
      $('liveList').innerHTML = '<p class="an-empty">Live-Ansicht noch nicht verfügbar – Migration 20261006110000_tracking.sql ausführen und Benutzer in admin_users eintragen.</p>';
    });
  }
  function liveLoop(){
    clearTimeout(liveTimer);
    var visible = document.visibilityState === 'visible';
    var onLive = $('pane-live').classList.contains('active');
    if(visible) pollLive();
    // auf dem Live-Tab alle 5 s, sonst alle 30 s (nur für die Zahl am Tab)
    liveTimer = setTimeout(liveLoop, onLive ? 5000 : 30000);
  }
  document.querySelectorAll('.tab[data-tab="live"], .tab[data-tab="besucher"]').forEach(function(t){
    t.addEventListener('click', function(){ if(!client) return; if(t.getAttribute('data-tab') === 'live') liveLoop(); else loadStats(); });
  });

  window.lusidesAdminAnalytics = { load: function(c){ client = c; loadStats(); liveLoop(); } };
})();
