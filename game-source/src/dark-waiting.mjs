const copy = {
  en: {
    place: 'Winden, 2019', setup: 'Every journey begins here.',
    setupDetail: 'Create a room, or take your place with friends.',
    connecting: 'Finding your room…', connectingDetail: 'Reconnecting to the other travellers.',
    waiting: 'Waiting for the others.', ready: 'The passage is open.',
    count: count => `${count} of 3 players have arrived`, readyCount: count => `${count} of 3 players are ready`,
    readyDetail: 'Everyone is ready. The narrator can begin.', caption: 'The beginning is the end.',
    look: 'Drag to look around · arrow keys', light: 'Flashlight', soundOff: 'Sound off', soundOn: 'Sound on',
    replay: 'Enter the cave again', preview: 'Preview the passage', loading: 'Finding the passage…', journey: 'Entering the passage',
    arrival: 'You are through.', skip: 'Skip journey', arrived: 'Your place is saved. Waiting for the narrator.',
    fallback: 'Forest view', depth: 'Explore the forest',
  },
  ka: {
    place: 'ვინდენი, 2019', setup: 'ყველა მოგზაურობა აქ იწყება.', setupDetail: 'შექმენი ოთახი ან შეუერთდი მეგობრებს.',
    connecting: 'შენი ოთახის ძიება…', connectingDetail: 'სხვა მოგზაურებთან კავშირი აღდგება.',
    waiting: 'სხვების მოლოდინში.', ready: 'გასასვლელი ღიაა.', count: count => `მოვიდა ${count} მოთამაშე 3-დან`,
    readyCount: count => `მზად არის ${count} მოთამაშე 3-დან`, readyDetail: 'ყველა მზადაა. მთხრობელს შეუძლია დაწყება.',
    caption: 'დასაწყისი დასასრულია.', look: 'გადაათრიე ან გამოიყენე ისრები', light: 'ფანარი',
    soundOff: 'ხმა გამორთულია', soundOn: 'ხმა ჩართულია', replay: 'კვლავ შედი გამოქვაბულში', preview: 'გასასვლელის ნახვა', loading: 'გასასვლელის ძიება…',
    journey: 'გასასვლელში შესვლა', arrival: 'შენ უკვე აქ ხარ.', skip: 'მოგზაურობის გამოტოვება',
    arrived: 'შენი ადგილი შენახულია. ველოდებით მთხრობელს.', fallback: 'ტყის ხედი', depth: 'გამოიკვლიე ტყე',
  },
};

let backdrop, title, listeners, scene, overlay, options, identity, armed = false;
let sound = false, light = false, returnFocus;
export function prepareDarkTravel() {armed = true;}
export function cancelDarkTravel() {armed = false;}

