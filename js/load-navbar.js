// Cellex Navbar Loader — properly executes scripts inside injected HTML
// Usage: <div id="nav-mount"></div>
//        <script src="js/load-navbar.js"></script>
(function() {
  fetch('shared/navbar.html')
    .then(r => r.text())
    .then(html => {
      const mount = document.getElementById('nav-mount');
      if (!mount) return;
      mount.innerHTML = html;
      // Extract and execute all <script> tags inside the injected HTML
      // (innerHTML doesn't execute scripts — this is a browser security feature)
      mount.querySelectorAll('script').forEach(oldScript => {
        const newScript = document.createElement('script');
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
    });
})();
