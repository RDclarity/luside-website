(function(){
  var planner = document.getElementById('planner');
  if(!planner) return;

  // Buchbare Zeiten — müssen zu book_appointment() in
  // supabase/migrations/20261007100000_booking_channel.sql passen.
  var TZ = 'Europe/Vienna';
  var REGION = (window.lusidesRegion && window.lusidesRegion.region) || 'EU';
  // EU: Start 09–16 Uhr Wiener Zeit. USA: 15–18 Uhr Wiener Zeit (= 9–12 Uhr New York).
  var SLOT_FIRST_HOUR = REGION === 'US' ? 15 : 9;
  var SLOT_LAST_HOUR = REGION === 'US' ? 18 : 16;
  var LOCAL_TZ = (function(){ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone || TZ; }catch(e){ return TZ; } })();
  var SHOW_TZ = REGION === 'US' ? LOCAL_TZ : TZ;
  var INVOICE_URL = (window.LUSIDES_SUPABASE ? window.LUSIDES_SUPABASE.url : '') + '/functions/v1/lusides-invoice';
  var WORKDAYS = [1, 2, 3, 4, 5];
  var MIN_LEAD_HOURS = 12;
  var MAX_DAYS_AHEAD = 90;
  var DURATION_MIN = 30;
  var VAT_RATE = 20;
  var PHONE_RE = /^[0-9+()\/ .\-]*$/;   // identisch zur Server-Prüfung
  var STORE_KEY = 'lusidesBooking';
  var CRM_INTAKE_URL = 'https://knuktzuqqmrrkpkusren.supabase.co/functions/v1/lusides-rima-sync';

  var $ = function(id){ return document.getElementById(id); };
  var calGrid = $('calGrid'), calMonth = $('calMonth'), calPrev = $('calPrev'), calNext = $('calNext');
  var slotsEl = $('slots'), slotsHead = $('slotsHead'), slotNote = $('slotNote');
  var details = $('details'), chosenEl = $('chosen');
  var form = $('bookingForm'), bookBtn = $('bookBtn'), noteEl = $('bookNote');
  var formGrid = $('formGrid'), reviewBtn = $('reviewBtn'), reviewEl = $('review'), reviewList = $('reviewList'), consent2 = $('bk-consent2');
  var successEl = $('success');
  var f = {
    name: $('bk-name'), email: $('bk-email'), phone: $('bk-phone'), company: $('bk-company'),
    street: $('bk-street'), zip: $('bk-zip'), city: $('bk-city'), country: $('bk-country'),
    uid: $('bk-uid'), message: $('bk-message'), consent: $('bk-consent')
  };

  var booked = {};          // ISO-Startzeit → true
  var blocked = {};         // 'YYYY-MM-DD' → true (gesperrte Tage aus blocked_dates)
  var selectedDay = null;   // 'YYYY-MM-DD' (Wiener Kalendertag)
  var selectedSlot = null;  // Date
  var viewYear, viewMonth;  // angezeigter Monat (0-basiert)
  var submitting = false;
  var lastBooking = null;

  function lang(){
    if(window.lusidesI18n && window.lusidesI18n.currentLang) return window.lusidesI18n.currentLang();
    try{ return localStorage.getItem('lusides_lang') === 'en' ? 'en' : 'de'; }catch(e){ return 'de'; }
  }
  // Englische Seite = US-Kunden → durchgehend en-US
  function locale(){ return lang() === 'en' ? 'en-US' : 'de-AT'; }
  function str(key, fallback){
    var dict = window.lusidesI18n && window.lusidesI18n.translations[lang()];
    var v = dict && dict.termin_page && dict.termin_page[key];
    return v || fallback || '';
  }
  function price(){ return window.lusidesRegion ? window.lusidesRegion.label() : '300 €'; }
  function money(amount, currency){
    // de-DE statt de-AT: "291,67 €" (wie der Headline-Preis), nicht "€ 291,67"
    var whole = Math.round(amount * 100) % 100 === 0;
    try{ return new Intl.NumberFormat(lang() === 'en' ? 'en-US' : 'de-DE', { style: 'currency', currency: currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(amount); }
    catch(e){ return amount.toFixed(2) + ' ' + currency; }
  }
  function meetingType(){
    var r = form.querySelector('input[name="meeting"]:checked');
    return r && r.value === 'phone' ? 'phone' : 'video';
  }
  function meetingLabel(mt){ return mt === 'phone' ? str('meet_phone', 'Telefon') : str('meet_video', 'Video (Microsoft Teams)'); }

  // --- Zeitzonen-Helfer: Wiener Ortszeit ↔ absolute Zeit -----------------
  var partsFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  function viennaParts(date){
    var o = {};
    partsFmt.formatToParts(date).forEach(function(p){ if(p.type !== 'literal') o[p.type] = parseInt(p.value, 10); });
    if(o.hour === 24) o.hour = 0;
    return o;
  }
  function viennaToDate(y, m, d, h){
    var guess = Date.UTC(y, m - 1, d, h, 0, 0);
    var p = viennaParts(new Date(guess));
    var asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    var result = new Date(guess - (asUtc - guess));
    var p2 = viennaParts(result);   // Korrektur an Umstellungstagen
    if(p2.hour !== h){ result = new Date(result.getTime() + (h - p2.hour) * 3600000); }
    return result;
  }
  function dayKey(y, m, d){ return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function isoDow(y, m, d){ var w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return w === 0 ? 7 : w; }

  // --- Österreichische Feiertage (identisch zu public.at_holiday in der Migration) ---
  function easterUTC(y){
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    var f2 = Math.floor((b + 8) / 25), g = Math.floor((b - f2 + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var n = h + l - 7 * m + 114;
    return Date.UTC(y, Math.floor(n / 31) - 1, (n % 31) + 1);
  }
  var FIXED_HOLIDAYS = [101, 106, 501, 815, 1026, 1101, 1208, 1224, 1225, 1226, 1231];
  function atHoliday(y, m, d){
    if(FIXED_HOLIDAYS.indexOf(m * 100 + d) !== -1) return true;
    var diff = Math.round((Date.UTC(y, m - 1, d) - easterUTC(y)) / 86400000);
    return diff === 1 || diff === 39 || diff === 50 || diff === 60; // Ostermontag, Christi Himmelfahrt, Pfingstmontag, Fronleichnam
  }
  function dayClosed(y, m, d){ return atHoliday(y, m, d) || !!blocked[dayKey(y, m, d)]; }

  function slotsForDay(y, m, d){
    var out = [];
    if(WORKDAYS.indexOf(isoDow(y, m, d)) === -1 || dayClosed(y, m, d)) return out;
    var min = Date.now() + MIN_LEAD_HOURS * 3600000;
    var max = Date.now() + MAX_DAYS_AHEAD * 86400000;
    for(var h = SLOT_FIRST_HOUR; h <= SLOT_LAST_HOUR; h++){
      var dt = viennaToDate(y, m, d, h);
      if(dt.getTime() < min || dt.getTime() > max) continue;
      out.push({ date: dt, taken: !!booked[dt.toISOString()] });
    }
    return out;
  }
  function hasFreeSlot(y, m, d){ return slotsForDay(y, m, d).some(function(s){ return !s.taken; }); }

  function fmtTime(date){
    return date.toLocaleTimeString(locale(), { timeZone: SHOW_TZ, hour: '2-digit', minute: '2-digit' });
  }
  function fmtLong(date){
    return date.toLocaleDateString(locale(), { timeZone: SHOW_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function fmtDayKey(key){
    var p = key.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).toLocaleDateString(locale(), { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function updateTzNote(){
    var el = $('tzNote');
    if(el && REGION === 'US') el.textContent = str('tz_local', 'All times shown in your local time ({tz}).').replace('{tz}', LOCAL_TZ.replace(/_/g, ' '));
  }

  // --- Belegte Slots + gesperrte Tage laden -----------------------------------
  function loadBooked(){
    return new Promise(function(resolve){
      if(!window.lusidesSupabaseReady){ resolve(); return; }
      window.lusidesSupabaseReady(function(client){
        if(!client){ resolve(); return; }
        var from = new Date();
        var to = new Date(Date.now() + (MAX_DAYS_AHEAD + 2) * 86400000);
        var pBooked = client.rpc('get_booked_slots', { p_from: from.toISOString(), p_to: to.toISOString() }).then(function(res){
          if(res.error){ console.warn('get_booked_slots', res.error); return; }
          booked = {};
          (res.data || []).forEach(function(row){
            var v = typeof row === 'string' ? row : (row.get_booked_slots || Object.values(row)[0]);
            booked[new Date(v).toISOString()] = true;
          });
        });
        var pBlocked = client.rpc('get_blocked_days', { p_from: from.toISOString().slice(0, 10), p_to: to.toISOString().slice(0, 10) }).then(function(res){
          if(res.error){ console.warn('get_blocked_days', res.error); return; }
          blocked = {};
          var list = Array.isArray(res.data) ? res.data : [];
          list.forEach(function(v){ if(typeof v === 'string') blocked[v.slice(0, 10)] = true; });
        });
        Promise.all([pBooked, pBlocked]).then(resolve, resolve);
      });
    });
  }

  // --- Schritt-Anzeige 1 Datum · 2 Uhrzeit · 3 Daten --------------------------
  function setStep(el, state){
    el.classList.toggle('is-active', state === 'active');
    el.classList.toggle('is-done', state === 'done');
    el.classList.toggle('is-pending', state === 'pending');
  }
  function updateSteps(){
    setStep($('step1Title'), selectedDay ? 'done' : 'active');
    setStep($('step2Title'), selectedSlot ? 'done' : (selectedDay ? 'active' : 'pending'));
    setStep($('step3Title'), selectedSlot ? 'active' : 'pending');
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
      html += '<div class="dow" aria-hidden="true">' + dd.toLocaleDateString(locale(), { weekday: 'short', timeZone: 'UTC' }).replace('.', '') + '</div>';
    }
    var lead = (first.getUTCDay() + 6) % 7;
    for(var b = 0; b < lead; b++) html += '<div aria-hidden="true"></div>';
    var days = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    for(var d = 1; d <= days; d++){
      var key = dayKey(viewYear, viewMonth + 1, d);
      var avail = hasFreeSlot(viewYear, viewMonth + 1, d);
      var holiday = atHoliday(viewYear, viewMonth + 1, d) && WORKDAYS.indexOf(isoDow(viewYear, viewMonth + 1, d)) !== -1;
      var sel = key === selectedDay;
      var label = fmtDayKey(key) + ', ' + (avail ? str('day_free', 'freie Termine') : (holiday ? str('holiday', 'Feiertag') : str('day_none', 'keine freien Termine')));
      var cls = 'cal-day' + (avail ? ' avail' : '') + (holiday ? ' holiday' : '') + (sel ? ' selected' : '') + (key === todayKey ? ' today' : '');
      html += '<button type="button" class="' + cls + '" data-day="' + key + '" aria-label="' + label.replace(/"/g, '&quot;') + '"'
        + (avail ? ' aria-pressed="' + (sel ? 'true' : 'false') + '"' : ' disabled')
        + (holiday ? ' title="' + str('holiday', 'Feiertag') + '"' : '') + '>' + d + '</button>';
    }
    calGrid.innerHTML = html;
    var nowMonthIdx = now.year * 12 + (now.month - 1);
    var viewIdx = viewYear * 12 + viewMonth;
    calPrev.disabled = viewIdx <= nowMonthIdx;
    var maxP = viennaParts(new Date(Date.now() + MAX_DAYS_AHEAD * 86400000));
    calNext.disabled = viewIdx >= maxP.year * 12 + (maxP.month - 1);
    calPrev.setAttribute('aria-label', str('prev_month', 'Vorheriger Monat'));
    calNext.setAttribute('aria-label', str('next_month', 'Nächster Monat'));
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
      var sel = !!selectedSlot && selectedSlot.toISOString() === iso;
      return '<button type="button" class="slot' + (sel ? ' selected' : '') + '" data-slot="' + iso + '" aria-pressed="' + sel + '">' + fmtTime(s.date) + '</button>';
    }).join('');
  }

  function renderChosen(){
    updateSteps();
    if(!selectedSlot){ details.classList.remove('show'); return; }
    var end = new Date(selectedSlot.getTime() + DURATION_MIN * 60000);
    chosenEl.textContent = fmtLong(selectedSlot) + ' · ' + fmtTime(selectedSlot) + '–' + fmtTime(end) + ' · ' + meetingLabel(meetingType());
    if(isReviewOpen()) renderReview();
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
  function renderAll(){ renderCalendar(); renderSlots(); renderChosen(); }

  function hideSlotNote(){ slotNote.hidden = true; slotNote.textContent = ''; }
  function showSlotNote(text){
    slotNote.textContent = text;
    slotNote.hidden = false;
    slotNote.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try{ slotNote.focus({ preventScroll: true }); }catch(e){ slotNote.focus(); }
  }

  calGrid.addEventListener('click', function(e){
    var btn = e.target.closest('.cal-day.avail');
    if(!btn) return;
    selectedDay = btn.getAttribute('data-day');
    selectedSlot = null;
    hideSlotNote();
    renderAll();
    var again = calGrid.querySelector('[data-day="' + selectedDay + '"]');
    if(again) again.focus();
    if(window.innerWidth < 641) slotsHead.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  slotsEl.addEventListener('click', function(e){
    var btn = e.target.closest('.slot');
    if(!btn) return;
    selectedSlot = new Date(btn.getAttribute('data-slot'));
    hideSlotNote();
    renderSlots(); renderChosen();
    // Weiter zu Schritt 3: Fokus + Scroll
    var t = $('step3Title');
    t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try{ t.focus({ preventScroll: true }); }catch(err){ t.focus(); }
  });
  calPrev.addEventListener('click', function(){ viewMonth--; if(viewMonth < 0){ viewMonth = 11; viewYear--; } renderCalendar(); });
  calNext.addEventListener('click', function(){ viewMonth++; if(viewMonth > 11){ viewMonth = 0; viewYear++; } renderCalendar(); });

  // --- Formular-Logik ----------------------------------------------------------
  var EU = ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'];
  var ISO = 'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW'.split(' ');
  var US_TZ = /^(America\/(New_York|Detroit|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Boise|Juneau|Sitka|Metlakatla|Yakutat|Nome|Adak|Menominee|Indiana\/.*|Kentucky\/.*|North_Dakota\/.*)|Pacific\/Honolulu)$/;
  var TZ_COUNTRY = { 'Europe/Vienna': 'AT', 'Europe/Berlin': 'DE', 'Europe/Busingen': 'DE', 'Europe/Zurich': 'CH', 'Europe/Vaduz': 'LI' };

  function fillCountries(){
    var sel = f.country, keep = sel.value, names;
    try{ names = new Intl.DisplayNames([lang() === 'en' ? 'en' : 'de'], { type: 'region' }); }catch(e){ names = null; }
    var nm = function(c){ try{ return names ? names.of(c) : c; }catch(e){ return c; } };
    // Englische Seite (USD): EU-Kunden buchen auf der deutschen Seite → keine EU-Länder anbieten.
    var codes = REGION === 'US' ? ISO.filter(function(c){ return EU.indexOf(c) === -1; }) : ISO;
    var pinned = REGION === 'US' ? ['US', 'CA', 'GB', 'CH'] : ['AT', 'DE', 'CH'];
    var rest = codes.filter(function(c){ return pinned.indexOf(c) === -1; }).sort(function(a, b){ return nm(a).localeCompare(nm(b)); });
    var html = '<option value="">' + str('country_pick', 'Bitte wählen') + '</option>';
    pinned.forEach(function(c){ html += '<option value="' + c + '">' + nm(c) + '</option>'; });
    html += '<option disabled>──────────</option>';
    rest.forEach(function(c){ html += '<option value="' + c + '">' + nm(c) + '</option>'; });
    sel.innerHTML = html;
    if(keep && codes.indexOf(keep) !== -1) sel.value = keep;
  }
  function updateRegionNote(){
    var note = $('regionNote');
    if(REGION === 'US'){
      note.hidden = false;
      note.innerHTML = '';
      note.appendChild(document.createTextNode(str('region_mismatch', 'Customers in the EU book on the German page, in euros.') + ' '));
      var link = document.createElement('a');
      link.href = '#'; link.textContent = str('region_switch_eur', 'Switch to the German page (EUR)');
      link.addEventListener('click', function(e){ e.preventDefault(); if(window.lusidesI18n) window.lusidesI18n.applyLang('de'); });
      note.appendChild(link);
    } else { note.hidden = true; note.textContent = ''; }
  }
  function normUid(v){ return String(v || '').toUpperCase().replace(/[\s.\-]/g, ''); }
  function uidValid(uid, country){
    return /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(uid) && uid.slice(0, 2) === (country === 'GR' ? 'EL' : country);
  }
  // UID nur auf der deutschen Seite und nur für EU-Länder außer Österreich (Reverse Charge)
  function updateUid(){
    var c = f.country.value;
    var show = REGION === 'EU' && EU.indexOf(c) !== -1 && c !== 'AT';
    $('fldUid').hidden = !show;
    if(!show){ f.uid.value = ''; f.uid.removeAttribute('aria-invalid'); }
  }
  // Tatsächlicher Rechnungsbetrag (spiegelt compute_tax): wird erst in der Übersicht angezeigt
  function charge(){
    var p = (window.lusidesRegion && window.lusidesRegion.pricing) || { amount: 300, currency: 'EUR' };
    if(REGION === 'US') return { amount: p.amount, currency: p.currency, tax: str('tax_us', 'keine österreichische USt') };
    var c = f.country.value, uid = normUid(f.uid.value);
    var net = Math.round(p.amount / (1 + VAT_RATE / 100) * 100) / 100;
    if(c && EU.indexOf(c) === -1) return { amount: net, currency: p.currency, tax: str('tax_noneu', 'ohne USt') };
    if(c && c !== 'AT' && uid && uidValid(uid, c)) return { amount: net, currency: p.currency, tax: str('tax_rc', 'ohne USt (Reverse Charge)') };
    return { amount: p.amount, currency: p.currency, tax: str('tax_incl', 'inkl. 20 % USt') };
  }
  function updateCharge(){ if(isReviewOpen()) renderReview(); }
  function updatePhone(){
    var req = meetingType() === 'phone';
    f.phone.required = req;
    f.phone.setAttribute('aria-required', req ? 'true' : 'false');
    $('bk-phone-label').textContent = req ? str('f_phone_req', 'Telefon *') : str('f_phone', 'Telefon (optional)');
    form.querySelectorAll('.meet-opt').forEach(function(l){ l.classList.toggle('is-checked', l.querySelector('input').checked); });
  }
  function setPlaceholders(){
    [['name', 'ph_name'], ['email', 'ph_email'], ['phone', 'ph_phone'], ['company', 'ph_company'], ['street', 'ph_street'],
     ['zip', 'ph_zip'], ['city', 'ph_city'], ['uid', 'ph_uid'], ['message', 'ph_message']].forEach(function(p){
      var v = str(p[1], ''); if(v) f[p[0]].placeholder = v;
    });
  }
  function idleLabel(){ var c = charge(); return str('submit', 'Zahlungspflichtig buchen · {price}').replace(/\{price\}/g, money(c.amount, c.currency)); }
  function setBusy(busy){
    submitting = busy;
    bookBtn.disabled = busy;
    bookBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
    bookBtn.textContent = busy ? str('submitting', 'Wird gebucht…') : idleLabel();
  }

  form.addEventListener('change', function(e){
    if(e.target.name === 'meeting'){ updatePhone(); renderChosen(); }
    if(e.target === f.country){ updateUid(); updateCharge(); }
  });
  f.uid.addEventListener('input', updateCharge);
  form.addEventListener('input', function(e){ if(e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); });

  // --- Buchen ----------------------------------------------------------------
  function showNote(text, isError){
    noteEl.textContent = text;
    noteEl.classList.add('show');
    noteEl.classList.toggle('error', !!isError);
    if(isError) noteEl.setAttribute('role', 'alert'); else noteEl.removeAttribute('role');
  }
  function fieldError(el, key, fallback){
    // Fehler in einem Eingabefeld: Übersicht schließen, damit das Feld sichtbar ist
    if(el && formGrid.contains(el) && !reviewEl.hidden){ reviewEl.hidden = true; formGrid.hidden = false; reviewBtn.hidden = false; }
    showNote(str(key, fallback), true);
    if(el){ el.setAttribute('aria-invalid', 'true'); el.focus(); }
  }

  function forwardToCrm(fields){
    var parts = fields.name.split(' ');
    var headers = { 'Content-Type': 'application/json' };
    if(window.LUSIDES_SUPABASE && window.LUSIDES_SUPABASE.anonKey){
      headers.apikey = window.LUSIDES_SUPABASE.anonKey;
      headers.Authorization = 'Bearer ' + window.LUSIDES_SUPABASE.anonKey;
    }
    var channel = fields.meeting === 'phone' ? 'Telefon' + (fields.phone ? ' ' + fields.phone : '') : 'Video/Microsoft Teams';
    return fetch(CRM_INTAKE_URL, {
      method: 'POST', headers: headers, keepalive: true,
      body: JSON.stringify({
        first_name: parts.shift(),
        last_name: parts.join(' ') || null,
        email: fields.email,
        phone: fields.phone || null,
        lead_company: fields.company || null,
        biggest_challenge: 'Erstgespräch gebucht (' + channel + ', 30 Min, ' + fields.amount + '): ' + fields.when + (fields.message ? ' · ' + fields.message : '')
      })
    }).catch(function(err){ console.warn('CRM forward failed (non-blocking):', err); });
  }

  // --- Schritt 3b: Übersicht mit Preis (erst nach Eingabe der Daten sichtbar) ---------
  function isReviewOpen(){ return !reviewEl.hidden; }
  function validate(){
    noteEl.classList.remove('show');
    var mt = meetingType();
    var name = f.name.value.trim();
    var email = f.email.value.trim();
    var phone = f.phone.value.trim();
    var country = f.country.value;
    var uid = normUid(f.uid.value);
    if(!selectedSlot){ showSlotNote(str('err_slot', 'Bitte wähle einen Termin.')); return null; }
    if(name.length < 2) return fieldError(f.name, 'err_name', 'Bitte gib deinen Namen an.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fieldError(f.email, 'err_email', 'Bitte gib eine gültige E-Mail-Adresse an.');
    if(!PHONE_RE.test(phone)) return fieldError(f.phone, 'err_phone_fmt', 'Bitte gib die Telefonnummer nur mit Ziffern, Leerzeichen und + ( ) / . - ein.');
    if(mt === 'phone' && phone.replace(/\D/g, '').length < 6) return fieldError(f.phone, 'err_phone', 'Für ein Telefongespräch brauchen wir deine Telefonnummer.');
    if(f.street.value.trim().length < 3) return fieldError(f.street, 'err_billing', 'Bitte Straße und Ort für die Rechnung angeben.');
    if(f.city.value.trim().length < 2) return fieldError(f.city, 'err_billing', 'Bitte Straße und Ort für die Rechnung angeben.');
    if(!country) return fieldError(f.country, 'err_country', 'Bitte wähle das Land.');
    if(REGION === 'US' && EU.indexOf(country) !== -1) return fieldError(f.country, 'region_mismatch', 'EU: Euro-Preis.');
    if(uid && !uidValid(uid, country)) return fieldError(f.uid, 'err_uid', 'Die UID-Nummer passt nicht zum gewählten Land.');
    return {
      name: name, email: email, phone: phone, meeting: mt,
      company: f.company.value.trim(),
      message: f.message.value.trim(),
      street: f.street.value.trim(),
      zip: f.zip.value.trim(),
      city: f.city.value.trim(),
      country: country,
      uid: uid
    };
  }
  function countryName(c){
    var o = f.country.querySelector('option[value="' + c + '"]');
    return o ? o.textContent : c;
  }
  function renderReview(){
    var v = validate();
    if(!v){ closeReview(); return; }
    var end = new Date(selectedSlot.getTime() + DURATION_MIN * 60000);
    var rows = [
      ['r_when', 'Termin', fmtLong(selectedSlot) + ', ' + fmtTime(selectedSlot) + '–' + fmtTime(end)],
      ['r_meet', 'Gespräch', meetingLabel(v.meeting) + ' · ' + DURATION_MIN + (lang() === 'en' ? ' min' : ' Min.')],
      ['r_name', 'Name', v.name],
      ['r_email', 'E-Mail', v.email],
      ['r_phone', 'Telefon', v.phone],
      ['r_company', 'Unternehmen', v.company],
      ['r_billing', 'Rechnungsadresse', [v.street, [v.zip, v.city].filter(Boolean).join(' '), countryName(v.country)].join('\n') + (v.uid ? '\nUID ' + v.uid : '')]
    ].filter(function(r){ return r[2]; });
    reviewList.innerHTML = '';
    rows.forEach(function(r){
      var dt = document.createElement('dt'); dt.textContent = str(r[0], r[1]);
      var dd = document.createElement('dd'); dd.textContent = r[2];
      reviewList.appendChild(dt); reviewList.appendChild(dd);
    });
    var c = charge();
    $('reviewPrice').textContent = money(c.amount, c.currency);
    $('reviewTax').textContent = c.tax;
    if(!submitting) bookBtn.textContent = idleLabel();
  }
  function openReview(){
    if(!validate()) return;
    reviewEl.hidden = false;
    formGrid.hidden = true; reviewBtn.hidden = true;
    renderReview();
    $('reviewH').focus();
  }
  function closeReview(){
    if(reviewEl.hidden) return;
    reviewEl.hidden = true;
    formGrid.hidden = false; reviewBtn.hidden = false;
  }
  reviewBtn.addEventListener('click', openReview);
  $('editBtn').addEventListener('click', function(){ closeReview(); f.name.focus(); });

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(submitting) return;
    if(!isReviewOpen()){ openReview(); return; }
    var fields = validate();
    if(!fields){ closeReview(); return; }
    if(!f.consent.checked) return fieldError(f.consent, 'err_consent', 'Bitte akzeptiere die AGB.');
    if(!consent2.checked) return fieldError(consent2, 'err_consent2', 'Bitte bestätige den Beginn der Leistung vor Ablauf der Widerrufsfrist.');
    var amt = charge(); fields.amount = money(amt.amount, amt.currency);
    if(!window.lusidesSupabaseReady){ showNote(str('err_generic', 'Buchung gerade nicht möglich. Bitte versuche es später erneut.'), true); return; }

    setBusy(true);
    var slot = selectedSlot;
    window.lusidesSupabaseReady(function(client){
      if(!client){ setBusy(false); showNote(str('err_generic', 'Buchung gerade nicht möglich.'), true); return; }
      client.rpc('book_appointment', {
        p_start: slot.toISOString(),
        p_name: fields.name, p_email: fields.email,
        p_company: fields.company || null, p_phone: fields.phone || null,
        p_message: fields.message || null, p_topic: null, p_lang: lang(),
        p_region: REGION, p_street: fields.street, p_zip: fields.zip || null, p_city: fields.city,
        p_country: fields.country, p_uid: fields.uid || null,
        p_meeting_type: fields.meeting, p_tz: LOCAL_TZ,
        p_terms: true, p_early_start: true
      }).then(function(res){
        if(res.error){ setBusy(false); handleError(res.error.message || '', slot); return; }
        var data = res.data || {};
        fields.when = fmtLong(slot) + ', ' + fmtTime(slot);
        forwardToCrm(fields);
        // Projektbogen im Anschluss vorausfüllen
        try{ sessionStorage.setItem('lusidesErstberatungLead', JSON.stringify({ name: fields.name, email: fields.email, phone: fields.phone, company: fields.company, durationLabel: 'Erstgespräch 30 Min (gebucht)' })); }catch(err){}
        if(window.lusidesLogConversion) window.lusidesLogConversion('appointment_booked');
        var booking = {
          start: slot.toISOString(), order_no: data.order_no || null, meeting_type: data.meeting_type || fields.meeting,
          gross: data.gross != null ? Number(data.gross) : null, currency: data.currency || null,
          email: fields.email, phone: fields.phone || null, region: REGION, mail: 'pending'
        };
        saveBooking(booking);
        showSuccess(booking, true);
        sendDocuments(data, booking);
        setBusy(false);
      }, function(){ setBusy(false); showNote(str('err_generic', 'Buchung gerade nicht möglich.'), true); });
    });
  });

  function handleError(msg, slot){
    // Termin-Probleme: Hinweis sichtbar über der Uhrzeitliste (Schritt 3 wird ausgeblendet)
    if(/invalid_slot|slot_taken/.test(msg)){
      var taken = /slot_taken/.test(msg);
      if(taken) booked[slot.toISOString()] = true;
      selectedSlot = null;
      renderSlots(); renderChosen();
      showSlotNote(taken ? str('err_taken', 'Dieser Termin wurde gerade vergeben. Bitte wähle einen anderen.')
                         : str('err_slot_gone', 'Dieser Termin ist leider nicht mehr verfügbar. Bitte wähle einen anderen.'));
      loadBooked().then(function(){ renderCalendar(); renderSlots(); });
      return;
    }
    var known = [
      ['phone_required', 'err_phone', f.phone], ['billing_required', 'err_billing', f.street], ['already_booked', 'err_already', f.email],
      ['rate_limited', 'err_rate', null], ['invalid_uid', 'err_uid', f.uid], ['invalid_input', 'err_input', null],
      ['region_mismatch', 'region_mismatch', f.country], ['terms_required', 'err_consent', f.consent]
    ];
    for(var k = 0; k < known.length; k++){
      if(msg.indexOf(known[k][0]) !== -1){ fieldError(known[k][2], known[k][1], 'Bitte prüfe deine Angaben.'); return; }
    }
    showNote(str('err_generic', 'Buchung gerade nicht möglich. Bitte versuche es später erneut.'), true);
  }

  // --- Erfolg: anzeigen, speichern, nach Reload/Sprachwechsel wiederherstellen ----
  function saveBooking(b){ lastBooking = b; try{ sessionStorage.setItem(STORE_KEY, JSON.stringify(b)); }catch(e){} }
  function loadStoredBooking(){
    try{
      var b = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
      if(b && b.start && new Date(b.start).getTime() > Date.now() - 2 * 3600000) return b;
    }catch(e){}
    return null;
  }
  function renderSuccess(b){
    var start = new Date(b.start);
    var end = new Date(start.getTime() + DURATION_MIN * 60000);
    $('successWhen').textContent = fmtLong(start) + ', ' + fmtTime(start) + '–' + fmtTime(end) + ' · ' + meetingLabel(b.meeting_type);
    $('okP').textContent = b.meeting_type === 'phone'
      ? str('ok_p_phone', 'Wir rufen dich zum Termin unter deiner Nummer an.').replace('{phone}', b.phone || '')
      : str('ok_p_video', 'Den Microsoft-Teams-Link senden wir dir vor dem Termin per E-Mail.');
    $('okMail').textContent = (b.mail === 'failed' ? str('ok_mail_fail', 'Bestellschein und Rechnung senden wir dir in Kürze per E-Mail.')
                                                   : str('ok_mail', 'Bestellschein und Rechnung kommen in wenigen Minuten per E-Mail an {email}.')).replace('{email}', b.email || '');
    var meta = [];
    if(b.order_no) meta.push(str('ok_order', 'Bestellnummer {order}').replace('{order}', b.order_no));
    if(b.gross != null && b.currency) meta.push(str('ok_amount', 'Rechnungsbetrag {amount}').replace('{amount}', money(b.gross, b.currency)));
    $('successMeta').textContent = meta.join(' · ');
  }
  function showSuccess(b, focus){
    lastBooking = b;
    renderSuccess(b);
    planner.style.display = 'none';
    successEl.classList.add('show');
    if(focus){
      var h = $('successH');
      h.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try{ h.focus({ preventScroll: true }); }catch(e){ h.focus(); }
    }
  }
  $('newBookingBtn').addEventListener('click', function(){
    try{ sessionStorage.removeItem(STORE_KEY); }catch(e){}
    lastBooking = null;
    selectedSlot = null;
    successEl.classList.remove('show');
    planner.style.display = '';
    form.reset(); updatePhone(); updateUid(); updateCharge(); presetCountry();
    noteEl.classList.remove('show');
    loadBooked().then(function(){ renderAll(); });
    $('step1Title').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Bestellschein + Rechnung erzeugen und per E-Mail (invoice@lusides.com) zustellen.
  // keepalive: Der Versand läuft weiter, auch wenn die Seite sofort verlassen/neu geladen wird.
  function sendDocuments(data, b){
    if(!data || !data.id || !data.token) return;
    var headers = { 'Content-Type': 'application/json' };
    if(window.LUSIDES_SUPABASE){ headers.apikey = window.LUSIDES_SUPABASE.anonKey; headers.Authorization = 'Bearer ' + window.LUSIDES_SUPABASE.anonKey; }
    fetch(INVOICE_URL, { method: 'POST', headers: headers, keepalive: true, body: JSON.stringify({ action: 'send', appointment_id: data.id, token: data.token }) })
      .then(function(r){ if(!r.ok) throw new Error('mail ' + r.status); b.mail = 'sent'; })
      .catch(function(err){ console.warn(err); b.mail = 'failed'; })
      .then(function(){ saveBooking(b); if(successEl.classList.contains('show')) renderSuccess(b); });
  }

  // --- .ics-Datei für den eigenen Kalender ------------------------------------
  function icsDate(d){ return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsText(s){ return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
  $('icsBtn').addEventListener('click', function(){
    var b = lastBooking || loadStoredBooking();
    if(!b) return;
    var start = new Date(b.start);
    var end = new Date(start.getTime() + DURATION_MIN * 60000);
    var phone = b.meeting_type === 'phone';
    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lusides//Terminbuchung//' + (lang() === 'en' ? 'EN' : 'DE'), 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + (b.order_no || icsDate(start)) + '@lusides.com',
      'DTSTAMP:' + icsDate(new Date()),
      'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end),
      'SUMMARY:' + icsText(phone ? str('ics_summary_phone', 'Erstgespräch mit Lusides (Telefon)') : str('ics_summary_video', 'Erstgespräch mit Lusides (Microsoft Teams)')),
      'DESCRIPTION:' + icsText(phone ? str('ics_desc_phone', 'Wir rufen dich zum Termin an.') : str('ics_desc_video', 'Den Microsoft-Teams-Link senden wir dir vor dem Termin per E-Mail.')),
      'LOCATION:' + icsText(phone ? str('ics_loc_phone', 'Telefon: wir rufen dich an') : str('ics_loc_video', 'Microsoft Teams')),
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    var url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url; a.download = 'lusides-erstgespraech.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  });

  // --- Start -----------------------------------------------------------------
  function presetCountry(){
    if(f.country.value) return;
    if(REGION === 'US' && US_TZ.test(LOCAL_TZ)) f.country.value = 'US';
    else if(REGION === 'EU' && TZ_COUNTRY[LOCAL_TZ]) f.country.value = TZ_COUNTRY[LOCAL_TZ];
    updateUid(); updateCharge();
  }
  function applyTexts(){
    fillCountries(); updateRegionNote(); updateUid(); updateCharge(); updatePhone(); setPlaceholders(); updateTzNote();
    if(!submitting) bookBtn.textContent = idleLabel();
  }
  window.addEventListener('lusides:langchange', function(){
    // Sprache wechselt Währung und Buchungszeiten → Seite neu aufbauen (Erfolg bleibt via sessionStorage erhalten)
    if(window.lusidesRegion && window.lusidesRegion.region !== REGION){ location.reload(); return; }
    applyTexts();
    if(lastBooking && successEl.classList.contains('show')) renderSuccess(lastBooking);
    if(viewYear != null) renderAll();
  });

  applyTexts();
  presetCountry();
  updateSteps();
  calPrev.setAttribute('aria-label', str('prev_month', 'Vorheriger Monat'));
  calNext.setAttribute('aria-label', str('next_month', 'Nächster Monat'));

  var stored = loadStoredBooking();
  if(stored) showSuccess(stored, false);

  slotsHead.textContent = str('loading', 'Lade freie Termine…');
  loadBooked().then(function(){
    firstAvailableMonth();
    renderAll();
  });
})();
