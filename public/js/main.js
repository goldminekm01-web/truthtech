// TruthMedia frontend JavaScript

// Dark mode toggle with localStorage persistence
(function () {
  const toggle = document.getElementById('themeToggle');
  const icon = toggle.querySelector('.theme-icon');
  const html = document.documentElement;

  // Resolve theme: saved > system > light
  function resolveTheme() {
    const saved = localStorage.getItem('tm-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      html.setAttribute('data-theme', 'dark');
      if (icon) icon.textContent = '☀️';
      toggle.setAttribute('aria-label', 'Skift til lys tilstand');
    } else {
      html.removeAttribute('data-theme');
      if (icon) icon.textContent = '🌙';
      toggle.setAttribute('aria-label', 'Skift til mørk tilstand');
    }
  }

  const theme = resolveTheme();
  applyTheme(theme);

  toggle.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('tm-theme', next);
    applyTheme(next);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('tm-theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Reveal on scroll (respects reduced motion)
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  }

  // Mobile menu toggle (if present)
  const menuBtn = document.getElementById('tm-mobile-menu-btn');
  const menu = document.getElementById('tm-mobile-menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        menu.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();
