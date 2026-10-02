// Terminkalender im Admin-Bereich (Woche / Monat / Jahr, im Stil von Google Kalender).
// Liest public.appointments (nur für eingeloggte Admins per RLS freigegeben).
(function(){
  var client = null;
  var appts = [];
  var view = 'week';
  var cursor = startOfDay(new Date());
  var current = null; // im Dialog geöffneter Termin

  var HOUR_FROM = 7, HOUR_TO = 20, HOUR_PX = 48;
  var STATUS_LABEL = { gebucht: 'Gebucht', bestaetigt: 'Bestätigt', erledigt: 'Erledigt', abgesagt: 'Abgesagt' };
  var MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var DOW = ['Mo','Di','Mi','Do','Fr','Sa','So'];

  var $ = function(id){ return document.getElementById(id); };

  function esc(str){ var d = document.createElement('div'); d.textContent = str == null ? '' : String(str); return d.innerHTML; }
  function startOfDay(d){ var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n){ var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function startOfWeek(d){ var x = startOfDay(d); var w = (x.getDay() + 6) % 7; return addDays(x, -w); }
  function sameDay(a, b){ return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function dayKey(d){ return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function hm(d){ return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }); }
  function longDate(d){ return d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }

  function byDay(){
    var map = {};
    appts.forEach(function(a){ var k = dayKey(a._start); (map[k] = map[k] || []).push(a); });
    Object.keys(map).forEach(function(k){ map[k].sort(function(x, y){ return x._start - y._start; }); });
    return map;
  }

  // ---------- Ansichten ----------
  function render(){
    document.querySelectorAll('.view-switch button').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-view') === view); });
    if(view === 'week') renderWeek();
    else if(view === 'month') renderMonth();
    else renderYear();
  }

  function renderWeek(){
    var start = startOfWeek(cursor);
    var end = addDays(start, 6);
    $('calTitle').textContent = start.getMonth() === end.getMonth()
      ? MONTHS[start.getMonth()] + ' ' + start.getFullYear()
      : MONTHS[start.getMonth()].slice(0, 3) + ' – ' + MONTHS[end.getMonth()].slice(0, 3) + ' ' + end.getFullYear();
    var today = new Date();
    var map = byDay();
    var head = '<div class="wk wk-head"><div></div>';
    for(var i = 0; i < 7; i++){
      var d = addDays(start, i);
      head += '<div class="wk-dh' + (sameDay(d, today) ? ' is-today' : '') + '">' + DOW[i] + '<span class="dn" data-goto="' + d.toISOString() + '">' + d.getDate() + '</span></div>';
    }
    head += '</div>';
    var body = '<div class="wk-body"><div class="wk"><div class="wk-hours">';
    for(var h = HOUR_FROM; h < HOUR_TO; h++) body += '<div class="wk-hour-label">' + (h === HOUR_FROM ? '' : String(h).padStart(2, '0') + ':00') + '</div>';
    body += '</div>';
    for(var c = 0; c < 7; c++){
      var day = addDays(start, c);
      body += '<div class="wk-col' + (sameDay(day, today) ? ' is-today' : '') + '">';
      for(var s = HOUR_FROM; s < HOUR_TO; s++) body += '<div class="slot-line"></div>';
      (map[dayKey(day)] || []).forEach(function(a){
        var startH = a._start.getHours() + a._start.getMinutes() / 60;
        var endH = a._end.getHours() + a._end.getMinutes() / 60;
        var top = Math.max(0, (startH - HOUR_FROM) * HOUR_PX);
        var height = Math.max(22, (endH - startH) * HOUR_PX - 2);
        body += '<div class="ev st-' + a.status + '" data-id="' + a.id + '" style="top:' + top + 'px;height:' + height + 'px" title="' + esc(a.name) + '">'
          + '<span class="ev-name">' + esc(a.name) + '</span>'
          + '<span class="ev-time">' + hm(a._start) + '–' + hm(a._end) + (a.company ? ' · ' + esc(a.company) : '') + '</span></div>';
      });
      if(sameDay(day, today)){
        var nowH = today.getHours() + today.getMinutes() / 60;
        if(nowH >= HOUR_FROM && nowH <= HOUR_TO) body += '<div class="now-line" style="top:' + ((nowH - HOUR_FROM) * HOUR_PX) + 'px"></div>';
      }
      body += '</div>';
    }
    body += '</div></div>';
    $('calView').innerHTML = head + body;
    var wb = $('calView').querySelector('.wk-body');
    wb.scrollTop = (8 - HOUR_FROM) * HOUR_PX;
  }

  function renderMonth(){
    var first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    $('calTitle').textContent = MONTHS[first.getMonth()] + ' ' + first.getFullYear();
    var gridStart = startOfWeek(first);
    var map = byDay();
    var today = new Date();
    var html = '<div class="mo">';
    DOW.forEach(function(d){ html += '<div class="mo-dow">' + d + '</div>'; });
    for(var i = 0; i < 42; i++){
      var d = addDays(gridStart, i);
      if(i === 35 && d.getMonth() !== first.getMonth()) break;
      var list = map[dayKey(d)] || [];
      html += '<div class="mo-cell' + (d.getMonth() !== first.getMonth() ? ' out' : '') + (sameDay(d, today) ? ' is-today' : '') + '">'
        + '<span class="mo-num" data-goto="' + d.toISOString() + '">' + d.getDate() + '</span>';
      list.slice(0, 3).forEach(function(a){
        html += '<button type="button" class="chip st-' + a.status + '" data-id="' + a.id + '">' + hm(a._start) + ' <b>' + esc(a.name) + '</b></button>';
      });
      if(list.length > 3) html += '<button type="button" class="more" data-goto="' + d.toISOString() + '">+' + (list.length - 3) + ' weitere</button>';
      html += '</div>';
    }
    html += '</div>';
    $('calView').innerHTML = html;
  }

  function renderYear(){
    var y = cursor.getFullYear();
    $('calTitle').textContent = String(y);
    var map = byDay();
    var today = new Date();
    var html = '<div class="yr">';
    for(var m = 0; m < 12; m++){
      var first = new Date(y, m, 1);
      var lead = (first.getDay() + 6) % 7;
      var days = new Date(y, m + 1, 0).getDate();
      var count = 0;
      html += '<div class="yr-m"><h4 data-month="' + m + '">' + MONTHS[m] + '</h4><div class="yr-g">';
      DOW.forEach(function(d){ html += '<span class="d">' + d.charAt(0) + '</span>'; });
      for(var b = 0; b < lead; b++) html += '<span></span>';
      for(var d = 1; d <= days; d++){
        var date = new Date(y, m, d);
        var list = (map[dayKey(date)] || []).filter(function(a){ return a.status !== 'abgesagt'; });
        count += list.length;
        var title = list.map(function(a){ return hm(a._start) + ' ' + a.name; }).join('\n');
        html += '<button type="button" class="' + (sameDay(date, today) ? 'today' : (list.length ? 'has' : '')) + '" data-goto="' + date.toISOString() + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + d + '</button>';
      }
      html += '</div><div class="yr-sum">' + (count ? count + (count === 1 ? ' Termin' : ' Termine') : '&nbsp;') + '</div></div>';
    }
    html += '</div>';
    $('calView').innerHTML = html;
  }

  function renderUpcoming(){
    var now = Date.now();
    var list = appts.filter(function(a){ return a._end.getTime() >= now && a.status !== 'abgesagt'; }).slice(0, 15);
    var active = appts.filter(function(a){ return a.status !== 'abgesagt'; });
    var upcoming = appts.filter(function(a){ return a._end.getTime() >= now && a.status !== 'abgesagt'; });
    $('apptsCount').textContent = active.length + ' Termine gesamt · ' + upcoming.length + ' anstehend · ' + active.filter(function(a){ return a.paid; }).length + ' bezahlt';
    if(!list.length){ $('upcomingBody').innerHTML = '<tr class="empty-row"><td colspan="6">Keine anstehenden Termine.</td></tr>'; return; }
    $('upcomingBody').innerHTML = list.map(function(a){
      return '<tr><td class="primary" data-label="Name"><button type="button" class="name-link" data-id="' + a.id + '">' + esc(a.name) + '</button></td>'
        + '<td data-label="Termin">' + esc(longDate(a._start)) + ', ' + hm(a._start) + '</td>'
        + '<td data-label="Unternehmen">' + esc(a.company || '—') + '</td><td data-label="Thema">' + esc(a.topic || '—') + '</td>'
        + '<td data-label="Status"><span class="status-pill st-' + a.status + '">' + STATUS_LABEL[a.status] + '</span></td>'
        + '<td data-label="Bezahlt" class="' + (a.paid ? 'tag-yes' : 'tag-no') + '">' + (a.paid ? 'Ja' : 'Nein') + '</td></tr>';
    }).join('');
  }

  // ---------- Detail-Dialog ----------
  function teamsCreateUrl(a){
    var p = new URLSearchParams({
      subject: 'Erstgespräch Lusides – ' + a.name + (a.company ? ' (' + a.company + ')' : ''),
      startTime: a._start.toISOString(),
      endTime: a._end.toISOString(),
      content: 'Erstgespräch (60 Min, 350 €)' + (a.topic ? ' · Thema: ' + a.topic : ''),
      attendees: a.email
    });
    return 'https://teams.microsoft.com/l/meeting/new?' + p.toString().replace(/\+/g, '%20');
  }
  function mailUrl(a, link){
    var when = longDate(a._start) + ', ' + hm(a._start) + '–' + hm(a._end) + ' Uhr';
    var body = 'Hallo ' + a.name + ',\n\n'
      + 'vielen Dank für deine Buchung. Hier die Details zu unserem Erstgespräch:\n\n'
      + 'Termin: ' + when + '\n'
      + 'Dauer: 60 Minuten\n'
      + 'Ort: Microsoft Teams (Video)\n'
      + 'Link: ' + (link || '[Teams-Link einfügen]') + '\n\n'
      + 'Die Rechnung über 350 € erhältst du separat.\n\n'
      + 'Bis bald!\nLusides';
    return 'mailto:' + encodeURIComponent(a.email)
      + '?subject=' + encodeURIComponent('Dein Erstgespräch mit Lusides am ' + a._start.toLocaleDateString('de-AT') + ' (Microsoft Teams)')
      + '&body=' + encodeURIComponent(body);
  }
  function setMsg(text, isErr){ var m = $('mMsg'); m.textContent = text || ''; m.classList.toggle('show', !!text); m.classList.toggle('err', !!isErr); }

  function refreshModalLinks(){
    if(!current) return;
    var link = $('mTeams').value.trim();
    $('mMail').href = mailUrl(current, link);
    var join = $('mJoin');
    if(/^https:\/\//.test(link)){ join.href = link; join.style.display = ''; } else { join.removeAttribute('href'); join.style.display = 'none'; }
  }

  function openModal(id){
    var a = appts.filter(function(x){ return x.id === id; })[0];
    if(!a) return;
    current = a;
    $('mTop').className = 'modal-top st-' + a.status;
    $('mName').textContent = a.name;
    $('mWhen').textContent = longDate(a._start) + ' · ' + hm(a._start) + '–' + hm(a._end) + ' · Microsoft Teams';
    var rows = [
      ['Unternehmen', esc(a.company || '—')],
      ['E-Mail', '<a href="mailto:' + esc(a.email) + '">' + esc(a.email) + '</a>'],
      ['Telefon', a.phone ? '<a href="tel:' + esc(a.phone.replace(/\s+/g, '')) + '">' + esc(a.phone) + '</a>' : '—'],
      ['Thema', esc(a.topic || '—')],
      ['Nachricht', esc(a.message || '—')],
      ['Preis', esc(new Intl.NumberFormat('de-AT', { style: 'currency', currency: a.currency || 'EUR' }).format(a.price_eur || 350))],
      ['Bestellung', esc(a.order_no || '—')],
      ['Rechnung', esc(invoiceLabel(a))],
      ['Rechnungsadr.', esc([a.billing_company, a.billing_street, [a.billing_zip, a.billing_city].filter(Boolean).join(' '), a.billing_country, a.billing_uid].filter(Boolean).join(', ') || '—')],
      ['Gebucht am', esc(new Date(a.created_at).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' }))]
    ];
    $('mInfo').innerHTML = rows.map(function(r){ return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('');
    $('mStatus').value = a.status;
    $('mPaid').checked = !!a.paid;
    $('mTeams').value = a.teams_link || '';
    $('mNotes').value = a.admin_notes || '';
    $('mTeamsCreate').href = teamsCreateUrl(a);
    var inv = docs() && docs().invoiceFor(a.id);
    ['mInvPdf', 'mOrderPdf', 'mResend'].forEach(function(id){ $(id).style.display = inv ? '' : 'none'; });
    setMsg('');
    refreshModalLinks();
    $('apptModal').classList.add('show');
    $('apptModal').setAttribute('aria-hidden', 'false');
  }
  function closeModal(){
    $('apptModal').classList.remove('show');
    $('apptModal').setAttribute('aria-hidden', 'true');
    current = null;
  }

  function save(){
    if(!current) return;
    var link = $('mTeams').value.trim();
    if(link && !/^https:\/\//.test(link)){ setMsg('Der Teams-Link muss mit https:// beginnen.', true); return; }
    var patch = { status: $('mStatus').value, paid: $('mPaid').checked, teams_link: link || null, admin_notes: $('mNotes').value.trim() || null };
    $('mSave').disabled = true;
    client.from('appointments').update(patch).eq('id', current.id).select().then(function(res){
      $('mSave').disabled = false;
      if(res.error){ setMsg(/appointments_active_slot|duplicate/.test(res.error.message) ? 'Dieser Slot ist bereits durch einen anderen Termin belegt.' : 'Speichern fehlgeschlagen: ' + res.error.message, true); return; }
      Object.assign(current, patch);
      $('mTop').className = 'modal-top st-' + current.status;
      setMsg('Gespeichert.');
      render(); renderUpcoming();
    });
  }
  function remove(){
    if(!current) return;
    if(!confirm('Termin von ' + current.name + ' endgültig löschen? Tipp: Status „Abgesagt“ behält den Verlauf.')) return;
    var id = current.id;
    client.from('appointments').delete().eq('id', id).select().then(function(res){
      if(res.error || !res.data || !res.data.length){ setMsg('Löschen nicht möglich: Zu diesem Termin gibt es eine Rechnung. Bitte Status „Abgesagt“ setzen und die Rechnung stornieren.', true); return; }
      appts = appts.filter(function(a){ return a.id !== id; });
      closeModal(); render(); renderUpcoming();
    });
  }

  function docs(){ return window.lusidesAdminDocs; }
  function invoiceLabel(a){
    var inv = docs() && docs().invoiceFor(a.id);
    if(!inv) return '—';
    return inv.invoice_no + ' · ' + inv.status + (inv.sent_at ? ' · gesendet' : (a.mail_status === 'fehler' ? ' · Versandfehler' : ''));
  }

  // ---------- Export ----------
  function exportCsv(){
    if(!window.lusidesAdminDownloadCSV) return;
    window.lusidesAdminDownloadCSV('termine.csv', appts, [
      { label: 'Datum', get: function(a){ return a._start.toLocaleDateString('de-AT'); } },
      { label: 'Beginn', get: function(a){ return hm(a._start); } },
      { label: 'Ende', get: function(a){ return hm(a._end); } },
      { label: 'Name', get: function(a){ return a.name; } },
      { label: 'Unternehmen', get: function(a){ return a.company; } },
      { label: 'E-Mail', get: function(a){ return a.email; } },
      { label: 'Telefon', get: function(a){ return a.phone; } },
      { label: 'Thema', get: function(a){ return a.topic; } },
      { label: 'Nachricht', get: function(a){ return a.message; } },
      { label: 'Status', get: function(a){ return STATUS_LABEL[a.status]; } },
      { label: 'Bezahlt', get: function(a){ return a.paid ? 'Ja' : 'Nein'; } },
      { label: 'Preis (€)', get: function(a){ return a.price_eur; } },
      { label: 'Teams-Link', get: function(a){ return a.teams_link; } }
    ]);
  }

  // ---------- Events ----------
  function move(dir){
    if(view === 'week') cursor = addDays(cursor, 7 * dir);
    else if(view === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
    else cursor = new Date(cursor.getFullYear() + dir, 0, 1);
    render();
  }
  function bind(){
    $('calPrev').addEventListener('click', function(){ move(-1); });
    $('calNext').addEventListener('click', function(){ move(1); });
    $('calToday').addEventListener('click', function(){ cursor = startOfDay(new Date()); render(); });
    document.querySelectorAll('.view-switch button').forEach(function(b){
      b.addEventListener('click', function(){ view = b.getAttribute('data-view'); render(); });
    });
    document.getElementById('termine').addEventListener('click', function(e){
      var ev = e.target.closest('[data-id]');
      if(ev){ openModal(ev.getAttribute('data-id')); return; }
      var go = e.target.closest('[data-goto]');
      if(go){ cursor = startOfDay(new Date(go.getAttribute('data-goto'))); view = 'week'; render(); return; }
      var mo = e.target.closest('[data-month]');
      if(mo){ cursor = new Date(cursor.getFullYear(), parseInt(mo.getAttribute('data-month'), 10), 1); view = 'month'; render(); }
    });
    $('mClose').addEventListener('click', closeModal);
    $('apptModal').addEventListener('click', function(e){ if(e.target === $('apptModal')) closeModal(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && current) closeModal(); });
    $('mSave').addEventListener('click', save);
    $('mDelete').addEventListener('click', remove);
    $('mInvPdf').addEventListener('click', function(){ var inv = current && docs().invoiceFor(current.id); if(inv) docs().openPdf(inv.id, 'invoice'); });
    $('mOrderPdf').addEventListener('click', function(){ var inv = current && docs().invoiceFor(current.id); if(inv) docs().openPdf(inv.id, 'order'); });
    $('mResend').addEventListener('click', function(){ if(current) docs().resend(current.id); });
    $('mTeams').addEventListener('input', refreshModalLinks);
    $('exportApptsBtn').addEventListener('click', exportCsv);
  }

  var bound = false;
  window.lusidesAdminCalendar = {
    load: function(c){
      client = c;
      if(!bound){ bind(); bound = true; }
      render();
      client.from('appointments').select('*').order('start_at', { ascending: true }).then(function(res){
        if(res.error){
          console.error(res.error);
          $('apptsCount').textContent = 'Termine konnten nicht geladen werden. Ist die Migration 20261002120000_appointments.sql schon in Supabase ausgeführt?';
          $('upcomingBody').innerHTML = '<tr class="empty-row"><td colspan="6">Fehler beim Laden.</td></tr>';
          return;
        }
        appts = (res.data || []).map(function(a){ a._start = new Date(a.start_at); a._end = new Date(a.end_at); return a; });
        render(); renderUpcoming();
      });
    }
  };
})();
