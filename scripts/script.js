/* ═══════════════════════════════════════════════
   Echoes — js/app.js
   Production app logic — all features
   localStorage MVP, Firebase-ready
═══════════════════════════════════════════════ */

'use strict';

/* ─── STATE ─── */
let user         = { name: 'Explorer', av: '🌙', uid: null };
let selAv        = '🌙';
let selFilter    = 'original';
let msgType      = 'tagged';
let memLat       = null, memLng = null;
let msgLatV      = null, msgLngV = null;
let imgData      = null, msgImgData = null;
let curDetailId  = null;
let fbRating     = 0, fbYN = '';
let galFilter    = 'all', nearbyFilter = 'all';
let deferredInstall = null;
let otpConfirmation = null;

/* ─── DEMO DATA (only loaded when user picks "Explore Demo") ─── */
const DEMO_MEMORIES = [
  { id:'dm1', image:null, caption:'First chai stop in Pune — the fog was thick, the tea was perfect.', filter:'warm', createdAt:new Date(Date.now()-86400000*3).toISOString(), lat:18.5204, lng:73.8567, locked:false, visibility:'public', creator:'wanderer', creatorAv:'✈️', tag:'nostalgia', likes:12, comments:[{author:'arun_k',text:'I remember this spot!',ts:Date.now()-3600000},{author:'priya_m',text:'Which chai stall? 😍',ts:Date.now()-1800000}] },
  { id:'dm2', image:null, caption:'College campus throwback — the bench where everything began.', filter:'vintage', createdAt:new Date(Date.now()-86400000*7).toISOString(), lat:18.5500, lng:73.8300, locked:true, visibility:'private', creator:'demo', creatorAv:'🌙', tag:'nostalgia', likes:0, comments:[] },
  { id:'dm3', image:null, caption:'Sunset at the ghats — photography lovers, this one\'s for you 🌅', filter:'cinematic', createdAt:new Date(Date.now()-86400000).toISOString(), lat:18.5100, lng:73.8200, locked:false, visibility:'public', creator:'lens_life', creatorAv:'📸', tag:'photography', likes:47, comments:[{author:'shutterhead',text:'Golden hour goals 📸',ts:Date.now()-600000}] },
  { id:'dm4', image:null, caption:'Hidden biryani spot near Kalyani Nagar. Food lovers only 🍛', filter:'original', createdAt:new Date(Date.now()-86400000*2).toISOString(), lat:18.5480, lng:73.9020, locked:true, visibility:'public', creator:'foodwanderer', creatorAv:'🍜', tag:'food', likes:31, comments:[] }
];
const DEMO_MESSAGES = [
  { id:'msg1', type:'tagged', text:'Remember that late night after our last exam? Left something for you here.', taggedPerson:'DemoUser', category:'friendship', lat:18.5204, lng:73.8567, radius:100, sender:'wanderer', senderAv:'✈️', createdAt:new Date(Date.now()-86400000*2).toISOString(), locked:true },
  { id:'msg2', type:'interest', text:'Hidden sunset photograph for travel lovers. The view from here changed my life.', taggedPerson:null, category:'photography', lat:18.5100, lng:73.8200, radius:250, sender:'lens_life', senderAv:'📸', createdAt:new Date(Date.now()-86400000).toISOString(), locked:true },
  { id:'msg3', type:'public', text:'Food lovers — best misal pav in Pune is 50m left of this pin 🌶️', taggedPerson:null, category:'food', lat:18.5300, lng:73.8600, radius:100, sender:'foodwanderer', senderAv:'🍜', createdAt:new Date(Date.now()-43200000).toISOString(), locked:false }
];
const DEMO_FEEDBACK = [
  { name:'Priya M.', rating:5, text:'Beautiful idea. The location unlock mechanic feels so nostalgic. Would use this every trip!', source:'instagram', yn:'yes', ts: Date.now()-100000 },
  { name:'Rohan K.', rating:4, text:'Love the tagged message concept. Imagine leaving a memory at your grandma\'s house for your kids 😭', source:'twitter', yn:'yes', ts: Date.now()-200000 },
  { name:'Anonymous', rating:3, text:'Cool concept but needs a real map. The discovery piece could be addictive if it works well.', source:'whatsapp', yn:'maybe', ts: Date.now()-300000 }
];

/* ─── STORAGE HELPERS ─── */
const getM    = () => JSON.parse(localStorage.getItem('e_memories')  || '[]');
const getMsgs = () => JSON.parse(localStorage.getItem('e_messages')  || '[]');
const getFB   = () => JSON.parse(localStorage.getItem('e_feedback')  || '[]');
const saveM   = d  => localStorage.setItem('e_memories',  JSON.stringify(d));
const saveMsgs= d  => localStorage.setItem('e_messages',  JSON.stringify(d));
const saveFB  = d  => localStorage.setItem('e_feedback',  JSON.stringify(d));

const ALLOW_MANUAL_LOCATION_OVERRIDE = false;
const MIN_UNLOCK_ACCURACY_M = 150;
const UNLOCK_COOLDOWN_MS = 8000;
let _unlockCooldownUntil = 0;

function cleanText(value, maxLen = 240) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanHandle(value, maxLen = 32) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .trim()
    .slice(0, maxLen);
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hasReliableGps(coords) {
  if (!coords || typeof coords.accuracy !== 'number') return false;
  return coords.accuracy > 0 && coords.accuracy <= MIN_UNLOCK_ACCURACY_M;
}

function showVpnUnlockWarning() {
  showToast('Turn off VPN/proxy and enable Precise Location to unlock memories.', 4200);
}


/* ════════════════════════════════════
   REVERSE GEOCODING — Nominatim (OpenStreetMap)
   Free, no API key, works in India
   Cache results to avoid redundant lookups
════════════════════════════════════ */
const _geoCache = {};

async function reverseGeocode(lat, lng) {
  const key = lat.toFixed(3) + ',' + lng.toFixed(3);
  if (_geoCache[key]) return _geoCache[key];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'EchoesApp/1.0' } }
    );
    const data = await res.json();
    const a = data.address || {};

    // Build a human-readable short name
    // Priority: road/amenity > suburb/neighbourhood > city_district > city > state
    const parts = [];
    const road = a.road || a.amenity || a.shop || a.tourism || a.leisure;
    const area = a.suburb || a.neighbourhood || a.city_district || a.quarter;
    const city = a.city || a.town || a.village || a.municipality;

    if (road)  parts.push(road);
    if (area && area !== road) parts.push(area);
    if (city && city !== area) parts.push(city);

    const name = parts.length ? parts.join(', ') : (data.display_name || key);
    _geoCache[key] = name;
    return name;
  } catch {
    // Fallback to short coords if network fails
    _geoCache[key] = lat.toFixed(3) + ', ' + lng.toFixed(3);
    return _geoCache[key];
  }
}

// Sync version — returns cached name or short coords while geocoding in background
function getLocationName(lat, lng, onUpdate) {
  const key = lat.toFixed(3) + ',' + lng.toFixed(3);
  if (_geoCache[key]) return _geoCache[key];
  // Start async lookup, call onUpdate when done
  reverseGeocode(lat, lng).then(name => {
    if (onUpdate) onUpdate(name);
  });
  return lat.toFixed(3) + ', ' + lng.toFixed(3); // temp placeholder
}


/* ════════════════════════════════════
   FOOTER LOADER — loads footer.html into #footer-root
════════════════════════════════════ */
function loadFooter() {
  // Footer is inlined in #landing — nothing to load
}

