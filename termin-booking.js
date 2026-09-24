(function(){
  var root = document.getElementById('terminBooking');
  if(!root) return;

  var CRM_INTAKE_URL = 'https://knuktzuqqmrrkpkusren.supabase.co/functions/v1/lusides-rima-sync';
  var NOTIFY_URL = 'https://knuktzuqqmrrkpkusren.supabase.co/functions/v1/lusides-appointment-notify';

  // Nur für die Anzeige — maßgeblich ist public.is_valid_appointment_slot()
  // in supabase/migrations/20260924120000_appointments.sql. Bei Änderungen
  // beide Stellen anpassen.
  var TZ = 'Europe/Vienna';
  var SCHEDULE = {
    weekdays: [1, 2, 4],                          // ISO: Mo, Di, Do
    windows: [['07:00', '12:00'], ['17:00', '21:00']],
    durationMin: 15,
    bufferMin: 30,                                // Pause zwischen zwei Terminen
    minLeadHours: 2,
    horizonDays: 60
  };

  var calGrid = document.getElementById('calGrid');
  var calTitle = document.getElementById('calTitle');
  var calPrev = document.getElementById('calPrev');
  var calNext = document.getElementById('calNext');
  var slotList = document.getElementById('slotList');
  var slotHint = document.getElementById('slotHint');
  var selectedLabel = document.getElementById('selectedSlotLabel');
  var form = document.getElementById('terminForm');
  var submitBtn = form.querySelector('button[type="submit"]');
  var noteEl = document.getElementById('terminNote');
  var successEl = document.getElementById('terminSuccess');

  var booked = {};          // slot ms → true
  var selectedDay = null;   // 'YYYY-MM-DD' (Wiener Kalendertag)
  var selectedSlot = null;  // Date
  var viewMonth = null;     // { y, m } (m 0-basiert)

  // ---------- i18n ----------
  function lang(){ return localStorage.getItem('lusides_lang') || 'de'; }
  function locale(){ return lang() === 'en' ? 'en-GB' : 'de-AT'; }
  function t(key, fallback){
    var dict = (window.lusidesI18n && window.lusidesI18n.translations[lang()]) || {};
    var val = dict.termin_page && dict.termin_page[key];
    return val !== undefined ? val : fallback;
  }

  // ---------- Zeitzonen-Helfer (Wiener Ortszeit ↔ Instant) ----------
  var partsFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  function viennaParts(date){
    var p = {};
    partsFmt.formatToParts(date).forEach(function(x){ p[x.type] = x.value; });
    return { y: +p.year, m: +p.month - 1, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
  }
  function offsetMinutes(date){
    var p = viennaParts(date);
    return (Date.UTC(p.y, p.m, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000) / 60000;
  }
  function viennaToDate(y, m, d, h, mi){
    var guess = Date.UTC(y, m, d, h, mi);
    var off = offsetMinutes(new Date(guess));
    var ts = guess - off * 60000;
    var off2 = offsetMinutes(new Date(ts));
    if(off2 !== off) ts = guess - off2 * 60000;
    return new Date(ts);
  }
  function dayKey(y, m, d){
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function parseHM(s){ var a = s.split(':'); return (+a[0]) * 60 + (+a[1]); }
  function isoWeekday(y, m, d){ var w = new Date(Date.UTC(y, m, d)).getUTCDay(); return w === 0 ? 7 : w; }

  // ---------- Slots ----------
  function slotsForDay(y, m, d){
    if(SCHEDULE.weekdays.indexOf(isoWeekday(y, m, d)) === -1) return [];
    var now = Date.now();
    var earliest = now + SCHEDULE.minLeadHours * 3600000;
    var latest = now + SCHEDULE.horizonDays * 86400000;
    var step = SCHEDULE.durationMin + SCHEDULE.bufferMin;
    var out = [];
    SCHEDULE.windows.forEach(function(w){
      var start = parseHM(w[0]), end = parseHM(w[1]);
      for(var min = start; min + SCHEDULE.durationMin <= end; min += step){
        var dt = viennaToDate(y, m, d, Math.floor(min / 60), min % 60);
        var ms = dt.getTime();
        if(ms < earliest || ms > latest) continue;
        out.push({ date: dt, taken: !!booked[ms] });
      }
    });
    return out;
  }
  function hasFreeSlot(y, m, d){
    return slotsForDay(y, m, d).some(function(s){ return !s.taken; });
  }

  function fmtTime(date){
    return date.toLocaleTimeString(locale(), { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  }
  function fmtSlotLong(date){
    var end = new Date(date.getTime() + SCHEDULE.durationMin * 60000);
    var day = date.toLocaleDateString(locale(), { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
    return day + ' · ' + fmtTime(date) + '–' + fmtTime(end);
  }

  // ---------- Kalender ----------
  function todayParts(){ return viennaParts(new Date()); }
  function lastBookableParts(){ return viennaParts(new Date(Date.now() + SCHEDULE.horizonDays * 86400000)); }

  function renderCalendar(){
    var y = viewMonth.y, m = viewMonth.m;
    var first = new Date(Date.UTC(y, m, 1));
    calTitle.textContent = first.toLocaleDateString(locale(), { timeZone: 'UTC', month: 'long', year: 'numeric' });

    var today = todayParts(), last = lastBookableParts();
    calPrev.disabled = (y === today.y && m === today.m);
    calNext.disabled = (y === last.y && m === last.m);

    var html = '';
    // Wochentags-Kopfzeile (Montag zuerst) — 2024-01-01 war ein Montag.
    for(var i = 0; i < 7; i++){
      var wd = new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale(), { timeZone: 'UTC', weekday: 'short' });
      html += '<div class="cal-wd">' + wd.replace('.', '') + '</div>';
    }
    var lead = isoWeekday(y, m, 1) - 1;
    for(i = 0; i < lead; i++) html += '<div class="cal-empty"></div>';

    var daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for(var d = 1; d <= daysInMonth; d++){
      var key = dayKey(y, m, d);
      var free = hasFreeSlot(y, m, d);
      var cls = 'cal-day' + (free ? ' available' : '') + (key === selectedDay ? ' selected' : '')
        + (y === today.y && m === today.m && d === today.d ? ' today' : '');
      html += '<button type="button" class="' + cls + '" data-day="' + key + '"' + (free ? '' : ' disabled') + '>' + d + '</button>';
    }
    calGrid.innerHTML = html;
  }

  function renderSlots(){
    if(!selectedDay){
      slotList.innerHTML = '';
      slotHint.textContent = t('pick_day', 'Wähle links einen Tag aus.');
      slotHint.style.display = '';
      return;
    }
    var a = selectedDay.split('-');
    var slots = slotsForDay(+a[0], +a[1] - 1, +a[2]);
    var dayLabel = new Date(Date.UTC(+a[0], +a[1] - 1, +a[2])).toLocaleDateString(locale(), { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
    slotHint.textContent = dayLabel;
    slotList.innerHTML = slots.map(function(s){
      var ms = s.date.getTime();
      var sel = selectedSlot && selectedSlot.getTime() === ms;
      return '<button type="button" class="slot-btn' + (sel ? ' selected' : '') + '" data-slot="' + ms + '"' + (s.taken ? ' disabled' : '') + '>'
        + fmtTime(s.date) + (s.taken ? ' <span class="slot-taken">' + t('slot_taken_short', 'belegt') + '</span>' : '')
        + '</button>';
    }).join('');
  }

  function renderSelection(){
    if(selectedSlot){
      selectedLabel.textContent = fmtSlotLong(selectedSlot) + ' ' + t('tz_note', '(Wiener Zeit)');
      selectedLabel.classList.add('has-slot');
    } else {
      selectedLabel.textContent = t('no_slot', 'Noch kein Termin gewählt — bitte oben Tag und Uhrzeit auswählen.');
      selectedLabel.classList.remove('has-slot');
    }
  }

  function renderAll(){ renderCalendar(); renderSlots(); renderSelection(); }

  function firstAvailableMonth(){
    var today = todayParts();
    var cursor = { y: today.y, m: today.m };
    for(var i = 0; i < 4; i++){
      var dim = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
      for(var d = 1; d <= dim; d++){ if(hasFreeSlot(cursor.y, cursor.m, d)) return cursor; }
      cursor = cursor.m === 11 ? { y: cursor.y + 1, m: 0 } : { y: cursor.y, m: cursor.m + 1 };
    }
    return { y: today.y, m: today.m };
  }

  calPrev.addEventListener('click', function(){
    viewMonth = viewMonth.m === 0 ? { y: viewMonth.y - 1, m: 11 } : { y: viewMonth.y, m: viewMonth.m - 1 };
    renderCalendar();
  });
  calNext.addEventListener('click', function(){
    viewMonth = viewMonth.m === 11 ? { y: viewMonth.y + 1, m: 0 } : { y: viewMonth.y, m: viewMonth.m + 1 };
    renderCalendar();
  });
  calGrid.addEventListener('click', function(e){
    var btn = e.target.closest('.cal-day');
    if(!btn || btn.disabled) return;
    selectedDay = btn.getAttribute('data-day');
    selectedSlot = null;
    renderAll();
  });
  slotList.addEventListener('click', function(e){
    var btn = e.target.closest('.slot-btn');
    if(!btn || btn.disabled) return;
    selectedSlot = new Date(+btn.getAttribute('data-slot'));
    renderSlots();
    renderSelection();
    if(window.matchMedia('(max-width: 860px)').matches){
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  window.addEventListener('lusides:langchange', function(){ if(viewMonth) renderAll(); });

  // ---------- Belegte Slots laden ----------
  function loadBooked(client){
    if(!client) return Promise.resolve();
    var from = new Date().toISOString();
    var to = new Date(Date.now() + (SCHEDULE.horizonDays + 1) * 86400000).toISOString();
    return client.rpc('get_booked_slots', { p_from: from, p_to: to }).then(function(res){
      if(res.error){ console.warn('get_booked_slots failed', res.error); return; }
      booked = {};
      (res.data || []).forEach(function(row){
        var val = typeof row === 'string' ? row : row.get_booked_slots;
        booked[new Date(val).getTime()] = true;
      });
    });
  }

  // ---------- Formular ----------
  function showNote(text, isError){
    noteEl.textContent = text;
    noteEl.classList.add('show');
    noteEl.classList.toggle('error', !!isError);
  }
  function hideNote(){ noteEl.classList.remove('show'); }

  function forwardToCrm(f, when){
    var headers = { 'Content-Type': 'application/json' };
    if(window.LUSIDES_SUPABASE && window.LUSIDES_SUPABASE.anonKey){
      headers.apikey = window.LUSIDES_SUPABASE.anonKey;
      headers.Authorization = 'Bearer ' + window.LUSIDES_SUPABASE.anonKey;
    }
    return fetch(CRM_INTAKE_URL, {
      method: 'POST', headers: headers, keepalive: true,
      body: JSON.stringify({
        first_name: f.firstName, last_name: f.lastName, email: f.email, phone: f.phone,
        biggest_challenge: 'Kostenloses 15-Min-Gespräch gebucht: ' + when + '\nAngebot: ' + f.offer + '\n\n' + f.message
      })
    }).catch(function(err){ console.warn('CRM forward failed (non-blocking):', err); });
  }

  function triggerNotify(id){
    var headers = { 'Content-Type': 'application/json' };
    if(window.LUSIDES_SUPABASE && window.LUSIDES_SUPABASE.anonKey){
      headers.apikey = window.LUSIDES_SUPABASE.anonKey;
      headers.Authorization = 'Bearer ' + window.LUSIDES_SUPABASE.anonKey;
    }
    return fetch(NOTIFY_URL, { method: 'POST', headers: headers, keepalive: true, body: JSON.stringify({ id: id }) })
      .catch(function(err){ console.warn('notify failed (non-blocking):', err); });
  }

  function icsDate(d){ return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsEscape(s){ return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
  function downloadIcs(id, start){
    var end = new Date(start.getTime() + SCHEDULE.durationMin * 60000);
    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lusides//Terminbuchung//DE', 'BEGIN:VEVENT',
      'UID:' + id + '@lusides.com', 'DTSTAMP:' + icsDate(new Date()),
      'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end),
      'SUMMARY:' + icsEscape('Lusides — ' + t('ics_summary', 'kostenloses 15-Minuten-Gespräch')),
      'DESCRIPTION:' + icsEscape(t('ics_desc', 'Videocall mit Lusides. Den Link erhältst du per E-Mail.')),
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    var url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url; a.download = 'lusides-termin.ics';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    hideNote();

    var f = {
      firstName: form.first_name.value.trim(),
      lastName: form.last_name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      offer: form.offer.value,
      message: form.message.value.trim()
    };

    if(!selectedSlot){ showNote(t('err_no_slot', 'Bitte wähle zuerst einen Tag und eine Uhrzeit aus.'), true); return; }
    if(!f.firstName || !f.lastName || !f.phone || !f.email || !f.offer || !f.message){
      showNote(t('err_required', 'Bitte fülle alle Felder aus.'), true); return;
    }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)){ showNote(t('err_email', 'Bitte gib eine gültige E-Mail-Adresse an.'), true); return; }
    if(!form.privacy.checked){ showNote(t('err_privacy', 'Bitte bestätige die Datenschutzerklärung.'), true); return; }
    if(!window.lusidesSupabaseReady){ showNote(t('err_generic', 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'), true); return; }

    submitBtn.disabled = true;
    var slot = selectedSlot;

    window.lusidesSupabaseReady(function(client){
      if(!client){ showNote(t('err_generic', 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'), true); submitBtn.disabled = false; return; }

      client.rpc('book_appointment', {
        p_slot_start: slot.toISOString(),
        p_first_name: f.firstName,
        p_last_name: f.lastName,
        p_phone: f.phone,
        p_email: f.email,
        p_offer: f.offer,
        p_message: f.message
      }).then(function(res){
        if(res.error) throw res.error;
        var id = res.data;
        var when = fmtSlotLong(slot) + ' ' + t('tz_note', '(Wiener Zeit)');

        triggerNotify(id);
        forwardToCrm(f, when);
        if(window.lusidesLogConversion) window.lusidesLogConversion('appointment_booked');

        form.style.display = 'none';
        document.getElementById('terminPicker').style.display = 'none';
        document.getElementById('terminSuccessWhen').textContent = when;
        successEl.classList.add('show');
        document.getElementById('terminIcsBtn').onclick = function(){ downloadIcs(id, slot); };
        successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch(function(err){
        console.error(err);
        var msg = (err && err.message) || '';
        if(msg.indexOf('SLOT_TAKEN') !== -1 || msg.indexOf('INVALID_SLOT') !== -1){
          showNote(t('err_taken', 'Dieser Termin ist leider nicht mehr frei. Bitte wähle eine andere Uhrzeit.'), true);
          selectedSlot = null;
          loadBooked(client).then(renderAll);
        } else if(msg.indexOf('TOO_MANY_BOOKINGS') !== -1){
          showNote(t('err_too_many', 'Mit dieser E-Mail-Adresse sind bereits Termine gebucht. Bitte melde dich direkt bei uns.'), true);
        } else {
          showNote(t('err_generic', 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'), true);
        }
        submitBtn.disabled = false;
      });
    });
  });

  // ---------- Start ----------
  function init(client){
    loadBooked(client).then(function(){
      viewMonth = firstAvailableMonth();
      renderAll();
    });
  }
  if(window.lusidesSupabaseReady){ window.lusidesSupabaseReady(init); } else { init(null); }
})();
