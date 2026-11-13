(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (max) => Math.floor(Math.random() * max);
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  /* ---------- Glitch text (vanilla recreation of the GlitchText behaviour) ---------- */

  const GLYPHS = 'ABCDEFGHKMNPRSTUVXYZ0123456789#/';

  function createGlitch(el, options = {}) {
    const config = { slices: 6, intensity: 0.05, scramble: 0.55, ...options };
    const text = el.textContent.trim();

    const layer = (className) => {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      return span;
    };

    const base = layer('glitch__base');
    const red = layer('glitch__rgb glitch__rgb--r');
    const cyan = layer('glitch__rgb glitch__rgb--c');
    const slices = Array.from({ length: config.slices }, () => layer('glitch__slice'));
    const layers = [base, red, cyan, ...slices];

    el.textContent = '';
    el.append(...layers);

    let running = false;
    let stepTimer = null;

    const setText = (value) => {
      layers.forEach((item) => {
        item.textContent = value;
      });
    };

    const scrambled = () => {
      const chars = text.split('');
      const swaps = Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < swaps; i += 1) {
        const index = randInt(chars.length);
        if (chars[index] !== ' ') chars[index] = GLYPHS[randInt(GLYPHS.length)];
      }
      return chars.join('');
    };

    const reset = () => {
      setText(text);
      [red, cyan].forEach((item) => {
        item.style.opacity = '0';
        item.style.transform = '';
      });
      slices.forEach((slice) => {
        slice.style.opacity = '0';
        slice.style.transform = '';
      });
    };

    const step = (shift) => {
      red.style.opacity = '1';
      cyan.style.opacity = '1';
      red.style.transform = `translate(${rand(-shift, shift) * 0.4}px, ${rand(-1, 1)}px)`;
      cyan.style.transform = `translate(${rand(-shift, shift) * 0.4}px, ${rand(-1, 1)}px)`;

      slices.forEach((slice) => {
        if (Math.random() < 0.3) {
          slice.style.opacity = '0';
          return;
        }
        const top = rand(0, 86);
        const height = rand(4, 22);
        const bottom = Math.max(0, 100 - top - height);
        slice.style.clipPath = `inset(${top}% -4% ${bottom}% -4%)`;
        slice.style.transform = `translateX(${rand(-shift, shift)}px)`;
        slice.style.opacity = '1';
      });

      setText(Math.random() < config.scramble ? scrambled() : text);
    };

    const burst = () => {
      if (running) return;
      running = true;
      const shift = parseFloat(getComputedStyle(el).fontSize) * config.intensity;
      const steps = 4 + randInt(5);
      let count = 0;

      const tick = () => {
        if (count >= steps) {
          reset();
          running = false;
          return;
        }
        count += 1;
        step(shift);
        stepTimer = window.setTimeout(tick, rand(45, 85));
      };

      tick();
    };

    const stop = () => {
      window.clearTimeout(stepTimer);
      running = false;
      reset();
    };

    el.addEventListener('pointerenter', burst);

    return { burst, stop };
  }

  const glitches = reducedMotion ? [] : $$('[data-glitch]').map((el) => createGlitch(el));
  let heroVisible = true;
  let glitchTimer = null;

  const scheduleGlitch = () => {
    window.clearTimeout(glitchTimer);
    glitchTimer = window.setTimeout(() => {
      if (heroVisible && !document.hidden) {
        glitches.forEach((glitch) => {
          if (Math.random() < 0.8) glitch.burst();
        });
      }
      scheduleGlitch();
    }, rand(2600, 5200));
  };

  /* ---------- Intro animation ---------- */

  const loaderBar = $('#loaderBar');
  const loaderCount = $('#loaderCount');

  const finishIntro = () => {
    root.classList.add('is-loaded');
    body.classList.remove('is-locked');
    window.setTimeout(() => {
      root.classList.add('intro-done');
      if (glitches.length) {
        glitches.forEach((glitch) => glitch.burst());
        scheduleGlitch();
      }
    }, reducedMotion ? 0 : 1900);
  };

  if (reducedMotion || !loaderBar) {
    finishIntro();
  } else {
    body.classList.add('is-locked');
    const duration = 1500;
    let start = null;

    const frame = (time) => {
      if (start === null) start = time;
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      loaderBar.style.transform = `scaleX(${eased})`;
      loaderCount.textContent = String(Math.round(eased * 100)).padStart(3, '0');
      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else {
        window.setTimeout(finishIntro, 250);
      }
    };

    window.requestAnimationFrame(frame);
  }

  /* ---------- Scroll: progress bar, navbar state and parallax ---------- */

  const nav = $('#nav');
  const progressBar = $('#scrollProgress');
  const parallaxItems = reducedMotion ? [] : $$('[data-parallax]');
  let scrollTicking = false;

  const updateScroll = () => {
    scrollTicking = false;
    const scrollY = window.scrollY;
    const max = root.scrollHeight - window.innerHeight;
    progressBar.style.transform = `scaleX(${max > 0 ? Math.min(scrollY / max, 1) : 0})`;
    nav.classList.toggle('is-scrolled', scrollY > 24);

    parallaxItems.forEach((item) => {
      const rect = item.parentElement.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      const speed = parseFloat(item.dataset.parallax) || 0.1;
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed;
      item.style.transform = `translate3d(0, ${(-offset).toFixed(1)}px, 0)`;
    });
  };

  const requestScrollUpdate = () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateScroll);
  };

  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', requestScrollUpdate);
  updateScroll();

  /* ---------- Reveal on scroll ---------- */

  const revealItems = $$('[data-reveal]');

  if ('IntersectionObserver' in window && !reducedMotion) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  /* ---------- Active navigation link ---------- */

  const navLinks = $$('.nav__links a');
  const sections = $$('main section[id]');

  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const key = entry.target.dataset.nav || entry.target.id;
          navLinks.forEach((link) => {
            const active = link.getAttribute('href') === `#${key}`;
            link.classList.toggle('is-active', active);
            if (active) {
              link.setAttribute('aria-current', 'true');
            } else {
              link.removeAttribute('aria-current');
            }
          });
          if (entry.target.id === 'home') heroVisible = true;
          else heroVisible = false;
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((section) => sectionObserver.observe(section));
  }

  /* ---------- Mobile menu ---------- */

  const menu = $('#mobileMenu');
  const toggle = $('#navToggle');

  const setMenu = (open) => {
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    body.classList.toggle('is-locked', open);
    if (open) {
      const firstLink = $('a', menu);
      if (firstLink) firstLink.focus({ preventScroll: true });
    }
  };

  toggle.addEventListener('click', () => {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) {
      setMenu(false);
      toggle.focus();
    }
  });

  window.matchMedia('(min-width: 860px)').addEventListener('change', (event) => {
    if (event.matches && menu.classList.contains('is-open')) setMenu(false);
  });

  /* ---------- Smooth anchor navigation ---------- */

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    event.preventDefault();

    const hash = link.getAttribute('href');
    if (hash === '#') return;

    const target = document.getElementById(hash.slice(1));
    if (!target) return;

    if (menu.classList.contains('is-open')) setMenu(false);
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ---------- Pointer effects: cursor, magnetic buttons, project tilt ---------- */

  if (finePointer && !reducedMotion) {
    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    let mouseX = -100;
    let mouseY = -100;
    let ringX = mouseX;
    let ringY = mouseY;
    let cursorFrame = null;

    root.classList.add('has-cursor');
    cursor.classList.add('is-hidden');

    const followRing = () => {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      if (Math.abs(mouseX - ringX) > 0.1 || Math.abs(mouseY - ringY) > 0.1) {
        cursorFrame = window.requestAnimationFrame(followRing);
      } else {
        cursorFrame = null;
      }
    };

    document.addEventListener('pointermove', (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      cursor.classList.remove('is-hidden');
      if (cursorFrame === null) cursorFrame = window.requestAnimationFrame(followRing);
    });

    document.addEventListener('pointerover', (event) => {
      cursor.classList.toggle('is-hover', Boolean(event.target.closest('a, button, [data-cursor]')));
      cursor.classList.toggle('is-text', Boolean(event.target.closest('input, textarea')));
    });

    root.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));

    $$('[data-magnetic]').forEach((item) => {
      item.addEventListener('pointermove', (event) => {
        const rect = item.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.25;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.35;
        item.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      item.addEventListener('pointerleave', () => {
        item.style.transform = '';
      });
    });

    $$('[data-tilt]').forEach((card) => {
      const inner = $('.project__inner', card);

      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        card.classList.add('is-tilting');
        inner.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        inner.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        inner.style.transform = `rotateX(${((0.5 - py) * 6).toFixed(2)}deg) rotateY(${((px - 0.5) * 8).toFixed(2)}deg)`;
      });

      card.addEventListener('pointerleave', () => {
        card.classList.remove('is-tilting');
        inner.style.transform = '';
      });
    });
  }

  /* ---------- Contact form validation ---------- */

  const form = $('#contactForm');
  const status = $('#formStatus');
  const validators = {
    name: (value) => (value.length >= 2 ? '' : 'Escribe tu nombre (mínimo 2 caracteres).'),
    email: (value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? '' : 'Introduce un email válido, por ejemplo nombre@dominio.com.',
    message: (value) => (value.length >= 10 ? '' : 'Cuéntame algo más (mínimo 10 caracteres).'),
  };

  const validateField = (input) => {
    const message = validators[input.name](input.value.trim());
    const field = input.closest('.field');
    field.classList.toggle('is-invalid', Boolean(message));
    field.classList.toggle('is-valid', !message);
    input.setAttribute('aria-invalid', String(Boolean(message)));
    $('.field__error', field).textContent = message;
    return !message;
  };

  const setStatus = (text, state) => {
    status.textContent = text;
    status.classList.toggle('is-error', state === 'error');
    status.classList.toggle('is-ok', state === 'ok');
  };

  const inputs = $$('input, textarea', form);

  inputs.forEach((input) => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input.closest('.field').classList.contains('is-invalid')) validateField(input);
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const invalid = inputs.filter((input) => !validateField(input));

    if (invalid.length) {
      setStatus('Revisa los campos marcados antes de continuar.', 'error');
      invalid[0].focus();
      return;
    }

    const submitButton = $('button[type="submit"]', form);
    submitButton.disabled = true;
    setStatus('Enviando tu mensaje…', '');

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
        redirect: 'error',
        referrerPolicy: 'strict-origin-when-cross-origin',
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const detail = Array.isArray(result?.errors)
          ? result.errors.map((error) => error.message).filter(Boolean).join(' ')
          : '';
        throw new Error(detail || 'No se pudo enviar el mensaje. Inténtalo de nuevo más tarde.');
      }

      form.reset();
      inputs.forEach((input) => {
        const field = input.closest('.field');
        field.classList.remove('is-valid', 'is-invalid');
        input.setAttribute('aria-invalid', 'false');
        $('.field__error', field).textContent = '';
      });
      setStatus('Mensaje enviado correctamente. Gracias por escribirme.', 'ok');
    } catch (error) {
      setStatus(
        error instanceof TypeError
          ? 'No se pudo confirmar el envío. Comprueba la conexión y vuelve a intentarlo.'
          : error.message,
        'error'
      );
    } finally {
      submitButton.disabled = false;
    }
  });

  /* ---------- Footer ---------- */

  $('#year').textContent = String(new Date().getFullYear());
})();

