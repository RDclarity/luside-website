// Projektdatenblatt (Schritt 2 nach dem Anfrageformular):
// speichern (Supabase, submit_project_sheet) → ins CRM übertragen (lusides-rima-sync)
// → PDF-Kopie per E-Mail (lusides-datasheet) → Zusammenfassung direkt auf der Seite.
(function(){
  var form = document.getElementById('projektbogenForm');
  if(!form) return;

  var BASE = window.LUSIDES_SUPABASE ? window.LUSIDES_SUPABASE.url : '';
  var CRM_INTAKE_URL = BASE + '/functions/v1/lusides-rima-sync';
  var DATASHEET_URL = BASE + '/functions/v1/lusides-datasheet';
  var noteEl = document.getElementById('formNote');
  var submitBtn = form.querySelector('button[type="submit"]');

  function lang(){ return (window.lusidesI18n && window.lusidesI18n.currentLang) ? window.lusidesI18n.currentLang() : 'de'; }
  function str(key, fallback){
    var dict = window.lusidesI18n && window.lusidesI18n.translations[lang()];
    return (dict && dict.pds && dict.pds[key]) || fallback;
  }
  function showNote(text, isError){
    noteEl.textContent = text;
    noteEl.classList.add('show');
    noteEl.classList.toggle('error', !!isError);
  }
  function headers(){
    var h = { 'Content-Type': 'application/json' };
    if(window.LUSIDES_SUPABASE){ h.apikey = window.LUSIDES_SUPABASE.anonKey; h.Authorization = 'Bearer ' + window.LUSIDES_SUPABASE.anonKey; }
    return h;
  }

  // ---------- Vorbelegung aus Schritt 1 (Anfrageformular bzw. Terminbuchung) ----------
  var lead = null;
  try{ var raw = sessionStorage.getItem('lusidesErstberatungLead'); if(raw) lead = JSON.parse(raw); }catch(e){}
  if(lead){
    ['name', 'email', 'phone', 'company'].forEach(function(k){ if(lead[k] && form[k]) form[k].value = lead[k]; });
    if(lead.message && form.situation && !form.situation.value) form.situation.value = String(lead.message).slice(0, 2000);
    var summaryEl = document.getElementById('leadSummary');
    if(summaryEl && (lead.name || lead.email)){
      summaryEl.textContent = [lead.name, lead.email, lead.durationLabel].filter(Boolean).join(' · ');
      summaryEl.classList.add('show');
    }
  }
  try{
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    var map = { 'Europe/Vienna': 'AT', 'Europe/Berlin': 'DE', 'Europe/Zurich': 'CH' };
    if(map[tz]) form.country.value = map[tz];
    else if(window.lusidesRegion && window.lusidesRegion.region === 'US') form.country.value = 'US';
  }catch(e){}

  // ---------- Daten einsammeln ----------
  function val(name){ var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; }
  function radio(name){ var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function collect(){
    return {
      lang: lang(),
      name: val('name'), position: val('position'), email: val('email'), phone: val('phone'),
      company: val('company'), legal_form: val('legal_form'), industry: val('industry'), website: val('website'),
      founded_year: val('founded_year'), city: val('city'), country: val('country'),
      business_model: radio('business_model'), succession: radio('succession'),
      employee_count: val('employee_count'), annual_revenue: val('annual_revenue'), revenue_trend: val('revenue_trend'), locations: val('locations'),
      areas: Array.prototype.map.call(form.querySelectorAll('input[name="areas"]:checked'), function(el){ return el.value; }),
      situation: val('situation'), tried: val('tried'), goal: val('goal'), urgency: val('urgency'), budget: val('budget'),
      decision_maker: !!form.decision_maker.checked, consent: !!form.consent.checked,
      source: lead && lead.durationLabel ? 'Terminbuchung' : (lead ? 'Anfrageformular' : 'Direkt')
    };
  }

  // Sichtbare Bezeichnung einer Auswahl (in der aktuellen Sprache)
  function labelOf(name, value){
    var el = form.querySelector('[name="' + name + '"] option[value="' + (window.CSS && CSS.escape ? CSS.escape(value) : value) + '"]')
          || form.querySelector('input[name="' + name + '"][value="' + (window.CSS && CSS.escape ? CSS.escape(value) : value) + '"] + span');
    return el ? el.textContent.trim() : value;
  }

  function summaryRows(d){
    var yes = str('yes', 'Ja'), no = str('no', 'Nein');
    return [
      [str('sec_contact', 'Ansprechpartner'), [
        [str('f_name', 'Name').replace(' *', ''), d.name], [str('f_position', 'Position'), d.position],
        [str('f_email', 'E-Mail').replace(' *', ''), d.email], [str('f_phone', 'Telefon'), d.phone]]],
      [str('sec_company', 'Unternehmen'), [
        [str('f_company', 'Firmenname').replace(' *', ''), d.company], [str('f_legal', 'Rechtsform'), d.legal_form && labelOf('legal_form', d.legal_form)],
        [str('f_industry', 'Branche').replace(' *', ''), labelOf('industry', d.industry)], [str('f_website', 'Website'), d.website],
        [str('f_founded', 'Gründungsjahr'), d.founded_year], [str('f_city', 'Standort').replace(' *', ''), d.city + (d.country ? ', ' + labelOf('country', d.country) : '')],
        [str('f_model', 'Geschäftsmodell'), d.business_model && labelOf('business_model', d.business_model)],
        [str('f_succession', 'Generationenwechsel / Nachfolge'), d.succession && labelOf('succession', d.succession)]]],
      [str('sec_figures', 'Kennzahlen'), [
        [str('f_employees', 'Mitarbeiter').replace(' *', ''), d.employee_count], [str('f_revenue', 'Jahresumsatz').replace(' *', ''), labelOf('annual_revenue', d.annual_revenue)],
        [str('f_trend', 'Umsatzentwicklung'), d.revenue_trend && labelOf('revenue_trend', d.revenue_trend)], [str('f_locations', 'Standorte'), d.locations]]],
      [str('sec_situation', 'Ausgangslage & Ziele'), [
        [str('f_areas', 'Bereiche'), d.areas.map(function(a){ return labelOf('areas', a); }).join(', ')],
        [str('f_situation', 'Situation').replace(' *', ''), d.situation], [str('f_tried', 'Bereits versucht'), d.tried],
        [str('f_goal', 'Ziel').replace(' *', ''), d.goal], [str('f_urgency', 'Zeitrahmen').replace(' *', ''), labelOf('urgency', d.urgency)],
        [str('f_budget', 'Budget'), d.budget && labelOf('budget', d.budget)], [str('f_decision_short', 'Entscheider'), d.decision_maker ? yes : no]]]
    ];
  }

  function renderResult(d, ref){
    var sheet = document.getElementById('pdsSheet');
    sheet.textContent = '';
    summaryRows(d).forEach(function(sec){
      var rows = sec[1].filter(function(r){ return r[1]; });
      if(!rows.length) return;
      var h3 = document.createElement('h3'); h3.textContent = sec[0]; sheet.appendChild(h3);
      var dl = document.createElement('dl');
      rows.forEach(function(r){
        var dt = document.createElement('dt'); dt.textContent = r[0];
        var dd = document.createElement('dd'); dd.textContent = r[1];
        dl.appendChild(dt); dl.appendChild(dd);
      });
      sheet.appendChild(dl);
    });
    document.getElementById('pdsRef').textContent = ref || '—';
    form.hidden = true;
    var steps = document.querySelectorAll('.pds-steps li');
    if(steps[1]){ steps[1].classList.remove('on'); steps[1].classList.add('done'); }
    if(steps[2]) steps[2].classList.add('on');
    var res = document.getElementById('pdsResult');
    res.hidden = false;
    res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function crmText(d, ref){
    return ['Projektdatenblatt ' + (ref || '') + ' (Quelle: ' + d.source + ')', '',
      'Position: ' + (d.position || '-'), 'Rechtsform: ' + (d.legal_form || '-'), 'Branche: ' + d.industry,
      'Website: ' + (d.website || '-'), 'Gründungsjahr: ' + (d.founded_year || '-'), 'Standort: ' + d.city + ' (' + d.country + ')',
      'Geschäftsmodell: ' + (d.business_model || '-'), 'Generationenwechsel/Nachfolge: ' + (d.succession || '-'),
      'Mitarbeiter: ' + d.employee_count, 'Jahresumsatz: ' + d.annual_revenue, 'Umsatzentwicklung: ' + (d.revenue_trend || '-'),
      'Standorte: ' + (d.locations || '-'), 'Bereiche: ' + (d.areas.join(', ') || '-'), '',
      'Situation: ' + d.situation, d.tried ? 'Bereits versucht: ' + d.tried : null, 'Ziel (12 Monate): ' + d.goal,
      'Zeitrahmen: ' + d.urgency, 'Budget: ' + (d.budget || '-'), 'Entscheider: ' + (d.decision_maker ? 'Ja' : 'Nein')
    ].filter(function(x){ return x !== null; }).join('\n');
  }

  function forwardToCrm(d, ref){
    var parts = d.name.split(' ');
    return fetch(CRM_INTAKE_URL, { method: 'POST', headers: headers(), body: JSON.stringify({
      first_name: parts.shift(), last_name: parts.join(' ') || null, email: d.email, phone: d.phone || null,
      lead_company: d.company, employee_count: d.employee_count, annual_revenue: d.annual_revenue,
      biggest_challenge: crmText(d, ref), channel: 'Projektdatenblatt', locale: d.lang
    }) }).catch(function(err){ console.warn('CRM forward failed (non-blocking):', err); });
  }

  function sendCopy(id, token, email){
    var mailEl = document.getElementById('pdsMail');
    fetch(DATASHEET_URL, { method: 'POST', headers: headers(), body: JSON.stringify({ action: 'send', id: id, token: token }) })
      .then(function(r){ if(!r.ok) throw new Error('mail ' + r.status); })
      .then(function(){ mailEl.removeAttribute('data-i18n'); mailEl.textContent = str('done_mail', 'A copy has been sent to {email}.').replace('{email}', email); })
      .catch(function(err){ console.warn(err); mailEl.removeAttribute('data-i18n'); mailEl.textContent = str('done_mail_fail', 'Saved. The email copy will follow shortly.'); });
  }

  // ---------- Absenden ----------
  form.addEventListener('submit', function(e){
    e.preventDefault();
    noteEl.classList.remove('show');
    var d = collect();
    var missing = [];
    ['name', 'email', 'company', 'industry', 'city', 'employee_count', 'annual_revenue', 'situation', 'goal', 'urgency'].forEach(function(k){
      var el = form.elements[k];
      var empty = !d[k] || (typeof d[k] === 'string' && d[k].length < (k === 'situation' || k === 'goal' ? 3 : 1));
      if(el) el.setAttribute('aria-invalid', empty ? 'true' : 'false');
      if(empty) missing.push(k);
    });
    if(missing.length){ showNote(str('err_required', 'Bitte füllen Sie alle Pflichtfelder (*) aus.'), true); var f = form.elements[missing[0]]; if(f && f.focus) f.focus(); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)){ showNote(str('err_email', 'Bitte geben Sie eine gültige E-Mail-Adresse an.'), true); form.email.focus(); return; }
    if(!d.consent){ showNote(str('err_consent', 'Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu.'), true); return; }
    if(!window.lusidesSupabaseReady){ showNote(str('err_generic', 'Senden gerade nicht möglich.'), true); return; }

    submitBtn.disabled = true;
    window.lusidesSupabaseReady(function(client){
      if(!client){ submitBtn.disabled = false; showNote(str('err_generic', 'Senden gerade nicht möglich.'), true); return; }
      client.rpc('submit_project_sheet', { p: d }).then(function(res){
        if(res.error){
          var m = res.error.message || '';
          showNote(/rate_limited/.test(m) ? str('err_rate', 'Bitte versuchen Sie es später erneut.')
                 : /invalid_input/.test(m) ? str('err_input', 'Bitte prüfen Sie Ihre Angaben (E-Mail, Telefon, Website).')
                 : str('err_generic', 'Senden gerade nicht möglich. Bitte versuchen Sie es später erneut.'), true);
          submitBtn.disabled = false;
          return;
        }
        var out = res.data || {};
        forwardToCrm(d, out.ref);
        sendCopy(out.id, out.token, d.email);
        if(window.lusidesLogConversion) window.lusidesLogConversion('project_sheet');
        try{ sessionStorage.removeItem('lusidesErstberatungLead'); }catch(err){}
        renderResult(d, out.ref);
      });
    });
  });

  document.getElementById('pdsPrint').addEventListener('click', function(){ window.print(); });
})();
