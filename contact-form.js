(function(){
  var form = document.getElementById('kontaktForm');
  if(!form) return;

  var CRM_INTAKE_URL = 'https://knuktzuqqmrrkpkusren.supabase.co/functions/v1/luside-rima-sync';

  // Best-effort: forwards the lead into the RIMA Equity CRM. Never blocks or
  // fails the user-facing submission — the local Supabase insert above is
  // the source of truth either way.
  function forwardToCrm(fields){
    var parts = fields.name.split(' ');
    var firstName = parts.shift();
    var lastName = parts.join(' ') || null;
    var headers = { 'Content-Type': 'application/json' };
    if(window.CLARITY_SUPABASE && window.CLARITY_SUPABASE.anonKey){
      headers.apikey = window.CLARITY_SUPABASE.anonKey;
      headers.Authorization = 'Bearer ' + window.CLARITY_SUPABASE.anonKey;
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
        biggest_challenge: fields.biggestChallenge || null
      })
    }).catch(function(err){ console.warn('CRM forward failed (non-blocking):', err); });
  }

  var noteEl = document.getElementById('formNote');
  var followup = document.getElementById('bookingFollowup');
  var submitBtn = form.querySelector('button[type="submit"]');

  function currentStrings(){
    var lang = localStorage.getItem('clarity_lang') || 'de';
    var dict = (window.clarityI18n && window.clarityI18n.translations[lang]) || {};
    return (dict.kontakt) || {};
  }

  function showNote(text, isError){
    if(!noteEl) return;
    noteEl.textContent = text;
    noteEl.classList.add('show');
    noteEl.classList.toggle('error', !!isError);
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();

    var company = form.company ? form.company.value.trim() : '';
    var name = form.name.value.trim();
    var employeeCount = form.employee_count ? form.employee_count.value : '';
    var annualRevenue = form.annual_revenue ? form.annual_revenue.value : '';
    var biggestChallenge = form.biggest_challenge ? form.biggest_challenge.value.trim() : '';
    var phone = form.phone.value.trim();
    var email = form.email.value.trim();
    var newsletter = form.newsletter.checked;

    if(!name || !email) return;

    if(!window.claritySupabaseReady){
      console.warn('Supabase is not configured yet — see supabase-config.js');
      showNote(currentStrings().form_error || 'Configuration missing.', true);
      return;
    }

    submitBtn.disabled = true;

    window.claritySupabaseReady(function(client){
      if(!client){
        showNote(currentStrings().form_error || 'Configuration missing.', true);
        submitBtn.disabled = false;
        return;
      }

      client.from('contacts').insert({
        name: name,
        phone: phone,
        email: email,
        newsletter_opt_in: newsletter,
        company: company,
        employee_count: employeeCount,
        annual_revenue: annualRevenue,
        biggest_challenge: biggestChallenge
      }).then(function(res){
        if(res.error) throw res.error;
        if(newsletter){
          return client.from('newsletter_subscribers')
            .insert({ name: name, email: email })
            .then(function(nlRes){
              // 23505 = unique_violation: already subscribed with this email — not an error for the user
              if(nlRes.error && nlRes.error.code !== '23505') throw nlRes.error;
            });
        }
      }).then(function(){
        forwardToCrm({ name: name, email: email, phone: phone, company: company, employeeCount: employeeCount, annualRevenue: annualRevenue, biggestChallenge: biggestChallenge });
        form.reset();
        showNote(currentStrings().form_success || 'Thank you.', false);
        if(followup) followup.classList.add('show');
        if(window.clarityLogConversion) window.clarityLogConversion('form_submit');
      }).catch(function(err){
        console.error(err);
        showNote(currentStrings().form_error || 'Something went wrong.', true);
      }).finally(function(){
        submitBtn.disabled = false;
      });
    });
  });
})();
