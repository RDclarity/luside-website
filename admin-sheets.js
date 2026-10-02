// Admin: Projektdatenblätter (Liste, Details, Status, PDF, erneuter Versand, Export).
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var client = null, rows = [], filter = 'alle', current = null, bound = false;
  var FN_URL = window.LUSIDES_SUPABASE.url + '/functions/v1/lusides-datasheet';
  function esc(str){ return String(str == null ? '' : str).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(iso){ try{ return new Date(iso).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vienna' }); }catch(e){ return iso; } }
  function toast(msg, err){ var t = $('toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show'); setTimeout(function(){ t.classList.remove('show'); }, 3200); }
  function callFn(body){
    return client.auth.getSession().then(function(r){
      var token = r.data && r.data.session ? r.data.session.access_token : '';
      return fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: window.LUSIDES_SUPABASE.anonKey, Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
    });
  }

  var LABELS = [
    ['Ansprechpartner', [['name', 'Name'], ['position', 'Position'], ['email', 'E-Mail'], ['phone', 'Telefon']]],
    ['Unternehmen', [['company', 'Firma'], ['legal_form', 'Rechtsform'], ['industry', 'Branche'], ['website', 'Website'], ['founded_year', 'Gründungsjahr'], ['city', 'Ort'], ['country', 'Land'], ['business_model', 'Geschäftsmodell'], ['owner_managed', 'Inhabergeführt']]],
    ['Kennzahlen', [['employee_count', 'Mitarbeiter'], ['annual_revenue', 'Jahresumsatz'], ['revenue_trend', 'Entwicklung'], ['locations', 'Standorte']]],
    ['Ausgangslage', [['areas', 'Bereiche'], ['situation', 'Situation'], ['tried', 'Bereits versucht'], ['goal', 'Ziel (12 Monate)'], ['urgency', 'Zeitrahmen'], ['budget', 'Budget'], ['decision_maker', 'Entscheider'], ['source', 'Quelle']]]
  ];
  function show(v){ if(v === true) return 'Ja'; if(v === false) return 'Nein'; if(Array.isArray(v)) return v.join(', '); return v; }

  function render(){
    var list = rows.filter(function(r){ return filter === 'alle' || r.status === filter; });
    $('sheetsCount').textContent = rows.length + ' Datenblätter';
    var neu = rows.filter(function(r){ return r.status === 'neu'; }).length;
    var b = $('bSheets'); if(b){ b.hidden = !neu; b.textContent = neu; }
    if(!list.length){ $('sheetsBody').innerHTML = '<tr class="empty-row"><td colspan="9">Keine Datenblätter.</td></tr>'; return; }
    $('sheetsBody').innerHTML = list.map(function(r){
      var pill = r.status === 'neu' ? 'offen' : (r.status === 'erledigt' ? 'bezahlt' : '');
      return '<tr class="clickable" data-row="' + esc(r.id) + '">'
        + '<td class="primary" data-label="Unternehmen"><button type="button" class="name-link" data-id="' + esc(r.id) + '">' + esc(r.company) + '</button></td>'
        + '<td data-label="Ansprechpartner">' + esc(r.name) + (r.position ? '<br><span style="color:var(--slate);font-size:12px">' + esc(r.position) + '</span>' : '') + '</td>'
        + '<td data-label="Branche">' + esc(r.industry) + '</td>'
        + '<td class="nowrap" data-label="Mitarbeiter">' + esc(r.employee_count) + '</td>'
        + '<td class="nowrap" data-label="Umsatz">' + esc(r.annual_revenue) + '</td>'
        + '<td data-label="Bereiche">' + esc((r.areas || []).join(', ') || '—') + '</td>'
        + '<td data-label="Status"><span class="pill ' + pill + '">' + esc(r.status) + '</span></td>'
        + '<td class="nowrap" data-label="Eingang">' + fmt(r.created_at) + '</td>'
        + '<td data-label=""><div class="row-actions"><button class="btn btn-sm" data-pdf="' + esc(r.id) + '">PDF</button></div></td></tr>';
    }).join('');
  }

  function openModal(id){
    var r = rows.filter(function(x){ return x.id === id; })[0]; if(!r) return;
    current = r;
    $('sName').textContent = r.company;
    $('sSub').textContent = (r.ref || '') + ' · ' + fmt(r.created_at) + ' · ' + r.name;
    var html = '';
    LABELS.forEach(function(sec){
      var items = sec[1].filter(function(f){ var v = r[f[0]]; return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length); });
      if(!items.length) return;
      html += '<h4>' + esc(sec[0]) + '</h4><dl>' + items.map(function(f){ return '<dt>' + esc(f[1]) + '</dt><dd>' + esc(show(r[f[0]])) + '</dd>'; }).join('') + '</dl>';
    });
    $('sInfo').innerHTML = html;
    $('sStatus').value = r.status;
    $('sNotes').value = r.admin_notes || '';
    $('sMail').innerHTML = r.mail_status === 'gesendet' ? '<span class="pill gesendet">gesendet</span>' : (r.mail_status === 'fehler' ? '<span class="pill fehler">Fehler</span>' : '<span class="pill">offen</span>');
    $('sMailto').href = 'mailto:' + encodeURIComponent(r.email) + '?subject=' + encodeURIComponent((r.lang === 'en' ? 'Your project data sheet ' : 'Ihr Projektdatenblatt ') + (r.ref || ''));
    $('sMsg').classList.remove('show');
    $('sheetModal').classList.add('show'); $('sheetModal').setAttribute('aria-hidden', 'false');
  }
  function closeModal(){ $('sheetModal').classList.remove('show'); $('sheetModal').setAttribute('aria-hidden', 'true'); current = null; }
  function msg(t, err){ var m = $('sMsg'); m.textContent = t; m.classList.add('show'); m.classList.toggle('err', !!err); }

  function openPdf(id){
    var win = window.open('', '_blank');
    callFn({ action: 'pdf', id: id }).then(function(r){ if(!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function(blob){ var url = URL.createObjectURL(blob); if(win) win.location = url; else location.href = url; })
      .catch(function(){ if(win) win.close(); toast('PDF konnte nicht erzeugt werden (Edge Function lusides-datasheet deployt?)', true); });
  }

  function bind(){
    $('sheetFilters').addEventListener('click', function(e){
      var b = e.target.closest('.chip-f'); if(!b) return; filter = b.getAttribute('data-f');
      document.querySelectorAll('#sheetFilters .chip-f').forEach(function(x){ x.classList.toggle('active', x === b); });
      render();
    });
    $('sheetsBody').addEventListener('click', function(e){
      var p = e.target.closest('[data-pdf]'); if(p) return openPdf(p.getAttribute('data-pdf'));
      var n = e.target.closest('[data-id], [data-row]'); if(n) openModal(n.getAttribute('data-id') || n.getAttribute('data-row'));
    });
    $('sClose').addEventListener('click', closeModal);
    $('sheetModal').addEventListener('click', function(e){ if(e.target === $('sheetModal')) closeModal(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && current) closeModal(); });
    $('sPdf').addEventListener('click', function(){ if(current) openPdf(current.id); });
    $('sResend').addEventListener('click', function(){
      if(!current) return;
      callFn({ action: 'resend', id: current.id }).then(function(r){ if(!r.ok) throw new Error(r.status); msg('Kopie wurde erneut gesendet.'); load(client); })
        .catch(function(){ msg('Versand fehlgeschlagen (RESEND_API_KEY gesetzt?)', true); });
    });
    $('sSave').addEventListener('click', function(){
      if(!current) return;
      var patch = { status: $('sStatus').value, admin_notes: $('sNotes').value.trim() || null };
      client.from('project_sheets').update(patch).eq('id', current.id).select().then(function(res){
        if(res.error || !res.data || !res.data.length){ msg('Speichern fehlgeschlagen.', true); return; }
        Object.assign(current, patch); msg('Gespeichert.'); render();
      });
    });
    $('exportSheetsBtn').addEventListener('click', function(){
      var cols = [{ label: 'Referenz', get: function(r){ return r.ref; } }, { label: 'Eingang', get: function(r){ return fmt(r.created_at); } }, { label: 'Status', get: function(r){ return r.status; } }];
      LABELS.forEach(function(sec){ sec[1].forEach(function(f){ cols.push({ label: f[1], get: function(r){ return show(r[f[0]]); } }); }); });
      window.lusidesAdminDownloadCSV('projektdatenblaetter.csv', rows, cols);
    });
  }

  function load(c){
    client = c;
    if(!bound){ bind(); bound = true; }
    client.from('project_sheets').select('*').order('created_at', { ascending: false }).then(function(res){
      if(res.error){ $('sheetsBody').innerHTML = '<tr class="empty-row"><td colspan="9">Noch nicht verfügbar – Migration 20261004100000_project_sheets.sql ausführen.</td></tr>'; return; }
      rows = res.data || []; render();
    });
  }
  window.lusidesAdminSheets = { load: load };
})();
