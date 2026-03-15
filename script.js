/* =========================================
   ECHOES — script.js
   All app logic: navigation, localStorage,
   geolocation, demo data, interactions
   ========================================= */

// =========================================
// STATE
// =========================================
let currentUser = { name: 'Explorer', avatar: '🌿' };
let currentScreen = 'dashboard';
let memoryLocation = null;
let msgLocation = null;
let selectedFilter = 'original';
let selectedVisibility = 'private';
let selectedMsgType = 'public';
let selectedRating = 0;
let selectedWouldUse = '';
let uploadedImageData = null;
let activeInterest = 'all';
let activeGalleryFilter = 'all';

// =========================================
// DEMO DATA — preloaded into localStorage
// =========================================
const DEMO_MEMORIES = [
  {
    id: 'demo-1',
    image: null,
    caption: 'First chai stop in Pune. That corner table, the smell of rain on hot concrete.',
    filter: 'vintage',
    date: '2024-11-12T08:30:00',
    lat: 18.5204,
    lng: 73.8567,
    locked: false,
    visibility: 'private',
    tag: 'nostalgia',
    creator: 'You',
    creatorAv: '🌿',
    likes: 0,
    comments: [],
    emoji: ''
  },
  {
    id: 'demo-2',
    image: null,
    caption: 'College campus throwback. This bench where we planned everything.',
    filter: 'warm',
    date: '2024-10-03T16:00:00',
    lat: 18.5314,
    lng: 73.8446,
    locked: true,
    visibility: 'private',
    tag: 'friendship',
    creator: 'You',
    creatorAv: '🌿',
    likes: 0,
    comments: [],
    emoji: ''
  },
  {
    id: 'demo-3',
    image: null,
    caption: 'Sunset from the rooftop. Pure golden hour. This light never comes back.',
    filter: 'cinematic',
    date: '2024-09-21T18:45:00',
    lat: 18.5200,
    lng: 73.8553,
    locked: false,
    visibility: 'public',
    tag: 'photography',
    creator: 'You',
    creatorAv: '🌿',
    likes: 14,
    comments: ['🔥 this is stunning', 'which rooftop??'],
    emoji: ''
  }
];

const DEMO_DROPS = [
  {
    id: 'drop-1',
    type: 'public',
    taggedTo: '',
    text: 'Food lovers unlock this near the restaurant! Best misal pav you',
    tag: 'food',
    radius: 100,
    date: '2025-01-05T12:00:00',
    lat: 18.5210,
    lng: 73.8560,
    locked: true,
    creator: 'Sai',
    creatorAv: '🔥',
    distance: '120m',
    likes: 8,
    comments: ['omg I need to find this', 'been searching for a year'],
    emoji: ''
  },
  {
    id: 'drop-2',
    type: 'private',
    taggedTo: 'Arun',
    text: 'Message for Arun at this café. Remember what we talked about? You',
    tag: 'friendship',
    radius: 100,
    date: '2025-01-08T09:30:00',
    lat: 18.5225,
    lng: 73.8570,
    locked: true,
    creator: 'Ajay',
    creatorAv: '🌊',
    distance: '250m',
    likes: 2,
    comments: [],
    emoji: ''
  },
  {
    id: 'drop-3',
    type: 'interest',
    taggedTo: '',
    text: 'Hidden sunset pic for photography lovers only. If you find this, you earned it.',
    tag: 'photography',
    radius: 50,
    date: '2025-01-10T17:00:00',
    lat: 18.5190,
    lng: 73.8545,
    locked: false,
    creator: 'Ravi',
    creatorAv: '📸',
    distance: '80m',
    likes: 21,
    comments: ['the framing!', 'saved this forever', 'how did you find this angle'],
    emoji: ''
  },
  {
    id: 'drop-4',
    type: 'public',
    taggedTo: '',
    text: 'MG Road summer nights. Best gola stall. Walk 40 steps north of the big tree.',
    tag: 'nostalgia',
    radius: 150,
    date: '2025-01-12T20:00:00',
    lat: 18.5230,
    lng: 73.8540,
    locked: true,
    creator: 'venkat',
    creatorAv: '⚡',
    distance: '340m',
    likes: 5,
    comments: [],
    emoji: ''
  }
];

