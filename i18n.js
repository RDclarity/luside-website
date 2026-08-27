(function(){
  var TRANSLATIONS = {
    de: {
      meta: { title: 'Luside — Du musst dein Unternehmen nicht allein tragen' },
      nav: { leistungen: 'Leistungen', warum: 'Warum wir', ablauf: 'Ablauf', faq: 'FAQ', team: 'Team', seminar: 'Seminar', cta: 'Erstgespräch' },
      hero: {
        eyebrow: 'LUSIDE',
        h1: 'Du hast dein Unternehmen aufgebaut. Nicht, um jetzt allein weiterzukämpfen.',
        sub: 'Luside ist Unternehmensberatung und Entwicklungspartner für inhabergeführte Unternehmen — in Prozessen, Systemen, Marketing und KI. Wir beraten nicht nur, wir setzen um.',
        cta1: 'Unternehmen vorstellen',
        cta2: 'Wie wir helfen',
        reassurance: 'Kein Massengeschäft. Nur für Unternehmen mit bestehendem Umsatz und Struktur.'
      },
      problem: {
        label: 'KENNST DU DAS?',
        h2: 'Du machst alles richtig. Trotzdem trägst du es allein.',
        p: 'Die meisten Unternehmer, mit denen wir sprechen, kennen genau dieses Gefühl:',
        li1: 'Du arbeitest mehr als jeder Mitarbeiter — und siehst es kaum am Ergebnis.',
        li2: 'Wachstum hängt nur an dir — ohne dich läuft spürbar weniger.',
        li3: 'Prozesse, Digitalisierung, KI — dafür bleibt neben dem Tagesgeschäft keine Zeit.',
        li4: 'Einen Partner, der wirklich mit anpackt statt nur zu beraten, hast du bisher nicht gefunden.'
      },
      loesung: {
        label: 'UNSER ANSATZ',
        h2: 'Beratung, die umsetzt.',
        p: 'Wir beraten dich bei den Prozessen, Systemen, dem Marketing und der KI-Strategie deines Unternehmens — und bleiben, bis es tatsächlich läuft. Keine Folien-Präsentationen, sondern Umsetzung. Voraussetzung: dein Unternehmen hat bereits Umsatz und eine gewachsene Struktur.'
      },
      leistungen: {
        label: 'LEISTUNGEN',
        h2: 'Wo wir konkret mit anpacken',
        p: 'Vier Bereiche. Ein Ziel: dass du nicht mehr alles allein tragen musst.',
        s1_tag: 'Prozesse & Systeme', s1_h: 'Ein Unternehmen, das auch ohne ständige Eingriffe funktioniert.', s1_p: 'Abläufe, Standards, Verantwortlichkeiten, Struktur.',
        s2_tag: 'Marketing', s2_h: 'Sichtbarkeit, die zum Umsatz passt.', s2_p: 'Positionierung, Kampagnen, Leadgenerierung, Vertrieb.',
        s3_tag: 'Finanzielle Angelegenheiten', s3_h: 'Kennzahlen, auf die man sich verlassen kann.', s3_p: 'Controlling, Reporting, Struktur für fundierte Entscheidungen.',
        s4_tag: 'Digitalisierung & KI', s4_h: 'KI-Systeme, die zu deinem Unternehmen passen.', s4_p: 'Firmenspezifisch entwickelt und von uns selbst implementiert.'
      },
      warum: {
        label: 'WARUM LUSIDE',
        h2: 'Ein Partner, der wirklich mit anpackt.',
        p: 'Wir sind keine Berater von außen — wir arbeiten mit.',
        w1_name: 'Wir packen mit an', w1_desc: 'Nicht nur Ratschläge — wir übernehmen Verantwortung mit.',
        w2_name: 'Beratung, die umsetzt', w2_desc: 'Keine Folien-Präsentationen — wir bauen die Systeme mit.',
        w3_name: 'Nur etablierte Unternehmen', w3_desc: 'Wir arbeiten mit Unternehmen, die bereits Umsatz und Struktur haben.',
        w4_name: 'Klare Verantwortlichkeiten', w4_desc: 'Jeder weiß, wer wofür zuständig ist.',
        w5_name: 'Firmenspezifische KI', w5_desc: 'Keine Standardsoftware — Systeme, die zu deinem Unternehmen passen.',
        w6_name: "Wir bleiben, auch wenn's schwierig wird", w6_desc: 'Wir denken in Jahren, nicht in Projekten.'
      },
      ablauf: {
        label: 'ABLAUF',
        h2: 'So läuft die Zusammenarbeit.',
        p: 'Drei Schritte, ohne Umwege.',
        step1_h: 'Analyse', step1_p: 'Wir prüfen dein Unternehmen: Zahlen, Struktur, Potenzial — und wo die größten Hebel liegen.',
        step2_h: 'Aufbau', step2_p: 'Gemeinsam bauen wir die Systeme, die fehlen — in Prozessen, Marketing oder Digitalisierung.',
        step3_h: 'Umsetzung', step3_p: 'Wir begleiten die Umsetzung als Partner — messbar, langfristig, mit echtem Interesse am Ergebnis.'
      },
      midcta: {
        h2: 'Passt dein Unternehmen dazu?',
        p: 'Zwei Minuten Formular. Wir melden uns, wenn wir wirklich weiterhelfen können.',
        btn: 'Unternehmen vorstellen'
      },
      faq: {
        label: 'FAQ',
        h2: 'Häufige Fragen',
        p: 'Was du vor einem Erstgespräch wissen solltest.',
        q1: 'Wann lohnt sich Luside für dich?',
        a1: 'Wenn dein Unternehmen bereits Umsatz und Struktur hat, aber Prozesse, Marketing oder Digitalisierung den nächsten Schritt bremsen.',
        q2: 'Für welche Unternehmen eignet sich das?',
        a2: 'Für etablierte, inhabergeführte Unternehmen mit bestehendem Umsatz und einer gewachsenen Struktur — nicht für Start-ups oder Ideen in der Frühphase.',
        q3: 'Wie lange dauert ein Projekt?',
        a3: 'Das hängt vom Umfang ab. Im Erstgespräch klären wir konkret, wo wir ansetzen würden und wie lange das realistisch dauert.',
        q4: 'Wie läuft die Zusammenarbeit ab?',
        a4: 'In drei Schritten: Analyse deines Unternehmens, gemeinsamer Aufbau der fehlenden Systeme, begleitete Umsetzung.'
      },
      kontakt: {
        label: 'ERSTGESPRÄCH',
        h2: 'Erzähl uns von deinem Unternehmen.',
        copy: 'Zwei Minuten Formular. Wir melden uns innerhalb von zwei Werktagen — nur wenn wir wirklich weiterhelfen können.',
        book_btn: 'Termin jetzt buchen',
        email_label: 'E-Mail',
        phone_label: 'Telefon',
        location_label: 'Standort',
        form_company: 'Unternehmen',
        form_name: 'Name',
        form_employees: 'Mitarbeiterzahl',
        form_revenue: 'Jahresumsatz',
        form_challenge: 'Größte Herausforderung',
        form_phone: 'Telefon',
        form_email: 'E-Mail',
        form_select_placeholder: 'Bitte wählen',
        form_newsletter: 'Ich möchte den Newsletter erhalten.',
        form_submit: 'Kontakt aufnehmen',
        form_success: 'Danke! Wir melden uns innerhalb von zwei Werktagen. Du kannst aber auch gleich einen Termin wählen:',
        form_error: 'Da ist etwas schiefgelaufen. Bitte versuche es erneut oder schreib uns direkt per E-Mail.'
      },
      footer: {
        copyright: '© 2026 Luside. Alle Rechte vorbehalten.',
        impressum: 'Impressum',
        datenschutz: 'Datenschutz'
      },
      team_page: {
        meta_title: 'Team — Luside',
        eyebrow: 'TEAM — LUSIDE',
        h1: 'Die Menschen hinter Luside.',
        sub: 'Unternehmer, die selbst umsetzen — nicht nur beraten.',
        role_pending: 'Rolle folgt',
        r_richard: 'Marketing, Vertrieb, Unternehmensentwicklung, Prozessaufbau',
        r_marko: 'Strategie, Organisation, Unternehmensentwicklung, Wachstum',
        cta_h: 'Bereit für den nächsten Schritt?',
        cta_sub: 'Erstgespräch · unverbindlich',
        cta_btn: 'Unternehmen vorstellen'
      },
      seminar_page: {
        meta_title: 'Seminar: Prozesse, Systeme, Marketing — Wien | Luside',
        eyebrow: 'SEMINAR — WIEN',
        h1: 'Prozesse, Systeme, Marketing: zwei Tage, die dein Unternehmen weiterbringen.',
        sub: 'Ein 2-tägiges Praxisseminar für Unternehmer, die ihre Prozesse, Systeme und ihr Marketing auf das nächste Level heben wollen.',
        meta_date: 'November/Dezember 2026 (voraussichtlich)',
        meta_location: 'Wien',
        meta_duration: '2 Tage',
        cta1: 'Interesse anmelden',
        cta2: 'Mehr erfahren',
        about_label: 'WORUM ES GEHT',
        about_h2: 'Zwei Tage, drei Hebel.',
        about_p: 'In zwei Tagen arbeitest du an den drei Bereichen, die über planbares Wachstum entscheiden: Prozesse, die dein Unternehmen tragen. Systeme, die Arbeit abnehmen. Marketing, das echte Anfragen bringt. Keine Theorie — wir bauen mit.',
        for_label: 'FÜR WEN',
        for_h2: 'Für Unternehmer, die bereit für den nächsten Schritt sind.',
        for_p: 'Das Seminar richtet sich an Inhaber und Führungskräfte etablierter, inhabergeführter Unternehmen mit bestehendem Umsatz und einer gewachsenen Struktur.',
        speakers_label: 'VORTRAGENDE',
        speakers_h2: 'Von Unternehmern für Unternehmer.',
        speakers_p: 'Weitere Vortragende werden noch bekanntgegeben.',
        agenda_label: 'THEMENSCHWERPUNKTE',
        agenda_h2: 'Geplante Inhalte.',
        agenda_day1_h: 'Tag 1 — Prozesse & Systeme',
        agenda_day1_p: 'Wie du Abläufe baust, die auch ohne dich funktionieren — und die richtigen Systeme dafür.',
        agenda_day2_h: 'Tag 2 — Marketing & Umsetzung',
        agenda_day2_p: 'Wie du planbar neue Anfragen gewinnst — und das Gelernte direkt in deinem Unternehmen umsetzt.',
        details_label: 'TERMIN & ORT',
        details_h2: 'Die Eckdaten.',
        details_date_label: 'Termin',
        details_date_value: 'November/Dezember 2026 (voraussichtlich)',
        details_location_label: 'Ort',
        details_location_value: 'Wien (Veranstaltungsort wird bekanntgegeben)',
        details_price_label: 'Teilnahmegebühr',
        details_price_value: 'Wird mit der Terminbestätigung bekanntgegeben',
        details_note: 'Der genaue Termin steht noch nicht fest. Melde dein Interesse unverbindlich an — wir informieren dich, sobald Datum und Ort feststehen.',
        faq_label: 'FAQ',
        faq_h2: 'Häufige Fragen',
        faq_q1: 'Ist der Termin schon fix?',
        faq_a1: 'Nein. Wir planen aktuell mit November/Dezember 2026 in Wien. Das genaue Datum geben wir bekannt, sobald es feststeht.',
        faq_q2: 'Wer sollte teilnehmen?',
        faq_a2: 'Inhaber und Führungskräfte etablierter, inhabergeführter Unternehmen, die an ihren Prozessen, Systemen und ihrem Marketing arbeiten wollen.',
        faq_q3: 'Was kostet die Teilnahme?',
        faq_a3: 'Die Teilnahmegebühr geben wir mit der Terminbestätigung bekannt.',
        faq_q4: 'Wie melde ich Interesse an?',
        faq_a4: 'Über das Formular unten. Wir melden uns, sobald Termin und Details feststehen.',
        form_label: 'INTERESSE ANMELDEN',
        form_h2: 'Sei dabei.',
        form_copy: 'Trag dich unverbindlich ein. Wir informieren dich, sobald Termin und Ort feststehen — ohne Verpflichtung.',
        form_name: 'Name',
        form_company: 'Unternehmen',
        form_phone: 'Telefon',
        form_email: 'E-Mail',
        form_newsletter: 'Ich möchte den Newsletter erhalten.',
        form_submit: 'Interesse anmelden',
        form_success: 'Danke! Wir melden uns, sobald der Termin feststeht.',
        form_error: 'Da ist etwas schiefgelaufen. Bitte versuche es erneut oder schreib uns direkt per E-Mail.'
      },
      impressum_page: {
        meta_title: 'Impressum — Luside',
        eyebrow: 'IMPRESSUM',
        h1: 'Impressum',
        sub: 'Angaben gemäß §5 ECG und §25 MedienG.',
        h_company: 'Unternehmen',
        l_name: 'Firma', l_address: 'Anschrift', l_email: 'E-Mail', l_phone: 'Telefon',
        l_fn: 'Firmenbuchnummer', l_court: 'Firmenbuchgericht', l_uid: 'UID-Nummer',
        l_gewerbe: 'Gewerbeberechtigung', l_behoerde: 'Aufsichtsbehörde',
        pending: 'folgt',
        h_purpose: 'Unternehmensgegenstand',
        p_purpose: 'Unternehmensberatung und Entwicklung für etablierte, inhabergeführte Unternehmen in den Bereichen Prozesse, Systeme, Marketing und Digitalisierung/KI.',
        h_dispute: 'Streitbeilegung',
        p_dispute: 'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: ec.europa.eu/consumers/odr. Wir sind zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle weder verpflichtet noch bereit.',
        h_liability: 'Haftung für Inhalte',
        p_liability: 'Die Inhalte dieser Website wurden mit Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir dennoch keine Gewähr übernehmen.',
        last_updated: 'Letzte Aktualisierung: August 2026'
      },
      privacy_page: {
        meta_title: 'Datenschutz — Luside',
        eyebrow: 'DATENSCHUTZ',
        h1: 'Datenschutzerklärung',
        sub: 'Stand: August 2026. Diese Erklärung beschreibt, welche personenbezogenen Daten wir auf dieser Website erheben, wofür wir sie verwenden und welche Rechte Sie haben.',
        h_controller: 'Verantwortlicher',
        p_controller: 'Verantwortlich für die Datenverarbeitung auf dieser Website ist Luside GmbH, Royerstraße 7, 2482 Münchendorf, Österreich. E-Mail: inquiry@luside.com, Telefon: +43 660 3607188.',
        h_data: 'Welche Daten wir erheben',
        h_contact_form: 'Kontaktformular',
        p_contact_form: 'Wenn Sie unser Kontaktformular ausfüllen, erheben wir: Name, Unternehmen, Mitarbeiterzahl, Jahresumsatz (jeweils als Größenklasse), Ihr Anliegen, Telefonnummer (optional) und E-Mail-Adresse. Diese Daten verwenden wir ausschließlich, um Ihre Anfrage zu bearbeiten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bearbeitung einer Anfrage im vorvertraglichen Stadium).',
        h_newsletter: 'Newsletter-Anmeldung',
        p_newsletter: 'Wenn Sie beim Absenden des Formulars die Newsletter-Checkbox aktivieren, speichern wir Ihren Namen und Ihre E-Mail-Adresse zusätzlich in einer separaten Liste für den Newsletter-Versand. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit formlos per E-Mail an inquiry@luside.com widerrufen können.',
        h_booking: 'Terminbuchung',
        p_booking: 'Nach dem Absenden des Formulars führt Sie der Button „Termin jetzt buchen" zu Microsoft Bookings, einem externen Dienst von Microsoft. Dort eingegebene Daten unterliegen den Datenschutzbestimmungen von Microsoft. Wir haben auf diese externe Seite keinen Einfluss.',
        h_analytics: 'Website-Analyse',
        p_analytics: 'Um zu verstehen, wie unsere Website genutzt wird, erfassen wir bei jedem Seitenaufruf: die aufgerufene Seite, die verweisende Seite (Referrer), den Gerätetyp (Mobil/Tablet/Desktop), die ungefähre Verweildauer und eine zufällig erzeugte Sitzungs-ID. Diese Sitzungs-ID verknüpft mehrere Seitenaufrufe miteinander und ist daher als pseudonyme Angabe zu behandeln. Unsere Anwendung selbst speichert dabei keine IP-Adressen oder Standortdaten; unser Hosting- und Datenbankanbieter verarbeitet IP-Adressen jedoch technisch bedingt kurzzeitig als übliche Server-Logdaten zur Sicherheit und Missbrauchsabwehr. Es werden keine Cookies gesetzt. Rechtsgrundlage ist unser berechtigtes Interesse an der Verbesserung unseres Angebots (Art. 6 Abs. 1 lit. f DSGVO).',
        h_chatbot: 'Chat-Assistent',
        p_chatbot: 'Der Chat-Assistent beantwortet einfache Fragen mit vorbereiteten Inhalten direkt in Ihrem Browser, ohne dass diese Eingaben übertragen werden. Bei weiterführenden Fragen wird Ihre Nachricht zur Beantwortung an die Chat-API von OpenAI, L.L.C. (USA) übermittelt; OpenAI kann diese Daten dabei in die USA übertragen und hat sich hierfür den EU-Standardvertragsklauseln unterworfen. Wir speichern den Gesprächsverlauf nicht dauerhaft. Wenn Sie über den Chat aktiv Ihre Kontaktdaten angeben und der Datenschutzerklärung sowie optional dem Newsletter zustimmen, werden diese Daten wie unter „Kontaktformular" beschrieben verarbeitet.',
        h_language: 'Spracheinstellung',
        p_language: 'Ihre Auswahl zwischen Deutsch und Englisch speichern wir lokal in Ihrem Browser (localStorage), damit sie bei Ihrem nächsten Besuch erhalten bleibt. Diese Information verlässt Ihr Gerät nicht.',
        h_providers: 'Hosting und Dienstleister',
        p_providers: 'Diese Website wird über GitHub Pages gehostet. Formular- und Analysedaten werden bei Supabase gespeichert, mit Serverstandort in Frankfurt (EU). Beide Anbieter fungieren als Auftragsverarbeiter und verarbeiten Daten ausschließlich in unserem Auftrag.',
        h_retention: 'Speicherdauer',
        p_retention: 'Wir speichern personenbezogene Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist: Anfragen bis zur vollständigen Bearbeitung und einer angemessenen Nachfrist, Newsletter-Daten bis zu Ihrem Widerruf. Auf Anfrage löschen wir Ihre Daten früher, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.',
        h_rights: 'Ihre Rechte',
        p_rights_intro: 'Nach der DSGVO haben Sie das Recht auf:',
        right1: 'Auskunft über Ihre gespeicherten Daten',
        right2: 'Berichtigung unrichtiger Daten',
        right3: 'Löschung Ihrer Daten',
        right4: 'Einschränkung der Verarbeitung',
        right5: 'Datenübertragbarkeit',
        right6: 'Widerspruch gegen die Verarbeitung',
        right7: 'Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft',
        p_rights_contact: 'Zur Ausübung dieser Rechte genügt eine E-Mail an inquiry@luside.com. Sie haben zudem das Recht, sich bei der österreichischen Datenschutzbehörde zu beschweren: Österreichische Datenschutzbehörde, Barichgasse 40-42, 1030 Wien, dsb@dsb.gv.at.',
        h_changes: 'Änderungen dieser Erklärung',
        p_changes: 'Wir passen diese Datenschutzerklärung an, wenn sich unsere Datenverarbeitung ändert. Es gilt die jeweils aktuelle, auf dieser Seite veröffentlichte Fassung.',
        last_updated: 'Letzte Aktualisierung: August 2026'
      }
    },
    en: {
      meta: { title: "Luside — You Don't Have to Carry Your Business Alone" },
      nav: { leistungen: 'Services', warum: 'Why us', ablauf: 'Process', faq: 'FAQ', team: 'Team', seminar: 'Seminar', cta: 'Get in touch' },
      hero: {
        eyebrow: 'LUSIDE',
        h1: "You built this business. Not to keep carrying it alone.",
        sub: "Luside is a management consultancy and development partner for owner-run businesses — in processes, systems, marketing, and AI. We don't just advise, we implement.",
        cta1: 'Introduce your business',
        cta2: 'How we help',
        reassurance: "Not a volume business. Only for companies with existing revenue and structure."
      },
      problem: {
        label: 'SOUND FAMILIAR?',
        h2: "You're doing everything right. And still carrying it alone.",
        p: 'Most business owners we talk to know exactly this feeling:',
        li1: "You work harder than anyone on your team — and barely see it in the result.",
        li2: "Growth depends entirely on you — without you, things visibly slow down.",
        li3: "Processes, digitalization, AI — there's never time for it alongside the day-to-day.",
        li4: "A partner who actually gets hands-on, not just advises, hasn't shown up yet."
      },
      loesung: {
        label: 'OUR APPROACH',
        h2: 'Advice that gets implemented.',
        p: "We advise you on your business's processes, systems, marketing, and AI strategy — and stay until it actually runs. No slide decks, just implementation. Requirement: your business already has revenue and a grown structure."
      },
      leistungen: {
        label: 'SERVICES',
        h2: 'Where we get hands-on',
        p: "Four areas. One goal: you don't have to carry it all alone anymore.",
        s1_tag: 'Processes & Systems', s1_h: 'A business that runs without constant hands-on intervention.', s1_p: 'Workflows, standards, responsibilities, structure.',
        s2_tag: 'Marketing', s2_h: 'Visibility that matches your revenue.', s2_p: 'Positioning, campaigns, lead generation, sales.',
        s3_tag: 'Financial matters', s3_h: 'Numbers you can rely on.', s3_p: 'Controlling, reporting, structure for sound decisions.',
        s4_tag: 'Digitalization & AI', s4_h: 'AI systems built for your business.', s4_p: 'Company-specific, built and implemented by us.'
      },
      warum: {
        label: 'WHY LUSIDE',
        h2: 'A partner who actually gets hands-on.',
        p: "We're not outside consultants — we work alongside you.",
        w1_name: 'We get hands-on', w1_desc: "Not just advice — we take on responsibility with you.",
        w2_name: 'Advice that gets implemented', w2_desc: "No slide decks — we build the systems with you.",
        w3_name: 'Established businesses only', w3_desc: 'We work with businesses that already have revenue and structure.',
        w4_name: 'Clear responsibilities', w4_desc: 'Everyone knows who is responsible for what.',
        w5_name: 'Company-specific AI', w5_desc: 'No off-the-shelf software — systems built for your business.',
        w6_name: "We stay, even when it gets hard", w6_desc: 'We think in years, not projects.'
      },
      ablauf: {
        label: 'PROCESS',
        h2: 'How the collaboration works.',
        p: 'Three steps, no detours.',
        step1_h: 'Analysis', step1_p: "We review your business: numbers, structure, potential — and where the biggest levers are.",
        step2_h: 'Build', step2_p: 'Together we build the systems that are missing — in processes, marketing, or digitalization.',
        step3_h: 'Implementation', step3_p: "We support the rollout as a partner — measurably, long-term, with genuine interest in the outcome."
      },
      midcta: {
        h2: 'Is your business a fit?',
        p: "Two minutes to fill out. We'll get back to you if we can genuinely help.",
        btn: 'Introduce your business'
      },
      faq: {
        label: 'FAQ',
        h2: 'Frequently asked questions',
        p: 'What to know before an introductory call.',
        q1: 'When is Luside worth it for you?',
        a1: 'When your business already has revenue and structure, but processes, marketing, or digitalization are holding back the next step.',
        q2: 'What kind of businesses is this a fit for?',
        a2: 'For established, owner-run businesses with existing revenue and a grown structure — not for start-ups or early-stage ideas.',
        q3: 'How long does a project take?',
        a3: "That depends on scope. In the introductory call we clarify concretely where we'd start and how long that realistically takes.",
        q4: 'How does the collaboration work?',
        a4: 'In three steps: analysis of your business, jointly building the missing systems, supported implementation.'
      },
      kontakt: {
        label: 'INTRODUCTORY CALL',
        h2: 'Tell us about your business.',
        copy: "Two minutes to fill out. We'll get back to you within two business days — only if we can genuinely help.",
        book_btn: 'Book a meeting now',
        email_label: 'Email',
        phone_label: 'Phone',
        location_label: 'Location',
        form_company: 'Company',
        form_name: 'Name',
        form_employees: 'Number of employees',
        form_revenue: 'Annual revenue',
        form_challenge: 'Biggest challenge',
        form_phone: 'Phone',
        form_email: 'Email',
        form_select_placeholder: 'Please select',
        form_newsletter: 'I would like to receive the newsletter.',
        form_submit: 'Get in touch',
        form_success: "Thanks! We'll get back to you within two business days. Or pick a time right now:",
        form_error: 'Something went wrong. Please try again or email us directly.'
      },
      footer: {
        copyright: '© 2026 Luside. All rights reserved.',
        impressum: 'Legal Notice',
        datenschutz: 'Privacy Policy'
      },
      team_page: {
        meta_title: 'Team — Luside',
        eyebrow: 'TEAM — LUSIDE',
        h1: 'The people behind Luside.',
        sub: 'Business owners who implement themselves — not just advise.',
        role_pending: 'Role to be announced',
        r_richard: 'Marketing, sales, business development, process design',
        r_marko: 'Strategy, organization, business development, growth',
        cta_h: 'Ready for the next step?',
        cta_sub: 'Introductory call · no obligation',
        cta_btn: 'Introduce your business'
      },
      seminar_page: {
        meta_title: 'Seminar: Processes, Systems, Marketing — Vienna | Luside',
        eyebrow: 'SEMINAR — VIENNA',
        h1: 'Processes, systems, marketing: two days that move your business forward.',
        sub: 'A 2-day hands-on seminar for business owners who want to take their processes, systems, and marketing to the next level.',
        meta_date: 'November/December 2026 (planned)',
        meta_location: 'Vienna',
        meta_duration: '2 days',
        cta1: 'Register interest',
        cta2: 'Learn more',
        about_label: 'WHAT IT\'S ABOUT',
        about_h2: 'Two days, three levers.',
        about_p: 'Over two days you work on the three areas that decide predictable growth: processes that carry your business, systems that take work off your plate, and marketing that brings real inquiries. No theory — we build it with you.',
        for_label: 'WHO IT\'S FOR',
        for_h2: 'For business owners ready for the next step.',
        for_p: 'The seminar is for owners and leaders of established, owner-run businesses with existing revenue and a grown structure.',
        speakers_label: 'SPEAKERS',
        speakers_h2: 'From business owners, for business owners.',
        speakers_p: 'Further speakers will be announced.',
        agenda_label: 'PLANNED TOPICS',
        agenda_h2: 'What to expect.',
        agenda_day1_h: 'Day 1 — Processes & Systems',
        agenda_day1_p: 'How to build workflows that run without you — and the right systems for it.',
        agenda_day2_h: 'Day 2 — Marketing & Implementation',
        agenda_day2_p: 'How to win new inquiries predictably — and put what you learn straight into practice.',
        details_label: 'DATE & LOCATION',
        details_h2: 'The essentials.',
        details_date_label: 'Date',
        details_date_value: 'November/December 2026 (planned)',
        details_location_label: 'Location',
        details_location_value: 'Vienna (venue to be announced)',
        details_price_label: 'Participation fee',
        details_price_value: 'Announced together with the confirmed date',
        details_note: 'The exact date is not yet fixed. Register your interest with no obligation — we\'ll let you know as soon as date and venue are confirmed.',
        faq_label: 'FAQ',
        faq_h2: 'Frequently asked questions',
        faq_q1: 'Is the date confirmed?',
        faq_a1: 'Not yet. We are currently planning for November/December 2026 in Vienna. We\'ll announce the exact date as soon as it\'s confirmed.',
        faq_q2: 'Who should attend?',
        faq_a2: 'Owners and leaders of established, owner-run businesses who want to work on their processes, systems, and marketing.',
        faq_q3: 'What does it cost?',
        faq_a3: 'We\'ll announce the participation fee together with the confirmed date.',
        faq_q4: 'How do I register interest?',
        faq_a4: 'Via the form below. We\'ll get back to you once date and details are confirmed.',
        form_label: 'REGISTER INTEREST',
        form_h2: 'Be part of it.',
        form_copy: 'Register with no obligation. We\'ll let you know as soon as date and venue are confirmed.',
        form_name: 'Name',
        form_company: 'Company',
        form_phone: 'Phone',
        form_email: 'Email',
        form_newsletter: 'I would like to receive the newsletter.',
        form_submit: 'Register interest',
        form_success: 'Thanks! We\'ll be in touch as soon as the date is confirmed.',
        form_error: 'Something went wrong. Please try again or email us directly.'
      },
      impressum_page: {
        meta_title: 'Legal Notice — Luside',
        eyebrow: 'LEGAL NOTICE',
        h1: 'Legal Notice',
        sub: 'Information pursuant to §5 ECG and §25 MedienG (Austria).',
        h_company: 'Company',
        l_name: 'Company name', l_address: 'Address', l_email: 'Email', l_phone: 'Phone',
        l_fn: 'Company register number', l_court: 'Register court', l_uid: 'VAT ID',
        l_gewerbe: 'Trade license', l_behoerde: 'Supervisory authority',
        pending: 'pending',
        h_purpose: 'Business purpose',
        p_purpose: 'Management consulting and development for established, owner-run businesses in processes, systems, marketing, and digitalization/AI.',
        h_dispute: 'Dispute resolution',
        p_dispute: 'The European Commission provides a platform for online dispute resolution (ODR): ec.europa.eu/consumers/odr. We are neither obligated nor willing to participate in dispute resolution proceedings before a consumer arbitration board.',
        h_liability: 'Liability for content',
        p_liability: 'The content of this website has been prepared with care. However, we cannot guarantee the accuracy, completeness, or timeliness of the content.',
        last_updated: 'Last updated: August 2026'
      },
      privacy_page: {
        meta_title: 'Privacy Policy — Luside',
        eyebrow: 'PRIVACY POLICY',
        h1: 'Privacy Policy',
        sub: 'Last updated: August 2026. This policy describes what personal data we collect on this website, why we use it, and what rights you have.',
        h_controller: 'Data Controller',
        p_controller: 'The controller responsible for data processing on this website is Luside GmbH, Royerstraße 7, 2482 Münchendorf, Austria. Email: inquiry@luside.com, Phone: +43 660 3607188.',
        h_data: 'What data we collect',
        h_contact_form: 'Contact form',
        p_contact_form: 'When you fill out our contact form, we collect: name, company, number of employees, annual revenue (each as a size bracket), what you need from us, phone number (optional), and email address. We use this data solely to process your request. The legal basis is Art. 6(1)(b) GDPR (handling a request in the pre-contractual stage).',
        h_newsletter: 'Newsletter sign-up',
        p_newsletter: 'If you tick the newsletter checkbox when submitting the form, we additionally store your name and email address in a separate list for sending the newsletter. The legal basis is your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time, informally, by emailing inquiry@luside.com.',
        h_booking: 'Booking an appointment',
        p_booking: 'After submitting the form, the "Book a meeting now" button takes you to Microsoft Bookings, an external service operated by Microsoft. Data entered there is subject to Microsoft\'s own privacy policy. We have no influence over that external page.',
        h_analytics: 'Website analytics',
        p_analytics: "To understand how our website is used, we record on each page view: the page visited, the referring page, the device type (mobile/tablet/desktop), the approximate time spent on the page, and a randomly generated session ID. This session ID links multiple page views together and is therefore treated as pseudonymous data. Our application itself does not store IP addresses or location data; our hosting and database provider does, however, process IP addresses briefly as standard server log data for security and abuse prevention. No cookies are set. The legal basis is our legitimate interest in improving our offering (Art. 6(1)(f) GDPR).",
        h_chatbot: 'Chat assistant',
        p_chatbot: "The chat assistant answers simple questions using pre-written content directly in your browser, without transmitting that input anywhere. For more complex questions, your message is sent to OpenAI, L.L.C.'s (USA) chat API to generate a reply; OpenAI may transfer this data to the USA and relies on the EU Standard Contractual Clauses for that transfer. We do not permanently store the conversation. If you actively provide your contact details through the chat and agree to the privacy policy and, optionally, the newsletter, that data is processed as described under \"Contact form\".",
        h_language: 'Language preference',
        p_language: 'We store your choice between German and English locally in your browser (localStorage) so it persists on your next visit. This information never leaves your device.',
        h_providers: 'Hosting and service providers',
        p_providers: 'This website is hosted via GitHub Pages. Form and analytics data is stored with Supabase, with servers located in Frankfurt (EU). Both providers act as data processors on our behalf only.',
        h_retention: 'Retention period',
        p_retention: 'We keep personal data only as long as necessary for its purpose: inquiries until fully handled plus a reasonable follow-up period, newsletter data until you withdraw consent. On request, we delete your data sooner, unless a legal retention obligation applies.',
        h_rights: 'Your rights',
        p_rights_intro: 'Under the GDPR, you have the right to:',
        right1: 'access the data we hold about you',
        right2: 'correct inaccurate data',
        right3: 'have your data deleted',
        right4: 'restrict processing',
        right5: 'data portability',
        right6: 'object to processing',
        right7: 'withdraw consent already given, with future effect',
        p_rights_contact: 'To exercise these rights, simply email inquiry@luside.com. You also have the right to lodge a complaint with the Austrian data protection authority: Österreichische Datenschutzbehörde, Barichgasse 40-42, 1030 Vienna, Austria, dsb@dsb.gv.at.',
        h_changes: 'Changes to this policy',
        p_changes: 'We update this privacy policy whenever our data processing changes. The version published on this page is always the current one.',
        last_updated: 'Last updated: August 2026'
      }
    }
  };

  function resolve(dict, path){
    return path.split('.').reduce(function(o, k){ return (o || {})[k]; }, dict);
  }

  function applyLang(lang){
    var dict = TRANSLATIONS[lang];
    if(!dict) return;
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var val = resolve(dict, el.getAttribute('data-i18n'));
      if(val !== undefined) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function(el){
      var val = resolve(dict, el.getAttribute('data-i18n-html'));
      if(val !== undefined) el.innerHTML = val;
    });
    document.querySelectorAll('[data-i18n-suffix]').forEach(function(el){
      var suffix = resolve(dict, el.getAttribute('data-i18n-suffix'));
      if(suffix === undefined) return;
      el.setAttribute('data-suffix', suffix);
      var target = parseInt(el.getAttribute('data-count'), 10);
      var prefix = el.getAttribute('data-prefix') || '';
      el.textContent = prefix + target + suffix;
    });
    document.querySelectorAll('.lang-btn').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    localStorage.setItem('clarity_lang', lang);
    window.dispatchEvent(new CustomEvent('clarity:langchange', { detail: { lang: lang } }));
  }

  window.clarityI18n = { translations: TRANSLATIONS, applyLang: applyLang, resolve: resolve };

  document.querySelectorAll('.lang-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      applyLang(btn.getAttribute('data-lang'));
    });
  });

  var savedLang = localStorage.getItem('clarity_lang') || 'de';
  applyLang(savedLang);
})();
