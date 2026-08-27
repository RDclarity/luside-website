(function(){
  if(!window.lusidesSupabaseReady) return;

  function detectDevice(){
    var ua = navigator.userAgent || '';
    if(/iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'Tablet';
    if(/Mobi|iPhone|Android/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  function genId(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  var sessionId = genId();
  var startTime = Date.now();
  window.LUSIDES_SESSION_ID = sessionId;

  window.lusidesLogConversion = function(eventType){
    if(!window.LUSIDES_SUPABASE) return;
    fetch(window.LUSIDES_SUPABASE.url + '/rest/v1/conversion_events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.LUSIDES_SUPABASE.anonKey,
        'Authorization': 'Bearer ' + window.LUSIDES_SUPABASE.anonKey
      },
      body: JSON.stringify({ session_id: sessionId, event_type: eventType, page: location.pathname }),
      keepalive: true
    }).catch(function(){});
  };

  window.lusidesSupabaseReady(function(client){
    if(!client) return;
    client.from('page_visits').insert({
      session_id: sessionId,
      page: location.pathname,
      referrer: document.referrer || null,
      device_type: detectDevice()
    }).then(function(res){
      if(res.error) console.warn('analytics: insert failed', res.error);
    });
  });

  function sendDuration(){
    var duration = Math.round((Date.now() - startTime) / 1000);
    if(duration < 1) return;
    fetch(window.LUSIDES_SUPABASE.url + '/rest/v1/page_visit_durations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.LUSIDES_SUPABASE.anonKey,
        'Authorization': 'Bearer ' + window.LUSIDES_SUPABASE.anonKey
      },
      body: JSON.stringify({ session_id: sessionId, duration_seconds: duration }),
      keepalive: true
    }).catch(function(){});
  }

  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden'){ sendDuration(); }
  });
  window.addEventListener('pagehide', sendDuration);

  // Track clicks on any booking button present on the page
  document.querySelectorAll('.booking-btn').forEach(function(el){
    el.addEventListener('click', function(){ window.lusidesLogConversion('booking_click'); });
  });
})();
