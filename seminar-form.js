(function(){
  var forms = document.querySelectorAll('form.seminar-form');
  if(!forms.length) return;

  var CRM_INTAKE_URL = 'https://nbnpeoiqiakwnnkorxim.supabase.co/functions/v1/claritylab-lead-intake';
  var SEMINAR_TAG = 'Seminar-Interesse: Prozesse, Systeme, Marketing (Wien, Nov/Dez 2026 vorauss.)';

  // Best-effort: forwards the lead into the Rima-Equity CRM. Never blocks or
  // fails the user-facing submission — the local Supabase insert is the
  // source of truth either way.
  function forwardToCrm(fields){
    var parts = fields.name.split(' ');
    var firstName = parts.shift();
    var lastName = parts.join(' ') || null;
    fetch(CRM_INTAKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email: fields.email,
        phone: fields.phone || null,
        lead_company: fields.company || null,
        biggest_challenge: SEMINAR_TAG
      })
    }).catch(function(err){ console.warn('CRM forward failed (non-blocking):', err); });
  }

  function currentStrings(){
    var lang = localStorage.getItem('clarity_lang') || 'de';
    var dict = (window.clarityI18n && window.clarityI18n.translations[lang]) || {};
    return (dict.seminar_page) || {};
  }

  function wireForm(form){
    var noteEl = form.querySelector('.form-note');
    var submitBtn = form.querySelector('button[type="submit"]');

    function showNote(text, isError){
      if(!noteEl) return;
      noteEl.textContent = text;
      noteEl.classList.add('show');
      noteEl.classList.toggle('error', !!isError);
    }

    form.addEventListener('submit', function(e){
      e.preventDefault();

      var name = form.name.value.trim();
      var company = form.company ? form.company.value.trim() : '';
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
          biggest_challenge: SEMINAR_TAG
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
          forwardToCrm({ name: name, email: email, phone: phone, company: company });
          form.reset();
          showNote(currentStrings().form_success || 'Thank you.', false);
          if(window.clarityLogConversion) window.clarityLogConversion('form_submit');
        }).catch(function(err){
          console.error(err);
          showNote(currentStrings().form_error || 'Something went wrong.', true);
        }).finally(function(){
          submitBtn.disabled = false;
        });
      });
    });
  }

  forms.forEach(wireForm);
})();