/* ════════════════════════════════════
   INIT
════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstall = e;
    document.getElementById('btn-pwa-install').classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => showToast('✅ Echoes added to your home screen!'));

  // iOS install banner
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !window.navigator.standalone) {
    document.getElementById('ios-banner').classList.remove('hidden');
  }

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  // Firebase init
  if (typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED) {
    const ok = await initSupabase();
    if (ok) {
      listenAuthState(sbUser => {
        if (sbUser && !localStorage.getItem('e_user')) {
          user = {
            name:  sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'Explorer',
            av:    sbUser.user_metadata?.avatar    || selAv || '🌙',
            uid:   sbUser.id,
            email: sbUser.email || ''
          };
          localStorage.setItem('e_user', JSON.stringify(user));
          launchApp();
        }
      });
    }
  }

  // Check for returning user — launch app directly if session exists
  const saved = localStorage.getItem('e_user');
  if (saved) {
    try {
      user = JSON.parse(saved);
      launchApp();
    } catch {
      localStorage.removeItem('e_user');
    }
  }
  // else: landing page is visible by default (normal document flow)
});

function installPWA() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  deferredInstall.userChoice.then(() => {
    deferredInstall = null;
    document.getElementById('btn-pwa-install').classList.add('hidden');
  });
}

/* ════════════════════════════════════
   AUTH — ENTRY
════════════════════════════════════ */
function pickAv(btn) {
  document.querySelectorAll('.av-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  selAv = btn.dataset.av;
}

async function enterApp() {
  const n = cleanText(document.getElementById('e-name').value, 24) || 'Explorer';

  let uid = 'local_' + Date.now();

  if (typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED) {
    try {
      // getSessionUid() reuses existing session — no new anon call if already signed in
      const existing = await getSessionUid();
      if (existing) {
        uid = existing;
      } else {
        const anonUser = await signInAnonymously();
        if (anonUser) uid = anonUser.id;
      }
    } catch (e) { console.warn('Auth check failed, using local uid:', e.message); }
  }

  user = { name: n, av: selAv, uid };
  localStorage.setItem('e_user', JSON.stringify(user));
  launchApp();
}

async function enterDemo() {
  let uid = 'demo';

  if (typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED) {
    try {
      const existing = await getSessionUid();
      if (existing) {
        uid = existing;
      } else {
        const anonUser = await signInAnonymously();
        if (anonUser) uid = anonUser.id;
      }
    } catch (e) { console.warn('Auth check failed for demo:', e.message); }
  }

  user = { name: 'DemoUser', av: '🌙', uid };
  localStorage.setItem('e_user', JSON.stringify(user));

  if (!localStorage.getItem('e_demo_seeded')) {
    saveM(DEMO_MEMORIES);
    saveMsgs(DEMO_MESSAGES);
    saveFB(DEMO_FEEDBACK);
    localStorage.setItem('e_demo_seeded', '1');
  }
  launchApp();
}


/* ════════════════════════════════════
   AUTH TABS + EMAIL/PASSWORD
════════════════════════════════════ */
function switchAuthTab(tab, btn) {
  ['login','signup','guest'].forEach(t => {
    const el = document.getElementById('auth-tab-' + t);
    if (el) el.classList.remove('active');
  });
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
  const active = document.getElementById('auth-tab-' + tab);
  if (active) active.classList.add('active');
  if (btn) btn.classList.add('active');
}

async function loginWithEmail() {
  const email = (document.getElementById('login-email')?.value || '').trim();
  const pass  = (document.getElementById('login-password')?.value || '').trim();
  if (!email || !pass) { showToast('Enter email and password'); return; }
  if (typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED) {
    showToast('Logging in…');
    const sbUser = await signInWithEmail(email, pass);
    if (sbUser) {
      user = {
        name:  sbUser.user_metadata?.full_name || email.split('@')[0],
        av:    sbUser.user_metadata?.avatar   || selAv || '🌙',
        uid:   sbUser.id,
        email: sbUser.email
      };
      localStorage.setItem('e_user', JSON.stringify(user));
      launchApp();
    }
  } else {
    showToast('Set SUPABASE_ENABLED = true first');
  }
}

async function signupWithEmail() {
  const name  = cleanText(document.getElementById('signup-name')?.value, 24) || 'Explorer';
  const email = (document.getElementById('signup-email')?.value || '').trim();
  const pass  = (document.getElementById('signup-password')?.value || '').trim();
  if (!email || !pass) { showToast('Enter email and password'); return; }
  if (pass.length < 6)  { showToast('Password must be at least 6 characters'); return; }
  if (typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED) {
    showToast('Creating account…');
    const sbUser = await signUpWithEmail(email, pass, name, selAv);
    if (sbUser) {
      user = { name, av: selAv, uid: sbUser.id, email: sbUser.email };
      localStorage.setItem('e_user', JSON.stringify(user));
      showToast('✅ Account created! Welcome to Echoes.');
      launchApp();
    }
  } else {
    showToast('Set SUPABASE_ENABLED = true first');
  }
}

async function forgotPassword() {
  const email = (document.getElementById('login-email')?.value || '').trim();
  if (!email) { showToast('Enter your email first'); return; }
  if (typeof resetPassword === 'function') await resetPassword(email);
}

async function signInGoogle() {
  if (typeof SUPABASE_ENABLED === 'undefined' || !SUPABASE_ENABLED) {
    showToast('⚠️ Set SUPABASE_ENABLED = true in supabase-config.js first');
    return;
  }
  const fbUser = await signInWithGoogle();
  if (!fbUser) showToast('❌ Google sign-in failed. Try again.');
}

function showAuthStep(n) {
  document.querySelectorAll('.auth-step').forEach(s => s.classList.remove('active'));
  const step = document.getElementById('auth-step-' + (n === 1 ? '1' : 'otp'));
  if (step) step.classList.add('active');
}

async function verifyOTP() {
  if (!otpConfirmation) return;
  const code = document.getElementById('otp-input').value.trim();
  try {
    await otpConfirmation.confirm(code);
    showToast('✅ Phone verified!');
  } catch {
    showToast('❌ Invalid OTP. Try again.');
  }
}

function logout() {
  dbStopNearby();
  if (typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED) {
    fbSignOut().catch(() => {});
  }

  // Clear session
  localStorage.removeItem('e_user');
  localStorage.removeItem('e_demo_seeded');

  // Reset state
  user = { name: 'Explorer', av: '🌙', uid: null };
  fbRating = 0; fbYN = '';

  // Hide app
  const appEl = document.getElementById('app');
  if (appEl) appEl.classList.add('hidden');

  // Unlock body scroll
  document.body.classList.remove('app-open');

  // Show landing
  const landing = document.getElementById('landing');
  if (landing) landing.style.display = '';

  // Scroll to top of landing
  window.scrollTo(0, 0);

  // Reset entry form
  const nameInp = document.getElementById('e-name');
  if (nameInp) nameInp.value = '';
  document.querySelectorAll('.av-btn').forEach(b => b.classList.remove('sel'));
  const firstAv = document.querySelector('.av-btn');
  if (firstAv) { firstAv.classList.add('sel'); selAv = firstAv.dataset.av || '🌙'; }
}

/* ════════════════════════════════════
   APP LAUNCH
════════════════════════════════════ */
function launchApp() {
  // Hide landing
  const landing = document.getElementById('landing');
  if (landing) landing.style.display = 'none';

  // Show app
  const appEl = document.getElementById('app');
  if (appEl) appEl.classList.remove('hidden');

  // Lock body scroll
  document.body.classList.add('app-open');

  // Let the DOM repaint before running JS that reads/writes elements
  requestAnimationFrame(() => {
    updateUserUI();
    syncCloudData();
    renderStats();
    renderTeasers();
    goSec('dashboard');
    handleDeepLink();
  });
}

function updateUserUI() {
  const handle = '@' + user.name.toLowerCase().replace(/\s+/g, '');
  const els = {
    'sb-av':     user.av,
    'sb-name':   user.name,
    'sb-handle': handle,
    'd-name':    user.name,
    'd-av':      user.av
  };
  Object.entries(els).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

/* ════════════════════════════════════
   NAVIGATION
════════════════════════════════════ */
function goSec(name, el) {
  document.querySelectorAll('.s').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('s-' + name);
  if (sec) sec.classList.add('active');

  document.querySelectorAll('.nl').forEach(l => l.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else {
    const link = document.querySelector('[data-s="' + name + '"]');
    if (link) link.classList.add('active');
  }

  // Close sidebar on mobile
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.remove('open');
  const ov = document.getElementById('sb-overlay');
  if (ov) ov.classList.add('hidden');

  // Render section
  const renders = {
    gallery: renderGallery,
    nearby:  renderNearby,
    places:  renderPlaces,
    inbox:   renderInbox,
    feedback:renderFBPrev,
    unlock:  renderUnlockList
  };
  if (renders[name]) renders[name]();
  return false;
}

function toggleSB() {
  document.getElementById('sidebar').classList.toggle('open');
  const ov = document.getElementById('sb-overlay');
  if (ov) ov.classList.toggle('hidden');
}

/* ════════════════════════════════════
   STATS — all real from localStorage
════════════════════════════════════ */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderStats() {
  const mems = getM();
  const msgs = getMsgs();

  setText('st-saved', mems.length);

  const myMems = mems.filter(m => m.creator === user.name || m.creator === 'demo');
  const uniqPlaces = new Set(myMems.map(m => m.lat.toFixed(2) + ',' + m.lng.toFixed(2)));
  setText('st-places', uniqPlaces.size);

  setText('st-unlocked', mems.filter(m => !m.locked).length);

  const drops = mems.filter(m => m.visibility === 'public').length
    + msgs.filter(m => m.type === 'public' || m.type === 'interest').length;
  setText('st-nearby', drops);

  setText('st-reactions', mems.reduce((s, m) => s + (m.likes || 0), 0));

  const tagged = msgs.filter(m => m.taggedPerson === user.name).length;
  const badge = document.getElementById('nbadge');
  if (badge) {
    badge.textContent = tagged;
    badge.classList.toggle('hidden', tagged === 0);
  }
}

/* ════════════════════════════════════
   TEASERS — real data driven
════════════════════════════════════ */
function renderTeasers() {
  const mems = getM();
  const msgs = getMsgs();
  const items = [];

  const locked = mems.filter(m => m.locked && (m.creator === user.name || m.creator === 'demo'));
  if (locked.length > 0)
    items.push({ dot:'dr', text: locked.length + ' locked memor' + (locked.length===1?'y':'ies') + ' waiting', sub:'Return to those places to unlock', act:'unlock', label:'Unlock →' });

  const taggedForMe = msgs.filter(m => m.taggedPerson === user.name);
  if (taggedForMe.length > 0)
    items.push({ dot:'da', text: taggedForMe.length + ' message' + (taggedForMe.length===1?'':'s') + ' tagged for you', sub:'Visit those places to reveal them', act:'inbox', label:'View →' });

  const pubDrops = mems.filter(m => m.visibility === 'public' && m.creator !== user.name).length
    + msgs.filter(m => (m.type === 'public' || m.type === 'interest') && m.sender !== user.name).length;
  if (pubDrops > 0)
    items.push({ dot:'dg', text: pubDrops + ' public drop' + (pubDrops===1?'':'s') + ' around you', sub:'Explore what others have left nearby', act:'nearby', label:'Explore →' });

  const unlocked = mems.filter(m => !m.locked);
  if (unlocked.length > 0)
    items.push({ dot:'dp', text: unlocked.length + ' memor' + (unlocked.length===1?'y':'ies') + ' unlocked', sub:'You\'ve been to these places', act:'gallery', label:'View →' });

  // Onboarding for new users
  if (items.length === 0) {
    items.push({ dot:'dr', text: 'Drop your first memory', sub:'Tap Add Memory to anchor a photo to a place', act:'add-memory', label:'Start →' });
    items.push({ dot:'dg', text: 'Explore public drops nearby', sub:'See what others have left around you', act:'nearby', label:'Explore →' });
  }

  const wrap = document.getElementById('teaser-wrap');
  if (!wrap) return;
  wrap.innerHTML = items.map(i => `
    <div class="teaser-card" onclick="goSec('${i.act}')">
      <div class="dot ${i.dot}"></div>
      <div class="t-body"><strong>${i.text}</strong><p>${i.sub}</p></div>
      <button class="t-act" onclick="event.stopPropagation();goSec('${i.act}')">${i.label}</button>
    </div>`).join('');
}

/* ════════════════════════════════════
   ADD MEMORY
════════════════════════════════════ */
function onImg(e) {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) { showToast('⚠️ Image too large. Max 5MB.'); return; }
  const r = new FileReader();
  r.onload = ev => {
    imgData = ev.target.result;
    const prev = document.getElementById('img-prev');
    prev.src = imgData;
    prev.className = 'img-prev filter-' + selFilter;
    prev.classList.remove('hidden');
    document.getElementById('up-ph').classList.add('hidden');
    document.getElementById('filt-strip').classList.remove('hidden');
  };
  r.readAsDataURL(f);
}

function applyFilt(f, btn) {
  selFilter = f;
  document.querySelectorAll('.fb').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const prev = document.getElementById('img-prev');
  if (prev) prev.className = 'img-prev filter-' + f;
}

function fetchMemLoc() {
  const dispEl = document.getElementById('m-loc');
  if (!dispEl) return;
  dispEl.textContent = 'Fetching GPS…';
  if (!navigator.geolocation) { showManualLocInput('mem'); return; }
  navigator.geolocation.getCurrentPosition(
    p => {
      if (!hasReliableGps(p.coords)) {
        dispEl.textContent = 'Precise GPS needed (turn off VPN/proxy)';
        showVpnUnlockWarning();
        return;
      }
      memLat = p.coords.latitude;
      memLng = p.coords.longitude;
      dispEl.textContent = '📍 Getting place name…';
      reverseGeocode(memLat, memLng).then(name => {
        dispEl.textContent = name;
        showToast('📍 ' + name);
      });
    },
    err => {
      console.warn('GPS blocked:', err.code);
      showManualLocInput('mem');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function showManualLocInput(type) {
  if (!ALLOW_MANUAL_LOCATION_OVERRIDE) {
    showToast('Manual location is disabled for security. Enable precise GPS and turn off VPN.', 4200);
    return;
  }
  const isMsg = type === 'msg';
  const el = document.getElementById(isMsg ? 'mg-loc' : 'm-loc');
  if (!el) return;
  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:.35rem;width:100%">'
    + '<small style="color:var(--muted)">GPS blocked — enter location:</small>'
    + '<input id="manual-loc" type="text" placeholder="e.g. FC Road, Pune or 18.52, 73.85" '
    + 'style="font-size:.78rem;padding:.4rem .7rem;border-radius:6px;border:1px solid var(--cb);background:var(--bg3);color:var(--text);width:100%"/>'
    + '<button onclick="applyManualLoc(\'' + type + '\')" '
    + 'style="font-size:.75rem;padding:.32rem .7rem;background:var(--gold);border:none;border-radius:6px;cursor:pointer;color:var(--bg)">Set Location</button>'
    + '</div>';
}

function applyManualLoc(type) {
  const isMsg = type === 'msg';
  const inp = document.getElementById('manual-loc');
  if (!inp || !inp.value.trim()) return;
  const val = inp.value.trim();
  const coordMatch = val.match(/(-?[0-9.]+)[,\s]+(-?[0-9.]+)/);
  let lat, lng, name;
  if (coordMatch) {
    lat = parseFloat(coordMatch[1]);
    lng = parseFloat(coordMatch[2]);
    name = null;
  } else {
    lat = 18.5204; lng = 73.8567; name = val;
  }
  if (isMsg) { msgLatV = lat; msgLngV = lng; }
  else       { memLat  = lat; memLng  = lng; }
  const key = lat.toFixed(3) + ',' + lng.toFixed(3);
  if (name) _geoCache[key] = name;
  const el = document.getElementById(isMsg ? 'mg-loc' : 'm-loc');
  if (el) {
    if (name) { el.textContent = '📍 ' + name; }
    else {
      el.textContent = '📍 Getting place name…';
      reverseGeocode(lat, lng).then(n => { if (el) el.textContent = n; });
    }
  }
  showToast('📍 Location set!');
}
function useMemMock() {
  memLat = 18.5204 + (Math.random() - 0.5) * 0.01;
  memLng = 73.8567 + (Math.random() - 0.5) * 0.01;
  const dispEl = document.getElementById('m-loc');
  dispEl.textContent = '📍 Getting place name…';
  reverseGeocode(memLat, memLng).then(name => { dispEl.textContent = name + ' (demo)'; });
  showToast('📍 Using demo GPS');
}

async function saveMemory() {
  const cap = cleanText(document.getElementById('m-cap').value, 500);
  if (!cap) { showToast('✏️ Add a caption first'); return; }
  if (!memLat) { showToast('📍 Please fetch your location first'); return; }

  // Get real Supabase uid if available, fall back to stored uid
  let creatorUid = user.uid || 'local';
  if (typeof getSessionUid === 'function') {
    const sessionUid = await getSessionUid();
    if (sessionUid) creatorUid = sessionUid;
  }

  const mem = {
    id: 'mem_' + Date.now(),
    image: imgData,
    caption: cap,
    filter: selFilter,
    createdAt: new Date().toISOString(),
    lat: memLat, lng: memLng,
    locationName: _geoCache[memLat.toFixed(3) + ',' + memLng.toFixed(3)] || null,
    locked: true,
    visibility: document.getElementById('m-vis').value,
    creator: user.name,
    creatorAv: user.av,
    creatorUid,
    tag: document.getElementById('m-tag').value,
    likes: 0,
    comments: []
  };

  try {
    const remoteId = await dbSaveMemory(mem);
    if (remoteId) mem.id = remoteId;
    const mems = getM();
    mems.unshift(mem);
    saveM(mems);
  } catch (err) {
    console.error('dbSaveMemory failed:', err);
    showToast('Cloud save failed. Not saved: ' + errToText(err), 4200);
    return;
  }

  // Reset form
  imgData = null; selFilter = 'original'; memLat = null; memLng = null;
  document.getElementById('m-cap').value = '';
  const prev = document.getElementById('img-prev');
  if (prev) prev.classList.add('hidden');
  document.getElementById('up-ph').classList.remove('hidden');
  document.getElementById('filt-strip').classList.add('hidden');
  document.getElementById('m-loc').textContent = 'Tap Fetch to use GPS';
  document.getElementById('img-pick').value = '';

  renderStats();
  showToast('🔒 Memory locked at this location!');
  setTimeout(() => goSec('gallery'), 900);
}

/* ════════════════════════════════════
   LEAVE MESSAGE
════════════════════════════════════ */
function pickMT(t, btn) {
  msgType = t;
  document.querySelectorAll('.mt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tf = document.getElementById('tag-field');
  if (tf) tf.style.display = (t === 'tagged') ? 'flex' : 'none';
}

function onMsgImg(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    msgImgData = ev.target.result;
    const p = document.getElementById('mg-img-prev');
    if (p) { p.src = msgImgData; p.classList.remove('hidden'); }
    const ph = document.getElementById('mg-img-ph');
    if (ph) ph.classList.add('hidden');
  };
  r.readAsDataURL(f);
}

function fetchMsgLoc() {
  const el = document.getElementById('mg-loc');
  if (!navigator.geolocation) { showManualLocInput('msg'); return; }
  if (el) el.textContent = 'Fetching GPS…';
  navigator.geolocation.getCurrentPosition(
    p => {
      if (!hasReliableGps(p.coords)) {
        if (el) el.textContent = 'Precise GPS needed (turn off VPN/proxy)';
        showVpnUnlockWarning();
        return;
      }
      msgLatV = p.coords.latitude; msgLngV = p.coords.longitude;
      if (el) el.textContent = '📍 Getting place name…';
      reverseGeocode(msgLatV, msgLngV).then(name => {
        if (el) el.textContent = name;
        showToast('📍 ' + name);
      });
    },
    err => {
      console.warn('GPS blocked:', err.code);
      showManualLocInput('msg');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

async function saveMessage() {
  const txt = cleanText(document.getElementById('mg-txt').value, 500);
  if (!txt) { showToast('✏️ Write a message first'); return; }
  if (!msgLatV) { showToast('📍 Please fetch drop location first'); return; }
  const taggedPerson = cleanHandle((document.getElementById('mg-tagged').value || '').replace('@', ''));

  const msg = {
    id: 'msg_' + Date.now(),
    type: msgType,
    text: txt,
    taggedPerson: taggedPerson || null,
    category: document.getElementById('mg-cat').value,
    lat: msgLatV, lng: msgLngV,
    locationName: _geoCache[msgLatV.toFixed(3) + ',' + msgLngV.toFixed(3)] || null,
    radius: parseInt(document.getElementById('mg-rad').value),
    sender: user.name,
    senderAv: user.av,
    senderUid: user.uid || 'local',
    createdAt: new Date().toISOString(),
    locked: true,
    image: msgImgData
  };

  try {
    const remoteId = await dbSaveMessage(msg);
    if (remoteId) msg.id = remoteId;
    const msgs = getMsgs();
    msgs.unshift(msg);
    saveMsgs(msgs);
  } catch (err) {
    console.error('dbSaveMessage failed:', err);
    showToast('Cloud save failed. Message not saved: ' + errToText(err), 4200);
    return;
  }

  // Reset
  document.getElementById('mg-txt').value = '';
  document.getElementById('mg-tagged').value = '';
  msgImgData = null; msgLatV = null; msgLngV = null;
  const pi = document.getElementById('mg-img-prev');
  if (pi) pi.classList.add('hidden');
  const ph = document.getElementById('mg-img-ph');
  if (ph) ph.classList.remove('hidden');
  document.getElementById('mg-loc').textContent = 'Tap Fetch to use GPS';
  document.getElementById('mg-img').value = '';

  renderStats();
  showToast('✉ Message dropped at location!');
  setTimeout(() => goSec('inbox'), 900);
}

/* ════════════════════════════════════
   UNLOCK NEARBY
════════════════════════════════════ */
function haversine(la1, lo1, la2, lo2) {
  const R = 6371000;
  const dL = (la2 - la1) * Math.PI / 180;
  const dl = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dL/2)**2 + Math.cos(la1*Math.PI/180) * Math.cos(la2*Math.PI/180) * Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function doUnlock() {
  if (Date.now() < _unlockCooldownUntil) {
    const waitMs = _unlockCooldownUntil - Date.now();
    showToast('Please wait ' + Math.ceil(waitMs / 1000) + 's before next unlock check.');
    return;
  }
  const btn = document.querySelector('[onclick="doUnlock()"]');
  if (btn) { btn.textContent = '⏳ Checking…'; btn.disabled = true; }
  showToast('🔍 Checking nearby memories…');
  _unlockCooldownUntil = Date.now() + UNLOCK_COOLDOWN_MS;

  const go = async (lat, lng) => {
    const mems = getM();
    let n = 0;
    const toUnlock = [];
    mems.forEach(m => {
      if (m.locked && haversine(lat, lng, m.lat, m.lng) <= 100) {
        m.locked = false; n++;
        toUnlock.push(m.id);
        setTimeout(() => showUnlockModal(m), n * 700);
      }
    });
    saveM(mems); // update local immediately for UI
    if (toUnlock.length) await Promise.all(toUnlock.map(id => dbUnlockMemory(id)));
    renderStats();
    renderUnlockList();
    if (btn) { btn.textContent = 'Check Location & Unlock'; btn.disabled = false; }
    if (n === 0) showToast('📍 No locked memories within 100m. Visit the exact places!');
    else showToast('🔓 ' + n + ' memor' + (n===1?'y':'ies') + ' unlocked!');
  };

  if (!navigator.geolocation) {
    if (btn) { btn.textContent = 'Check Location & Unlock'; btn.disabled = false; }
    showToast('Precise GPS is required to unlock memories.', 3800);
  } else {
    navigator.geolocation.getCurrentPosition(
      p => {
        if (!hasReliableGps(p.coords)) {
          if (btn) { btn.textContent = 'Check Location & Unlock'; btn.disabled = false; }
          showVpnUnlockWarning();
          return;
        }
        go(p.coords.latitude, p.coords.longitude);
      },
      () => {
        if (btn) { btn.textContent = 'Check Location & Unlock'; btn.disabled = false; }
        showToast('Location permission denied. Enable GPS and try again.', 3800);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
}

function renderUnlockList() {
  const mems = getM();
  const list = document.getElementById('unlock-list');
  if (!list) return;
  if (!mems.length) { list.innerHTML = emptyState('🔒', 'Save some memories first, then return to those places.'); return; }
  list.innerHTML = mems.map(m => `
    <div class="mem-card" style="margin-bottom:.75rem" onclick="openDetail('${m.id}')">
      <div class="mem-img-wrap">
        ${m.image ? `<img class="mem-img filter-${m.filter||'original'}" src="${m.image}"/>` : `<div class="mem-emoji">${tagEmoji(m.tag)}</div>`}
        ${m.locked ? `<div class="lock-ov"><div class="li">🔒</div><span>Visit to unlock</span></div>` : ''}
      </div>
      <div class="mem-body">
        <div class="mem-cap">${m.caption}</div>
        <div class="mem-tags">
          <span class="mbadge ${m.locked?'locked-b':'unlocked-b'}">${m.locked?'🔒 Locked':'🔓 Unlocked'}</span>
          <span class="mbadge">📍 ${m.locationName || (m.lat.toFixed(3) + ', ' + m.lng.toFixed(3))}</span>
        </div>
      </div>
    </div>`).join('');
}

/* ════════════════════════════════════
   GALLERY
════════════════════════════════════ */
function filterGal(f, btn) {
  galFilter = f;
  document.querySelectorAll('.ftag[data-gf]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderGallery();
}

function renderGallery() {
  let mems = getM();
  if (galFilter === 'locked')   mems = mems.filter(m => m.locked);
  else if (galFilter === 'unlocked') mems = mems.filter(m => !m.locked);
  else if (galFilter === 'public')   mems = mems.filter(m => m.visibility === 'public');
  else if (galFilter === 'private')  mems = mems.filter(m => m.visibility === 'private');
  else if (galFilter === 'recent')   mems = [...mems].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6);

  const grid = document.getElementById('gal-grid');
  if (!grid) return;
  if (!mems.length) { grid.innerHTML = emptyState('📷', 'No memories here yet. Go create some!'); return; }

  grid.innerHTML = mems.map(m => `
    <div class="mem-card" onclick="openDetail('${m.id}')">
      <div class="mem-img-wrap">
        ${m.image ? `<img class="mem-img filter-${m.filter||'original'}" src="${m.image}"/>` : `<div class="mem-emoji">${tagEmoji(m.tag)}</div>`}
        ${m.locked ? `<div class="lock-ov"><div class="li">🔒</div><span>Visit to unlock</span></div>` : ''}
      </div>
      <div class="mem-body">
        <div class="mem-cap">${m.caption}</div>
        <div class="mem-tags">
          <span class="mbadge ${m.locked?'locked-b':'unlocked-b'}">${m.locked?'🔒':'🔓'}</span>
          <span class="mbadge ${m.visibility==='public'?'pub-b':''}">${m.visibility==='public'?'🌐':'👤'}</span>
          <span class="mbadge">${tagEmoji(m.tag)} ${m.tag}</span>
        </div>
        <div style="font-size:.67rem;color:var(--dim);margin-top:.35rem;font-family:'DM Mono',monospace">${fmtDate(m.createdAt)}</div>
      </div>
    </div>`).join('');
}

/* ════════════════════════════════════
   NEARBY
════════════════════════════════════ */
function filterNearby(t, btn) {
  nearbyFilter = t;
  document.querySelectorAll('.ftag[data-tg]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderNearby();
}

/* ─── NEARBY GPS STATE ─── */
let _nearbyLat = null, _nearbyLng = null;
let _nearbyIsReal = false;
const NEARBY_RADIUS_M = 5000; // show items within 5km

function renderNearby() {
  const grid = document.getElementById('nearby-grid');
  if (!grid) return;

  // Show loading while getting GPS
  grid.innerHTML = '<div class="empty-state"><div class="ei">📍</div><p>Getting your location…</p></div>';

  const build = (lat, lng, isReal) => {
    _nearbyLat = lat; _nearbyLng = lng;
    _nearbyIsReal = !!isReal;

    const mems = getM().filter(m => m.visibility === 'public');
    const msgs = getMsgs().filter(m => m.type !== 'tagged');
    let all = [
      ...mems.map(m => ({...m, _k:'memory'})),
      ...msgs.map(m => ({...m, _k:'message'}))
    ];

    // Calculate real distance for every item
    all = all.map(item => ({
      ...item,
      _dist: haversine(lat, lng, item.lat, item.lng)
    }));

    // Filter by interest tag
    if (nearbyFilter !== 'all') {
      all = all.filter(i => (i.tag || i.category) === nearbyFilter);
    }

    // Sort by real distance ascending
    all.sort((a, b) => a._dist - b._dist);

    if (!all.length) {
      grid.innerHTML = emptyState('◉', 'No drops match this interest.');
      return;
    }

    if (!isReal) {
      grid.insertAdjacentHTML('beforebegin',
        '<div class="gps-warn">📡 Using demo location — enable GPS for real distances</div>');
    }

    grid.innerHTML = all.map(item => {
      const dist  = item._dist;
      const distLabel = dist < 1000
        ? Math.round(dist) + 'm away'
        : (dist / 1000).toFixed(1) + 'km away';
      // Nearby = within 100m (can unlock), close = within 500m
      const isNearby  = dist <= 100;
      const isClose   = dist <= 500;
      const cat     = item.tag || item.category || 'unknown';
      const preview = item.caption || item.text || 'A hidden memory…';
      const sender  = item.creator || item.sender || 'unknown';
      const av      = item.creatorAv || item.senderAv || '🌐';
      const locName = item.locationName || (item.lat.toFixed(3) + ', ' + item.lng.toFixed(3));

      return `
        <div class="nb-card${isNearby?' nb-card-hot':''}" onclick="openDetail('${item.id}')">
          <div class="nb-top">
            <div class="nb-av">${av}</div>
            <div>
              <div class="nb-user">@${sender}</div>
              <div class="nb-dist${isNearby?' nb-dist-near':isClose?' nb-dist-close':''}">${distLabel}</div>
            </div>
            <span class="nb-tag">${tagEmoji(cat)} ${cat}</span>
          </div>
          <div class="nb-loc">📍 ${locName}</div>
          <div class="nb-preview${item.locked && !isNearby?' blurred':''}">${
            item.locked && !isNearby
              ? 'Walk closer to reveal this memory…'
              : (item.caption || item.text || 'A hidden memory…')
          }</div>
          <div class="nb-foot">
            <div class="nb-status">${
              isNearby && item.locked
                ? '🔓 You can unlock this now!'
                : item.locked
                  ? '🔒 Walk to ' + locName + ' to unlock'
                  : '🔓 Discovered'
            }</div>
            <div style="display:flex;gap:.4rem">
              ${isNearby && item.locked
                ? `<button class="nb-unlock nb-unlock-ready" onclick="event.stopPropagation();tryUnlockItem('${item.id}')">Unlock now 🔓</button>`
                : item.locked
                  ? `<button class="nb-unlock" onclick="event.stopPropagation();shareMemory('${item.id}','${sender}','${locName}')">Share 📤</button>`
                  : `<span style="font-size:.74rem;color:var(--teal)">❤️ ${item.likes||0}</span>`
              }
            </div>
          </div>
        </div>`;
    }).join('');
  };

  if (!navigator.geolocation) {
    build(18.5204, 73.8567, false);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    p => build(p.coords.latitude, p.coords.longitude, true),
    () => build(18.5204, 73.8567, false),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

/* Try to unlock a specific nearby item */
function tryUnlockItem(memId) {
  if (!_nearbyLat || !_nearbyIsReal) {
    showVpnUnlockWarning();
    return;
  }
  const mems = getM();
  const m = mems.find(x => x.id === memId);
  if (!m) return;
  const dist = haversine(_nearbyLat, _nearbyLng, m.lat, m.lng);
  if (dist <= 100) {
    m.locked = false;
    saveM(mems);
    dbUnlockMemory(memId).catch(() => {});
    renderStats();
    renderNearby();
    showUnlockModal(m);
  } else {
    showToast('📍 Move closer — you are ' + Math.round(dist) + 'm away (need 100m)');
  }
}

/* ════════════════════════════════════
   INBOX
════════════════════════════════════ */
function renderInbox() {
  const msgs = getMsgs();
  // Only show messages tagged to THIS user
  const mine = msgs.filter(m => String(m.taggedPerson || '').toLowerCase() === String(user.name || '').toLowerCase());
  const pub  = msgs.filter(m => !m.taggedPerson && m.type !== 'public');
  const all  = [...mine, ...pub];

  const list = document.getElementById('inbox-list');
  if (!list) return;
  if (!all.length) { list.innerHTML = emptyState('💌', 'No messages for you yet. Ask a friend to drop one at a place you both love!'); return; }

  list.innerHTML = all.map(msg => {
    const safeSender = esc(msg.sender || 'unknown');
    const safeText = esc(msg.text || 'A secret message is waiting for you…');
    const safeLoc = esc(msg.locationName || (msg.lat.toFixed(3) + ', ' + msg.lng.toFixed(3)));
    return `
      <div class="inbox-card ${msg.locked?'locked':'unlocked'}">
        <div class="inbox-top">
          <div class="inbox-av">${msg.senderAv || '👤'}</div>
          <div>
            <div class="inbox-from"><strong>@${safeSender}</strong> left something for you</div>
            <div style="font-size:.7rem;color:var(--dim);font-family:'DM Mono',monospace">${fmtDate(msg.createdAt)}</div>
          </div>
          <div class="inbox-lock">${msg.locked?'🔒':'🔓'}</div>
        </div>
        <div class="inbox-preview${msg.locked?' blurred':''}">${msg.locked?'A secret message is waiting for you…':safeText}</div>
        <div class="inbox-coords">
          <span>📍 ${safeLoc}</span>
          <span>🎯 ${msg.radius}m radius</span>
          <span>${tagEmoji(msg.category)} ${msg.category}</span>
        </div>
        ${msg.locked ? `<div style="margin-top:.75rem;display:flex;gap:.5rem;flex-wrap:wrap">
          <button class="btn-ghost" style="font-size:.8rem;padding:.45rem .9rem"
            onclick="showToast('📍 Visit the pinned location to unlock')">
            📍 Get Place Hint
          </button>
          <button class="btn-ghost" style="font-size:.8rem;padding:.45rem .9rem"
            onclick="inviteTaggedPerson('${msg.id}')">
            📤 Share Invite
          </button>
        </div>` : ''}
      </div>`;
  }).join('');
}

/* ════════════════════════════════════
   PLACES
════════════════════════════════════ */
function renderPlaces() {
  const mems = getM();
  const msgs = getMsgs();
  const pins = document.getElementById('map-pins');
  if (pins) pins.innerHTML = '';

  // Group by rounded coords
  const placeMap = {};
  mems.forEach(m => {
    const key = m.lat.toFixed(2) + ',' + m.lng.toFixed(2);
    if (!placeMap[key]) placeMap[key] = { lat:m.lat, lng:m.lng, memories:0, drops:0, tagged:0, label:'Memory location' };
    placeMap[key].memories++;
    if (m.visibility === 'public') placeMap[key].drops++;
  });
  msgs.forEach(m => {
    const key = m.lat.toFixed(2) + ',' + m.lng.toFixed(2);
    if (!placeMap[key]) placeMap[key] = { lat:m.lat, lng:m.lng, memories:0, drops:0, tagged:0, label:'Message drop' };
    if (m.taggedPerson === user.name) placeMap[key].tagged++;
    else placeMap[key].drops++;
  });

  const places = Object.values(placeMap);
  const listEl = document.getElementById('places-list');

  if (places.length === 0) {
    if (listEl) listEl.innerHTML = emptyState('📍', 'No places yet. Add a memory with GPS to see your locations here.');
    return;
  }

  // Scatter pins
  if (pins) {
    places.forEach((p, i) => {
      const top  = 15 + ((i * 31) % 60);
      const left = 10 + ((i * 23) % 72);
      const d = document.createElement('div');
      d.className = 'map-dot';
      d.style.top  = Math.min(top, 78) + '%';
      d.style.left = Math.min(left, 80) + '%';
      d.title = p.label;
      pins.appendChild(d);
    });
  }

  const icons = ['📍','🏠','☕','🌅','🍜','🎓','🎭','🌿','📸','🗺️','🌊','🔥'];

  // Geocode any places without a name, update display when resolved
  places.forEach(p => {
    if (!p.locationName) {
      reverseGeocode(p.lat, p.lng).then(name => {
        p.locationName = name;
        if (listEl) {
          const coordEl = listEl.querySelector(`[data-coords="${p.lat.toFixed(3)},${p.lng.toFixed(3)}"]`);
          if (coordEl) coordEl.textContent = name;
        }
      });
    }
  });

  if (listEl) {
    listEl.innerHTML = places.map((p, i) => `
      <div class="place-row">
        <div class="place-ico">${icons[i % icons.length]}</div>
        <div>
          <div class="place-name">${p.label}</div>
          <div class="place-coords" data-coords="${p.lat.toFixed(3)},${p.lng.toFixed(3)}">${p.locationName || (p.lat.toFixed(3) + ', ' + p.lng.toFixed(3))}</div>
        </div>
        <div class="place-stats">
          <div class="pstat"><strong>${p.memories}</strong>Memories</div>
          <div class="pstat"><strong>${p.drops}</strong>Drops</div>
          <div class="pstat"><strong>${p.tagged}</strong>Tagged</div>
        </div>
      </div>`).join('');
  }
}

/* ════════════════════════════════════
   MEMORY DETAIL MODAL
════════════════════════════════════ */
function openDetail(id) {
  const mems = getM();
  const msgs = getMsgs();
  const item = mems.find(m => m.id === id) || msgs.find(m => m.id === id);
  if (!item) return;
  curDetailId = id;

  const img = document.getElementById('dm-img');
  const ph  = document.getElementById('dm-placeholder');
  if (item.image) {
    img.src = item.image;
    img.className = 'modal-img filter-' + (item.filter || 'original');
    img.classList.remove('hidden');
    if (ph) ph.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    if (ph) { ph.classList.remove('hidden'); ph.textContent = tagEmoji(item.tag || item.category); }
  }

  const cap = document.getElementById('dm-cap');
  if (cap) cap.textContent = item.locked ? '🔒 Locked — return to this place to reveal.' : (item.caption || item.text || '');

  const meta = document.getElementById('dm-meta');
  if (meta) meta.innerHTML = `
    <span>📍 ${item.locationName || ((item.lat||0).toFixed(3) + ', ' + (item.lng||0).toFixed(3))}</span>
    <span>📅 ${fmtDate(item.createdAt)}</span>
    <span>${tagEmoji(item.tag||item.category)} ${item.tag||item.category||''}</span>`;

  const likes = document.getElementById('dm-likes');
  if (likes) likes.textContent = item.likes || 0;

  renderComments(item.comments || []);
  // Add share button to modal
  const existingShare = document.getElementById('detail-share-btn');
  if (existingShare) existingShare.remove();
  const shareBtn = document.createElement('button');
  shareBtn.id = 'detail-share-btn';
  shareBtn.className = 'btn-ghost';
  shareBtn.style.cssText = 'width:100%;margin-top:.5rem;font-size:.85rem';
  shareBtn.textContent = '📤 Share this memory';
  const locName = item.locationName || (item.lat.toFixed(3) + ', ' + item.lng.toFixed(3));
  shareBtn.onclick = () => shareMemory(id, item.creator || item.sender || user.name, locName);
  document.querySelector('#modal-detail .modal-card').appendChild(shareBtn);

  document.getElementById('modal-detail').classList.remove('hidden');
}


function openChatFromDetail() {
  if (!curDetailId) return;
  const mems = getM(); const msgs = getMsgs();
  const item = mems.find(m => m.id === curDetailId) || msgs.find(m => m.id === curDetailId);
  if (!item) return;
  const withName = item.creator || item.sender || 'User';
  const withAv   = item.creatorAv || item.senderAv || '✨';
  const withUid  = item.creatorUid || item.senderUid || 'unknown';
  closeModal('modal-detail');
  openChat(withUid, withName, withAv, curDetailId);
}

function renderComments(comments) {
  const el = document.getElementById('dm-comments');
  if (!el) return;
  if (!comments.length) {
    el.innerHTML = '<div style="font-size:.8rem;color:var(--dim);padding:.4rem 0">No comments yet. Be first!</div>';
    return;
  }
  el.innerHTML = comments.map(c =>
    `<div class="comment-item"><span class="comment-author">@${esc(c.author)}</span> ${esc(c.text)}</div>`
  ).join('');
}

async function likeIt() {
  if (!curDetailId) return;
  // Update locally immediately
  const mems = getM();
  const m = mems.find(x => x.id === curDetailId);
  if (!m) return;
  m.likes = (m.likes || 0) + 1;
  saveM(mems);
  const el = document.getElementById('dm-likes');
  if (el) el.textContent = m.likes;
  renderStats();
  showToast('❤️ Liked!');
  // Sync to Supabase silently
  dbLikeMemory(curDetailId).catch(e => console.warn('Like sync:', e));
}

function emojiReact(e) { showToast(e + ' Reaction added!'); }

async function postComment() {
  const inp = document.getElementById('comment-inp');
  if (!inp || !curDetailId) return;
  const txt = cleanText(inp.value, 300);
  if (!txt) return;
  // Save locally immediately
  const mems = getM();
  const m = mems.find(x => x.id === curDetailId);
  if (m) {
    m.comments = m.comments || [];
    m.comments.push({ author: user.name, authorUid: user.uid || 'local', text: txt, ts: Date.now() });
    saveM(mems);
    renderComments(m.comments);
  }
  inp.value = '';
  showToast('💬 Comment posted!');
  // Sync silently
  dbAddComment(curDetailId, txt, user.uid || 'local', user.name)
    .catch(e => console.warn('Comment sync:', e));
}

/* ════════════════════════════════════
   UNLOCK MODAL
════════════════════════════════════ */
function showUnlockModal(mem) {
  const img = document.getElementById('um-img');
  if (mem.image) {
    img.src = mem.image;
    img.className = 'modal-img filter-' + (mem.filter || 'original');
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
  }
  const cap = document.getElementById('um-cap');
  if (cap) cap.textContent = mem.caption || mem.text || '';
  const meta = document.getElementById('um-meta');
  if (meta) meta.innerHTML = `
    <span>👤 @${mem.creator || mem.sender || 'unknown'}</span>
    <span>📅 ${fmtDate(mem.createdAt)}</span>
    <span>${tagEmoji(mem.tag || mem.category)} ${mem.tag || mem.category || ''}</span>`;
  document.getElementById('modal-unlock').classList.remove('hidden');
}

/* ════════════════════════════════════
   FEEDBACK
════════════════════════════════════ */
function setRat(v) {
  fbRating = v;
  document.querySelectorAll('.rb').forEach(b =>
    b.classList.toggle('sel', parseInt(b.dataset.v) === v));
}

function setYN(v) {
  fbYN = v;
  ['yes','maybe','no'].forEach(k => {
    const el = document.getElementById('yn-' + k);
    if (el) el.classList.toggle('sel', k === v);
  });
}

async function submitFeedback() {
  if (!fbRating) { showToast('😊 Pick an excitement level first!'); return; }

  const features = [];
  document.querySelectorAll('.ck input:checked').forEach(cb => features.push(cb.value));

  const entry = {
    name:     (document.getElementById('fb-name').value    || '').trim() || 'Anonymous',
    rating:   fbRating,
    text:     (document.getElementById('fb-thoughts').value|| '').trim() || '(no additional comments)',
    source:    document.getElementById('fb-source').value  || 'unknown',
    yn:       fbYN || 'unknown',
    features,
    uid:      user.uid || null,
    ts:       Date.now()
  };

  try { await dbSaveFeedback(entry); }
  catch(e) { console.warn('Feedback save error:', e); }

  const fc = document.getElementById('fb-form-card');
  if (fc) fc.classList.add('hidden');
  const ft = document.getElementById('fb-thanks');
  if (ft) ft.classList.remove('hidden');
  renderFBPrev();
  showToast('🙏 Thank you for your feedback!');
}

function renderFBPrev() {
  const fbs  = getFB();
  const list = document.getElementById('fb-prev-list');
  if (!list) return;
  if (!fbs.length) { list.innerHTML = ''; return; }

  const stars = ['😐','🙂','😊','🤩','🔥'];
  list.innerHTML = fbs.slice(0, 8).map(f => `
    <div class="fb-resp-card">
      <div class="fb-resp-top">
        <div class="fb-resp-name">${f.name}</div>
        <div class="fb-resp-rat">${stars[(f.rating||3) - 1] || '😊'}</div>
      </div>
      <div class="fb-resp-txt">${f.text}</div>
      <div class="fb-resp-src">via ${f.source} · ${f.yn==='yes'?'✅ Would use':f.yn==='maybe'?'🤔 Maybe':'❌ Not really'}</div>
    </div>`).join('');
}


/* ════════════════════════════════════
   SHARING — WhatsApp, Instagram, Contacts, Web Share
════════════════════════════════════ */

function shareMemory(memId, sender, locationName) {
  const mems = getM();
  const msgs = getMsgs();
  const item = mems.find(m => m.id === memId) || msgs.find(m => m.id === memId);

  const baseUrl = window.location.origin;
  const deepLink = `${baseUrl}?memory=${memId}`;
  const text = item
    ? `@${sender} left a hidden memory at "${locationName || 'a location near you'}". Visit the exact spot to unlock it on Echoes!`
    : `Someone left a hidden memory near you. Come find it on Echoes!`;
  const shareData = {
    title: 'Echoes — Unlock a hidden memory',
    text,
    url: deepLink
  };

  showShareModal(shareData, deepLink);
}

function shareTaggedMessage(sender, locName, deepLink) {
  const text = `@${sender} left a secret message for you at "${locName}". You need to physically visit that place to unlock it 🔒`;
  showShareModal({ title: 'You have a secret message', text, url: deepLink }, deepLink);
}

function showShareModal(data, url) {
  // Use native Web Share API on mobile
  if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
    navigator.share(data).catch(() => {});
    return;
  }

  // Desktop / fallback — show share sheet modal
  const existing = document.getElementById('share-modal');
  if (existing) existing.remove();

  const waText  = encodeURIComponent(data.text + '\n' + url);
  const igText  = encodeURIComponent(data.text);
  const twText  = encodeURIComponent(data.text + ' ' + url);
  const mailSub = encodeURIComponent(data.title);
  const mailBod = encodeURIComponent(data.text + '\n\n' + url);

  const modal = document.createElement('div');
  modal.id = 'share-modal';
  modal.className = 'modal-ov';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:360px">
      <button class="modal-x" onclick="document.getElementById('share-modal').remove()">✕</button>
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;margin-bottom:.4rem">Share this memory</h3>
      <p style="font-size:.83rem;color:var(--muted);margin-bottom:1.5rem">${data.text}</p>
      <div class="share-grid">
        <a class="share-btn share-wa" href="https://wa.me/?text=${waText}" target="_blank">
          <span class="share-icon">💬</span><span>WhatsApp</span>
        </a>
        <a class="share-btn share-tw" href="https://twitter.com/intent/tweet?text=${twText}" target="_blank">
          <span class="share-icon">𝕏</span><span>Twitter/X</span>
        </a>
        <a class="share-btn share-tg" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(data.text)}" target="_blank">
          <span class="share-icon">✈</span><span>Telegram</span>
        </a>
        <a class="share-btn share-mail" href="mailto:?subject=${mailSub}&body=${mailBod}">
          <span class="share-icon">✉</span><span>Email</span>
        </a>
        <button class="share-btn share-copy" onclick="copyLink('${url}')">
          <span class="share-icon">🔗</span><span>Copy link</span>
        </button>
        <a class="share-btn share-ig" href="https://www.instagram.com/" target="_blank"
           onclick="copyLink('${url}');showToast('Link copied — paste in Instagram bio or DM!')">
          <span class="share-icon">📸</span><span>Instagram</span>
        </a>
      </div>
      <div class="share-link-box">
        <input type="text" value="${url}" id="share-link-input" readonly
          style="font-family:'DM Mono',monospace;font-size:.75rem"/>
        <button onclick="copyLink('${url}')">Copy</button>
      </div>
      <p style="font-size:.75rem;color:var(--dim);margin-top:1rem;text-align:center">
        They must visit the exact location to unlock 🔒
      </p>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('🔗 Link copied to clipboard!');
  }).catch(() => {
    const el = document.getElementById('share-link-input');
    if (el) { el.select(); document.execCommand('copy'); }
    showToast('🔗 Link copied!');
  });
}

/* ════════════════════════════════════
   DEEP LINK HANDLER
   If URL has ?memory=ID open that memory on load
════════════════════════════════════ */
function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const memId  = params.get('memory');
  const msgId  = params.get('message');
  const invite = params.get('invite'); // tagged message invite

  if (memId) {
    // Wait for app to load then open the memory
    setTimeout(() => {
      goSec('nearby');
      openDetail(memId);
    }, 600);
  }
  if (invite) {
    // Someone was tagged — show them the locked message with location hint
    setTimeout(() => {
      goSec('inbox');
      showToast('📍 Someone left a message for you — visit the location to unlock it!');
    }, 600);
  }
}

/* ════════════════════════════════════
   TAGGED PERSON INVITE (no account needed)
   Generate a link they can click to join and see their message
════════════════════════════════════ */
function inviteTaggedPerson(msgId, taggedName, locationName) {
  if (!taggedName || !locationName) {
    const msg = getMsgs().find(m => m.id === msgId);
    if (msg) {
      taggedName = taggedName || msg.taggedPerson || 'friend';
      locationName = locationName || msg.locationName || (msg.lat.toFixed(3) + ', ' + msg.lng.toFixed(3));
    }
  }
  taggedName = cleanText(taggedName || 'friend', 40);
  locationName = cleanText(locationName || 'this location', 120);
  const url  = `${window.location.origin}?invite=${msgId}`;
  const text = `Hey ${taggedName}! I left a hidden message for you at "${locationName}". You need to physically visit that exact place to unlock it. Join Echoes to see it 🔒`;
  showShareModal({ title: 'You have a secret message waiting', text, url }, url);
}

/* ════════════════════════════════════
   MODALS
════════════════════════════════════ */
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  curDetailId = null;
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-ov')) {
    e.target.classList.add('hidden');
    curDetailId = null;
  }
});

/* ════════════════════════════════════
   TOAST
════════════════════════════════════ */
function showToast(msg, dur = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), dur);
}

function errToText(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.details && err.hint) return err.details + ' | ' + err.hint;
  if (err.details) return err.details;
  try { return JSON.stringify(err); }
  catch { return 'Unexpected error'; }
}

async function syncCloudData() {
  if (typeof SUPABASE_ENABLED === 'undefined' || !SUPABASE_ENABLED) return;
  if (typeof dbGetPublicMemories !== 'function' || typeof dbGetPublicMessages !== 'function') return;

  try {
    const uid = (typeof getSessionUid === 'function' ? await getSessionUid() : null) || user.uid || null;

    const [publicMems, publicMsgs, myMems, myMsgs] = await Promise.all([
      dbGetPublicMemories(null, 120),
      dbGetPublicMessages(120),
      uid ? dbGetMyMemories(uid) : Promise.resolve([]),
      uid ? dbGetMessagesForUser(uid) : Promise.resolve([])
    ]);

    const mergedMemsMap = new Map();
    // In cloud mode, keep only cloud IDs to avoid mixing demo/local rows.
    const existingCloudMems = getM().filter(m => isCloudId(m?.id));
    [...existingCloudMems, ...publicMems, ...myMems].forEach(m => { if (m?.id) mergedMemsMap.set(m.id, m); });
    saveM(Array.from(mergedMemsMap.values()));

    const mergedMsgsMap = new Map();
    const existingCloudMsgs = getMsgs().filter(m => isCloudId(m?.id));
    [...existingCloudMsgs, ...publicMsgs, ...myMsgs].forEach(m => { if (m?.id) mergedMsgsMap.set(m.id, m); });
    saveMsgs(Array.from(mergedMsgsMap.values()));

    renderStats();
    renderTeasers();

    const active = document.querySelector('.s.active')?.id || '';
    if (active === 's-gallery') renderGallery();
    if (active === 's-nearby') renderNearby();
    if (active === 's-inbox') renderInbox();
    if (active === 's-places') renderPlaces();
    if (active === 's-unlock') renderUnlockList();
  } catch (err) {
    console.warn('Cloud sync failed:', errToText(err));
  }
}

function isCloudId(id) {
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/* ════════════════════════════════════
   HELPERS
════════════════════════════════════ */
function tagEmoji(t) {
  const map = { nostalgia:'🕰️', food:'🍜', travel:'✈️', photography:'📸', friendship:'👥', hidden:'📝' };
  return map[t] || '✨';
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  } catch { return '—'; }
}

function emptyState(icon, msg) {
  return `<div class="empty-state"><div class="ei">${icon}</div><p>${msg}</p></div>`;
}

/* ════════════════════════════════════
   DIRECT MESSAGES / CHAT
   Instagram-style DM between users
   Each conversation = memoryId or userId pair
════════════════════════════════════ */

let _activeChatId   = null;
let _chatUnsub      = null;

function openChat(withUid, withName, withAv, contextMemId) {
  _activeChatId = [user.uid || 'local', withUid].sort().join('_');

  // Show chat modal
  const existing = document.getElementById('chat-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'chat-modal';
  modal.className = 'modal-ov';
  modal.innerHTML = `
    <div class="modal-card chat-modal-card" style="max-width:480px;padding:0;display:flex;flex-direction:column;height:80vh;text-align:left">
      <div class="chat-header">
        <button class="modal-x" style="position:static;margin-right:.5rem" onclick="closeChat()">←</button>
        <span class="chat-av">${withAv}</span>
        <div><div class="chat-name">${withName}</div>
          ${contextMemId ? `<div class="chat-context">📍 Re: a memory drop</div>` : ''}
        </div>
        ${contextMemId ? `<button class="chat-locate" onclick="showToast('Visit the memory location to unlock it!')">📍</button>` : ''}
      </div>
      <div class="chat-messages" id="chat-messages">
        <div style="text-align:center;padding:2rem;font-size:.82rem;color:var(--dim)">
          Start a conversation about this memory drop.<br>They must visit the location to unlock it 🔒
        </div>
      </div>
      <div class="chat-input-row">
        <input type="text" id="chat-input" placeholder="Message ${withName}…"
          onkeydown="if(event.key==='Enter')sendChatMsg('${withUid}','${withName}','${withAv}')"/>
        <button onclick="sendChatMsg('${withUid}','${withName}','${withAv}')">Send</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) closeChat(); });
  document.body.appendChild(modal);

  loadChatMessages(_activeChatId);
}

function closeChat() {
  if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
  const m = document.getElementById('chat-modal');
  if (m) m.remove();
  _activeChatId = null;
}

function loadChatMessages(chatId) {
  const msgs = _lgetChat(chatId);
  renderChatMessages(msgs);
}

function renderChatMessages(msgs) {
  const el = document.getElementById('chat-messages');
  if (!el || !msgs.length) return;
  el.innerHTML = msgs.map(m => `
    <div class="chat-msg ${m.senderUid === (user.uid || 'local') ? 'chat-msg-me' : 'chat-msg-them'}">
      <div class="chat-bubble">${m.text}</div>
      <div class="chat-time">${fmtTime(m.ts)}</div>
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function sendChatMsg(toUid, toName, toAv) {
  const inp = document.getElementById('chat-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text || !_activeChatId) return;

  const msg = {
    id:        'cm_' + Date.now(),
    chatId:    _activeChatId,
    senderUid: user.uid || 'local',
    senderName:user.name,
    toUid,
    text,
    ts:        Date.now()
  };

  // Store in localStorage (Supabase chat table when enabled)
  const existing = _lgetChat(_activeChatId);
  existing.push(msg);
  localStorage.setItem('e_chat_' + _activeChatId, JSON.stringify(existing));

  inp.value = '';
  renderChatMessages(existing);

  // TODO: when Supabase enabled, save to 'direct_messages' table
  // and use real-time subscription for live updates
}

function _lgetChat(chatId) {
  try { return JSON.parse(localStorage.getItem('e_chat_' + chatId) || '[]'); }
  catch { return []; }
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