const DEMO_PLACES = [
  { name: 'Pune Café Lane', coords: '18.5204°N, 73.8567°E', memories: 2, publicDrops: 1, tagged: 0, unlocked: true },
  { name: 'MG Road', coords: '18.5230°N, 73.8540°E', memories: 1, publicDrops: 2, tagged: 0, unlocked: false },
  { name: 'College Campus', coords: '18.5314°N, 73.8446°E', memories: 1, publicDrops: 0, tagged: 1, unlocked: false },
  { name: 'Rooftop Skybar', coords: '18.5200°N, 73.8553°E', memories: 1, publicDrops: 1, tagged: 0, unlocked: true },
];

// =========================================
// STORAGE HELPERS
// =========================================
const DEMO_VERSION = "v1";

function initDemoData() {
  const storedVersion = localStorage.getItem('echoes_seeded');

  if (storedVersion !== DEMO_VERSION) {
    saveMemories(DEMO_MEMORIES);
    saveDrops(DEMO_DROPS);
    localStorage.setItem('echoes_seeded', DEMO_VERSION);
  }
}
function saveMemories(arr) {
  localStorage.setItem('echoes_memories', JSON.stringify(arr));
}
function getDrops() {
  const raw = localStorage.getItem('echoes_drops');
  return raw ? JSON.parse(raw) : [];
}
function saveDrops(arr) {
  localStorage.setItem('echoes_drops', JSON.stringify(arr));
}
function getFeedback() {
  const raw = localStorage.getItem('echoes_feedback');
  return raw ? JSON.parse(raw) : [];
}
function saveFeedback(arr) {
  localStorage.setItem('echoes_feedback', JSON.stringify(arr));
}

initDemoData();

// =========================================
// TOAST SYSTEM
// =========================================
function showToast(msg, type = 'info', duration = 3200) {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    t.style.transition = '0.3s ease';
    setTimeout(() => t.remove(), 320);
  }, duration);
}

