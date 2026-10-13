// Leistungsfolder: PDF-Download gegen Telefonnummer (Edge Function lusides-folder).
(function(){
  var form = document.getElementById('folderForm');
  if(!form) return;
  var note = document.getElementById('folderNote');
  var btn = document.getElementById('folderBtn');
  var PHONE_RE = /^[0-9+()\/ .\-]+$/;   // identisch zur Server-Prüfung

  function lang(){ return window.lusidesI18n ? window.lusidesI18n.currentLang() : 'de'; }
  function str(key, fallback){
    var d = window.lusidesI18n && window.lusidesI18n.translations[lang()];
    var v = d && d.folder && d.folder[key];
    return v || fallback;
  }
  function show(html, ok){ note.innerHTML = html; note.className = 'folder-note ' + (ok ? 'ok' : 'err'); }
  function setPlaceholder(){ form.phone.placeholder = str('phone_ph', '+43 660 1234567'); }
  setPlaceholder();
  window.addEventListener('lusides:langchange', setPlaceholder);

  var busy = false;
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(busy) return;
    var phone = form.phone.value.trim();
    if(!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 6){ show(str('err_phone', 'Bitte gib eine gültige Telefonnummer an.'), false); form.phone.focus(); return; }
    if(!form.consent.checked){ show(str('err_consent', 'Bitte bestätige, dass wir dich kontaktieren dürfen.'), false); form.consent.focus(); return; }
    var cfg = window.LUSIDES_SUPABASE;
    if(!cfg){ show(str('err_generic', 'Download gerade nicht möglich.'), false); return; }

    busy = true; btn.disabled = true;
    show(str('sending', 'Einen Moment …'), true);
    fetch(cfg.url + '/functions/v1/lusides-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey },
      body: JSON.stringify({ phone: phone, consent: true, lang: lang(), page: location.pathname })
    }).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ return { ok: r.ok && d.ok && d.url, status: r.status, d: d }; }); })
      .then(function(res){
        busy = false; btn.disabled = false;
        if(!res.ok){
          show(res.status === 429 ? str('err_rate', 'Zu viele Versuche.') : res.d.error === 'invalid_phone' ? str('err_phone', 'Bitte gib eine gültige Telefonnummer an.') : str('err_generic', 'Download gerade nicht möglich.'), false);
          return;
        }
        var url = res.d.url;
        show(str('ok', 'Danke! Der Download startet. Falls nicht: <a href="{url}" target="_blank" rel="noopener">PDF öffnen</a>').replace('{url}', url.replace(/"/g, '&quot;')), true);
        var a = document.createElement('a');
        a.href = url; a.download = 'Lusides-Leistungsfolder.pdf'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        if(window.lusidesLogConversion) window.lusidesLogConversion('folder_download');
      })
      .catch(function(){ busy = false; btn.disabled = false; show(str('err_generic', 'Download gerade nicht möglich.'), false); });
  });
})();
