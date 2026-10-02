// Lusides Admin: Login, Tabs, Rechnungen, Anfragen, Newsletter, Besucher, Einstellungen.
// Der Terminkalender steckt in admin-calendar.js.
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var client = null;
  var INVOICE_URL = window.LUSIDES_SUPABASE.url + '/functions/v1/lusides-invoice';
  var data = { contacts: [], newsletter: [], invoices: [], appointments: {} };

  // ---------- Hilfen ----------
  function esc(str){ var d = document.createElement('div'); d.textContent = str == null ? '' : String(str); return d.innerHTML; }
  function fmtDate(iso, withTime){
    if(!iso) return '—';
    try{ return new Date(iso).toLocaleString('de-AT', withTime === false ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }); }catch(e){ return iso; }
  }
  function money(v, cur){ try{ return new Intl.NumberFormat('de-AT', { style: 'currency', currency: cur || 'EUR' }).format(v); }catch(e){ return v + ' ' + cur; } }
  function fmtDuration(sec){ if(sec == null) return '—'; var m = Math.floor(sec / 60), s = sec % 60; return m > 0 ? (m + ' min ' + s + 's') : (s + 's'); }
  var toastTimer;
  function toast(msg, isErr){
    var t = $('toast'); t.textContent = msg; t.classList.toggle('err', !!isErr); t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 3200);
  }
  function badge(id, n){ var b = $(id); if(!b) return; b.hidden = !n; b.textContent = n; }
  function csvEscape(val){
    var str = val == null ? '' : String(val);
    if(/^[=+\-@\t\r]/.test(str)) str = "'" + str;
    if(/[",\n;]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  }
  function downloadCSV(filename, rows, columns){
    var lines = [columns.map(function(c){ return csvEscape(c.label); }).join(';')];
    rows.forEach(function(row){ lines.push(columns.map(function(c){ return csvEscape(c.get(row)); }).join(';')); });
    var url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    var a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  window.lusidesAdminDownloadCSV = downloadCSV;

  // ---------- Belege (PDF / Versand) über die Edge Function ----------
  function callInvoiceFn(body){
    return client.auth.getSession().then(function(res){
      var token = res.data && res.data.session ? res.data.session.access_token : '';
      return fetch(INVOICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: window.LUSIDES_SUPABASE.anonKey, Authorization: 'Bearer ' + token },
        body: JSON.stringify(body)
      });
    });
  }
  function openPdf(invoiceId, doc){
    var win = window.open('', '_blank');
    callInvoiceFn({ action: 'pdf', invoice_id: invoiceId, doc: doc || 'invoice' }).then(function(r){
      if(!r.ok) throw new Error('PDF ' + r.status);
      return r.blob();
    }).then(function(blob){
      var url = URL.createObjectURL(blob);
      if(win){ win.location = url; } else { location.href = url; }
    }).catch(function(e){ if(win) win.close(); console.error(e); toast('PDF konnte nicht erzeugt werden (Edge Function lusides-invoice deployt?)', true); });
  }
  function resend(appointmentId){
    return callInvoiceFn({ action: 'resend', appointment_id: appointmentId }).then(function(r){
      if(!r.ok) throw new Error('send ' + r.status);
      toast('Bestellschein und Rechnung wurden erneut gesendet.');
      loadInvoices();
    }).catch(function(e){ console.error(e); toast('Versand fehlgeschlagen (RESEND_API_KEY gesetzt?)', true); });
  }
  window.lusidesAdminDocs = {
    invoiceFor: function(apptId){ return data.invoices.filter(function(i){ return i.appointment_id === apptId && i.kind === 'rechnung'; })[0] || null; },
    openPdf: openPdf, resend: resend
  };

  // ---------- Tabs ----------
  function showTab(name){
    document.querySelectorAll('.tab').forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-tab') === name); t.setAttribute('aria-selected', t.getAttribute('data-tab') === name); });
    document.querySelectorAll('.pane').forEach(function(p){ p.classList.toggle('active', p.id === 'pane-' + name); });
    try{ sessionStorage.setItem('lusides_admin_tab', name); }catch(e){}
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach(function(t){ t.addEventListener('click', function(){ showTab(t.getAttribute('data-tab')); }); });

  // ---------- Rechnungen ----------
  var invFilter = 'alle';
  var TAX = { AT_20: 'AT 20 %', REVERSE_CHARGE: 'Reverse Charge', NON_EU: 'Drittland' };
  function renderInvoices(){
    var rows = data.invoices.filter(function(i){ return invFilter === 'alle' || i.status === invFilter; });
    $('invCount').textContent = data.invoices.length + ' Belege';
    var sums = {};
    data.invoices.forEach(function(i){
      if(i.kind !== 'rechnung' || i.status === 'storniert') return;
      var k = i.currency; sums[k] = sums[k] || { open: 0, paid: 0 };
      sums[k][i.status === 'bezahlt' ? 'paid' : 'open'] += Number(i.gross_amount);
    });
    var openCount = data.invoices.filter(function(i){ return i.kind === 'rechnung' && i.status === 'offen'; }).length;
    badge('bRechnungen', openCount);
    var st = '';
    Object.keys(sums).forEach(function(cur){
      st += '<div class="stat hl"><div class="num">' + money(sums[cur].open, cur) + '</div><div class="lbl">offen (' + cur + ')</div></div>';
      st += '<div class="stat"><div class="num">' + money(sums[cur].paid, cur) + '</div><div class="lbl">bezahlt (' + cur + ')</div></div>';
    });
    $('invStats').innerHTML = st || '<div class="stat"><div class="num">0</div><div class="lbl">noch keine Rechnungen</div></div>';
    if(!rows.length){ $('invBody').innerHTML = '<tr class="empty-row"><td colspan="9">Keine Rechnungen.</td></tr>'; return; }
    $('invBody').innerHTML = rows.map(function(i){
      var appt = data.appointments[i.appointment_id] || {};
      var actions = '<button class="btn btn-sm" data-act="pdf" data-id="' + i.id + '">PDF</button>';
      if(i.kind === 'rechnung' && i.appointment_id) actions += '<button class="btn btn-sm" data-act="order" data-id="' + i.id + '">Bestellschein</button>';
      if(i.kind === 'rechnung' && i.status === 'offen') actions += '<button class="btn btn-sm" data-act="paid" data-id="' + i.id + '">Bezahlt</button>';
      if(i.kind === 'rechnung' && i.status === 'bezahlt') actions += '<button class="btn btn-sm" data-act="unpaid" data-id="' + i.id + '">Offen</button>';
      if(i.kind === 'rechnung' && i.appointment_id) actions += '<button class="btn btn-sm" data-act="resend" data-appt="' + i.appointment_id + '">Senden</button>';
      if(i.kind === 'rechnung' && i.status !== 'storniert') actions += '<button class="btn btn-sm btn-danger" data-act="storno" data-id="' + i.id + '" data-no="' + esc(i.invoice_no) + '">Storno</button>';
      var mail = i.sent_at ? '<span class="pill gesendet">gesendet</span>' : (appt.mail_status === 'fehler' ? '<span class="pill fehler" title="' + esc(appt.mail_error || '') + '">Fehler</span>' : '<span class="pill">offen</span>');
      return '<tr>'
        + '<td class="primary nowrap" data-label="Nummer">' + esc(i.invoice_no) + (i.kind === 'storno' ? ' <span class="pill storniert">Storno</span>' : '') + '</td>'
        + '<td class="nowrap" data-label="Datum">' + fmtDate(i.issue_date, false) + '</td>'
        + '<td data-label="Kunde">' + esc(i.customer_company ? i.customer_company + ' · ' + i.customer_name : i.customer_name) + '</td>'
        + '<td class="nowrap" data-label="Leistung">' + fmtDate(i.service_date, false) + '</td>'
        + '<td class="num" data-label="Betrag">' + money(i.gross_amount, i.currency) + '</td>'
        + '<td class="nowrap" data-label="Steuer">' + esc(TAX[i.tax_treatment] || i.tax_treatment) + '</td>'
        + '<td data-label="Status"><span class="pill ' + i.status + '">' + i.status + '</span></td>'
        + '<td data-label="Versand">' + mail + '</td>'
        + '<td data-label=""><div class="row-actions">' + actions + '</div></td>'
        + '</tr>';
    }).join('');
  }
  $('invFilters').addEventListener('click', function(e){
    var b = e.target.closest('.chip-f'); if(!b) return;
    invFilter = b.getAttribute('data-f');
    document.querySelectorAll('#invFilters .chip-f').forEach(function(x){ x.classList.toggle('active', x === b); });
    renderInvoices();
  });
  $('invBody').addEventListener('click', function(e){
    var b = e.target.closest('button[data-act]'); if(!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if(act === 'pdf') return openPdf(id, 'invoice');
    if(act === 'order') return openPdf(id, 'order');
    if(act === 'resend'){ b.disabled = true; return resend(b.getAttribute('data-appt')).then(function(){ b.disabled = false; }); }
    if(act === 'paid' || act === 'unpaid'){
      client.from('invoices').update(act === 'paid' ? { status: 'bezahlt', paid_at: new Date().toISOString() } : { status: 'offen', paid_at: null }).eq('id', id).then(function(res){
        if(res.error){ toast('Speichern fehlgeschlagen: ' + res.error.message, true); return; }
        var inv = data.invoices.filter(function(i){ return i.id === id; })[0];
        if(inv && inv.appointment_id) client.from('appointments').update({ paid: act === 'paid' }).eq('id', inv.appointment_id).then(function(){});
        loadInvoices(); toast(act === 'paid' ? 'Als bezahlt markiert.' : 'Wieder offen.');
      });
    }
    if(act === 'storno'){
      if(!confirm('Rechnung ' + b.getAttribute('data-no') + ' stornieren? Es wird eine Stornorechnung mit eigener Nummer erstellt.')) return;
      client.rpc('cancel_invoice', { p_invoice: id }).then(function(res){
        if(res.error){ toast('Storno fehlgeschlagen: ' + res.error.message, true); return; }
        toast('Stornorechnung ' + res.data + ' erstellt.'); loadInvoices();
      });
    }
  });
  $('exportInvBtn').addEventListener('click', function(){
    downloadCSV('rechnungen.csv', data.invoices, [
      { label: 'Nummer', get: function(i){ return i.invoice_no; } },
      { label: 'Art', get: function(i){ return i.kind; } },
      { label: 'Datum', get: function(i){ return i.issue_date; } },
      { label: 'Leistungsdatum', get: function(i){ return i.service_date; } },
      { label: 'Kunde', get: function(i){ return i.customer_name; } },
      { label: 'Firma', get: function(i){ return i.customer_company; } },
      { label: 'Land', get: function(i){ return i.customer_country; } },
      { label: 'UID Kunde', get: function(i){ return i.customer_uid; } },
      { label: 'Währung', get: function(i){ return i.currency; } },
      { label: 'Netto', get: function(i){ return String(i.net_amount).replace('.', ','); } },
      { label: 'USt-Satz', get: function(i){ return String(i.vat_rate).replace('.', ','); } },
      { label: 'USt', get: function(i){ return String(i.vat_amount).replace('.', ','); } },
      { label: 'Brutto', get: function(i){ return String(i.gross_amount).replace('.', ','); } },
      { label: 'Steuer', get: function(i){ return TAX[i.tax_treatment]; } },
      { label: 'Status', get: function(i){ return i.status; } }
    ]);
  });
  function loadInvoices(){
    return Promise.all([
      client.from('invoices').select('*').order('invoice_no', { ascending: false }),
      client.from('appointments').select('id, order_no, mail_status, mail_error')
    ]).then(function(r){
      if(r[0].error){ $('invBody').innerHTML = '<tr class="empty-row"><td colspan="9">Rechnungen nicht verfügbar – Migration 20261003100000_billing.sql ausgeführt?</td></tr>'; return; }
      data.invoices = r[0].data || [];
      data.appointments = {};
      (r[1].data || []).forEach(function(a){ data.appointments[a.id] = a; });
      renderInvoices();
    });
  }

  // ---------- Anfragen / Newsletter / Besucher ----------
  function renderContacts(rows){
    data.contacts = rows;
    $('contactsCount').textContent = rows.length + ' Einträge';
    var week = Date.now() - 7 * 86400000;
    badge('bAnfragen', rows.filter(function(r){ return new Date(r.created_at).getTime() > week; }).length);
    if(!rows.length){ $('contactsBody').innerHTML = '<tr class="empty-row"><td colspan="7">Noch keine Anfragen.</td></tr>'; return; }
    $('contactsBody').innerHTML = rows.map(function(r){
      return '<tr>'
        + '<td class="primary" data-label="Name">' + esc(r.name) + '</td>'
        + '<td data-label="Unternehmen">' + esc(r.company || '—') + '</td>'
        + '<td data-label="Anliegen">' + esc(r.biggest_challenge || '—') + '</td>'
        + '<td class="nowrap" data-label="Telefon">' + (r.phone ? '<a href="tel:' + esc(r.phone.replace(/\s+/g, '')) + '">' + esc(r.phone) + '</a>' : '—') + '</td>'
        + '<td data-label="E-Mail"><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a></td>'
        + '<td data-label="Newsletter" class="' + (r.newsletter_opt_in ? 'tag-yes' : 'tag-no') + '">' + (r.newsletter_opt_in ? 'Ja' : 'Nein') + '</td>'
        + '<td class="nowrap" data-label="Datum">' + fmtDate(r.created_at) + '</td></tr>';
    }).join('');
  }
  function renderNewsletter(rows){
    data.newsletter = rows;
    $('newsletterCount').textContent = rows.length + ' Abonnenten';
    if(!rows.length){ $('newsletterBody').innerHTML = '<tr class="empty-row"><td colspan="3">Noch keine Abonnenten.</td></tr>'; return; }
    $('newsletterBody').innerHTML = rows.map(function(r){
      return '<tr><td class="primary" data-label="Name">' + esc(r.name || '—') + '</td><td data-label="E-Mail"><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a></td><td class="nowrap" data-label="Datum">' + fmtDate(r.created_at) + '</td></tr>';
    }).join('');
  }
  function renderAnalytics(visits, durations, conversions){
    var devices = {};
    visits.forEach(function(v){ devices[v.device_type] = (devices[v.device_type] || 0) + 1; });
    var sessions = new Set(visits.map(function(v){ return v.session_id; }));
    var conv = new Set((conversions || []).map(function(c){ return c.session_id; }));
    var rate = sessions.size ? (conv.size / sessions.size * 100) : 0;
    var html = '<div class="stat"><div class="num">' + visits.length + '</div><div class="lbl">Seitenaufrufe</div></div>';
    Object.keys(devices).sort().forEach(function(d){ html += '<div class="stat"><div class="num">' + devices[d] + '</div><div class="lbl">' + esc(d) + '</div></div>'; });
    html += '<div class="stat hl"><div class="num">' + (conversions || []).length + '</div><div class="lbl">Conversions</div></div>';
    html += '<div class="stat hl"><div class="num">' + rate.toFixed(1) + ' %</div><div class="lbl">Conversion-Rate</div></div>';
    $('analyticsSummary').innerHTML = html;
    if(!visits.length){ $('analyticsBody').innerHTML = '<tr class="empty-row"><td colspan="5">Noch keine Besuche.</td></tr>'; return; }
    $('analyticsBody').innerHTML = visits.map(function(v){
      return '<tr><td class="primary" data-label="Seite">' + esc(v.page) + '</td><td data-label="Herkunft">' + esc(v.referrer || 'Direktzugriff') + '</td><td data-label="Gerät">' + esc(v.device_type) + '</td><td class="nowrap" data-label="Verweildauer">' + fmtDuration(durations[v.session_id]) + '</td><td class="nowrap" data-label="Datum">' + fmtDate(v.created_at) + '</td></tr>';
    }).join('');
  }
  $('exportContactsBtn').addEventListener('click', function(){
    downloadCSV('kontaktanfragen.csv', data.contacts, [
      { label: 'Name', get: function(r){ return r.name; } }, { label: 'Unternehmen', get: function(r){ return r.company; } },
      { label: 'Anliegen', get: function(r){ return r.biggest_challenge; } }, { label: 'Telefon', get: function(r){ return r.phone; } },
      { label: 'E-Mail', get: function(r){ return r.email; } }, { label: 'Newsletter', get: function(r){ return r.newsletter_opt_in ? 'Ja' : 'Nein'; } },
      { label: 'Datum', get: function(r){ return fmtDate(r.created_at); } }
    ]);
  });
  $('exportNewsletterBtn').addEventListener('click', function(){
    downloadCSV('newsletter-abonnenten.csv', data.newsletter, [
      { label: 'Name', get: function(r){ return r.name; } }, { label: 'E-Mail', get: function(r){ return r.email; } },
      { label: 'Datum', get: function(r){ return fmtDate(r.created_at); } }
    ]);
  });

  // ---------- Einstellungen ----------
  var settingsForm = $('settingsForm');
  function loadSettings(){
    client.from('billing_settings').select('*').eq('id', true).maybeSingle().then(function(res){
      if(res.error || !res.data){ settingsForm.querySelector('h3').insertAdjacentHTML('afterend', '<p class="hint full">Noch nicht verfügbar – Migration 20261003100000_billing.sql ausführen.</p>'); return; }
      Object.keys(res.data).forEach(function(k){ var el = settingsForm.elements[k]; if(el) el.value = res.data[k] == null ? '' : res.data[k]; });
    });
  }
  settingsForm.addEventListener('submit', function(e){
    e.preventDefault();
    var patch = {};
    Array.prototype.forEach.call(settingsForm.elements, function(el){
      if(!el.name) return;
      var v = el.value.trim();
      patch[el.name] = el.type === 'number' ? (v === '' ? null : Number(v)) : (v === '' ? null : v);
    });
    patch.updated_at = new Date().toISOString();
    client.from('billing_settings').update(patch).eq('id', true).then(function(res){
      toast(res.error ? 'Speichern fehlgeschlagen: ' + res.error.message : 'Einstellungen gespeichert.', !!res.error);
    });
  });

  // ---------- Laden ----------
  function loadData(){
    if(window.lusidesAdminCalendar) window.lusidesAdminCalendar.load(client);
    loadInvoices();
    loadSettings();
    client.from('contacts').select('*').order('created_at', { ascending: false }).then(function(res){
      if(res.error){ $('contactsBody').innerHTML = '<tr class="empty-row"><td colspan="7">Fehler beim Laden.</td></tr>'; return; }
      renderContacts(res.data || []);
    });
    client.from('newsletter_subscribers').select('*').order('created_at', { ascending: false }).then(function(res){
      if(res.error){ $('newsletterBody').innerHTML = '<tr class="empty-row"><td colspan="3">Fehler beim Laden.</td></tr>'; return; }
      renderNewsletter(res.data || []);
    });
    Promise.all([
      client.from('page_visits').select('*').order('created_at', { ascending: false }).limit(300),
      client.from('page_visit_durations').select('session_id, duration_seconds'),
      client.from('conversion_events').select('*').order('created_at', { ascending: false })
    ]).then(function(r){
      if(r[0].error || r[1].error){ $('analyticsBody').innerHTML = '<tr class="empty-row"><td colspan="5">Fehler beim Laden.</td></tr>'; return; }
      var durations = {};
      (r[1].data || []).forEach(function(d){ durations[d.session_id] = Math.max(durations[d.session_id] || 0, d.duration_seconds); });
      renderAnalytics(r[0].data || [], durations, r[2].error ? [] : (r[2].data || []));
    });
  }

  // ---------- Login ----------
  var loginForm = $('loginForm'), loginNote = $('loginNote'), logoutBtn = $('logoutBtn');
  loginForm.querySelector('button').disabled = true;
  function showDashboard(session){
    $('loginView').style.display = 'none';
    $('dashboardView').style.display = 'block';
    $('tabs').style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    $('userEmail').textContent = session && session.user ? session.user.email : '';
    var tab = null; try{ tab = sessionStorage.getItem('lusides_admin_tab'); }catch(e){}
    if(tab && $('pane-' + tab)) showTab(tab);
    loadData();
  }
  function showLogin(){
    $('loginView').style.display = 'block';
    $('dashboardView').style.display = 'none';
    $('tabs').style.display = 'none';
    logoutBtn.style.display = 'none';
    $('userEmail').textContent = '';
  }
  if(!window.lusidesSupabaseReady){ $('configNote').classList.add('show'); return; }
  window.lusidesSupabaseReady(function(c){
    client = c;
    if(!client){ $('configNote').classList.add('show'); return; }
    loginForm.querySelector('button').disabled = false;
    client.auth.getSession().then(function(res){ if(res.data && res.data.session) showDashboard(res.data.session); });
    loginForm.addEventListener('submit', function(e){
      e.preventDefault();
      var btn = loginForm.querySelector('button'); btn.disabled = true; loginNote.classList.remove('show');
      client.auth.signInWithPassword({ email: $('admin-email').value.trim(), password: $('admin-password').value }).then(function(res){
        if(res.error) throw res.error;
        showDashboard(res.data.session);
      }).catch(function(){
        loginNote.textContent = 'Anmeldung fehlgeschlagen. E-Mail oder Passwort falsch.';
        loginNote.classList.add('show');
      }).finally(function(){ btn.disabled = false; });
    });
    logoutBtn.addEventListener('click', function(){ client.auth.signOut().then(showLogin); });
  });
})();