// =========================================
// NAVIGATION
// =========================================
function navigateTo(screen) {
  // Hide all app screens
  document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screen}`);
  if (target) target.classList.add('active');

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.screen === screen);
  });

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobile-nav-overlay').classList.add('hidden');

  currentScreen = screen;

  // Render the screen
  switch(screen) {
    case 'dashboard': renderDashboard(); break;
    case 'gallery': renderGallery(); break;
    case 'tagged': renderTagged(); break;
    case 'unlock': renderUnlock(); break;
    case 'nearby': renderNearby(); break;
    case 'places': renderPlaces(); break;
    case 'feedback': renderFeedback(); break;
  }
}

// =========================================
// ENTRY / LOGIN
// =========================================
document.querySelectorAll('.avatar-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.avatar-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
  });
});

document.getElementById('btn-enter-demo').addEventListener('click', () => {
  const name = document.getElementById('entry-username').value.trim() || 'Explorer';
  const avatar = document.querySelector('.avatar-opt.selected')?.dataset.av || '🌿';
  currentUser = { name, avatar };

  // Save user
  localStorage.setItem('echoes_user', JSON.stringify(currentUser));

  // Update UI
  document.getElementById('nav-username').textContent = name;
  document.getElementById('nav-avatar').textContent = avatar;
  document.getElementById('dash-username').textContent = name;
  document.getElementById('dash-avatar').textContent = avatar;

  // Switch screens
  document.getElementById('screen-entry').classList.remove('active');
  document.getElementById('app-shell').classList.remove('hidden');

  renderDashboard();
  showToast(`Welcome to Echoes, ${name}! 🌿`, 'success');
});

document.getElementById('btn-logout').addEventListener('click', () => {
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('screen-entry').classList.add('active');
  showToast('See you next time!', 'info');
});

// =========================================
// NAV LINKS & CTA GRID
// =========================================
document.querySelectorAll('.nav-link[data-screen]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(link.dataset.screen);
  });
});

document.querySelectorAll('.cta-card[data-screen]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
});

// Mobile menu
document.getElementById('mobile-menu-btn').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-nav-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('hidden', !sidebar.classList.contains('open'));
});
document.getElementById('mobile-nav-overlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobile-nav-overlay').classList.add('hidden');
});

// =========================================
// DASHBOARD
// =========================================
function renderDashboard() {
  const memories = getMemories();
  const unlocked = memories.filter(m => !m.locked);
  document.getElementById('stat-saved').textContent = memories.length;
  document.getElementById('stat-unlocked').textContent = unlocked.length;
}

// =========================================
// ADD MEMORY
// =========================================
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const uploadPreview = document.getElementById('upload-preview');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const filterRow = document.getElementById('filter-row');

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = 'var(--accent)';
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.style.borderColor = '';
});
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) processImageFile(file);
  uploadZone.style.borderColor = '';
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processImageFile(file);
});

function processImageFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image too large. Max 5MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImageData = e.target.result;
    uploadPreview.src = uploadedImageData;
    uploadPreview.className = `filter-${selectedFilter}`;
    uploadPreview.classList.remove('hidden');
    uploadPlaceholder.classList.add('hidden');
    filterRow.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

// Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedFilter = btn.dataset.filter;
    if (uploadPreview.src) {
      uploadPreview.className = `filter-${selectedFilter}`;
    }
  });
});

// Visibility toggle
document.querySelectorAll('[data-vis]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-vis]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedVisibility = btn.dataset.vis;
  });
});

// Fetch location for memory
let memLocLoading = false;
document.getElementById('btn-fetch-location').addEventListener('click', () => {
  if (memLocLoading) return;
  memLocLoading = true;
  const el = document.getElementById('location-text');
  el.textContent = '📍 Fetching location...';
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        memoryLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        el.textContent = `📍 ${memoryLocation.lat.toFixed(4)}, ${memoryLocation.lng.toFixed(4)}`;
        memLocLoading = false;
        showToast('Location captured!', 'success');
      },
      () => {
        memoryLocation = { lat: 18.5204, lng: 73.8567 }; // fallback: Pune
        el.textContent = `📍 18.5204, 73.8567 (demo location)`;
        memLocLoading = false;
        showToast('Using demo location (permission denied)', 'info');
      },
      { timeout: 8000 }
    );
  } else {
    memoryLocation = { lat: 18.5204, lng: 73.8567 };
    el.textContent = `📍 18.5204, 73.8567 (demo location)`;
    memLocLoading = false;
  }
});

document.getElementById('btn-save-memory').addEventListener('click', () => {
  const caption = document.getElementById('memory-caption').value.trim();
  if (!caption) { showToast('Add a caption for your memory.', 'error'); return; }
  if (!memoryLocation) { showToast('Please fetch your location first.', 'error'); return; }

  const memory = {
    id: 'mem-' + Date.now(),
    image: uploadedImageData,
    caption,
    filter: selectedFilter,
    date: new Date().toISOString(),
    lat: memoryLocation.lat,
    lng: memoryLocation.lng,
    locked: true,
    visibility: selectedVisibility,
    tag: document.getElementById('memory-tag').value,
    creator: currentUser.name,
    creatorAv: currentUser.avatar,
    likes: 0,
    comments: [],
    emoji: ''
  };

  const memories = getMemories();
  memories.unshift(memory);
  saveMemories(memories);

  // Reset form
  document.getElementById('memory-caption').value = '';
  uploadedImageData = null;
  uploadPreview.classList.add('hidden');
  uploadPlaceholder.classList.remove('hidden');
  uploadPreview.src = '';
  filterRow.classList.add('hidden');
  memoryLocation = null;
  document.getElementById('location-text').textContent = '📍 Not fetched yet';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-filter="original"]').classList.add('active');
  fileInput.value = '';

  showToast('Memory saved & locked! 🔒 Revisit this place to unlock.', 'success');
  renderDashboard();
});

// =========================================
// LEAVE MESSAGE
// =========================================
document.querySelectorAll('[data-msg-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-msg-type]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMsgType = btn.dataset.msgType;
    const tpg = document.getElementById('tagged-person-group');
    tpg.classList.toggle('hidden', selectedMsgType !== 'private');
  });
});

let msgLocLoading = false;
document.getElementById('btn-fetch-msg-location').addEventListener('click', () => {
  if (msgLocLoading) return;
  msgLocLoading = true;
  const el = document.getElementById('msg-location-text');
  el.textContent = '📍 Fetching...';
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        msgLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        el.textContent = `📍 ${msgLocation.lat.toFixed(4)}, ${msgLocation.lng.toFixed(4)}`;
        msgLocLoading = false;
        showToast('Location captured!', 'success');
      },
      () => {
        msgLocation = { lat: 18.5220, lng: 73.8570 };
        el.textContent = `📍 18.5220, 73.8570 (demo location)`;
        msgLocLoading = false;
        showToast('Using demo location', 'info');
      }, { timeout: 8000 }
    );
  } else {
    msgLocation = { lat: 18.5220, lng: 73.8570 };
    el.textContent = `📍 18.5220, 73.8570 (demo location)`;
    msgLocLoading = false;
  }
});

document.getElementById('btn-save-message').addEventListener('click', () => {
  const text = document.getElementById('msg-text').value.trim();
  if (!text) { showToast('Write a message first.', 'error'); return; }
  if (!msgLocation) { showToast('Fetch your location first.', 'error'); return; }

  const taggedTo = selectedMsgType === 'private'
    ? document.getElementById('msg-tagged-person').value.trim()
    : '';

  const drop = {
    id: 'drop-' + Date.now(),
    type: selectedMsgType,
    taggedTo,
    text,
    tag: document.getElementById('msg-tag').value,
    radius: parseInt(document.getElementById('msg-radius').value),
    date: new Date().toISOString(),
    lat: msgLocation.lat,
    lng: msgLocation.lng,
    locked: true,
    creator: currentUser.name,
    creatorAv: currentUser.avatar,
    distance: 'just dropped',
    likes: 0,
    comments: [],
    emoji: ''
  };

  const drops = getDrops();
  drops.unshift(drop);
  saveDrops(drops);

  document.getElementById('msg-text').value = '';
  document.getElementById('msg-tagged-person').value = '';
  msgLocation = null;
  document.getElementById('msg-location-text').textContent = '📍 Not fetched yet';

  showToast('Message hidden at this location! 💌', 'success');
  if (taggedTo) {
    showToast(`${taggedTo} will see a teaser when they're nearby.`, 'info', 4000);
  }
});

