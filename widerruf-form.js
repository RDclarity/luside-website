// Online-Widerruf „Vertrag widerrufen" (§ 13a FAGG) → Edge Function lusides-withdraw.
(function(){
  var form = document.getElementById('wdForm');
  if(!form) return;
  var note = document.getElementById('wdNote');
  var btn = form.querySelector('button[type="submit"]');
  function en(){ return document.documentElement.lang === 'en'; }
  function show(text, ok){ note.textContent = text; note.className = 'wd-note ' + (ok ? 'ok' : 'err'); }
  function stamp(iso){
    try{
      return new Intl.DateTimeFormat(en() ? 'en-GB' : 'de-AT', { timeZone: 'Europe/Vienna', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    }catch(e){ return iso; }
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var name = form.name.value.trim(), email = form.email.value.trim();
    if(name.length < 2){ show(en() ? 'Please enter your name.' : 'Bitte geben Sie Ihren Namen an.', false); form.name.focus(); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ show(en() ? 'Please enter a valid email address.' : 'Bitte geben Sie eine gültige E-Mail-Adresse an.', false); form.email.focus(); return; }
    var cfg = window.LUSIDES_SUPABASE;
    if(!cfg){ show(en() ? 'Not available right now. Please email inquiry@lusides.com.' : 'Gerade nicht verfügbar. Bitte schreiben Sie an inquiry@lusides.com.', false); return; }
    btn.disabled = true;
    show(en() ? 'Sending…' : 'Wird gesendet…', true);
    fetch(cfg.url + '/functions/v1/lusides-withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey },
      body: JSON.stringify({ name: name, email: email, order_no: form.order_no.value.trim(), message: form.message.value.trim(), lang: en() ? 'en' : 'de' })
    }).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ return { ok: r.ok && d.ok, status: r.status, d: d }; }); })
      .then(function(res){
        if(!res.ok){
          btn.disabled = false;
          if(res.status === 429) return show(en() ? 'Too many attempts. Please email inquiry@lusides.com.' : 'Zu viele Versuche. Bitte schreiben Sie an inquiry@lusides.com.', false);
          return show(en() ? 'Your withdrawal could not be sent. Please email inquiry@lusides.com – that is equally valid.' : 'Der Widerruf konnte nicht gesendet werden. Bitte schreiben Sie an inquiry@lusides.com – das ist ebenso gültig.', false);
        }
        var when = stamp(res.d.received_at);
        form.querySelectorAll('input, textarea').forEach(function(el){ el.disabled = true; });
        show(en()
          ? 'Your withdrawal was received on ' + when + ' (Vienna time). ' + (res.d.mail === 'sent' ? 'A confirmation has been sent to your email.' : 'We will also confirm it by email.')
          : 'Ihr Widerruf ist am ' + when + ' (Wiener Zeit) bei uns eingegangen. ' + (res.d.mail === 'sent' ? 'Die Bestätigung ist per E-Mail an Sie unterwegs.' : 'Wir bestätigen ihn zusätzlich per E-Mail.'), true);
        if(window.lusidesLogConversion) window.lusidesLogConversion('withdrawal');
      })
      .catch(function(){
        btn.disabled = false;
        show(en() ? 'Network error. Please try again or email inquiry@lusides.com.' : 'Netzwerkfehler. Bitte versuchen Sie es erneut oder schreiben Sie an inquiry@lusides.com.', false);
      });
  });
})();
