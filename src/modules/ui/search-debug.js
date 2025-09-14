// Debug utility for search overlay issues
(function() {
  // 1. Check for multiple overlays
  const overlays = document.querySelectorAll('#search-overlay');
  console.log(`[DEBUG] Number of #search-overlay elements: ${overlays.length}`);
  overlays.forEach((el, i) => {
    console.log(`[DEBUG] Overlay[${i}] classes:`, el.className, 'style.display:', el.style.display);
  });

  // 2. Log if openSearchOverlay is being called repeatedly
  const origOpen = window.DispatchApp?.modules?.get('SearchSystem')?.openSearchOverlay;
  if (origOpen && !origOpen._debugWrapped) {
    window.DispatchApp.modules.get('SearchSystem').openSearchOverlay = function(...args) {
      console.log('[DEBUG] openSearchOverlay called');
      return origOpen.apply(this, args);
    };
    window.DispatchApp.modules.get('SearchSystem').openSearchOverlay._debugWrapped = true;
  }

  // 3. Log overlay class changes
  const overlay = document.getElementById('search-overlay');
  if (overlay) {
    const observer = new MutationObserver(() => {
      console.log('[DEBUG] #search-overlay classList:', overlay.className);
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }
})();