// =========================================
// TAGGED FOR ME
// =========================================
function renderTagged() {
  const drops = getDrops();
  // Show drops tagged to current user name OR demo drops tagged to Arun if user is Arun
  const tagged = drops.filter(d =>
    d.type === 'private' && (
      d.taggedTo.toLowerCase() === currentUser.name.toLowerCase() ||
      d.taggedTo === 'Arun'
    )
  );

  const list = document.getElementById('tagged-list');
  if (tagged.length === 0) {
    list.innerHTML = `<div class="empty-state"><span>🔔</span><p>No messages tagged for you yet.<br/>Ask a friend to leave you something special.</p></div>`;
    return;
  }
  list.innerHTML = '';
  tagged.forEach(drop => {
    const el = buildTaggedCard(drop);
    list.appendChild(el);
  });
}

function buildTaggedCard(drop) {
  const card = document.createElement('div');
  card.className = 'memory-card';
  const locked = drop.locked;

  card.innerHTML = `
    <div class="memory-card-header">
      <div class="memory-card-sender">
        <span class="av">${drop.creatorAv}</span>
        <strong>${drop.creator}</strong>
        <span>left you a ${drop.tag} message</span>
      </div>
      <span class="memory-tag-badge">${tagEmoji(drop.tag)} ${drop.tag}</span>
    </div>
    ${locked ? `
      <div class="lock-overlay" style="position:relative;padding:24px;display:flex;flex-direction:column;align-items:center;gap:8px;background:rgba(200,169,110,0.06);border:1px solid rgba(200,169,110,0.2);border-radius:12px;margin:8px 0;">
        <span>🔒</span>
        <strong>A message is waiting for you</strong>
        <p style="text-align:center;color:var(--text-muted);font-size:0.82rem;">From <strong>${drop.creator}</strong> · Near <strong>${drop.lat.toFixed(3)}, ${drop.lng.toFixed(3)}</strong></p>
        <p style="color:var(--text-dim);font-size:0.78rem;">Visit this place to unlock the message.</p>
      </div>
    ` : `
      <div style="background:rgba(111,235,181,0.07);border:1px solid rgba(111,235,181,0.2);border-radius:12px;padding:16px;margin:8px 0;">
        <p>${drop.text}</p>
      </div>
    `}
    <div class="memory-card-meta">
      <span>📍 ${drop.lat.toFixed(3)}, ${drop.lng.toFixed(3)}</span>
      <span>🕐 ${fmtDate(drop.date)}</span>
      <span>Unlock radius: ${drop.radius}m</span>
    </div>
  `;
  return card;
}

