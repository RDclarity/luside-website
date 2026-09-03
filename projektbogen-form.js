(function(){
  var form = document.getElementById('projektbogenForm');
  if(!form) return;

  var CRM_INTAKE_URL = 'https://knuktzuqqmrrkpkusren.supabase.co/functions/v1/lusides-rima-sync';

  // Prefill from the Erstberatung request (erstberatung-form.js), if the
  // visitor arrived via that redirect. Falls back gracefully to an empty,
  // fully-editable form when there's nothing to prefill (direct visit,
  // sessionStorage unavailable, etc.) — this form always works standalone.
  var lead = null;
  try {
    var raw = sessionStorage.getItem('lusidesErstberatungLead');
    if(raw) lead = JSON.parse(raw);
  } catch(err){ console.warn('sessionStorage unavailable (non-blocking):', err); }

  if(lead){
    if(lead.name) form.name.value = lead.name;
    if(lead.company) form.company.value = lead.company;
    if(lead.email) form.email.value = lead.email;
    if(lead.phone) form.phone.value = lead.phone;
    var summaryEl = document.getElementById('leadSummary');
    if(summaryEl && (lead.name || lead.email)){
      var parts = [];
      if(lead.name) parts.push(lead.name);
      if(lead.email) parts.push(lead.email);
      if(lead.durationLabel) parts.push(lead.durationLabel);
      summaryEl.textContent = parts.join(' · ');
      summaryEl.classList.add('show');
    }
  }

  // Best-effort: forwards the completed brief into the RIMA Equity CRM.
  // Never blocks or fails the user-facing submission — the local Supabase
  // insert is the source of truth either way.
  function forwardToCrm(fields){
    var parts = fields.name.split(' ');
    var firstName = parts.shift();
    var lastName = parts.join(' ') || null;
    var headers = { 'Content-Type': 'application/json' };
    if(window.LUSIDES_SUPABASE && window.LUSIDES_SUPABASE.anonKey){
      headers.apikey = window.LUSIDES_SUPABASE.anonKey;
      headers.Authorization = 'Bearer ' + window.LUSIDES_SUPABASE.anonKey;
    }
    fetch(CRM_INTAKE_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email: fields.email,
        phone: fields.phone || null,
        lead_company: fields.company || null,
        employee_count: fields.employeeCount || null,
        annual_revenue: fields.annualRevenue || null,
        biggest_challenge: fields.biggestChallenge
      })
    }).catch(function(err){ console.warn('CRM forward failed (non-blocking):', err); });
  }

  var noteEl = document.getElementById('formNote');
  var submitBtn = form.querySelector('button[type="submit"]');

  function currentStrings(){
    var lang = localStorage.getItem('lusides_lang') || 'de';
    var dict = (window.lusidesI18n && window.lusidesI18n.translations[lang]) || {};
    return (dict.projektbogen_page) || {};
  }

  function showNote(text, isError){
    if(!noteEl) return;
    noteEl.textContent = text;
    noteEl.classList.add('show');
    noteEl.classList.toggle('error', !!isError);
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();

    var name = form.name.value.trim();
    var company = form.company.value.trim();
    var email = form.email.value.trim();
    var phone = form.phone.value.trim();
    var bereich = Array.from(form.querySelectorAll('input[name="bereich"]:checked')).map(function(el){ return el.value; });
    var situation = form.situation.value.trim();
    var versucht = form.versucht.value.trim();
    var ziel = form.ziel.value.trim();
    var dringlichkeit = form.dringlichkeit.value;
    var employeeCount = form.employee_count.value;
    var annualRevenue = form.annual_revenue.value;
    var entscheidung = form.entscheidung.checked;

    if(!name || !company || !email || !situation || !ziel || !dringlichkeit || !employeeCount || !annualRevenue) return;

    if(!window.lusidesSupabaseReady){
      console.warn('Supabase is not configured yet — see supabase-config.js');
      showNote(currentStrings().form_error || 'Configuration missing.', true);
      return;
    }

    submitBtn.disabled = true;

    var durationLabel = lead && lead.durationLabel ? lead.durationLabel : null;
    var lines = [
      'Projektbogen zur Erstberatung' + (durationLabel ? ' (' + durationLabel + ')' : ''),
      '',
      'Themenbereich(e): ' + (bereich.length ? bereich.join(', ') : '(keine Angabe)'),
      'Aktuelle Situation: ' + situation,
      versucht ? 'Bereits versucht: ' + versucht : null,
      'Gewünschtes Ergebnis: ' + ziel,
      'Dringlichkeit: ' + dringlichkeit,
      'Entscheidungsbefugnis: ' + (entscheidung ? 'Ja' : 'Nein')
    ].filter(Boolean);
    var biggestChallenge = lines.join('\n');

    window.lusidesSupabaseReady(function(client){
      if(!client){
        showNote(currentStrings().form_error || 'Configuration missing.', true);
        submitBtn.disabled = false;
        return;
      }

      client.from('contacts').insert({
        name: name,
        phone: phone,
        email: email,
        newsletter_opt_in: false,
        company: company,
        employee_count: employeeCount,
        annual_revenue: annualRevenue,
        biggest_challenge: biggestChallenge
      }).then(function(res){
        if(res.error) throw res.error;
        forwardToCrm({
          name: name, email: email, phone: phone, company: company,
          employeeCount: employeeCount, annualRevenue: annualRevenue,
          biggestChallenge: biggestChallenge
        });
        try { sessionStorage.removeItem('lusidesErstberatungLead'); } catch(err){}
        form.reset();
        form.querySelectorAll('input, textarea, select, button').forEach(function(el){ el.disabled = true; });
        showNote(currentStrings().form_success || 'Thank you.', false);
      }).catch(function(err){
        console.error(err);
        showNote(currentStrings().form_error || 'Something went wrong.', true);
        submitBtn.disabled = false;
      });
    });
  });
})();
