// Fill these in from Supabase → Project Settings → API.
// Both values are meant to be public (safe to ship in client-side code) —
// access control is enforced by the Row Level Security policies in Supabase, not by hiding these.
window.LUSIDES_SUPABASE = {
  url: 'https://knuktzuqqmrrkpkusren.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudWt0enVxcW1ycmtwa3VzcmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MzkxNjEsImV4cCI6MjEwMDMxNTE2MX0.pWHzfjP7DvvAsTgevaFpp9BM46kyciCgFJIfZd4KeWw'
};

// Single shared client instance — avoids each script (contact form, analytics, admin)
// creating its own GoTrueClient against the same storage key.
// The supabase-js CDN script can occasionally still be loading when this runs,
// so this polls briefly instead of assuming it's already available.
(function initClient(attempt){
  if(window.LUSIDES_SUPABASE_CLIENT) return;
  if(window.LUSIDES_SUPABASE.url.indexOf('YOUR_SUPABASE') !== -1) return;
  if(window.supabase){
    window.LUSIDES_SUPABASE_CLIENT = window.supabase.createClient(
      window.LUSIDES_SUPABASE.url,
      window.LUSIDES_SUPABASE.anonKey
    );
    return;
  }
  if((attempt || 0) < 50){ setTimeout(function(){ initClient((attempt || 0) + 1); }, 100); }
})();

// Call back once the shared client is ready (or null if it never became available).
window.lusidesSupabaseReady = function(callback){
  if(window.LUSIDES_SUPABASE_CLIENT){ callback(window.LUSIDES_SUPABASE_CLIENT); return; }
  var tries = 0;
  var timer = setInterval(function(){
    tries++;
    if(window.LUSIDES_SUPABASE_CLIENT){
      clearInterval(timer);
      callback(window.LUSIDES_SUPABASE_CLIENT);
    } else if(tries > 60){
      clearInterval(timer);
      callback(null);
    }
  }, 100);
};