// =========================================
// UNLOCK NEARBY
// =========================================
function renderUnlock() {
  const memories = getMemories();
  const list = document.getElementById('unlock-list');
  if (memories.length === 0) {
    list.innerHTML = `<div class="empty-state"><span>🔓</span><p>No memories yet. Add one first!</p></div>`;
    return;
  }
  list.innerHTML = '';
  memories.forEach(m => {
    const card = buildUnlockCard(m);
    list.appendChild(card);
  });
}

function buildUnlockCard(m) {
  const card = document.createElement('div');
  card.className = 'memory-card';
  const preview = m.image
    ? `<img src="${m.image}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:10px;filter:${cssFilter(m.filter)}" />`
    : `<div style="height:60px;display:flex;align-items:center;justify-content:center;font-size:36px;opacity:0.3;margin-bottom:10px;">${tagEmoji(m.tag)}</div>`;

  card.innerHTML = `
    ${preview}
    <div class="memory-card-header">
      <span class="memory-card-title">${m.caption}</span>
      <span class="${m.locked ? 'lock-badge lock-badge-locked' : 'lock-badge lock-badge-unlocked'}">${m.locked ? '🔒 Locked' : '🔓 Unlocked'}</span>
    </div>
    <div class="memory-card-meta">
      <span>${tagEmoji(m.tag)} ${m.tag}</span>
      <span>📍 ${m.lat.toFixed(3)}, ${m.lng.toFixed(3)}</span>
      <span>🕐 ${fmtDate(m.date)}</span>
    </div>
    ${!m.locked ? `<p style="font-size:0.8rem;color:var(--accent4);margin-top:8px;">✓ This memory is already unlocked.</p>` : ''}
  `;
  return card;
}

document.getElementById('btn-do-unlock').addEventListener('click', () => {
  const btn = document.getElementById('btn-do-unlock');
  btn.textContent = '📍 Checking location...';
  btn.disabled = true;

  const doCheck = (userLat, userLng) => {
    const memories = getMemories();
    let unlockCount = 0;
    const updated = memories.map(m => {
      if (!m.locked) return m;
      const dist = haversine(userLat, userLng, m.lat, m.lng);
      if (dist <= 100) {
        unlockCount++;
        showUnlockModal(m);
        return { ...m, locked: false };
      }
      return m;
    });
    saveMemories(updated);

    btn.textContent = 'Check My Location & Unlock';
    btn.disabled = false;

    if (unlockCount === 0) {
      showToast('No memories within 100m. Move closer to saved locations.', 'info');
    } else {
      showToast(`${unlockCount} memory unlocked! 🔓`, 'success');
    }
    renderUnlock();
    renderDashboard();
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => doCheck(pos.coords.latitude, pos.coords.longitude),
      () => {
        // For demo: simulate being near demo-3 (unlocked) and demo-1
        showToast('Using demo location for unlock simulation.', 'info');
        doCheck(18.5200, 73.8553); // near demo-3
      },
      { timeout: 8000 }
    );
  } else {
    doCheck(18.5200, 73.8553);
  }
});

