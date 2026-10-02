(function(){
  var planner = document.getElementById('planner');
  if(!planner) return;

  // Buchbare Zeiten — müssen zu book_appointment() in
  // supabase/migrations/20261002120000_appointments.sql passen.
  var TZ = 'Europe/Vienna';
  var REGION = (window.lusidesRegion && window.lusidesRegion.region) || 'EU';
  // EU: Start 09–16 Uhr Wiener Zeit. USA: 15–18 Uhr Wiener Zeit (= 9–12 Uhr New York).
  var SLOT_FIRST_HOUR = REGION === 'US' ? 15 : 9;
  var SLOT_LAST_HOUR = REGION === 'US' ? 18 : 16;
  var LOCAL_TZ = (function(){ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone; }catch(e){ return TZ; } })();
  var SHOW_TZ = REGION === 'US' ? LOCAL_TZ : TZ;
  var INVOICE_URL = (window.LUSIDES_SUPABASE ? window.LUSIDES_SUPABASE.url : '') + '/functions/v1/lusides-invoice';
  var WORKDAYS = [1, 2, 3, 4, 5];
  var MIN_LEAD_HOURS = 12;
  var MAX_DAYS_AHEAD = 90;
  var DURATION_MIN = 60;
  var CRM_INTAKE_URL = 'https://knuktzuqqmrrkpkusren.supabase.co/functions/v1/lusides-rima-sync';

  var calGrid = document.getElementById('calGrid');
  var calMonth = document.getElementById('calMonth');
  var calPrev = document.getElementById('calPrev');
  var calNext = document.getElementById('calNext');
  var slotsEl = document.getElementById('slots');
  var slotsHead = document.getElementById('slotsHead');
  var details = document.getElementById('details');
  var chosenEl = document.getElementById('chosen');
  var form = document.getElementById('bookingForm');
  var bookBtn = document.getElementById('bookBtn');
  var noteEl = document.getElementById('bookNote');
  var successEl = document.getElementById('success');

  var booked = {};          // ISO-Startzeit → true
  var selectedDay = null;   // 'YYYY-MM-DD' (Wiener Kalendertag)
  var selectedSlot = null;  // Date
  var viewYear, viewMonth;  // angezeigter Monat (0-basiert)

  function lang(){ return localStorage.getItem('lusides_lang') === 'en' ? 'en' : 'de'; }
  function locale(){ return lang() === 'en' ? 'en-GB' : 'de-AT'; }
  function str(key, fallback){
    var dict = window.lusidesI18n && window.lusidesI18n.translations[lang()];
    var v = dict && dict.termin_page && dict.termin_page[key];
    return v || fallback;
  }

  // --- Zeitzonen-Helfer: Wiener Ortszeit ↔ absolute Zeit -----------------
  var partsFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  function viennaParts(date){
    var o = {};
    partsFmt.formatToParts(date).forEach(function(p){ if(p.type !== 'literal') o[p.type] = parseInt(p.value, 10); });
    return o;
  }
  function viennaToDate(y, m, d, h){
    var guess = Date.UTC(y, m - 1, d, h, 0, 0);
    var p = viennaParts(new Date(guess));
    var asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    var offset = asUtc - guess;
    var result = new Date(guess - offset);
    // Korrektur an Umstellungstagen
    var p2 = viennaParts(result);
    if(p2.hour !== h){ result = new Date(result.getTime() + (h - p2.hour) * 3600000); }
    return result;
  }
  function dayKey(y, m, d){ return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function isoDow(y, m, d){ var w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return w === 0 ? 7 : w; }

  function slotsForDay(y, m, d){
    var out = [];
    if(WORKDAYS.indexOf(isoDow(y, m, d)) === -1) return out;
    var min = Date.now() + MIN_LEAD_HOURS * 3600000;
    var max = Date.now() + MAX_DAYS_AHEAD * 86400000;
    for(var h = SLOT_FIRST_HOUR; h <= SLOT_LAST_HOUR; h++){
      var dt = viennaToDate(y, m, d, h);
      if(dt.getTime() < min || dt.getTime() > max) continue;
      out.push({ date: dt, taken: !!booked[dt.toISOString()] });
    }
    return out;
  }
  function hasFreeSlot(y, m, d){
    return slotsForDay(y, m, d).some(function(s){ return !s.taken; });
  }

  function fmtTime(date){
    return date.toLocaleTimeString(lang() === 'en' && REGION === 'US' ? 'en-US' : locale(), { timeZone: SHOW_TZ, hour: '2-digit', minute: '2-digit' });
  }
  function fmtLong(date){
    return date.toLocaleDateString(locale(), { timeZone: SHOW_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function price(){ return window.lusidesRegion ? window.lusidesRegion.label() : '350 €'; }
  function updateTzNote(){
    var el = document.getElementById('tzNote');
    if(el && REGION === 'US') el.textContent = str('tz_local', 'All times shown in your local time ({tz}).').replace('{tz}', LOCAL_TZ.replace(/_/g, ' '));
  }

  // --- Belegte Slots laden ---------------------------------------------------
  function loadBooked(){
    return new Promise(function(resolve){
      if(!window.lusidesSupabaseReady){ resolve(); return; }
      window.lusidesSupabaseReady(function(client){
        if(!client){ resolve(); return; }
        var from = new Date();
        var to = new Date(Date.now() + (MAX_DAYS_AHEAD + 2) * 86400000);
        client.rpc('get_booked_slots', { p_from: from.toISOString(), p_to: to.toISOString() }).then(function(res){
          if(res.error){ console.warn('get_booked_slots', res.error); resolve(); return; }
          booked = {};
          (res.data || []).forEach(function(row){
            var v = typeof row === 'string' ? row : (row.get_booked_slots || Object.values(row)[0]);
            booked[new Date(v).toISOString()] = true;
          });
          resolve();
        });
      });
    });
  }

  // --- Monatskalender --------------------------------------------------------
  function renderCalendar(){
    var now = viennaParts(new Date());
    var todayKey = dayKey(now.year, now.month, now.day);
    var first = new Date(Date.UTC(viewYear, viewMonth, 1));
    calMonth.textContent = first.toLocaleDateString(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' });
    var html = '';
    var dowBase = new Date(Date.UTC(2024, 0, 1)); // ein Montag
    for(var i = 0; i < 7; i++){
      var dd = new Date(dowBase.getTime() + i * 86400000);
      html += '<div class="dow">' + dd.toLocaleDateString(locale(), { weekday: 'short', timeZone: 'UTC' }).replace('.', '') + '</div>';
    }
    var lead = (first.getUTCDay() + 6) % 7;
    for(var b = 0; b < lead; b++) html += '<div></div>';
    var days = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    for(var d = 1; d <= days; d++){
      var key = dayKey(viewYear, viewMonth + 1, d);
      var avail = hasFreeSlot(viewYear, viewMonth + 1, d);
      var cls = 'cal-day' + (avail ? ' avail' : '') + (key === selectedDay ? ' selected' : '') + (key === todayKey ? ' today' : '');
      html += '<button type="button" class="' + cls + '" data-day="' + key + '"' + (avail ? '' : ' disabled') + '>' + d + '</button>';
    }
    calGrid.innerHTML = html;
    var nowMonthIdx = now.year * 12 + (now.month - 1);
    var viewIdx = viewYear * 12 + viewMonth;
    calPrev.disabled = viewIdx <= nowMonthIdx;
    var maxP = viennaParts(new Date(Date.now() + MAX_DAYS_AHEAD * 86400000));
    calNext.disabled = viewIdx >= maxP.year * 12 + (maxP.month - 1);
  }

  function renderSlots(){
    if(!selectedDay){
      slotsHead.textContent = str('pick_day', 'Bitte zuerst ein Datum wählen.');
      slotsEl.innerHTML = '';
      return;
    }
    var p = selectedDay.split('-').map(Number);
    var list = slotsForDay(p[0], p[1], p[2]).filter(function(s){ return !s.taken; });
    slotsHead.textContent = fmtLong(viennaToDate(p[0], p[1], p[2], 12));
    if(list.length === 0){
      slotsEl.innerHTML = '<div class="empty">' + str('no_slots', 'Keine freien Termine an diesem Tag.') + '</div>';
      return;
    }
    slotsEl.innerHTML = list.map(function(s){
      var iso = s.date.toISOString();
      var sel = selectedSlot && selectedSlot.toISOString() === iso;
      return '<button type="button" class="slot' + (sel ? ' selected' : '') + '" data-slot="' + iso + '">' + fmtTime(s.date) + '</button>';
    }).join('');
  }

  function renderChosen(){
    if(!selectedSlot){ details.classList.remove('show'); return; }
    var end = new Date(selectedSlot.getTime() + DURATION_MIN * 60000);
    chosenEl.textContent = fmtLong(selectedSlot) + ' · ' + fmtTime(selectedSlot) + '–' + fmtTime(end) + ' · Microsoft Teams · ' + price();
    details.classList.add('show');
  }

  function firstAvailableMonth(){
    var now = viennaParts(new Date());
    viewYear = now.year; viewMonth = now.month - 1;
    for(var k = 0; k < 4; k++){
      var days = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
      for(var d = 1; d <= days; d++){ if(hasFreeSlot(viewYear, viewMonth + 1, d)) return; }
      viewMonth++; if(viewMonth > 11){ viewMonth = 0; viewYear++; }
    }
    viewYear = now.year; viewMonth = now.month - 1;
  }

  calGrid.addEventListener('click', function(e){
    var btn = e.target.closest('.cal-day.avail');
    if(!btn) return;
    selectedDay = btn.getAttribute('data-day');
    selectedSlot = null;
    renderCalendar(); renderSlots(); renderChosen();
  });
  slotsEl.addEventListener('click', function(e){
    var btn = e.target.closest('.slot');
    if(!btn) return;
    selectedSlot = new Date(btn.getAttribute('data-slot'));
    renderSlots(); renderChosen();
    if(window.innerWidth < 880) details.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  calPrev.addEventListener('click', function(){ viewMonth--; if(viewMonth < 0){ viewMonth = 11; viewYear--; } renderCalendar(); });
  calNext.addEventListener('click', function(){ viewMonth++; if(viewMonth > 11){ viewMonth = 0; viewYear++; } renderCalendar(); });
  window.addEventListener('lusides:langchange', function(){
    if(viewYear == null) return;
    renderCalendar(); renderSlots(); renderChosen(); updateTzNote();
  });

  // --- Buchen ----------------------------------------------------------------
  function showNote(text, isError){
    noteEl.textContent = text;
    noteEl.classList.add('show');
    noteEl.classList.toggle('error', !!isError);
  }

  function forwardToCrm(fields){
    var parts = fields.name.split(' ');
    var headers = { 'Content-Type': 'application/json' };
    if(window.LUSIDES_SUPABASE && window.LUSIDES_SUPABASE.anonKey){
      headers.apikey = window.LUSIDES_SUPABASE.anonKey;
      headers.Authorization = 'Bearer ' + window.LUSIDES_SUPABASE.anonKey;
    }
    return fetch(CRM_INTAKE_URL, {
      method: 'POST', headers: headers,
      body: JSON.stringify({
        first_name: parts.shift(),
        last_name: parts.join(' ') || null,
        email: fields.email,
        phone: fields.phone || null,
        lead_company: fields.company || null,
        biggest_challenge: 'Erstgespräch gebucht (Teams, 60 Min, ' + price() + '): ' + fields.when + ' · Thema: ' + fields.topic + (fields.message ? ' · ' + fields.message : '')
      })
    }).catch(function(err){ console.warn('CRM forward failed (non-blocking):', err); });
  }

  var lastBooking = null;

  form.addEventListener('submit', function(e){
    e.preventDefault();
    noteEl.classList.remove('show');
    var name = form.name.value.trim();
    var email = form.email.value.trim();
    if(!selectedSlot){ showNote(str('err_slot', 'Bitte wähle einen Termin.'), true); return; }
    if(name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      showNote(str('err_fields', 'Bitte Name und eine gültige E-Mail-Adresse angeben.'), true); return;
    }
    if(form.street.value.trim().length < 3 || form.city.value.trim().length < 2){ showNote(str('err_billing', 'Bitte Straße und Ort für die Rechnung angeben.'), true); return; }
    if(!form.consent.checked){ showNote(str('err_consent', 'Bitte bestätige die Buchung.'), true); return; }
    if(!window.lusidesSupabaseReady){ showNote(str('err_generic', 'Buchung gerade nicht möglich. Bitte versuche es später erneut.'), true); return; }

    bookBtn.disabled = true;
    var fields = {
      name: name, email: email,
      company: form.company.value.trim(),
      phone: form.phone.value.trim(),
      topic: form.topic.value,
      message: form.message.value.trim(),
      street: form.street.value.trim(),
      zip: form.zip.value.trim(),
      city: form.city.value.trim(),
      country: form.country.value === 'XX' ? '' : form.country.value,
      uid: form.uid.value.trim()
    };
    window.lusidesSupabaseReady(function(client){
      if(!client){ bookBtn.disabled = false; showNote(str('err_generic', 'Buchung gerade nicht möglich.'), true); return; }
      client.rpc('book_appointment', {
        p_start: selectedSlot.toISOString(),
        p_name: fields.name, p_email: fields.email,
        p_company: fields.company || null, p_phone: fields.phone || null,
        p_message: fields.message || null, p_topic: fields.topic, p_lang: lang(),
        p_region: REGION, p_street: fields.street, p_zip: fields.zip || null, p_city: fields.city,
        p_country: fields.country || (REGION === 'US' ? 'US' : null), p_uid: fields.uid || null
      }).then(function(res){
        if(res.error){
          if(/billing_required/.test(res.error.message || '')){ showNote(str('err_billing', 'Bitte Straße und Ort angeben.'), true); bookBtn.disabled = false; return; }
          var taken = /slot_taken|invalid_slot/.test(res.error.message || '');
          showNote(taken ? str('err_taken', 'Dieser Termin wurde gerade vergeben. Bitte wähle einen anderen.') : str('err_generic', 'Buchung gerade nicht möglich. Bitte versuche es später erneut.'), true);
          if(taken){
            booked[selectedSlot.toISOString()] = true;
            selectedSlot = null;
            loadBooked().then(function(){ renderCalendar(); renderSlots(); renderChosen(); });
          }
          bookBtn.disabled = false;
          return;
        }
        fields.when = fmtLong(selectedSlot) + ', ' + fmtTime(selectedSlot);
        lastBooking = { start: selectedSlot, name: fields.name };
        forwardToCrm(fields);
        sendDocuments(res.data, fields.email);
        if(window.lusidesLogConversion) window.lusidesLogConversion('appointment_booked');
        document.getElementById('successWhen').textContent = fields.when + ' · Microsoft Teams';
        planner.style.display = 'none';
        successEl.classList.add('show');
        successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  });

  // Bestellschein + Rechnung erzeugen und per E-Mail (invoice@lusides.com) zustellen.
  function sendDocuments(booking, email){
    var okP = document.getElementById('okP');
    if(!booking || !booking.id || !booking.token){ return; }
    var headers = { 'Content-Type': 'application/json' };
    if(window.LUSIDES_SUPABASE){ headers.apikey = window.LUSIDES_SUPABASE.anonKey; headers.Authorization = 'Bearer ' + window.LUSIDES_SUPABASE.anonKey; }
    fetch(INVOICE_URL, { method: 'POST', headers: headers, body: JSON.stringify({ action: 'send', appointment_id: booking.id, token: booking.token }) })
      .then(function(r){ if(!r.ok) throw new Error('mail ' + r.status); })
      .then(function(){ if(okP) okP.textContent = str('ok_mail', 'Sent to {email}.').replace('{email}', email); })
      .catch(function(err){ console.warn(err); if(okP) okP.textContent = str('ok_mail_fail', 'Your documents will follow by email.'); });
  }

  // --- .ics-Datei für den eigenen Kalender ------------------------------------
  function icsDate(d){ return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  document.getElementById('icsBtn').addEventListener('click', function(){
    if(!lastBooking) return;
    var end = new Date(lastBooking.start.getTime() + DURATION_MIN * 60000);
    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lusides//Terminbuchung//DE', 'BEGIN:VEVENT',
      'UID:' + icsDate(lastBooking.start) + '-' + Math.random().toString(36).slice(2) + '@lusides',
      'DTSTAMP:' + icsDate(new Date()),
      'DTSTART:' + icsDate(lastBooking.start), 'DTEND:' + icsDate(end),
      'SUMMARY:Erstgespräch Lusides (Microsoft Teams)',
      'DESCRIPTION:Der Microsoft-Teams-Link folgt per E-Mail.',
      'LOCATION:Microsoft Teams', 'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    var url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url; a.download = 'lusides-erstgespraech.ics';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  // --- Start -----------------------------------------------------------------
  if(REGION === 'US' && form.country) form.country.value = 'US';
  updateTzNote();
  slotsHead.textContent = str('loading', 'Lade freie Termine…');
  loadBooked().then(function(){
    firstAvailableMonth();
    renderCalendar(); renderSlots();
  });
})();
