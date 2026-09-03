(function(){
  var form = document.getElementById('erstberatungForm');
  if(!form) return;

  var CRM_INTAKE_URL = 'https://knuktzuqqmrrkpkusren.supabase.co/functions/v1/lusides-rima-sync';
  var DURATION_LABELS = { '30': '30 Minuten (250€)', '60': '60 Minuten (450€)' };

  // Forwards the lead into the RIMA Equity CRM. Never fails the user-facing
  // submission (rejections are swallowed, never thrown) — but unlike the
  // other forms on this site, this one redirects to projektbogen.html right
  // after, and a truly fire-and-forget fetch() gets cancelled by the browser
  // when the page navigates away before the request completes. So callers
  // await the returned promise (with a timeout race) before redirecting.
  function forwardToCrm(fields){
    var parts = fields.name.split(' ');
    var firstName = parts.shift();
    var lastName = parts.join(' ') || null;
    var headers = { 'Content-Type': 'application/json' };
    if(window.LUSIDES_SUPABASE && window.LUSIDES_SUPABASE.anonKey){
      headers.apikey = window.LUSIDES_SUPABASE.anonKey;
      headers.Authorization = 'Bearer ' + window.LUSIDES_SUPABASE.anonKey;
    }
    return fetch(CRM_INTAKE_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email: fields.email,
        phone: fields.phone || null,
        lead_company: fields.company || null,
        biggest_challenge: fields.biggestChallenge
      })
    }).catch(function(err){ console.warn('CRM forward failed (non-blocking):', err); });
  }

  // Gives forwardToCrm a fair chance to complete before we navigate away,
  // without risking the redirect hanging if the request stalls.
  function withTimeout(promise, ms){
    return Promise.race([
      promise,
      new Promise(function(resolve){ setTimeout(resolve, ms); })
    ]);
  }

  var noteEl = document.getElementById('formNote');
  var submitBtn = form.querySelector('button[type="submit"]');

  function currentStrings(){
    var lang = localStorage.getItem('lusides_lang') || 'de';
    var dict = (window.lusidesI18n && window.lusidesI18n.translations[lang]) || {};
    return (dict.erstberatung_page) || {};
  }

  function showNote(text, isError){
    if(!noteEl) return;
    noteEl.textContent = text;
    noteEl.classList.add('show');
    noteEl.classList.toggle('error', !!isError);
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();

    var company = form.company.value.trim();
    var name = form.name.value.trim();
    var duration = form.duration.value;
    var message = form.message.value.trim();
    var phone = form.phone.value.trim();
    var email = form.email.value.trim();
    var newsletter = form.newsletter.checked;

    if(!name || !company || !email || !duration) return;

    if(!window.lusidesSupabaseReady){
      console.warn('Supabase is not configured yet — see supabase-config.js');
      showNote(currentStrings().form_error || 'Configuration missing.', true);
      return;
    }

    submitBtn.disabled = true;

    var durationLabel = DURATION_LABELS[duration] || duration;
    var biggestChallenge = 'Erstberatung angefragt: ' + durationLabel + (message ? '\n\n' + message : '');

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
        newsletter_opt_in: newsletter,
        company: company,
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
        var crmForward = forwardToCrm({ name: name, email: email, phone: phone, company: company, biggestChallenge: biggestChallenge });
        return withTimeout(crmForward, 2500);
      }).then(function(){
        try {
          sessionStorage.setItem('lusidesErstberatungLead', JSON.stringify({
            name: name, email: email, phone: phone, company: company,
            duration: duration, durationLabel: durationLabel
          }));
        } catch(err){ console.warn('sessionStorage unavailable (non-blocking):', err); }
        window.location.href = 'projektbogen.html';
      }).catch(function(err){
        console.error(err);
        showNote(currentStrings().form_error || 'Something went wrong.', true);
        submitBtn.disabled = false;
      });
    });
  });
})();