// =========================================
// NEARBY DISCOVERIES
// =========================================
function renderNearby() {
  const drops = getDrops();
  const list = document.getElementById('nearby-list');

  const publicDrops = drops.filter(d => d.type !== 'private' || d.taggedTo === '');
  const filtered = activeInterest === 'all'
    ? publicDrops
    : publicDrops.filter(d => d.tag === activeInterest);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><span>🌍</span><p>No drops in this category yet.</p></div>`;
    return;
  }
  list.innerHTML = '';
  filtered.forEach(d => list.appendChild(buildNearbyCard(d)));
}

function buildNearbyCard(drop) {
  const card = document.createElement('div');
  card.className = 'memory-card';
  const isLocked = drop.locked;

  card.innerHTML = `
    <div class="memory-card-header">
      <div class="memory-card-sender">
        <span class="av">${drop.creatorAv}</span>
        <strong>${drop.creator}</strong>
      </div>
      <span class="memory-tag-badge">${tagEmoji(drop.tag)} ${drop.tag}</span>
    </div>
    <div class="memory-card-meta">
      <span>📏 ${drop.distance || 'nearby'}</span>
      <span>🕐 ${fmtDate(drop.date)}</span>
      <span>${isLocked ? '🔒 Locked' : '🔓 Unlocked'}</span>
    </div>
    ${isLocked
      ? `<div style="margin:12px 0;padding:14px;background:rgba(255,255,255,0.03);border:1px solid var(--card-border);border-radius:10px;font-size:0.88rem;color:var(--text-muted);line-height:1.5;">
          <strong style="display:block;margin-bottom:4px;color:var(--text);">Someone left a ${drop.tag} memory here</strong>
          Get within ${drop.radius}m to unlock this drop.
        </div>`
      : `<div style="margin:12px 0;padding:14px;background:rgba(111,235,181,0.05);border:1px solid rgba(111,235,181,0.2);border-radius:10px;font-size:0.88rem;line-height:1.5;">
          ${drop.text}
        </div>`
    }
    <div class="interact-row">
      <button class="interact-btn like-btn" data-id="${drop.id}" data-type="drop">❤️ ${drop.likes || 0}</button>
      <button class="interact-btn" onclick="toggleComments(this, '${drop.id}', 'drop')">💬 ${drop.comments?.length || 0}</button>
      <button class="interact-btn">↗ Share</button>
    </div>
    <div class="comments-section hidden" id="comments-${drop.id}">
      ${(drop.comments || []).map(c => `<div class="comment-item">· ${c}</div>`).join('')}
      <div class="comment-input-row">
        <input type="text" placeholder="Leave a thought..." data-id="${drop.id}" data-type="drop" />
        <button onclick="postComment(this.previousElementSibling)">→</button>
      </div>
    </div>
  `;

  // Like btn
  card.querySelector('.like-btn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const drops = getDrops();
    const idx = drops.findIndex(d => d.id === drop.id);
    if (idx !== -1) {
      drops[idx].likes = (drops[idx].likes || 0) + 1;
      saveDrops(drops);
      btn.textContent = `❤️ ${drops[idx].likes}`;
      btn.classList.add('liked');
    }
  });

  return card;
}

// Interest filter bar
document.querySelectorAll('[data-interest]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-interest]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeInterest = btn.dataset.interest;
    renderNearby();
  });
});

// =========================================
// GALLERY
// =========================================
function renderGallery() {
  const memories = getMemories();
  const grid = document.getElementById('gallery-grid');

  let filtered = [...memories];
  if (activeGalleryFilter === 'locked') filtered = memories.filter(m => m.locked);
  else if (activeGalleryFilter === 'unlocked') filtered = memories.filter(m => !m.locked);
  else if (activeGalleryFilter === 'public') filtered = memories.filter(m => m.visibility === 'public');
  else if (activeGalleryFilter === 'private') filtered = memories.filter(m => m.visibility === 'private');
  else if (activeGalleryFilter === 'recent') filtered = [...memories].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,6);

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span>🖼</span><p>No memories here. Add your first one!</p></div>`;
    return;
  }
  grid.innerHTML = '';
  filtered.forEach(m => grid.appendChild(buildGalleryCard(m)));
}

