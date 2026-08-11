(function(){
  var BOOKING_URL = 'https://outlook.office.com/bookwithme/user/dc79bf543acd4612bd3cd71f5b078ae2@tischlerkultur.onmicrosoft.com/meetingtype/Lf7qqrACrkGmDArzLF0Lvw2?anonymous&ismsaljsauthenabled&ep=mlink';
  var CRM_INTAKE_URL = 'https://nbnpeoiqiakwnnkorxim.supabase.co/functions/v1/claritylab-lead-intake';

  var UI = {
    de: {
      title: 'Clarity·Lab Assistent',
      closeAria: 'Chat schließen',
      openAria: 'Chat öffnen',
      placeholder: 'Frage eingeben…',
      inputAria: 'Nachricht',
      send: 'Senden',
      bookingChip: 'Termin buchen',
      contactChip: 'Kontakt aufnehmen',
      greeting: 'Hallo! Ich bin der Clarity·Lab Assistent. Frag mich etwas über die Firma oder unsere Leistungen — oder wähl unten eine Frage.',
      fallback: 'Das habe ich leider nicht ganz verstanden. Wähle unten eine Frage aus, oder vereinbare direkt ein unverbindliches Erstgespräch.',
      aiError: 'Da ist gerade etwas schiefgelaufen. Bitte versuche es nochmal oder nimm über das Formular Kontakt auf.',
      thinking: '…',
      leadIntro: 'Gerne! Lass uns kurz deine Kontaktdaten aufnehmen.',
      askFirstName: 'Wie ist dein Vorname?',
      askLastName: 'Und dein Nachname?',
      askPhone: 'Deine Telefonnummer?',
      askPostal: 'Postleitzahl?',
      askEmail: 'Und deine E-Mail-Adresse?',
      consentIntro: 'Fast fertig — bitte noch bestätigen:',
      consentPrivacy: 'Ich habe die Datenschutzerklärung gelesen und stimme zu.',
      consentPrivacyLink: 'Datenschutzerklärung',
      consentNewsletter: 'Ich möchte den Newsletter erhalten.',
      consentSubmit: 'Absenden',
      consentRequired: 'Bitte bestätige die Datenschutzerklärung, um fortzufahren.',
      leadSuccess: 'Danke! Wir melden uns innerhalb von zwei Werktagen bei dir. Du kannst aber auch gleich einen Termin wählen:',
      leadError: 'Da ist etwas schiefgelaufen. Bitte versuch es über das Formular auf der Startseite.',
      cancelHint: '(jederzeit „abbrechen" tippen)',
      cancelled: 'Kein Problem, abgebrochen. Wie kann ich sonst helfen?',
      invalidEmail: 'Das sieht nicht nach einer gültigen E-Mail-Adresse aus — bitte nochmal.'
    },
    en: {
      title: 'Clarity·Lab Assistant',
      closeAria: 'Close chat',
      openAria: 'Open chat',
      placeholder: 'Type a question…',
      inputAria: 'Message',
      send: 'Send',
      bookingChip: 'Book a meeting',
      contactChip: 'Get in touch',
      greeting: "Hello! I'm the Clarity·Lab Assistant. Ask me something about the company or our services — or pick a question below.",
      fallback: "Sorry, I didn't quite catch that. Pick a question below, or schedule a free, no-obligation consultation directly.",
      aiError: 'Something went wrong there. Please try again, or get in touch via the form.',
      thinking: '…',
      leadIntro: "Sure! Let's grab your contact details.",
      askFirstName: 'What\'s your first name?',
      askLastName: 'And your last name?',
      askPhone: 'Your phone number?',
      askPostal: 'Postal code?',
      askEmail: 'And your email address?',
      consentIntro: 'Almost done — please confirm:',
      consentPrivacy: "I've read the privacy policy and agree.",
      consentPrivacyLink: 'privacy policy',
      consentNewsletter: 'I would like to receive the newsletter.',
      consentSubmit: 'Submit',
      consentRequired: 'Please confirm the privacy policy to continue.',
      leadSuccess: "Thanks! We'll get back to you within two business days. Or pick a time right now:",
      leadError: 'Something went wrong. Please use the form on the homepage instead.',
      cancelHint: '(type "cancel" anytime)',
      cancelled: 'No problem, cancelled. What else can I help with?',
      invalidEmail: "That doesn't look like a valid email address — please try again."
    }
  };

  var FAQS = {
    de: [
      {
        label: 'Über Clarity Lab',
        keywords: ['was ist', 'über euch', 'über clarity', 'firma', 'unternehmen', 'wer seid ihr'],
        answer: 'Clarity Lab baut mit inhabergeführten Betrieben Systeme für planbare Neukunden, bessere Abschlüsse und klare Prozesse — damit dein Unternehmen nicht dauerhaft von dir abhängig ist. Praxis statt Theorie: Wir setzen dieselben Systeme auch in unseren eigenen Unternehmen ein.'
      },
      {
        label: 'Unsere Leistungen',
        keywords: ['leistung', 'angebot', 'service', 'was bietet'],
        answer: 'Fünf Bereiche: <ul><li>Mehr Neukunden — Meta/Google Ads, Webseiten, Leadgenerierung</li><li>Mehr Abschlüsse — Vertriebsprozess, Telefonleitfäden, Einwandbehandlung</li><li>CRM &amp; Automatisierung — Aircall, CRM, KI, Dashboards</li><li>Prozesse — Checklisten, Standards, Verantwortlichkeiten</li><li>Unternehmerfreiheit — Delegation, Kennzahlen, Führung</li></ul>'
      },
      {
        label: 'Ablauf der Zusammenarbeit',
        keywords: ['methode', 'ablauf', 'wie arbeitet', 'vorgehen', 'zusammenarbeit'],
        answer: 'Drei Schritte:<br>1. <strong>Analyse</strong> — wir schauen uns dein Unternehmen an.<br>2. <strong>Aufbau</strong> — wir bauen gemeinsam die fehlenden Systeme.<br>3. <strong>Umsetzung</strong> — Begleitung bis es messbar läuft.'
      },
      {
        label: 'Für welche Unternehmen?',
        keywords: ['für welche', 'zielgruppe', 'passt das', 'unternehmensgröße'],
        answer: 'Für inhabergeführte Betriebe, vor allem im Handwerk und in produzierenden Branchen — von Tischlereien über Installateure bis zu Bauunternehmen. Von Einzelunternehmern mit ersten Mitarbeitern bis zu Betrieben mit mehreren Dutzend Mitarbeitenden.'
      },
      {
        label: 'Unser Team',
        keywords: ['team', 'mitarbeiter', 'wer arbeitet'],
        answer: 'Im Team: Richard Dobrohruschka und Marko Katalan, beide selbst Unternehmer. <a href="team.html">Mehr zum Team →</a>'
      },
      {
        label: 'Kontakt & Adresse',
        keywords: ['kontakt', 'email', 'e-mail', 'telefon', 'adresse', 'erreichen', 'standort'],
        answer: 'E-Mail: inquiry@clarity-lab.com<br>Telefon: +43 660 3607188<br>Adresse: Royerstraße 7, 2482 Münchendorf<br><br>Am schnellsten geht’s über das Analyse-Formular unten auf der Startseite, oder über den „Kontakt aufnehmen"-Button unten.'
      },
      {
        label: 'Termin vereinbaren',
        hideChip: true,
        keywords: ['termin', 'buchen', 'meeting', 'gespräch', 'vereinbaren', 'erstgespräch', 'analyse'],
        answer: 'Am schnellsten über den „Kontakt aufnehmen"-Button unten — danach kannst du direkt einen Termin wählen: <a href="' + BOOKING_URL + '" target="_blank" rel="noopener noreferrer">Termin-Kalender öffnen →</a>'
      }
    ],
    en: [
      {
        label: 'About Clarity Lab',
        keywords: ['what is', 'about you', 'about clarity', 'company', 'who are you'],
        answer: "Clarity Lab builds systems with owner-run businesses for predictable new customers, better close rates, and clear processes — so your business isn't permanently dependent on you. Practice, not theory: we use the same systems in our own businesses."
      },
      {
        label: 'Our Services',
        keywords: ['service', 'offer', 'what do you do'],
        answer: 'Five areas: <ul><li>More new customers — Meta/Google Ads, websites, lead generation</li><li>More closed deals — sales process, phone scripts, objection handling</li><li>CRM &amp; Automation — Aircall, CRM, AI, dashboards</li><li>Processes — checklists, standards, responsibilities</li><li>Owner freedom — delegation, metrics, leadership</li></ul>'
      },
      {
        label: 'How we work together',
        keywords: ['method', 'process', 'how do you work', 'approach', 'collaboration'],
        answer: 'Three steps:<br>1. <strong>Analysis</strong> — we look at your business.<br>2. <strong>Build</strong> — we build the missing systems together.<br>3. <strong>Implementation</strong> — support until it runs measurably.'
      },
      {
        label: 'Who is this for?',
        keywords: ['who is this for', 'company size', 'fit', 'suitable'],
        answer: 'For owner-run businesses, especially in trades and manufacturing — from joineries to electricians to construction companies. From sole proprietors with their first employees to businesses with several dozen employees.'
      },
      {
        label: 'Our Team',
        keywords: ['team', 'staff', 'who works there'],
        answer: 'On the team: Richard Dobrohruschka and Marko Katalan, both business owners themselves. <a href="team.html">More about the team →</a>'
      },
      {
        label: 'Contact & Address',
        keywords: ['contact', 'email', 'phone', 'address', 'reach you', 'location'],
        answer: 'Email: inquiry@clarity-lab.com<br>Phone: +43 660 3607188<br>Address: Royerstraße 7, 2482 Münchendorf, Austria<br><br>Fastest way is the "Get in touch" button below.'
      },
      {
        label: 'Schedule an appointment',
        hideChip: true,
        keywords: ['appointment', 'book', 'meeting', 'schedule', 'consultation', 'analysis'],
        answer: 'Fastest way is the "Get in touch" button below — afterwards you can pick a time directly: <a href="' + BOOKING_URL + '" target="_blank" rel="noopener noreferrer">Open booking calendar →</a>'
      }
    ]
  };

  var css = ''
    + '.cl-chat-toggle{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:var(--ink);color:var(--paper);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 12px 28px -12px rgba(20,30,60,0.45);z-index:200;transition:background .2s ease;}'
    + '.cl-chat-toggle:hover{background:var(--accent);}'
    + '.cl-chat-toggle svg{width:24px;height:24px;}'
    + '.cl-chat-panel{position:fixed;bottom:92px;right:24px;width:min(360px, calc(100vw - 32px));max-height:min(560px, calc(100vh - 140px));background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 20px 48px -20px rgba(20,30,60,0.35);display:none;flex-direction:column;overflow:hidden;z-index:200;font-family:"IBM Plex Sans",sans-serif;}'
    + '.cl-chat-panel.open{display:flex;}'
    + '.cl-chat-header{background:var(--ink);color:var(--paper);padding:14px 16px;padding-top:calc(14px + env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between;font-family:"Space Grotesk",sans-serif;font-weight:600;font-size:0.96rem;flex-shrink:0;}'
    + '.cl-chat-close{background:none;border:none;color:var(--paper);opacity:0.75;font-size:1.2rem;line-height:1;cursor:pointer;padding:0 2px;}'
    + '.cl-chat-close:hover{opacity:1;}'
    + '.cl-chat-messages{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;}'
    + '.cl-msg{max-width:92%;padding:10px 13px;border-radius:var(--radius);font-size:0.88rem;line-height:1.55;}'
    + '.cl-msg.bot{align-self:flex-start;background:var(--paper-dim);color:var(--ink);}'
    + '.cl-msg.user{align-self:flex-end;background:var(--accent);color:#fff;}'
    + '.cl-msg ul{margin:6px 0 0 18px;padding:0;}'
    + '.cl-msg li{margin-bottom:4px;}'
    + '.cl-msg a{color:var(--accent-ink);text-decoration:underline;}'
    + '.cl-msg.bot a{color:var(--accent-ink);}'
    + '.cl-msg label{display:flex;gap:7px;align-items:flex-start;margin:9px 0;font-size:0.84rem;cursor:pointer;}'
    + '.cl-msg label input{margin-top:3px;flex-shrink:0;accent-color:var(--accent);}'
    + '.cl-consent-submit{margin-top:6px;background:var(--ink);color:var(--paper);border:none;padding:9px 16px;border-radius:var(--radius);font-size:0.82rem;cursor:pointer;font-family:inherit;transition:background .2s ease;}'
    + '.cl-consent-submit:hover{background:var(--accent);}'
    + '.cl-consent-submit:disabled{opacity:0.6;cursor:not-allowed;}'
    + '.cl-consent-error{color:#B3261E;font-size:0.8rem;margin-top:6px;display:none;}'
    + '.cl-consent-error.show{display:block;}'
    + '.cl-typing{align-self:flex-start;color:var(--slate-light);font-size:0.88rem;padding:10px 13px;}'
    + '.cl-chips{display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px;border-top:1px solid var(--line);flex-shrink:0;}'
    + '.cl-chip{border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:7px 12px;font-size:0.78rem;border-radius:var(--radius);cursor:pointer;transition:border-color .2s ease, color .2s ease;font-family:inherit;}'
    + '.cl-chip:hover{border-color:var(--accent);color:var(--accent);}'
    + '.cl-chip.cl-chip-primary{background:var(--ink);color:var(--paper);border-color:var(--ink);}'
    + '.cl-chip.cl-chip-primary:hover{background:var(--accent);border-color:var(--accent);color:#fff;}'
    + '.cl-chat-inputrow{display:flex;gap:8px;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--line);flex-shrink:0;}'
    + '.cl-chat-inputrow input{flex:1;border:1px solid var(--line);padding:9px 10px;font-family:inherit;font-size:0.88rem;border-radius:var(--radius);color:var(--ink);background:var(--paper);}'
    + '.cl-chat-inputrow input:focus{outline:none;border-color:var(--accent);}'
    + '.cl-chat-inputrow button{background:var(--ink);color:var(--paper);border:none;padding:9px 14px;font-size:0.82rem;border-radius:var(--radius);cursor:pointer;font-family:inherit;transition:background .2s ease;}'
    + '.cl-chat-inputrow button:hover{background:var(--accent);}'
    + '@media (max-width:480px){'
    + '.cl-chat-panel{top:0;left:0;right:0;bottom:0;width:100%;max-width:none;height:100%;max-height:none;border-radius:0;border:none;}'
    + '.cl-chat-panel.open ~ .cl-chat-toggle{display:none;}'
    + '.cl-chat-messages{padding:16px;}'
    + '.cl-chip{padding:9px 14px;font-size:0.82rem;}'
    + '.cl-chat-inputrow input{padding:11px 12px;font-size:1rem;}'
    + '.cl-chat-inputrow button{padding:11px 16px;}'
    + '}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var toggle = document.createElement('button');
  toggle.className = 'cl-chat-toggle';
  toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  var panel = document.createElement('div');
  panel.className = 'cl-chat-panel';
  panel.innerHTML = ''
    + '<div class="cl-chat-header"><span class="cl-title"></span><button class="cl-chat-close">×</button></div>'
    + '<div class="cl-chat-messages"></div>'
    + '<div class="cl-chips"></div>'
    + '<div class="cl-chat-inputrow"><input type="text"><button type="button"></button></div>';

  document.body.appendChild(panel);
  document.body.appendChild(toggle);

  var titleEl = panel.querySelector('.cl-title');
  var messagesEl = panel.querySelector('.cl-chat-messages');
  var chipsEl = panel.querySelector('.cl-chips');
  var inputEl = panel.querySelector('input');
  var sendBtn = panel.querySelector('.cl-chat-inputrow button');
  var closeBtn = panel.querySelector('.cl-chat-close');

  var initialized = false;
  var aiHistory = [];
  var leadState = null; // { step, data:{} }
  var leadSteps = ['first_name', 'last_name', 'phone', 'postal_code', 'email'];

  function getLang(){
    return localStorage.getItem('clarity_lang') || 'de';
  }

  function ui(){ return UI[getLang()] || UI.de; }
  function faqs(){ return FAQS[getLang()] || FAQS.de; }

  function applyChrome(){
    var strings = ui();
    titleEl.textContent = strings.title;
    closeBtn.setAttribute('aria-label', strings.closeAria);
    toggle.setAttribute('aria-label', strings.openAria);
    inputEl.placeholder = strings.placeholder;
    inputEl.setAttribute('aria-label', strings.inputAria);
    sendBtn.textContent = strings.send;
  }

  function addMessage(text, from){
    var div = document.createElement('div');
    div.className = 'cl-msg ' + from;
    if(from === 'bot'){ div.innerHTML = text; } else { div.textContent = text; }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping(){
    var div = document.createElement('div');
    div.className = 'cl-typing';
    div.textContent = ui().thinking;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function renderMenu(){
    chipsEl.innerHTML = '';
    faqs().filter(function(faq){ return !faq.hideChip; }).forEach(function(faq){
      var chip = document.createElement('button');
      chip.className = 'cl-chip';
      chip.type = 'button';
      chip.textContent = faq.label;
      chip.addEventListener('click', function(){
        addMessage(faq.label, 'user');
        addMessage(faq.answer, 'bot');
      });
      chipsEl.appendChild(chip);
    });
    var contactChip = document.createElement('button');
    contactChip.className = 'cl-chip cl-chip-primary';
    contactChip.type = 'button';
    contactChip.textContent = ui().contactChip;
    contactChip.addEventListener('click', startLeadFlow);
    chipsEl.appendChild(contactChip);

    var bookingChip = document.createElement('button');
    bookingChip.className = 'cl-chip';
    bookingChip.type = 'button';
    bookingChip.textContent = ui().bookingChip;
    bookingChip.addEventListener('click', function(){
      if(window.clarityLogConversion) window.clarityLogConversion('booking_click');
      window.open(BOOKING_URL, '_blank', 'noopener');
    });
    chipsEl.appendChild(bookingChip);
  }

  // ---------- Guided lead capture ----------

  function startLeadFlow(){
    leadState = { step: 'first_name', data: {} };
    addMessage(ui().contactChip, 'user');
    addMessage(ui().leadIntro + ' ' + ui().cancelHint, 'bot');
    addMessage(ui().askFirstName, 'bot');
  }

  function stepQuestion(step){
    return {
      last_name: ui().askLastName,
      phone: ui().askPhone,
      postal_code: ui().askPostal,
      email: ui().askEmail
    }[step];
  }

  function showConsentStep(){
    var strings = ui();
    var html = '<p>' + strings.consentIntro + '</p>'
      + '<label><input type="checkbox" class="cl-consent-privacy"><span>' + strings.consentPrivacy + ' <a href="datenschutz.html" target="_blank">' + strings.consentPrivacyLink + '</a></span></label>'
      + '<label><input type="checkbox" class="cl-consent-newsletter"><span>' + strings.consentNewsletter + '</span></label>'
      + '<button type="button" class="cl-consent-submit">' + strings.consentSubmit + '</button>'
      + '<div class="cl-consent-error"></div>';
    var msgEl = addMessage(html, 'bot');
    var privacyBox = msgEl.querySelector('.cl-consent-privacy');
    var newsletterBox = msgEl.querySelector('.cl-consent-newsletter');
    var submitBtn = msgEl.querySelector('.cl-consent-submit');
    var errorEl = msgEl.querySelector('.cl-consent-error');

    submitBtn.addEventListener('click', function(){
      if(!privacyBox.checked){
        errorEl.textContent = strings.consentRequired;
        errorEl.classList.add('show');
        return;
      }
      submitBtn.disabled = true;
      submitLead(newsletterBox.checked, submitBtn, errorEl);
    });
  }

  function submitLead(newsletterOptIn, submitBtn, errorEl){
    var d = leadState.data;
    var strings = ui();

    fetch(CRM_INTAKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: d.first_name,
        last_name: d.last_name,
        email: d.email,
        phone: d.phone || null,
        postal_code: d.postal_code || null
      })
    }).catch(function(err){ console.warn('CRM forward failed (non-blocking):', err); });

    // Note: the Supabase query builder is only a "thenable" (implements .then),
    // not a full Promise — chaining .catch() directly on it throws
    // "...catch is not a function". Always go through .then(res => ...) and
    // inspect res.error instead (matches the pattern in contact-form.js).
    if(window.claritySupabaseReady){
      window.claritySupabaseReady(function(client){
        if(!client) return;
        try {
          client.from('contacts').insert({
            name: (d.first_name + ' ' + d.last_name).trim(),
            phone: d.phone || '',
            email: d.email,
            newsletter_opt_in: newsletterOptIn,
            biggest_challenge: d.postal_code ? ('Chat-Anfrage · PLZ ' + d.postal_code) : 'Chat-Anfrage'
          }).then(function(res){
            if(res && res.error) console.warn('local insert failed (non-blocking):', res.error);
          });

          if(newsletterOptIn){
            client.from('newsletter_subscribers')
              .insert({ name: (d.first_name + ' ' + d.last_name).trim(), email: d.email })
              .then(function(res){
                // 23505 = unique_violation: already subscribed — not an error for the user
                if(res && res.error && res.error.code !== '23505') console.warn('newsletter insert failed (non-blocking):', res.error);
              });
          }
        } catch(err){
          console.warn('local insert failed (non-blocking):', err);
        }
      });
    }

    leadState = null;
    if(errorEl) errorEl.classList.remove('show');
    addMessage(strings.leadSuccess, 'bot');
    var followup = document.createElement('div');
    followup.className = 'cl-msg bot';
    var link = document.createElement('a');
    link.href = BOOKING_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = strings.bookingChip + ' →';
    link.addEventListener('click', function(){
      if(window.clarityLogConversion) window.clarityLogConversion('booking_click');
    });
    followup.appendChild(link);
    messagesEl.appendChild(followup);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if(window.clarityLogConversion) window.clarityLogConversion('form_submit');
  }

  function handleLeadStep(text){
    var strings = ui();
    if(/^(abbrechen|cancel)$/i.test(text.trim())){
      leadState = null;
      addMessage(strings.cancelled, 'bot');
      return;
    }

    var step = leadState.step;
    var value = text.trim();

    if(step === 'email' && value.indexOf('@') === -1){
      addMessage(strings.invalidEmail, 'bot');
      return;
    }

    leadState.data[step] = value;
    var idx = leadSteps.indexOf(step);
    var next = leadSteps[idx + 1];
    if(next){
      leadState.step = next;
      addMessage(stepQuestion(next), 'bot');
    } else {
      leadState.step = 'consent';
      showConsentStep();
    }
  }

  // ---------- AI free-text ----------

  function callAi(userText){
    var strings = ui();
    aiHistory.push({ role: 'user', content: userText });
    if(aiHistory.length > 12) aiHistory = aiHistory.slice(-12);

    var typingEl = showTyping();
    var configured = window.CLARITY_SUPABASE && window.CLARITY_SUPABASE.url && window.CLARITY_SUPABASE.anonKey
      && window.CLARITY_SUPABASE.url.indexOf('YOUR_SUPABASE') === -1;

    if(!configured){
      typingEl.remove();
      addMessage(strings.aiError, 'bot');
      return;
    }

    fetch(window.CLARITY_SUPABASE.url + '/functions/v1/claritylab-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.CLARITY_SUPABASE.anonKey,
        'Authorization': 'Bearer ' + window.CLARITY_SUPABASE.anonKey
      },
      body: JSON.stringify({ messages: aiHistory, lang: getLang() })
    }).then(function(res){ return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
      .then(function(result){
        typingEl.remove();
        if(!result.ok || !result.data || !result.data.reply){
          addMessage(strings.aiError, 'bot');
          return;
        }
        aiHistory.push({ role: 'assistant', content: result.data.reply });
        addMessage(escapeHtml(result.data.reply).replace(/\n/g, '<br>'), 'bot');
      }).catch(function(err){
        console.error(err);
        typingEl.remove();
        addMessage(strings.aiError, 'bot');
      });
  }

  function escapeHtml(str){
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function handleUserText(text){
    var trimmed = text.trim();
    if(!trimmed) return;
    addMessage(trimmed, 'user');

    if(leadState){
      handleLeadStep(trimmed);
      return;
    }

    var lower = trimmed.toLowerCase();
    var match = faqs().find(function(faq){
      return faq.keywords.some(function(kw){ return lower.indexOf(kw) !== -1; });
    });
    if(match){
      addMessage(match.answer, 'bot');
    } else {
      callAi(trimmed);
    }
  }

  function openPanel(){
    panel.classList.add('open');
    if(!initialized){
      initialized = true;
      addMessage(ui().greeting, 'bot');
      renderMenu();
    }
    inputEl.focus();
  }

  function closePanel(){
    panel.classList.remove('open');
  }

  toggle.addEventListener('click', function(){
    if(panel.classList.contains('open')){ closePanel(); } else { openPanel(); }
  });
  closeBtn.addEventListener('click', closePanel);
  sendBtn.addEventListener('click', function(){
    handleUserText(inputEl.value);
    inputEl.value = '';
  });
  inputEl.addEventListener('keydown', function(e){
    if(e.key === 'Enter'){
      handleUserText(inputEl.value);
      inputEl.value = '';
    }
  });

  window.addEventListener('clarity:langchange', function(){
    applyChrome();
    if(initialized) renderMenu();
  });

  applyChrome();
})();
