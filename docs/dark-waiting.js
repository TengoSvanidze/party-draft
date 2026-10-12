const copy = {
  en: {
    place: 'Winden, 2019',
    setup: 'Every journey begins here.',
    setupDetail: 'Create a room, or take your place with friends.',
    connecting: 'Finding your room…',
    connectingDetail: 'Reconnecting to the other travellers.',
    waiting: 'Waiting for the others.',
    ready: 'Everyone is here.',
    count: count => `${count} of 3 players have arrived`,
    readyDetail: 'The narrator will begin when the room is ready.',
    caption: 'The beginning is the end.',
  },
  ka: {
    place: 'ვინდენი, 2019',
    setup: 'ყველა მოგზაურობა აქ იწყება.',
    setupDetail: 'შექმენი ოთახი ან შეუერთდი მეგობრებს.',
    connecting: 'შენი ოთახის ძიება…',
    connectingDetail: 'სხვა მოგზაურებთან კავშირი აღდგება.',
    waiting: 'სხვების მოლოდინში.',
    ready: 'ყველა აქ არის.',
    count: count => `მოვიდა ${count} მოთამაშე 3-დან`,
    readyDetail: 'მთხრობელი თამაშს დაიწყებს, როცა ოთახი მზად იქნება.',
    caption: 'დასაწყისი დასასრულია.',
  },
};

let backdrop, title, listeners, frame = 0;
let pointerX = 0, pointerY = 0;

export function clearDarkWaiting() {
  listeners?.abort(); listeners = null;
  cancelAnimationFrame(frame); frame = 0;
  backdrop?.remove(); title?.remove();
  backdrop = title = null;
  document.body.classList.remove('dark-waiting');
  delete document.body.dataset.darkWaiting;
}

export function syncDarkWaiting({active, language = 'en', phase = 'setup', players = 0, connected = true}) {
  if (!active) { clearDarkWaiting(); return; }
  const text = copy[language] || copy.en;
  const count = Math.max(0, Math.min(3, players));
  document.body.classList.add('dark-waiting');
  document.body.dataset.darkWaiting = phase;

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'dark-waiting-scene';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = `<picture class="dark-waiting-picture">
      <source type="image/avif" srcset="./assets/dark/winden-loading-960.avif 960w, ./assets/dark/winden-loading-1920.avif 1920w" sizes="100vw">
      <img src="./assets/dark/winden-loading-1920.webp" srcset="./assets/dark/winden-loading-960.webp 960w, ./assets/dark/winden-loading-1920.webp 1920w" sizes="100vw" width="1920" height="1080" alt="" fetchpriority="high" decoding="async">
    </picture><div class="dark-waiting-shade"></div>`;
    document.body.prepend(backdrop);
    const img = backdrop.querySelector('img');
    img.addEventListener('load', () => backdrop?.classList.add('is-loaded'), {once: true});
    if (img.complete && img.naturalWidth) backdrop.classList.add('is-loaded');
    listeners = new AbortController();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const mouse = matchMedia('(hover: hover) and (pointer: fine)');
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0;
      backdrop?.style.removeProperty('--forest-x');
      backdrop?.style.removeProperty('--forest-y');
    };
    window.addEventListener('pointermove', event => {
      if (!backdrop || motion.matches || !mouse.matches || document.hidden) return;
      pointerX = (event.clientX / innerWidth - .5) * 8;
      pointerY = (event.clientY / innerHeight - .5) * 5;
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        backdrop?.style.setProperty('--forest-x', `${pointerX.toFixed(2)}px`);
        backdrop?.style.setProperty('--forest-y', `${pointerY.toFixed(2)}px`);
      });
    }, {signal: listeners.signal, passive: true});
    document.addEventListener('visibilitychange', reset, {signal: listeners.signal});
    document.documentElement.addEventListener('pointerleave', reset, {signal: listeners.signal});
    motion.addEventListener('change', reset, {signal: listeners.signal});
  }

  // Server updates redraw the room controls; the image stays mounted.
  const shell = document.querySelector('#app > .shell');
  if (!shell) return;
  if (!title?.isConnected) {
    title = document.createElement('section');
    title.id = 'dark-waiting-title';
    title.innerHTML = `<p class="dark-waiting-place"></p><p class="dark-waiting-wordmark">DARK</p>
      <p class="dark-waiting-caption"></p><div class="dark-waiting-status" role="status" aria-live="polite" aria-atomic="true">
      <span class="dark-waiting-marker" aria-hidden="true"></span><div><strong></strong><p></p></div></div>
      <div class="dark-waiting-seats" aria-hidden="true"><i></i><i></i><i></i></div>`;
    shell.querySelector('.page-nav')?.after(title);
  }
  title.querySelector('.dark-waiting-place').textContent = text.place;
  title.querySelector('.dark-waiting-caption').textContent = text.caption;
  const headline = phase === 'setup' ? text.setup : phase === 'connecting' || !connected ? text.connecting : count === 3 ? text.ready : text.waiting;
  const detail = phase === 'setup' ? text.setupDetail : phase === 'connecting' || !connected ? text.connectingDetail : count === 3 ? text.readyDetail : text.count(count);
  const status = title.querySelector('.dark-waiting-status');
  if (status.querySelector('strong').textContent !== headline) status.querySelector('strong').textContent = headline;
  if (status.querySelector('p').textContent !== detail) status.querySelector('p').textContent = detail;
  title.querySelector('.dark-waiting-seats').hidden = phase !== 'lobby';
  title.querySelectorAll('.dark-waiting-seats i').forEach((seat, index) => seat.classList.toggle('has-arrived', index < count));
}