function buildGalleryCard(m) {
  const card = document.createElement('div');
  card.className = `gallery-card ${m.locked ? 'gallery-card-locked' : ''}`;

  card.innerHTML = `
    <div class="gallery-card-img">
      ${m.image
        ? `<img src="${m.image}" alt="" style="filter:${cssFilter(m.filter)}" />`
        : `<span class="placeholder-img">${tagEmoji(m.tag)}</span>`
      }
      ${m.locked ? `<span class="lock-icon-overlay">🔒</span>` : ''}
    </div>
    <div class="gallery-card-info">
      <div class="gallery-card-caption">${m.caption}</div>
      <div class="gallery-card-meta">
        <span class="vis-badge ${m.visibility === 'public' ? 'vis-public' : 'vis-private'}">${m.visibility === 'public' ? '🌐' : '🔒'} ${m.visibility}</span>
        <span class="lock-badge ${m.locked ? 'lock-badge-locked' : 'lock-badge-unlocked'}">${m.locked ? 'Locked' : 'Unlocked'}</span>
      </div>
      <div class="gallery-card-meta" style="margin-top:4px">
        <span>${tagEmoji(m.tag)} ${m.tag}</span>
        <span>${fmtDate(m.date)}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => {
    if (!m.locked) {
      showUnlockModal(m, true); // Already unlocked — just show details
    } else {
      showToast('🔒 Visit this location to unlock this memory.', 'info');
    }
  });

  return card;
}

document.querySelectorAll('[data-gallery]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-gallery]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeGalleryFilter = btn.dataset.gallery;
    renderGallery();
  });
});

// =========================================
// PLACES
// =========================================
function renderPlaces() {
  const list = document.getElementById('places-list');
  list.innerHTML = '';
  DEMO_PLACES.forEach(p => {
    const card = document.createElement('div');
    card.className = 'place-card';
    card.innerHTML = `
      <span class="place-icon">${p.unlocked ? '📍' : '🔒'}</span>
      <div class="place-info">
        <div class="place-name">${p.name}</div>
        <div class="place-meta">${p.coords}</div>
        <div class="place-stats">
          <span class="place-stat">🖼 ${p.memories} memories</span>
          <span class="place-stat">🌐 ${p.publicDrops} public</span>
          ${p.tagged ? `<span class="place-stat">🔔 ${p.tagged} tagged</span>` : ''}
          <span class="place-stat" style="color:${p.unlocked ? 'var(--accent4)' : 'var(--text-dim)'}">${p.unlocked ? '🔓 Unlocked' : '🔒 Locked'}</span>
        </div>
      </div>
    `;
    list.appendChild(card);
  });
}

// =========================================
// UNLOCK MODAL
// =========================================
function showUnlockModal(memory, alreadyUnlocked = false) {
  const modal = document.getElementById('unlock-modal');
  const subtitle = document.getElementById('unlock-subtitle-text');
  const content = document.getElementById('unlock-content');

  subtitle.textContent = alreadyUnlocked
    ? 'Relive this moment.'
    : 'You\'re back where it happened.';

  content.innerHTML = `
    ${memory.image ? `<img src="${memory.image}" style="width:100%;max-height:160px;object-fit:cover;border-radius:10px;margin-bottom:12px;filter:${cssFilter(memory.filter||'original')}" />` : `<div style="text-align:center;font-size:48px;margin-bottom:12px;opacity:0.7">${tagEmoji(memory.tag)}</div>`}
    <strong>${memory.caption}</strong>
    <p>By ${memory.creatorAv} ${memory.creator}</p>
    <p>${tagEmoji(memory.tag)} ${memory.tag} · ${fmtDate(memory.date)}</p>
    <p>📍 ${typeof memory.lat === 'number' ? memory.lat.toFixed(4) : memory.lat}, ${typeof memory.lng === 'number' ? memory.lng.toFixed(4) : memory.lng}</p>
  `;

  modal.classList.remove('hidden');
}

function closeUnlockModal() {
  document.getElementById('unlock-modal').classList.add('hidden');
}

document.getElementById('unlock-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('unlock-modal')) closeUnlockModal();
});

// =========================================
// COMMENTS
// =========================================
function toggleComments(btn, id, type) {
  const section = document.getElementById(`comments-${id}`);
  section.classList.toggle('hidden');
}

function postComment(input) {
  const id = input.dataset.id;
  const type = input.dataset.type;
  const text = input.value.trim();
  if (!text) return;

  if (type === 'drop') {
    const drops = getDrops();
    const idx = drops.findIndex(d => d.id === id);
    if (idx !== -1) {
      drops[idx].comments = drops[idx].comments || [];
      drops[idx].comments.push(`${currentUser.avatar} ${currentUser.name}: ${text}`);
      saveDrops(drops);
      const section = document.getElementById(`comments-${id}`);
      const commentEl = document.createElement('div');
      commentEl.className = 'comment-item';
      commentEl.textContent = `· ${currentUser.avatar} ${currentUser.name}: ${text}`;
      section.insertBefore(commentEl, section.lastElementChild);
      input.value = '';
    }
  }
}

// =========================================
// FEEDBACK
// =========================================
function renderFeedback() {
  // Star rating
  document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.v);
      document.querySelectorAll('.star').forEach((s,i) => {
        s.classList.toggle('active', i < selectedRating);
      });
    });
    star.addEventListener('mouseenter', () => {
      const v = parseInt(star.dataset.v);
      document.querySelectorAll('.star').forEach((s,i) => {
        s.style.color = i < v ? '#f7c948' : '';
      });
    });
    star.addEventListener('mouseleave', () => {
      document.querySelectorAll('.star').forEach((s,i) => {
        s.style.color = i < selectedRating ? '#f7c948' : '';
      });
    });
  });

  // Would use toggle
  document.querySelectorAll('[data-use]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-use]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedWouldUse = btn.dataset.use;
    });
  });

  // Show existing responses
  showFeedbackResponses();
}

function showFeedbackResponses() {
  const all = getFeedback();
  const section = document.getElementById('feedback-responses-section');
  const list = document.getElementById('feedback-list');
  if (all.length === 0) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  list.innerHTML = '';
  [...all].reverse().forEach(fb => {
    const card = document.createElement('div');
    card.className = 'feedback-response-card';
    const stars = '★'.repeat(fb.rating || 0) + '☆'.repeat(5 - (fb.rating || 0));
    card.innerHTML = `
      <div class="fb-card-header">
        <span class="fb-name">${fb.name || 'Anonymous'}</span>
        <span class="fb-stars">${stars}</span>
      </div>
      <div class="fb-would-use">Would use: <strong>${fb.wouldUse || '—'}</strong></div>
      ${fb.killerFeature ? `<div class="fb-killer">"${fb.killerFeature}"</div>` : ''}
      ${fb.other ? `<div class="fb-killer" style="margin-top:6px;color:var(--text-dim)">${fb.other}</div>` : ''}
      <div class="fb-date" style="margin-top:8px">${fmtDate(fb.date)}</div>
    `;
    list.appendChild(card);
  });
}

document.getElementById('btn-submit-feedback').addEventListener('click', () => {
  const name = document.getElementById('fb-name').value.trim();
  const email = document.getElementById('fb-email').value.trim();
  const killer = document.getElementById('fb-killer').value.trim();
  const other = document.getElementById('fb-other').value.trim();

  if (!selectedRating) { showToast('Please rate the concept first.', 'error'); return; }

  const excites = Array.from(document.querySelectorAll('#excites-group input:checked')).map(i => i.value);

  const entry = {
    id: 'fb-' + Date.now(),
    name: name || 'Anonymous',
    email,
    rating: selectedRating,
    excites,
    wouldUse: selectedWouldUse || 'not specified',
    killerFeature: killer,
    other,
    date: new Date().toISOString()
  };

  const all = getFeedback();
  all.push(entry);
  saveFeedback(all);

  // Reset
  document.getElementById('fb-name').value = '';
  document.getElementById('fb-email').value = '';
  document.getElementById('fb-killer').value = '';
  document.getElementById('fb-other').value = '';
  document.querySelectorAll('#excites-group input').forEach(i => i.checked = false);
  document.querySelectorAll('.star').forEach(s => { s.classList.remove('active'); s.style.color = ''; });
  document.querySelectorAll('[data-use]').forEach(b => b.classList.remove('active'));
  selectedRating = 0;
  selectedWouldUse = '';

  showToast('Thank you! Your feedback means a lot. 🙏', 'success', 4000);
  showFeedbackResponses();
});

// =========================================
// UTILITIES
// =========================================

// Haversine formula — distance in meters
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2)
          + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180)
          * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Format date
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Tag → emoji
function tagEmoji(tag) {
  const map = { travel:'✈️', food:'🍜', photography:'📸', friendship:'🤝', nostalgia:'🌀', hidden:'🕵️' };
  return map[tag] || '✦';
}

// CSS filter string
function cssFilter(f) {
  const map = {
    original: 'none',
    vintage: 'sepia(0.5) contrast(1.1) brightness(0.9) saturate(0.85)',
    warm: 'sepia(0.15) saturate(1.4) brightness(1.05) hue-rotate(-10deg)',
    bw: 'grayscale(1) contrast(1.1)',
    cinematic: 'contrast(1.2) brightness(0.88) saturate(0.75)'
  };
  return map[f] || 'none';
}

// =========================================
// BOOT
// =========================================
(function init() {
  initDemoData();

  // Restore user if exists
  const saved = localStorage.getItem('echoes_user');
  if (saved) {
    try {
      const u = JSON.parse(saved);
      currentUser = u;
    } catch(e) {}
  }

  // Preselect avatar
  const av = document.querySelector('.avatar-opt.selected');
  if (av) av.dataset.av = currentUser.avatar;
})();