function endJourney() {
  const hadOverlay = !!overlay;
  overlay?.remove();overlay = null;document.querySelector('#app')?.removeAttribute('inert');
  document.body.classList.remove('dark-travelling');
  if (backdrop) {backdrop.dataset.travel = 'forest';backdrop.style.setProperty('--cave-black', '0');}
  if (hadOverlay) (document.getElementById(returnFocus) || document.querySelector('#player-ready'))?.focus({preventScroll: true});
}
function journey() {
  if (!backdrop || overlay) return;
  if (!scene) {armed = true;return;}
  const text = copy[options.language] || copy.en;
  returnFocus = document.activeElement?.id;
  overlay = document.createElement('section');overlay.id = 'dark-journey';
  overlay.setAttribute('role', 'dialog');overlay.setAttribute('aria-modal', 'true');overlay.setAttribute('aria-labelledby', 'dark-journey-heading');
  overlay.innerHTML = `<button type="button" id="dark-skip"></button><div class="dark-journey-caption"><span class="dark-journey-before"></span>
    <h2 id="dark-journey-heading">2019</h2><p class="dark-journey-after"></p><p class="dark-arrival-detail"></p></div>`;
  overlay.querySelector('button').textContent = text.skip;
  overlay.querySelector('.dark-journey-before').textContent = text.journey;
  overlay.querySelector('.dark-journey-after').textContent = text.arrival;
  overlay.querySelector('.dark-arrival-detail').textContent = text.arrived;
  overlay.querySelector('button').onclick = () => scene?.skip();
  document.body.append(overlay);document.body.classList.add('dark-travelling');
  document.querySelector('#app')?.setAttribute('inert', '');overlay.querySelector('button').focus({preventScroll: true});
  armed = false;if (!scene.travel()) endJourney();
}
export function clearDarkWaiting() {
  endJourney();listeners?.abort();listeners = null;scene?.dispose();scene = null;
  backdrop?.remove();title?.remove();backdrop = title = null;
  options = identity = null;armed = sound = light = false;
  document.body.classList.remove('dark-waiting');delete document.body.dataset.darkWaiting;
}
export function syncDarkWaiting(next) {
  if (!next.active) {clearDarkWaiting();return;}
  options = next;
  const {language = 'en', phase = 'setup', players = 0, readyPlayers = 0, connected = true, ready = false} = next;
  if (identity !== next.identity) {identity = next.identity;armed = false;scene?.skip();}
  const text = copy[language] || copy.en, count = Math.max(0, Math.min(3, players));
  document.body.classList.add('dark-waiting');document.body.dataset.darkWaiting = phase;
  if (!backdrop) {
    backdrop = document.createElement('div');backdrop.id = 'dark-waiting-scene';
    backdrop.setAttribute('aria-hidden', 'true');backdrop.dataset.depth = 'loading';backdrop.dataset.travel = 'forest';
    backdrop.innerHTML = `<picture class="dark-waiting-picture"><source type="image/avif" srcset="./assets/dark/winden-loading-960.avif 960w, ./assets/dark/winden-loading-1920.avif 1920w" sizes="100vw">
      <img src="./assets/dark/winden-loading-1920.webp" srcset="./assets/dark/winden-loading-960.webp 960w, ./assets/dark/winden-loading-1920.webp 1920w" sizes="100vw" width="1920" height="1080" alt="" fetchpriority="high" decoding="async">
    </picture><div class="dark-waiting-shade"></div><div class="dark-cave-black"></div>`;
    document.body.prepend(backdrop);
    const img = backdrop.querySelector('img'), mounted = backdrop;
    img.addEventListener('load', () => mounted.classList.add('is-loaded'), {once: true});
    if (img.complete && img.naturalWidth) backdrop.classList.add('is-loaded');
    listeners = new AbortController();const signal = listeners.signal;
    import('./dark-waiting-scene.js?v=dark-depth-20261012').then(module => module.mountDarkWaitingScene(mounted, {
      signal, onTravelEnd: endJourney,
      onLost: () => {scene = null;mounted.dataset.depth = 'fallback';endJourney();if (options) syncDarkWaiting(options);},
    })).then(controller => {
      if (signal.aborted) {controller.dispose();return;}
      scene = controller;if (options) syncDarkWaiting(options);
    }).catch(() => {
      if (signal.aborted) return;mounted.dataset.depth = 'fallback';armed = false;if (options) syncDarkWaiting(options);
    });
  }
  const shell = document.querySelector('#app > .shell');if (!shell) return;
  if (!title?.isConnected) {
    title = document.createElement('section');title.id = 'dark-waiting-title';
    title.innerHTML = `<p class="dark-waiting-place"></p><p class="dark-waiting-wordmark">DARK</p><p class="dark-waiting-caption"></p>
      <button type="button" id="dark-look-control"></button><div class="dark-scene-controls"><button type="button" id="dark-flashlight" aria-pressed="false"></button>
      <button type="button" id="dark-ambience" aria-pressed="false"></button><button type="button" id="dark-replay"></button></div>
      <div class="dark-waiting-status" role="status" aria-live="polite" aria-atomic="true"><span class="dark-waiting-marker" aria-hidden="true"></span><div><strong></strong><p></p></div></div>
      <div class="dark-waiting-seats" aria-hidden="true"><i></i><i></i><i></i></div>`;
    shell.querySelector('.page-nav')?.after(title);
    title.querySelector('#dark-flashlight').onclick = () => {if (scene) light = scene.flashlight();syncDarkWaiting(options);};
    title.querySelector('#dark-ambience').onclick = async () => {
      const activeScene = scene;if (!activeScene) return;
      const enabled = await activeScene.sound();if (scene !== activeScene) return;sound = enabled;syncDarkWaiting(options);
    };
    title.querySelector('#dark-replay').onclick = journey;
  }
  title.querySelector('.dark-waiting-place').textContent = text.place;title.querySelector('.dark-waiting-caption').textContent = text.caption;
  const look = title.querySelector('#dark-look-control');
  look.textContent = backdrop.dataset.depth === 'fallback' ? text.fallback : scene ? '↔ ' + text.look : text.loading;
  look.setAttribute('aria-label', text.depth + '. ' + text.look);look.disabled = !scene;
  const flashlight = title.querySelector('#dark-flashlight');flashlight.textContent = text.light;flashlight.setAttribute('aria-pressed', String(light));flashlight.disabled = !scene;
  const ambience = title.querySelector('#dark-ambience');ambience.textContent = sound ? text.soundOn : text.soundOff;ambience.setAttribute('aria-pressed', String(sound));ambience.disabled = !scene;
  const replay = title.querySelector('#dark-replay');replay.textContent = ready ? text.replay : text.preview;replay.hidden = !ready&&phase!=='setup'&&next.role!=='narrator';replay.disabled = !scene;
  const reconnect = phase === 'connecting' || !connected;
  const headline = phase === 'setup' ? text.setup : reconnect ? text.connecting : readyPlayers === 3 ? text.ready : text.waiting;
  const detail = phase === 'setup' ? text.setupDetail : reconnect ? text.connectingDetail : readyPlayers === 3 ? text.readyDetail : count === 3 ? text.readyCount(readyPlayers) : text.count(count);
  const status = title.querySelector('.dark-waiting-status');
  if (status.querySelector('strong').textContent !== headline) status.querySelector('strong').textContent = headline;
  if (status.querySelector('p').textContent !== detail) status.querySelector('p').textContent = detail;
  title.querySelector('.dark-waiting-seats').hidden = phase !== 'lobby';
  title.querySelectorAll('.dark-waiting-seats i').forEach((seat, index) => {seat.classList.toggle('has-arrived', index < count);seat.classList.toggle('is-ready', index < readyPlayers);});
  if (armed && ready && connected && scene) journey();
  if (next.role==='drafter'&&!ready&&overlay) scene?.skip();
}
