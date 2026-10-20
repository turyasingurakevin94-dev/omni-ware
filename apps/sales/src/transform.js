/* sales.html as the app ships it.

   The web page loads its database client and its fonts from CDNs. The app
   carries both inside itself instead, so it opens on one bar of signal (or
   none) as fast as the phone can draw. The same swaps are made twice: by
   scripts/build-www.js when the app is built, and by the native layer in
   sales.html when the installed app fetches a newer copy of it -- one function, so the two
   never drift. Each swap is a no-op if the page changes shape; the app then
   falls back to the CDN copy rather than breaking. */
(function(root){
  'use strict';
  var SWAPS = [
    // The install manifest is for the browser; the app is already installed.
    [/<link rel="manifest"[^>]*>\s*/, ''],
    [/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/, ''],
    [/<link rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net" crossorigin>\s*/, ''],
    [/<link rel="stylesheet"[^>]*href="https:\/\/fonts\.googleapis\.com\/css2[^"]*">/, '<link rel="stylesheet" href="fonts/fonts.css">'],
    [/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2.118.0\/dist\/umd\/supabase\.js"><\/script>/, '<script src="vendor/supabase.js"></script>'],
    // The swaps again, for the installed app's live updates. The native
    // layer itself is inside sales.html, so it updates with the page.
    // Anchored to <html>: the page's own comments mention <head> too.
    [/(<html[^>]*>\s*)<head>(?!\n<script src="transform\.js">)/, '$1<head>\n<script src="transform.js"></script>'],
  ];
  function owAppTransform(html){
    return SWAPS.reduce(function(s, sw){ return s.replace(sw[0], sw[1]); }, String(html));
  }
  owAppTransform.SWAPS = SWAPS;
  if(typeof module !== 'undefined' && module.exports) module.exports = owAppTransform;
  else root.owAppTransform = owAppTransform;
})(this);
