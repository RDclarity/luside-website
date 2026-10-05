(function(){
  'use strict';
  if(window.__lusidesChatLoaded) return;
  window.__lusidesChatLoaded = true;

  var BOOKING_URL = 'termin.html';
  var CRM_INTAKE_URL = 'https://knuktzuqqmrrkpkusren.supabase.co/functions/v1/lusides-rima-sync';
  var CONTACT_EMAIL = 'inquiry@lusides.com';
  var CONTACT_PHONE = '+43 660 3607188';
  var CONTACT_PHONE_HREF = '+436603607188';
  var REQUEST_TIMEOUT_MS = 15000;
  var AI_TIMEOUT_MS = 30000;
  var CHAR_MS = 18;            // Tippgeschwindigkeit pro Zeichen
  var MAX_TYPE_MS = 2400;      // lange Antworten sind spätestens nach ~2,4 s fertig
  var AI_HISTORY_MAX = 12;

  // ---------- Strings (DE/EN) ----------

  var UI = {
    de: {
      title: 'Lusides Assistent',
      subtitle: 'Digitale Transformation · Wien',
      dialogAria: 'Chat mit dem Lusides Assistenten',
      closeAria: 'Chat schließen',
      openAria: 'Chat öffnen',
      placeholder: 'Frage eingeben…',
      inputAria: 'Nachricht',
      send: 'Senden',
      topics: 'Themen',
      topicsAria: 'Themenübersicht anzeigen',
      qrAria: 'Antwortvorschläge',
      bookChip: 'Termin buchen',
      bookDirectChip: 'Termin direkt buchen',
      contactChip: 'Kontakt aufnehmen',
      closeChip: 'Chat schließen',
      skipChip: 'Überspringen',
      greeting: 'Hallo! Ich bin der Lusides Assistent. Wir begleiten <strong>etablierte Unternehmen und die nächste Generation</strong> bei der digitalen Transformation. Wie kann ich dir helfen?',
      topicsIntro: 'Worüber möchtest du mehr erfahren?',
      aiError: 'Da ist gerade etwas schiefgelaufen. Versuch es bitte gleich nochmal — oder buch dir direkt ein Erstgespräch.',
      aiRateLimited: 'Du hast gerade sehr viele Fragen gestellt — bitte warte ein paar Minuten. Direkt erreichst du uns unter {contact}.',
      leadIntro: 'Gerne! Ich nehme kurz deine Kontaktdaten auf — dauert keine Minute. (Tipp jederzeit „abbrechen", um zu stoppen.)',
      askName: 'Wie heißt du? (Vor- und Nachname)',
      askEmail: 'Danke, {name}! Unter welcher E-Mail-Adresse erreichen wir dich?',
      askPhone: 'Und deine Telefonnummer? Das ist optional — du kannst es auch überspringen.',
      invalidName: 'Bitte gib deinen Namen ein (Vor- und Nachname).',
      invalidEmail: 'Das sieht nicht nach einer gültigen E-Mail-Adresse aus — bitte nochmal.',
      invalidPhone: 'Diese Telefonnummer kann ich nicht lesen. Bitte nur Ziffern, +, Leerzeichen, / oder - — oder überspring diesen Schritt.',
      consentIntro: 'Fast fertig — bitte noch bestätigen:',
      consentPrivacy: 'Ich habe die {link} gelesen und stimme zu.',
      consentPrivacyLink: 'Datenschutzerklärung',
      consentNewsletter: 'Ich möchte den Newsletter erhalten.',
      consentSubmit: 'Absenden',
      consentSending: 'Wird gesendet…',
      consentRequired: 'Bitte bestätige die Datenschutzerklärung, um fortzufahren.',
      consentReminder: 'Bitte setz oben das Häkchen bei der Datenschutzerklärung und klick auf „Absenden" — oder tipp „abbrechen".',
      leadSuccess: 'Danke, {name}! Deine Anfrage ist bei uns angekommen — wir melden uns innerhalb von zwei Werktagen. Schneller geht’s, wenn du dir gleich dein Erstgespräch buchst:',
      leadError: 'Das hat leider nicht geklappt. Bitte versuch es gleich nochmal — oder schreib uns direkt an {contact}.',
      cancelled: 'Kein Problem, abgebrochen. Wie kann ich sonst helfen?',
      contactLine: '<a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a> oder ruf an: <a href="tel:' + CONTACT_PHONE_HREF + '">' + CONTACT_PHONE + '</a>'
    },
    en: {
      title: 'Lusides Assistant',
      subtitle: 'Digital transformation · Vienna',
      dialogAria: 'Chat with the Lusides Assistant',
      closeAria: 'Close chat',
      openAria: 'Open chat',
      placeholder: 'Type a question…',
      inputAria: 'Message',
      send: 'Send',
      topics: 'Topics',
      topicsAria: 'Show topic overview',
      qrAria: 'Suggested replies',
      bookChip: 'Book a call',
      bookDirectChip: 'Book your call now',
      contactChip: 'Get in touch',
      closeChip: 'Close chat',
      skipChip: 'Skip',
      greeting: "Hi! I'm the Lusides Assistant. We help <strong>established businesses and the next generation</strong> with their digital transformation. How can I help?",
      topicsIntro: 'What would you like to know more about?',
      aiError: 'Something went wrong there. Please try again in a moment — or book an initial call directly.',
      aiRateLimited: "You've asked a lot of questions in a short time — please wait a few minutes. You can reach us directly at {contact}.",
      leadIntro: "Sure! Let me take down your contact details — it takes less than a minute. (Type \"cancel\" anytime to stop.)",
      askName: "What's your name? (First and last name)",
      askEmail: 'Thanks, {name}! Which email address can we reach you at?',
      askPhone: "And your phone number? It's optional — you can also skip this step.",
      invalidName: 'Please enter your name (first and last name).',
      invalidEmail: "That doesn't look like a valid email address — please try again.",
      invalidPhone: "I can't read that phone number. Please use digits, +, spaces, / or - only — or skip this step.",
      consentIntro: 'Almost done — please confirm:',
      consentPrivacy: "I've read the {link} and agree.",
      consentPrivacyLink: 'privacy policy',
      consentNewsletter: "I'd like to receive the newsletter.",
      consentSubmit: 'Submit',
      consentSending: 'Sending…',
      consentRequired: 'Please confirm the privacy policy to continue.',
      consentReminder: 'Please tick the privacy policy box above and click "Submit" — or type "cancel".',
      leadSuccess: "Thanks, {name}! We've received your request and will get back to you within two business days. Want to move faster? Book your initial call right away:",
      leadError: 'Unfortunately that didn\'t work. Please try again in a moment — or contact us directly at {contact}.',
      cancelled: 'No problem, cancelled. What else can I help with?',
      contactLine: '<a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a> or call <a href="tel:' + CONTACT_PHONE_HREF + '">' + CONTACT_PHONE + '</a>'
    }
  };

  // ---------- FAQ ----------
  // Keyword-Syntax: "wort" = exaktes Wort, "wort*" = Wortanfang, "zwei worte" = Phrase
  // (immer an Wortgrenzen). ":n" = Gewicht (Standard 1). Treffer werden summiert;
  // nur ein klarer Sieger mit Score ≥ 2 wird lokal beantwortet, sonst übernimmt die KI.

  var FAQS = [
    {
      id: 'services',
      label: { de: 'Leistungen', en: 'Services' },
      keywords: {
        de: ['leistung*:3', 'angebot*:2', 'service*:2', 'was bietet:3', 'was macht ihr:3', 'was machen sie:3', 'bereiche:2', 'schwerpunkt*:2', 'prozesse:1', 'systeme:1', 'marketing:1', 'finanz*:1', 'digitalisierung:1', 'ki:1', 'onlineshop*:1', 'webshop*:1'],
        en: ['service*:3', 'offer*:2', 'what do you do:3', 'what do you offer:3', 'areas:2', 'focus:1', 'processes:1', 'systems:1', 'marketing:1', 'finance:1', 'digitalization:1', 'digitalisation:1', 'ai:1', 'online shop*:1', 'ecommerce:1', 'e commerce:1']
      },
      answer: {
        de: 'Fünf Bereiche — wir beraten nicht nur, wir setzen mit dir um:<ul>'
          + '<li><a href="leistungen-prozesse-systeme.html">Prozesse &amp; Systeme</a> — Abläufe, Standards, Verantwortlichkeiten</li>'
          + '<li><a href="leistungen-marketing.html">Marketing</a> — Positionierung, Kampagnen, Leadgenerierung</li>'
          + '<li><a href="leistungen-finanzen.html">Finanzen</a> — Controlling, Reporting, Entscheidungsgrundlagen</li>'
          + '<li><a href="leistungen-digitalisierung-ki.html">Digitalisierung &amp; KI</a> — firmenspezifische KI-Systeme</li>'
          + '<li><a href="leistungen-onlineshop-entwicklung.html">Onlineshop-Entwicklung</a> — Shops und Web-Apps mit Anbindung an deine Systeme</li></ul>',
        en: 'Five areas — we don\'t just advise, we implement with you:<ul>'
          + '<li><a href="leistungen-prozesse-systeme.html">Processes &amp; Systems</a> — workflows, standards, responsibilities</li>'
          + '<li><a href="leistungen-marketing.html">Marketing</a> — positioning, campaigns, lead generation</li>'
          + '<li><a href="leistungen-finanzen.html">Finance</a> — controlling, reporting, a basis for decisions</li>'
          + '<li><a href="leistungen-digitalisierung-ki.html">Digitalization &amp; AI</a> — company-specific AI systems</li>'
          + '<li><a href="leistungen-onlineshop-entwicklung.html">Online Shop Development</a> — shops and web apps connected to your systems</li></ul>'
      },
      next: ['pricing', 'process']
    },
    {
      id: 'pricing',
      label: { de: 'Ablauf Erstgespräch', en: 'How the call works' },
      keywords: {
        de: ['kost*:3', 'preis*:3', 'honorar*:3', 'gebühr*:2', 'teuer:3', 'günstig:2', 'wie viel:2', 'wieviel:2', 'bezahl*:2', 'rechnung:2', 'dauer*:2', 'wie lange:2', 'minuten:2', 'umbuch*:3', 'stornier*:3', 'absage*:2', 'erstgespräch:1', 'erstberatung:1', 'teams:1', 'video:1'],
        en: ['cost*:3', 'price*:3', 'pricing:3', 'fee*:3', 'how much:3', 'expensive:3', 'cheap:2', 'pay:2', 'payment:2', 'invoice:2', 'duration:2', 'how long:2', 'minutes:2', 'reschedul*:3', 'cancellation:2', 'initial call:1', 'consultation:1', 'teams:1', 'video:1']
      },
      answer: {
        de: 'Das Erstgespräch dauert <strong>30 Minuten</strong>, per Telefon oder Video (Microsoft Teams), direkt mit den Gründern.<br>Du buchst es direkt online: Termin wählen, Daten eingeben — danach siehst du den Preis, bevor du verbindlich buchst. Die Rechnung kommt per E-Mail. Umbuchen ist bis 24 Stunden vorher kostenlos.<br>Was ein Projekt kostet, hängt vom Umfang ab — das klären wir im Gespräch.',
        en: 'The initial call takes <strong>30 minutes</strong>, by phone or video (Microsoft Teams), directly with the founders.<br>You book it online: pick a time, enter your details — you then see the price before you confirm. The invoice arrives by email. Rescheduling is free up to 24 hours before.<br>Project costs depend on the scope — we clarify that in the call.'
      },
      next: ['process', 'services']
    },
    {
      id: 'booking',
      menu: false,
      label: { de: 'Termin buchen', en: 'Book a call' },
      keywords: {
        de: ['termin*:3', 'buchen:3', 'buchung:3', 'buche:3', 'gebucht:2', 'vereinbaren:2', 'erstgespräch:2', 'erstberatung:2', 'gespräch:1', 'meeting:2', 'kalender:2', 'verschieb*:2'],
        en: ['book:3', 'booking:3', 'appointment*:3', 'schedule:3', 'scheduling:3', 'meeting:2', 'calendar:2', 'initial call:2', 'consultation:1', 'call:1']
      },
      answer: {
        de: 'Ganz einfach: Wähl auf der <a href="' + BOOKING_URL + '">Buchungsseite</a> einen freien Termin und ob wir per Telefon oder Video (Teams) sprechen. 30 Minuten, den Preis siehst du nach Eingabe deiner Daten, Rechnung per E-Mail — Umbuchen bis 24 Stunden vorher kostenlos.',
        en: 'Easy: pick a free slot on the <a href="' + BOOKING_URL + '">booking page</a> and choose phone or video (Teams). 30 minutes, you see the price after entering your details, invoice by email — free rescheduling up to 24 hours before.'
      },
      next: ['pricing', 'process']
    },
    {
      id: 'process',
      label: { de: 'Ablauf', en: 'How it works' },
      keywords: {
        de: ['ablauf:3', 'vorgehen:3', 'vorgehensweise:3', 'methode*:3', 'wie arbeitet:3', 'wie läuft:3', 'zusammenarbeit:2', 'schritte:2'],
        en: ['how do you work:3', 'how does it work:3', 'approach:3', 'method*:3', 'steps:2', 'collaboration:2', 'working together:3', 'work together:2']
      },
      answer: {
        de: 'Drei Schritte:<br>1. <strong>Analyse</strong> — wir schauen uns dein Unternehmen genau an.<br>2. <strong>Aufbau</strong> — wir bauen gemeinsam die fehlenden Systeme.<br>3. <strong>Umsetzung</strong> — wir begleiten dich, bis es im Alltag läuft.<br>Am Anfang steht das 60-minütige Erstgespräch.',
        en: 'Three steps:<br>1. <strong>Analysis</strong> — we take a close look at your business.<br>2. <strong>Build</strong> — we build the missing systems together.<br>3. <strong>Implementation</strong> — we support you until it runs day to day.<br>It all starts with the 60-minute initial call.'
      },
      next: ['pricing', 'audience']
    },
    {
      id: 'audience',
      label: { de: 'Für wen?', en: 'Who is it for?' },
      keywords: {
        de: ['für wen:3', 'für welche:3', 'zielgruppe:3', 'passt das:2', 'passt:1', 'geeignet:2', 'startup*:2', 'start up:2', 'branche*:2', 'unternehmensgröße:2', 'nächste generation:3', 'nachfolge*:2'],
        en: ['who is this for:3', 'who is it for:3', 'who do you work with:3', 'for whom:3', 'target:2', 'fit:1', 'suitable:2', 'startup*:2', 'start up:2', 'industr*:2', 'next generation:3', 'succession:2']
      },
      answer: {
        de: 'Für <strong>etablierte Unternehmen</strong>, die ihre Abläufe, ihr Marketing und ihre Systeme digital aufstellen wollen — und für <strong>die nächste Generation</strong>, die Verantwortung übernimmt und das Unternehmen weiterentwickelt. Nicht gedacht ist es für Start-ups in der Frühphase. Ob es bei dir passt, klären wir am besten im Erstgespräch.',
        en: 'For <strong>established businesses</strong> that want to put their workflows, marketing and systems on a digital footing — and for <strong>the next generation</strong> taking on responsibility and moving the business forward. It is not designed for early-stage start-ups. Whether it fits for you is best clarified in an initial call.'
      },
      next: ['services', 'team']
    },
    {
      id: 'team',
      label: { de: 'Team', en: 'Team' },
      keywords: {
        de: ['team:3', 'gründer*:3', 'wer steckt:3', 'wer seid ihr:3', 'mitarbeiter*:2', 'marko:3', 'katalan:3', 'richard:3', 'dobrohruschka:3', 'inhaber*:2', 'geschäftsführ*:2'],
        en: ['team:3', 'founder*:3', 'who is behind:3', 'who are you:3', 'staff:2', 'people:1', 'marko:3', 'katalan:3', 'richard:3', 'dobrohruschka:3', 'owner*:2']
      },
      answer: {
        de: 'Lusides wurde von <strong>Marko Katalan</strong> und <strong>Richard Dobrohruschka</strong> gegründet — das Erstgespräch führst du direkt mit ihnen. <a href="team.html">Mehr zum Team →</a>',
        en: 'Lusides was founded by <strong>Marko Katalan</strong> and <strong>Richard Dobrohruschka</strong> — your initial call is directly with them. <a href="team.html">More about the team →</a>'
      },
      next: ['services', 'pricing']
    },
    {
      id: 'about',
      menu: false,
      label: { de: 'Über Lusides', en: 'About Lusides' },
      keywords: {
        de: ['über euch:3', 'über lusides:3', 'was ist lusides:3', 'was macht lusides:3', 'wer ist lusides:3', 'lusides:1', 'firma:1'],
        en: ['about you:3', 'about lusides:3', 'what is lusides:3', 'what does lusides do:3', 'who is lusides:3', 'lusides:1', 'company:1']
      },
      answer: {
        de: 'Lusides steht für <strong>digitale Transformation für etablierte Unternehmen und die nächste Generation</strong>. Wir sitzen in Wien und setzen gemeinsam mit dir um — von Prozessen und Marketing über Finanzen bis zu KI und Onlineshops.',
        en: 'Lusides stands for <strong>digital transformation for established businesses and the next generation</strong>. Based in Vienna, we implement together with you — from processes and marketing to finance, AI and online shops.'
      },
      next: ['services', 'team']
    },
    {
      id: 'contact',
      label: { de: 'Kontaktdaten', en: 'Contact details' },
      keywords: {
        de: ['kontakt:2', 'kontaktdaten:3', 'email:2', 'e mail:2', 'mail:1', 'telefon*:2', 'nummer:1', 'adresse:3', 'anschrift:3', 'standort:3', 'büro:2', 'wo seid ihr:3', 'erreichen:2', 'anrufen:2', 'wien:1'],
        en: ['contact:2', 'contact details:3', 'email:2', 'e mail:2', 'phone:2', 'number:1', 'address:3', 'location:3', 'office:2', 'where are you:3', 'reach you:3', 'call you:2', 'vienna:1']
      },
      answer: {
        de: 'E-Mail: <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a><br>Telefon: <a href="tel:' + CONTACT_PHONE_HREF + '">' + CONTACT_PHONE + '</a><br>Adresse: Endresstraße 50/V3, 1230 Wien<br>Am schnellsten geht’s mit einem gebuchten Erstgespräch.',
        en: 'Email: <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a><br>Phone: <a href="tel:' + CONTACT_PHONE_HREF + '">' + CONTACT_PHONE + '</a><br>Address: Endresstraße 50/V3, 1230 Vienna, Austria<br>The fastest way is to book an initial call.'
      },
      next: ['lead']
    }
  ];

  var WELCOME_TOPICS = ['services', 'pricing', 'audience', 'team'];
  var MENU_TOPICS = ['services', 'pricing', 'process', 'audience', 'team', 'contact'];

  // Keywords einmalig parsen (DE+EN zusammen, Duplikate nur einmal mit höchstem Gewicht).
  FAQS.forEach(function(faq){
    var byKey = {};
    ['de', 'en'].forEach(function(lang){
      faq.keywords[lang].forEach(function(raw){
        var parts = raw.split(':');
        var term = parts[0];
        var weight = parts[1] ? parseInt(parts[1], 10) : 1;
        if(!byKey[term] || byKey[term].weight < weight){
          var prefix = term.charAt(term.length - 1) === '*';
          var clean = prefix ? term.slice(0, -1) : term;
          byKey[term] = { term: clean, weight: weight, prefix: prefix, phrase: clean.indexOf(' ') !== -1 };
        }
      });
    });
    faq.parsed = Object.keys(byKey).map(function(k){ return byKey[k]; });
  });

  // ---------- Styles ----------

  var EASE = 'cubic-bezier(.16,1,.3,1)';
  var css = ''
    + '.cl-chat-toggle{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:var(--ink);color:var(--paper);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 12px 28px -12px rgba(20,30,60,0.45);z-index:200;transition:background .2s ease, transform .3s ' + EASE + ';}'
    + '.cl-chat-toggle:hover{background:var(--accent);transform:translateY(-2px);}'
    + '.cl-chat-toggle:focus-visible,.cl-chat-close:focus-visible,.cl-chip:focus-visible,.cl-topics-btn:focus-visible,.cl-send:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}'
    + '.cl-chat-toggle svg{width:24px;height:24px;position:absolute;transition:opacity .25s ease, transform .35s ' + EASE + ';}'
    + '.cl-chat-toggle .cl-ico-close{opacity:0;transform:rotate(-90deg) scale(.6);}'
    + '.cl-chat-toggle[aria-expanded="true"] .cl-ico-chat{opacity:0;transform:rotate(90deg) scale(.6);}'
    + '.cl-chat-toggle[aria-expanded="true"] .cl-ico-close{opacity:1;transform:none;}'
    + '.cl-chat-panel{position:fixed;bottom:92px;right:24px;width:min(380px, calc(100vw - 32px));height:min(600px, calc(100vh - 140px));background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 28px 64px -24px rgba(20,30,60,0.38);display:flex;flex-direction:column;overflow:hidden;z-index:200;font-family:"Instrument Sans",sans-serif;'
    + 'visibility:hidden;opacity:0;transform:translateY(16px) scale(.97);transform-origin:bottom right;pointer-events:none;transition:opacity .25s ease, transform .4s ' + EASE + ', visibility 0s linear .4s;}'
    + '.cl-chat-panel.open{visibility:visible;opacity:1;transform:none;pointer-events:auto;transition:opacity .25s ease, transform .4s ' + EASE + ', visibility 0s;}'
    + '.cl-chat-panel:focus{outline:none;}'
    + '.cl-chat-header{background:var(--ink);color:var(--paper);padding:12px 10px 12px 18px;padding-top:calc(12px + env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;}'
    + '.cl-head-text{display:flex;flex-direction:column;min-width:0;}'
    + '.cl-title{font-weight:600;font-size:1.02rem;line-height:1.25;}'
    + '.cl-subtitle{font-size:0.74rem;opacity:0.65;letter-spacing:.02em;margin-top:2px;}'
    + '.cl-chat-close{background:none;border:none;color:var(--paper);opacity:0.8;width:42px;height:42px;min-width:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:opacity .2s ease, background .2s ease;}'
    + '.cl-chat-close:hover{opacity:1;background:rgba(255,255,255,0.1);}'
    + '.cl-chat-close svg{width:20px;height:20px;}'
    + '.cl-chat-messages{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:16px;display:flex;flex-direction:column;gap:10px;}'
    + '.cl-msg{max-width:90%;padding:10px 14px;border-radius:var(--radius);font-size:0.88rem;line-height:1.55;overflow-wrap:anywhere;animation:cl-in .38s ' + EASE + ' both;}'
    + '.cl-msg.bot{align-self:flex-start;background:var(--paper-dim);color:var(--ink);border-bottom-left-radius:4px;}'
    + '.cl-msg.user{align-self:flex-end;background:var(--accent);color:#fff;border-bottom-right-radius:4px;}'
    + '.cl-msg p{margin:0 0 8px;}'
    + '.cl-msg p:last-child{margin-bottom:0;}'
    + '.cl-msg ul{margin:6px 0 2px 18px;padding:0;}'
    + '.cl-msg li{margin-bottom:4px;}'
    + '.cl-msg a{color:var(--accent-ink);text-decoration:underline;text-underline-offset:2px;}'
    + '.cl-msg label{display:flex;gap:8px;align-items:flex-start;margin:9px 0;font-size:0.84rem;cursor:pointer;}'
    + '.cl-msg label input{margin-top:3px;flex-shrink:0;width:16px;height:16px;accent-color:var(--accent);}'
    + '.cl-consent-submit{margin-top:6px;background:var(--ink);color:var(--paper);border:none;padding:10px 18px;min-height:40px;border-radius:var(--radius);font-size:0.84rem;cursor:pointer;font-family:inherit;transition:background .2s ease;}'
    + '.cl-consent-submit:hover{background:var(--accent);}'
    + '.cl-consent-submit:disabled{opacity:0.6;cursor:not-allowed;}'
    + '.cl-consent-error{color:#B3261E;font-size:0.8rem;margin-top:6px;display:none;}'
    + '.cl-consent-error.show{display:block;}'
    + '.cl-typing{align-self:flex-start;background:var(--paper-dim);border-radius:var(--radius);border-bottom-left-radius:4px;padding:13px 15px;display:flex;gap:5px;align-items:center;animation:cl-in .3s ' + EASE + ' both;}'
    + '.cl-typing span{width:7px;height:7px;border-radius:50%;background:var(--slate-light);animation:cl-bounce 1.2s infinite ease-in-out;}'
    + '.cl-typing span:nth-child(2){animation-delay:.15s;}'
    + '.cl-typing span:nth-child(3){animation-delay:.3s;}'
    + '.cl-qr{display:flex;flex-wrap:wrap;gap:7px;align-self:flex-start;max-width:100%;margin-top:-2px;transition:opacity .2s ease, transform .2s ease;}'
    + '.cl-qr .cl-chip{animation:cl-in .4s ' + EASE + ' both;}'
    + '.cl-qr.cl-qr-out{opacity:0;transform:translateY(4px);pointer-events:none;}'
    + '.cl-chip{display:inline-flex;align-items:center;border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:7px 13px;min-height:34px;font-size:0.8rem;line-height:1.3;border-radius:999px;cursor:pointer;text-decoration:none;transition:border-color .2s ease, color .2s ease, background .2s ease, transform .2s ' + EASE + ';font-family:inherit;}'
    + '.cl-chip:hover{border-color:var(--accent);color:var(--accent);transform:translateY(-1px);}'
    + '.cl-chip.cl-chip-primary{background:var(--ink);color:var(--paper);border-color:var(--ink);font-weight:600;}'
    + '.cl-chip.cl-chip-primary:hover{background:var(--accent);border-color:var(--accent);color:#fff;}'
    + '.cl-chat-inputrow{display:flex;gap:8px;align-items:center;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--line);flex-shrink:0;background:var(--paper);}'
    + '.cl-chat-inputrow input{flex:1;min-width:0;border:1px solid var(--line);padding:9px 12px;font-family:inherit;font-size:0.88rem;border-radius:var(--radius);color:var(--ink);background:var(--paper);transition:border-color .2s ease, opacity .2s ease;}'
    + '.cl-chat-inputrow input:focus{outline:none;border-color:var(--accent);}'
    + '.cl-chat-inputrow input[readonly]{opacity:0.65;}'
    + '.cl-topics-btn{background:none;border:none;color:var(--slate);font-family:inherit;font-size:0.78rem;padding:8px 4px;min-height:36px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--line);flex-shrink:0;transition:color .2s ease;}'
    + '.cl-topics-btn:hover{color:var(--accent);}'
    + '.cl-topics-btn:disabled{opacity:0.5;cursor:default;}'
    + '.cl-send{background:var(--ink);color:var(--paper);border:none;padding:9px 14px;min-height:38px;font-size:0.82rem;border-radius:var(--radius);cursor:pointer;font-family:inherit;flex-shrink:0;transition:background .2s ease, opacity .2s ease;}'
    + '.cl-send:hover{background:var(--accent);}'
    + '.cl-send:disabled{opacity:0.5;cursor:default;background:var(--ink);}'
    + '.cl-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}'
    + '@keyframes cl-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}'
    + '@keyframes cl-bounce{0%,60%,100%{transform:translateY(0);opacity:.45;}30%{transform:translateY(-5px);opacity:1;}}'
    + '@media (max-width:480px){'
    + '.cl-chat-panel{top:0;left:0;right:0;bottom:0;width:100%;max-width:none;height:100vh;height:100dvh;max-height:none;border-radius:0;border:none;transform:translateY(24px);transform-origin:bottom center;}'
    + '.cl-chat-panel.open ~ .cl-chat-toggle{display:none;}'
    + 'html.cl-chat-lock,html.cl-chat-lock body{overflow:hidden;}'
    + '.cl-chat-messages{padding:16px;}'
    + '.cl-msg{max-width:92%;font-size:0.92rem;}'
    + '.cl-chip{padding:9px 14px;font-size:0.84rem;min-height:40px;}'
    + '.cl-chat-inputrow input{padding:11px 12px;font-size:1rem;}'
    + '.cl-send{padding:11px 16px;min-height:44px;}'
    + '}'
    + '@media (prefers-reduced-motion: reduce){'
    + '.cl-chat-panel,.cl-chat-panel.open,.cl-chat-toggle,.cl-chat-toggle svg,.cl-qr,.cl-chip{transition:none;}'
    + '.cl-chat-panel{transform:none;}'
    + '.cl-msg,.cl-typing,.cl-qr .cl-chip{animation:none;}'
    + '.cl-typing span{animation:none;opacity:.7;}'
    + '}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- DOM ----------

  var ICON_CHAT = '<svg class="cl-ico-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var ICON_CLOSE = '<svg class="cl-ico-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'cl-chat-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'cl-chat-panel');
  toggle.innerHTML = ICON_CHAT + ICON_CLOSE;

  var panel = document.createElement('div');
  panel.className = 'cl-chat-panel';
  panel.id = 'cl-chat-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('tabindex', '-1');
  panel.innerHTML = ''
    + '<div class="cl-chat-header"><div class="cl-head-text"><span class="cl-title"></span><span class="cl-subtitle"></span></div>'
    + '<button type="button" class="cl-chat-close">' + ICON_CLOSE.replace('class="cl-ico-close" ', '') + '</button></div>'
    + '<div class="cl-chat-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>'
    + '<div class="cl-chat-inputrow"><button type="button" class="cl-topics-btn"></button><input type="text" autocomplete="off" enterkeyhint="send" maxlength="800"><button type="button" class="cl-send"></button></div>';

  document.body.appendChild(panel);
  document.body.appendChild(toggle);

  var titleEl = panel.querySelector('.cl-title');
  var subtitleEl = panel.querySelector('.cl-subtitle');
  var messagesEl = panel.querySelector('.cl-chat-messages');
  var inputEl = panel.querySelector('.cl-chat-inputrow input');
  var sendBtn = panel.querySelector('.cl-send');
  var topicsBtn = panel.querySelector('.cl-topics-btn');
  var closeBtn = panel.querySelector('.cl-chat-close');

  // ---------- State ----------

  var initialized = false;
  var aiHistory = [];
  var leadState = null;      // { step, data:{}, consent:{...}, submitting }
  var epoch = 0;             // erhöht sich bei Reset → laufende Animationen/Requests verfallen
  var queue = Promise.resolve();
  var pending = 0;           // Bot-Ausgaben in der Warteschlange
  var aiPending = false;
  var currentQr = null;

  // ---------- Helpers ----------

  function mq(q){ try{ return window.matchMedia ? window.matchMedia(q) : null; }catch(e){ return null; } }
  var reducedMq = mq('(prefers-reduced-motion: reduce)');
  var coarseMq = mq('(pointer: coarse)');
  function reducedMotion(){ return !!(reducedMq && reducedMq.matches); }
  function isTouch(){ return !!(coarseMq && coarseMq.matches); }

  function getLang(){
    var l = (window.lusidesI18n && window.lusidesI18n.currentLang) ? window.lusidesI18n.currentLang() : 'de';
    return l === 'en' ? 'en' : 'de';
  }
  function ui(){ return UI[getLang()]; }
  function price(){
    try{ if(window.lusidesRegion && window.lusidesRegion.label) return window.lusidesRegion.label(); }catch(e){}
    return '300 €';
  }
  // Ersetzt {key}-Platzhalter. {price} und {contact} sind immer verfügbar.
  function fmt(str, vars){
    vars = vars || {};
    return String(str).replace(/\{(\w+)\}/g, function(m, k){
      if(Object.prototype.hasOwnProperty.call(vars, k)) return vars[k];
      if(k === 'price') return esc(price());
      if(k === 'contact') return ui().contactLine;
      return m;
    });
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function now(){ return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function rand(a, b){ return a + Math.round(Math.random() * (b - a)); }
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function withTimeout(promise, ms){
    return new Promise(function(resolve, reject){
      var t = setTimeout(function(){ reject(new Error('timeout')); }, ms);
      promise.then(function(v){ clearTimeout(t); resolve(v); }, function(e){ clearTimeout(t); reject(e); });
    });
  }
  function settle(promises){
    return Promise.all(promises.map(function(p){
      return p.then(function(v){ return { ok: true, value: v }; }, function(e){ return { ok: false, error: e }; });
    }));
  }
  function logBooking(){ if(window.lusidesLogConversion) window.lusidesLogConversion('booking_click'); }

  function nearBottom(){ return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 60; }
  function scrollToBottom(){ messagesEl.scrollTop = messagesEl.scrollHeight; }

  function isBusy(){ return pending > 0 || aiPending || !!(leadState && leadState.submitting); }
  function updateInputState(){
    var busy = isBusy();
    sendBtn.disabled = busy;
    topicsBtn.disabled = busy;
    inputEl.readOnly = aiPending;
    messagesEl.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function applyChrome(){
    var s = ui();
    titleEl.textContent = s.title;
    subtitleEl.textContent = s.subtitle;
    panel.setAttribute('aria-label', s.dialogAria);
    closeBtn.setAttribute('aria-label', s.closeAria);
    toggle.setAttribute('aria-label', panel.classList.contains('open') ? s.closeAria : s.openAria);
    inputEl.placeholder = s.placeholder;
    inputEl.setAttribute('aria-label', s.inputAria);
    sendBtn.textContent = s.send;
    topicsBtn.textContent = s.topics;
    topicsBtn.setAttribute('aria-label', s.topicsAria);
  }

  // ---------- Messages ----------

  function addUserMessage(text){
    var div = document.createElement('div');
    div.className = 'cl-msg user';
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function createBotMessage(){
    var div = document.createElement('div');
    div.className = 'cl-msg bot';
    messagesEl.appendChild(div);
    return div;
  }

  function showTyping(){
    var div = document.createElement('div');
    div.className = 'cl-typing';
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function removeNode(n){ if(n && n.parentNode) n.parentNode.removeChild(n); }

  // HTML in eine flache Liste aus open/text/close zerlegen, damit Text Zeichen für
  // Zeichen erscheinen kann, während Links, <strong>, Listen etc. erhalten bleiben.
  function buildOps(root){
    var ops = [];
    (function walk(node){
      for(var c = node.firstChild; c; c = c.nextSibling){
        if(c.nodeType === 3){ if(c.data) ops.push({ t: 'text', v: c.data }); }
        else if(c.nodeType === 1){ ops.push({ t: 'open', n: c.cloneNode(false) }); walk(c); ops.push({ t: 'close' }); }
      }
    })(root);
    return ops;
  }

  function typeInto(target, html, token){
    var tpl = document.createElement('div');
    tpl.innerHTML = html;
    if(reducedMotion()){
      while(tpl.firstChild) target.appendChild(tpl.firstChild);
      scrollToBottom();
      return Promise.resolve();
    }
    return new Promise(function(resolve){
      var ops = buildOps(tpl);
      var total = 0;
      ops.forEach(function(o){ if(o.t === 'text') total += o.v.length; });
      var perChar = Math.min(CHAR_MS, MAX_TYPE_MS / Math.max(total, 1));
      var stack = [target], i = 0, cur = null, pos = 0, revealed = 0, start = now();
      function step(){
        if(token !== epoch){ resolve(); return; }
        var goal = Math.floor((now() - start) / perChar) + 1;
        var stick = nearBottom();
        while(i < ops.length){
          var op = ops[i];
          if(op.t === 'close'){ stack.pop(); i++; continue; }
          if(revealed >= goal) break;
          if(op.t === 'open'){ stack[stack.length - 1].appendChild(op.n); stack.push(op.n); i++; continue; }
          if(!cur){ cur = document.createTextNode(''); stack[stack.length - 1].appendChild(cur); pos = 0; }
          var take = Math.min(op.v.length - pos, goal - revealed);
          pos += take; revealed += take;
          cur.data = op.v.slice(0, pos);
          if(pos >= op.v.length){ cur = null; i++; }
        }
        if(stick) scrollToBottom();
        if(i >= ops.length){ resolve(); return; }
        setTimeout(step, 16);
      }
      step();
    });
  }

  // Alle Bot-Ausgaben laufen über eine Warteschlange, damit sie nacheinander erscheinen.
  function enqueue(fn){
    var token = epoch;
    pending++;
    updateInputState();
    queue = queue.then(function(){
      if(token !== epoch) return;
      return fn(token);
    }).catch(function(err){
      console.error('chatbot:', err);
    }).then(function(){
      if(token === epoch){ pending--; updateInputState(); }
    });
    return queue;
  }

  // opts: delay (ms Tipp-Indikator), instant (ohne Schreibmaschine), replies (Array|Function), onDone(el)
  function botSay(html, opts){
    opts = opts || {};
    return enqueue(function(token){
      clearQuickReplies();
      var delay = opts.delay != null ? opts.delay : rand(500, 900);
      if(reducedMotion()) delay = Math.min(delay, 250);
      var indicator = delay > 0 ? showTyping() : null;
      return wait(delay).then(function(){
        removeNode(indicator);
        if(token !== epoch) return;
        var content = typeof html === 'function' ? html() : html;
        var el = createBotMessage();
        var done;
        if(opts.instant){ el.innerHTML = content; scrollToBottom(); done = Promise.resolve(); }
        else { done = typeInto(el, content, token); }
        return done.then(function(){
          if(token !== epoch) return;
          if(opts.onDone) opts.onDone(el);
          if(opts.replies) renderQuickReplies(typeof opts.replies === 'function' ? opts.replies() : opts.replies);
        });
      });
    });
  }

  // ---------- Quick replies ----------

  function renderQuickReplies(items){
    clearQuickReplies(true);
    if(!items || !items.length) return;
    var wrap = document.createElement('div');
    wrap.className = 'cl-qr';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', ui().qrAria);
    items.forEach(function(item, idx){
      var el;
      if(item.href){
        el = document.createElement('a');
        el.href = item.href;
      } else {
        el = document.createElement('button');
        el.type = 'button';
      }
      el.className = 'cl-chip' + (item.primary ? ' cl-chip-primary' : '');
      el.textContent = item.label;
      if(!reducedMotion()) el.style.animationDelay = (idx * 45) + 'ms';
      el.addEventListener('click', function(e){
        if(isBusy() && !item.href){ e.preventDefault(); return; }
        clearQuickReplies();
        if(item.run) item.run(e);
      });
      wrap.appendChild(el);
    });
    messagesEl.appendChild(wrap);
    currentQr = wrap;
    scrollToBottom();
  }

  function clearQuickReplies(immediate){
    if(!currentQr) return;
    var el = currentQr;
    currentQr = null;
    var hadFocus = el.contains(document.activeElement);
    if(immediate || reducedMotion()){ removeNode(el); }
    else {
      el.classList.add('cl-qr-out');
      setTimeout(function(){ removeNode(el); }, 220);
    }
    if(hadFocus && !isTouch()) inputEl.focus({ preventScroll: true });
  }

  function faqById(id){
    for(var i = 0; i < FAQS.length; i++) if(FAQS[i].id === id) return FAQS[i];
    return null;
  }
  function qrBook(key){
    return { label: fmt(ui()[key || 'bookChip'], { price: price() }), primary: true, href: BOOKING_URL, run: logBooking };
  }
  function qrContact(){ return { label: ui().contactChip, run: function(){ startLeadFlow(false); } }; }
  function qrFaq(id){
    if(id === 'lead') return qrContact();
    var faq = faqById(id);
    return { label: faq.label[getLang()], run: function(){ answerFaq(faq, true); } };
  }
  function qrClose(){ return { label: ui().closeChip, run: function(){ closePanel(true); } }; }

  function welcomeReplies(){
    return [qrBook(), qrContact()].concat(WELCOME_TOPICS.map(qrFaq));
  }
  function menuReplies(){
    return [qrBook(), qrContact()].concat(MENU_TOPICS.map(qrFaq));
  }
  function faqReplies(faq){
    return [qrBook()].concat((faq.next || []).slice(0, 2).map(qrFaq));
  }

  // ---------- FAQ matching ----------

  function normalize(text){
    return String(text).toLowerCase().replace(/[^a-z0-9äöüßàâçéèêëîïôûùœ]+/g, ' ').trim();
  }

  function matchFaq(text){
    var norm = normalize(text);
    if(!norm) return null;
    var tokens = norm.split(' ');
    var padded = ' ' + norm + ' ';
    var scored = FAQS.map(function(faq){
      var score = 0;
      faq.parsed.forEach(function(kw){
        var hit;
        if(kw.phrase){
          if(kw.prefix){
            hit = padded.indexOf(' ' + kw.term) !== -1;
          } else {
            hit = padded.indexOf(' ' + kw.term + ' ') !== -1;
          }
        } else if(kw.prefix){
          hit = tokens.some(function(t){ return t.indexOf(kw.term) === 0; });
        } else {
          hit = tokens.indexOf(kw.term) !== -1;
        }
        if(hit) score += kw.weight;
      });
      return { faq: faq, score: score };
    }).sort(function(a, b){ return b.score - a.score; });
    var best = scored[0], second = scored[1];
    if(best.score < 2 || best.score <= second.score) return null;
    // Lange, spezifische Fragen lieber der KI überlassen, außer der Treffer ist sehr eindeutig.
    if(tokens.length > 12 && best.score < 4) return null;
    return best.faq;
  }

  function answerFaq(faq, fromClick){
    if(fromClick) addUserMessage(faq.label[getLang()]);
    botSay(function(){ return fmt(faq.answer[getLang()]); }, { replies: function(){ return faqReplies(faq); } });
  }

  function showWelcome(delay){
    botSay(function(){ return ui().greeting; }, { delay: delay, replies: welcomeReplies });
  }

  function showTopics(){
    if(isBusy()) return;
    clearQuickReplies();
    botSay(function(){ return esc(ui().topicsIntro); }, { delay: 350, replies: menuReplies });
  }

  // ---------- Lead flow ----------

  var EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

  function words(text){
    return String(text).toLowerCase().replace(/[^a-zäöüß\s-]/g, ' ').split(/\s+/).filter(Boolean);
  }
  function isCancel(text){
    var w = words(text);
    if(!w.length || w.length > 3) return false;
    return w.some(function(x){ return x === 'abbrechen' || x === 'abbruch' || x === 'cancel' || x === 'stopp' || x === 'stop'; });
  }
  function isSkip(text){
    var t = String(text).toLowerCase().replace(/[.!?\s]+$/g, '').trim();
    return /^(überspringen|ueberspringen|skip|nein|no|keine|none|-|–|—|n\/a)$/.test(t);
  }
  function isYes(text){
    var t = String(text).toLowerCase().replace(/[.!?\s]+$/g, '').trim();
    return /^(ja|yes|ok|okay|einverstanden|ich stimme zu|i agree|agree)$/.test(t);
  }

  function startLeadFlow(fromTyped){
    if(!fromTyped) addUserMessage(ui().contactChip);
    leadState = { step: 'name', data: {} };
    botSay(function(){ return esc(ui().leadIntro); });
    botSay(function(){ return esc(ui().askName); }, { delay: rand(350, 550) });
  }

  function splitName(full){
    var parts = full.split(/\s+/).filter(Boolean);
    return { first: parts[0] || '', last: parts.slice(1).join(' ') };
  }

  function handleLeadStep(text){
    var s = ui();
    if(isCancel(text)){
      leadState = null;
      updateInputState();
      botSay(function(){ return esc(ui().cancelled); }, { replies: function(){ return [qrBook()].concat(WELCOME_TOPICS.slice(0, 2).map(qrFaq)); } });
      return;
    }
    var step = leadState.step;
    var value = text.trim();

    if(step === 'name'){
      if(value.length < 2 || value.length > 100 || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value) || /[<>@]/.test(value)){
        botSay(function(){ return esc(ui().invalidName); }, { delay: 400 });
        return;
      }
      var name = splitName(value.replace(/\s+/g, ' '));
      leadState.data.name = value.replace(/\s+/g, ' ');
      leadState.data.first_name = name.first;
      leadState.data.last_name = name.last;
      leadState.step = 'email';
      botSay(function(){ return fmt(esc(ui().askEmail), { name: esc(name.first) }); });
      return;
    }

    if(step === 'email'){
      if(!EMAIL_RE.test(value) || value.indexOf('..') !== -1 || value.length > 254){
        botSay(function(){ return esc(ui().invalidEmail); }, { delay: 400 });
        return;
      }
      leadState.data.email = value;
      leadState.step = 'phone';
      botSay(function(){ return esc(ui().askPhone); }, { replies: function(){ return [skipReply()]; } });
      return;
    }

    if(step === 'phone'){
      if(isSkip(value)){
        leadState.data.phone = '';
      } else {
        var digits = value.replace(/\D/g, '');
        if(!/^[+\d\s\/\-().]+$/.test(value) || digits.length < 6 || digits.length > 20){
          botSay(function(){ return esc(ui().invalidPhone); }, { delay: 400, replies: function(){ return [skipReply()]; } });
          return;
        }
        leadState.data.phone = value;
      }
      leadState.step = 'consent';
      showConsentStep();
      return;
    }

    if(step === 'consent'){
      var c = leadState.consent;
      if(c && isYes(value) && c.privacyBox.checked){ c.submit(); return; }
      botSay(function(){ return esc(s.consentReminder); }, { delay: 400 });
    }
  }

  function skipReply(){
    return { label: ui().skipChip, run: function(){ handleUserText(ui().skipChip); } };
  }

  function showConsentStep(){
    var s = ui();
    var html = '<p>' + esc(s.consentIntro) + '</p>'
      + '<label><input type="checkbox" class="cl-consent-privacy"><span>'
      + fmt(esc(s.consentPrivacy), { link: '<a href="datenschutz.html" target="_blank" rel="noopener">' + esc(s.consentPrivacyLink) + '</a>' })
      + '</span></label>'
      + '<label><input type="checkbox" class="cl-consent-newsletter"><span>' + esc(s.consentNewsletter) + '</span></label>'
      + '<button type="button" class="cl-consent-submit">' + esc(s.consentSubmit) + '</button>'
      + '<div class="cl-consent-error" role="alert"></div>';
    botSay(html, { instant: true, onDone: function(msgEl){
      var privacyBox = msgEl.querySelector('.cl-consent-privacy');
      var newsletterBox = msgEl.querySelector('.cl-consent-newsletter');
      var submitBtn = msgEl.querySelector('.cl-consent-submit');
      var errorEl = msgEl.querySelector('.cl-consent-error');
      var state = leadState;
      if(!state) return;

      function setDisabled(d){ privacyBox.disabled = d; newsletterBox.disabled = d; submitBtn.disabled = d; }

      function submit(){
        if(!state || state !== leadState || state.submitting) return;
        var strings = ui();
        if(!privacyBox.checked){
          errorEl.textContent = strings.consentRequired;
          errorEl.classList.add('show');
          return;
        }
        errorEl.classList.remove('show');
        clearQuickReplies();
        state.submitting = true;
        setDisabled(true);
        submitBtn.textContent = strings.consentSending;
        updateInputState();
        submitLead(state.data, newsletterBox.checked).then(function(ok){
          state.submitting = false;
          if(state !== leadState){ updateInputState(); return; }
          if(ok){
            var first = state.data.first_name;
            leadState = null;
            submitBtn.textContent = ui().consentSubmit;
            updateInputState();
            if(window.lusidesLogConversion) window.lusidesLogConversion('form_submit');
            botSay(function(){ return fmt(esc(ui().leadSuccess), { name: esc(first) }); }, {
              delay: 300,
              replies: function(){ return [qrBook('bookDirectChip'), qrClose()]; }
            });
          } else {
            setDisabled(false);
            submitBtn.textContent = ui().consentSubmit;
            updateInputState();
            botSay(function(){ return fmt(esc(ui().leadError)); }, { delay: 300 });
          }
        });
      }

      submitBtn.addEventListener('click', submit);
      privacyBox.addEventListener('change', function(){ if(privacyBox.checked) errorEl.classList.remove('show'); });
      state.consent = { privacyBox: privacyBox, submit: submit };
      if(!isTouch()) privacyBox.focus({ preventScroll: true });
    } });
  }

  // Resolves true, sobald mindestens ein Kanal (CRM oder Supabase) erfolgreich war.
  function submitLead(d, newsletterOptIn){
    var fullName = d.name || ((d.first_name || '') + ' ' + (d.last_name || '')).trim();

    var crmHeaders = { 'Content-Type': 'application/json' };
    if(window.LUSIDES_SUPABASE && window.LUSIDES_SUPABASE.anonKey){
      crmHeaders.apikey = window.LUSIDES_SUPABASE.anonKey;
      crmHeaders.Authorization = 'Bearer ' + window.LUSIDES_SUPABASE.anonKey;
    }
    var crm = withTimeout(fetch(CRM_INTAKE_URL, {
      method: 'POST',
      headers: crmHeaders,
      body: JSON.stringify({
        first_name: d.first_name,
        last_name: d.last_name,
        email: d.email,
        phone: d.phone || null,
        postal_code: null,
        biggest_challenge: 'Chat-Anfrage'
      })
    }).then(function(res){
      if(!res.ok) throw new Error('CRM HTTP ' + res.status);
      return true;
    }), REQUEST_TIMEOUT_MS);

    // Hinweis: Der Supabase-Query-Builder ist nur "thenable" (kein echtes Promise,
    // kein .catch) — daher immer über .then(onOk, onErr) und res.error prüfen.
    var db = withTimeout(new Promise(function(resolve, reject){
      if(!window.lusidesSupabaseReady){ reject(new Error('Supabase not configured')); return; }
      window.lusidesSupabaseReady(function(client){
        if(!client){ reject(new Error('Supabase client unavailable')); return; }
        try {
          client.from('contacts').insert({
            name: fullName,
            phone: d.phone || '',
            email: d.email,
            newsletter_opt_in: newsletterOptIn,
            biggest_challenge: 'Chat-Anfrage'
          }).then(function(res){
            if(res && res.error) reject(res.error); else resolve(true);
          }, reject);

          if(newsletterOptIn){
            client.from('newsletter_subscribers')
              .insert({ name: fullName, email: d.email })
              .then(function(res){
                // 23505 = unique_violation: bereits angemeldet — kein Fehler für den Nutzer
                if(res && res.error && res.error.code !== '23505') console.warn('newsletter insert failed (non-blocking):', res.error);
              }, function(err){ console.warn('newsletter insert failed (non-blocking):', err); });
          }
        } catch(err){ reject(err); }
      });
    }), REQUEST_TIMEOUT_MS);

    return settle([crm, db]).then(function(results){
      results.forEach(function(r, i){ if(!r.ok) console.warn((i === 0 ? 'CRM' : 'Supabase') + ' lead submit failed:', r.error); });
      return results.some(function(r){ return r.ok; });
    });
  }

  // ---------- AI ----------

  function isSameSite(url){
    return url.indexOf(location.origin + '/') === 0 || /^https:\/\/(www\.)?lusides\.com\//i.test(url);
  }
  function safeHref(escapedUrl){
    var url = escapedUrl.replace(/&amp;/g, '&').trim();
    if(/^https:\/\/[^\s"'<>\\]+$/i.test(url)) return url;
    // relativ: kein Schema, kein protokoll-relatives //
    if(/^(?![a-z][a-z0-9+.\-]*:)(?!\/\/)[^\s"'<>\\]+$/i.test(url)) return url;
    return null;
  }
  function inlineMd(s){
    s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function(m, text, href){
      var u = safeHref(href);
      if(!u) return text;
      var external = /^https:/i.test(u) && !isSameSite(u);
      return '<a href="' + esc(u) + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + text + '</a>';
    });
    s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
    return s;
  }
  // Escapen zuerst, dann nur **fett**, [Link](url), Zeilenumbrüche und "- "-Listen umwandeln.
  function renderMarkdown(text){
    var lines = esc(String(text || '').replace(/\r\n?/g, '\n').trim()).split('\n');
    var out = [], para = [], list = [];
    function flushPara(){ if(para.length){ out.push('<p>' + para.join('<br>') + '</p>'); para = []; } }
    function flushList(){ if(list.length){ out.push('<ul>' + list.map(function(li){ return '<li>' + li + '</li>'; }).join('') + '</ul>'); list = []; } }
    lines.forEach(function(line){
      var m = line.match(/^\s*[-*•]\s+(.*)$/);
      if(m){ flushPara(); list.push(inlineMd(m[1])); return; }
      flushList();
      if(!line.trim()){ flushPara(); return; }
      para.push(inlineMd(line.trim()));
    });
    flushPara(); flushList();
    return out.join('');
  }

  function aiConfigured(){
    var c = window.LUSIDES_SUPABASE;
    return !!(c && c.url && c.anonKey && c.url.indexOf('YOUR_SUPABASE') === -1);
  }

  function callAi(userText){
    var entry = { role: 'user', content: userText };
    aiHistory.push(entry);
    if(aiHistory.length > AI_HISTORY_MAX) aiHistory = aiHistory.slice(-AI_HISTORY_MAX);

    if(!aiConfigured()){
      aiHistory.pop();
      botSay(function(){ return esc(ui().aiError); }, { replies: function(){ return [qrBook(), qrContact()]; } });
      return;
    }

    aiPending = true;
    updateInputState();
    enqueue(function(token){
      clearQuickReplies();
      var indicator = showTyping();
      var started = now();
      var controller = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function(){ if(controller) controller.abort(); }, AI_TIMEOUT_MS);
      var historySnapshot = aiHistory.slice();

      return fetch(window.LUSIDES_SUPABASE.url + '/functions/v1/lusides-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.LUSIDES_SUPABASE.anonKey,
          'Authorization': 'Bearer ' + window.LUSIDES_SUPABASE.anonKey
        },
        body: JSON.stringify({ messages: historySnapshot, lang: getLang() }),
        signal: controller ? controller.signal : undefined
      }).then(function(res){
        return res.json().catch(function(){ return null; }).then(function(data){ return { ok: res.ok, status: res.status, data: data }; });
      }, function(err){
        console.error('chatbot AI request failed:', err);
        return { ok: false, status: 0, data: null };
      }).then(function(result){
        clearTimeout(timer);
        // Mindestens kurz "tippen", damit sehr schnelle Antworten nicht abrupt wirken.
        var minWait = reducedMotion() ? 0 : Math.max(0, 450 - (now() - started));
        return wait(minWait).then(function(){ return result; });
      }).then(function(result){
        removeNode(indicator);
        if(token !== epoch) return;
        aiPending = false;
        updateInputState();
        var reply = result.ok && result.data && typeof result.data.reply === 'string' ? result.data.reply.trim() : '';
        var el = createBotMessage();
        if(reply){
          aiHistory.push({ role: 'assistant', content: reply });
          if(aiHistory.length > AI_HISTORY_MAX) aiHistory = aiHistory.slice(-AI_HISTORY_MAX);
          return typeInto(el, renderMarkdown(reply), token).then(function(){
            if(token !== epoch) return;
            renderQuickReplies([qrBook(), qrContact()]);
            refocusInput();
          });
        }
        // Fehlgeschlagenen Nutzer-Turn wieder aus dem Verlauf entfernen.
        var idx = aiHistory.lastIndexOf(entry);
        if(idx !== -1) aiHistory.splice(idx, 1);
        var msg = result.status === 429 ? fmt(esc(ui().aiRateLimited)) : esc(ui().aiError);
        return typeInto(el, msg, token).then(function(){
          if(token !== epoch) return;
          renderQuickReplies([qrBook(), qrContact()]);
          refocusInput();
        });
      }).then(null, function(err){
        if(token === epoch){ aiPending = false; updateInputState(); }
        throw err;
      });
    });
  }

  function refocusInput(){
    if(panel.classList.contains('open') && !isTouch() && (document.activeElement === inputEl || document.activeElement === document.body || panel.contains(document.activeElement))){
      inputEl.focus({ preventScroll: true });
    }
  }

  // ---------- Input handling ----------

  function handleUserText(text){
    var trimmed = String(text || '').trim();
    if(!trimmed || isBusy()) return false;
    clearQuickReplies();
    addUserMessage(trimmed);

    if(leadState){
      handleLeadStep(trimmed);
      return true;
    }

    var norm = normalize(trimmed);
    if(norm === normalize(UI.de.contactChip) || norm === normalize(UI.en.contactChip)){
      startLeadFlow(true);
      return true;
    }

    var faq = matchFaq(trimmed);
    if(faq){ answerFaq(faq, false); }
    else { callAi(trimmed); }
    return true;
  }

  function submitInput(){
    if(isBusy()) return;
    if(handleUserText(inputEl.value)) inputEl.value = '';
  }

  sendBtn.addEventListener('click', submitInput);
  inputEl.addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    if(e.isComposing || e.keyCode === 229) return; // IME-Eingabe noch nicht abgeschlossen
    e.preventDefault();
    if(e.repeat) return;
    submitInput();
  });
  topicsBtn.addEventListener('click', function(){
    if(leadState){
      // Während der Kontaktaufnahme nicht unterbrechen; Hinweis auf "abbrechen".
      inputEl.focus({ preventScroll: true });
      return;
    }
    showTopics();
  });

  // Klicks auf Buchungslinks in Bot-Nachrichten als Conversion zählen.
  messagesEl.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if(a && !a.classList.contains('cl-chip') && /termin\.html/.test(a.getAttribute('href') || '')) logBooking();
  });

  // ---------- Open / close ----------

  function openPanel(){
    panel.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', ui().closeAria);
    document.documentElement.classList.add('cl-chat-lock');
    if(!initialized){
      initialized = true;
      showWelcome(450);
    }
    if(isTouch()) panel.focus({ preventScroll: true });
    else inputEl.focus({ preventScroll: true });
  }

  function closePanel(returnFocus){
    if(!panel.classList.contains('open')) return;
    var hadFocus = panel.contains(document.activeElement);
    panel.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', ui().openAria);
    document.documentElement.classList.remove('cl-chat-lock');
    if(returnFocus || hadFocus) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', function(){
    if(panel.classList.contains('open')) closePanel(true); else openPanel();
  });
  closeBtn.addEventListener('click', function(){ closePanel(true); });
  panel.addEventListener('keydown', function(e){
    if(e.key === 'Escape' || e.key === 'Esc'){
      e.stopPropagation();
      closePanel(true);
    }
  });

  // ---------- Language switch ----------

  function resetConversation(){
    epoch++;
    queue = Promise.resolve();
    pending = 0;
    aiPending = false;
    aiHistory = [];
    leadState = null;
    currentQr = null;
    messagesEl.innerHTML = '';
    updateInputState();
    showWelcome(300);
  }

  window.addEventListener('lusides:langchange', function(){
    applyChrome();
    if(!initialized) return;
    // Laufende Kontaktaufnahme nicht verwerfen — folgende Fragen kommen in der neuen Sprache.
    if(leadState) return;
    resetConversation();
  });

  applyChrome();
  updateInputState();
})();
