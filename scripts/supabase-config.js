/* ═══════════════════════════════════════════════
   supabase-config.js — Echoes Backend
   All DB operations, auth, storage
═══════════════════════════════════════════════ */

const SUPABASE_URL      = 'https://rtusvxxwfkyuxvdhzjwq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0dXN2eHh3Zmt5dXh2ZGh6andxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Mjg5OTEsImV4cCI6MjA4OTMwNDk5MX0.sxC3aI_miRnYiG8-JLQEH9K8-0Izd3QqklDvh43w5hg';
const SUPABASE_ENABLED  = true;

let _supabase = null;
let _sbReady  = false;

async function initSupabase() {
  if (!SUPABASE_ENABLED) { console.log('[Echoes] localStorage mode'); return false; }
  if (_sbReady) return true;
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.SB = _supabase;
    _sbReady = true;
    console.log('[Echoes] Supabase connected');
    return true;
  } catch (err) { console.error('[Echoes] Supabase init failed:', err); return false; }
}

const sb = () => _supabase || window.SB;

/* ─── ALWAYS GET FRESH UID ─── */
async function _getUid() {
  if (!sb()) return null;
  // Check existing session first — never create a new anon session if one exists
  const { data: { session } } = await sb().auth.getSession();
  if (session?.user?.id) return session.user.id;
  const { data: { user } } = await sb().auth.getUser();
  if (user?.id) return user.id;
  // No session at all — create anonymous (rate limited, avoid repeated calls)
  const { data, error } = await sb().auth.signInAnonymously();
  if (error) { console.warn('Anon skipped:', error.message); return null; }
  return data?.user?.id || null;
}

/* ═══════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════ */

async function signInWithGoogle() {
  if (!SUPABASE_ENABLED || !sb()) { showToast('Supabase not connected'); return null; }
  const { data, error } = await sb().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) { showToast('Sign-in failed: ' + error.message); return null; }
  return data;
}

async function signUpWithEmail(email, password, name, avatar) {
  if (!SUPABASE_ENABLED || !sb()) return null;
  const { data, error } = await sb().auth.signUp({
    email, password,
    options: { data: { full_name: name, avatar: avatar || '🌙' } }
  });
  if (error) { showToast('Sign up failed: ' + error.message); return null; }
  if (data.user) await upsertUserProfile(data.user, name, avatar);
  return data.user;
}

async function signInWithEmail(email, password) {
  if (!SUPABASE_ENABLED || !sb()) return null;
  const { data, error } = await sb().auth.signInWithPassword({ email, password });
  if (error) { showToast('Login failed: ' + error.message); return null; }
  if (data.user) await upsertUserProfile(data.user);
  return data.user;
}

async function resetPassword(email) {
  if (!sb()) return;
  const { error } = await sb().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  if (error) showToast('Error: ' + error.message);
  else showToast('Password reset email sent! Check your inbox.');
}

async function signInAnonymously() {
  if (!SUPABASE_ENABLED || !sb()) return null;
  // Reuse existing session if available — prevents rate limit errors
  const { data: { session } } = await sb().auth.getSession();
  if (session?.user) return session.user;
  const { data: { user: existingUser } } = await sb().auth.getUser();
  if (existingUser) return existingUser;
  // No existing session — create new anonymous one
  const { data, error } = await sb().auth.signInAnonymously();
  if (error) { console.error('Anon sign-in failed:', error); return null; }
  return data.user;
}

async function getSessionUid() {
  if (!SUPABASE_ENABLED || !sb()) return null;
  const { data } = await sb().auth.getSession();
  return data?.session?.user?.id || null;
}

function listenAuthState(cb) {
  if (!SUPABASE_ENABLED || !sb()) return;
  sb().auth.onAuthStateChange(async (_e, session) => {
    if (session?.user) {
      await upsertUserProfile(session.user);
    }
    cb(session?.user || null);
  });
}

async function getCurrentUser() {
  if (!sb()) return null;
  const { data: { user } } = await sb().auth.getUser();
  return user;
}

async function fbSignOut() {
  if (sb()) await sb().auth.signOut();
}

/* ─── USERS TABLE ──────────────────────────────
   What gets stored here:
   Google login  → name from Google, email, photo URL, auth_uid
   Email signup  → name you chose, email, avatar emoji, auth_uid
   Guest/anon    → name you typed, avatar emoji, auth_uid (anon uuid)
   All auto-saved on every login via listenAuthState
─────────────────────────────────────────────── */
async function upsertUserProfile(sbUser, name, avatar) {
  if (!sb() || !sbUser?.id) return;
  try {
    await sb().from('users').upsert({
      auth_uid:  sbUser.id,
      name:      name || sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'Explorer',
      avatar:    avatar || sbUser.user_metadata?.avatar || '🌙',
      email:     sbUser.email || '',
      photo_url: sbUser.user_metadata?.avatar_url || '',
      last_seen: new Date().toISOString()
    }, { onConflict: 'auth_uid' });
  } catch (e) { console.warn('upsertUserProfile failed:', e.message); }
}

/* ═══════════════════════════════════════════════
   MEMORIES
═══════════════════════════════════════════════ */
async function dbSaveMemory(data) {
  if (!SUPABASE_ENABLED || !sb()) return data.id;
  const uid = await _getUid();
  if (!uid) {
    // Auth unavailable (rate limited etc) — caller still saves to localStorage
    console.warn('No uid — cloud save skipped');
    return data.id;
  }

  const { data: r, error } = await sb().from('memories').insert({
    caption:       data.caption,
    filter:        data.filter       || 'original',
    image_url:     data.image        || null,
    lat:           data.lat,
    lng:           data.lng,
    location_name: data.locationName || null,
    locked:        true,
    visibility:    data.visibility   || 'private',
    tag:           data.tag          || 'nostalgia',
    creator_uid:   uid,
    creator_name:  data.creator      || 'Explorer',
    creator_av:    data.creatorAv    || '🌙'
  }).select().single();

  if (error) throw error;
  return r.id;
}

async function dbGetMyMemories(uid) {
  if (!SUPABASE_ENABLED || !sb()) return _lg('e_memories');
  const { data, error } = await sb().from('memories').select('*')
    .eq('creator_uid', uid).order('created_at', { ascending: false });
  if (error) { console.error(error); return _lg('e_memories'); }
  return (data || []).map(_mf);
}

async function dbGetPublicMemories(tag = null, count = 50) {
  if (!SUPABASE_ENABLED || !sb()) {
    let l = _lg('e_memories').filter(m => m.visibility === 'public');
    if (tag) l = l.filter(m => m.tag === tag);
    return l;
  }
  let q = sb().from('memories').select('*').eq('visibility', 'public');
  if (tag) q = q.eq('tag', tag);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(count);
  if (error) { console.error(error); return []; }
  return (data || []).map(_mf);
}

async function dbUnlockMemory(memId) {
  if (!SUPABASE_ENABLED || !sb()) {
    const l = _lg('e_memories');
    const m = l.find(x => x.id === memId);
    if (m) { m.locked = false; _ls('e_memories', l); }
    return;
  }
  if (!_isUuid(memId)) return;
  await sb().from('memories').update({ locked: false }).eq('id', memId);
}

/* ─── LIKES + REACTIONS ─────────────────────────
   reactions table: tracks WHO liked WHAT (uid, memory_id, emoji)
   memories.likes:  the running count shown in UI
─────────────────────────────────────────────── */
async function dbLikeMemory(memId) {
  if (!SUPABASE_ENABLED || !sb() || !_isUuid(memId)) return;

  const uid = await _getUid();

  // Insert into reactions table
  try {
    await sb().from('reactions').upsert({
      memory_id: memId,
      uid:       uid || 'anon',
      emoji:     'heart'
    }, { onConflict: 'memory_id,uid,emoji', ignoreDuplicates: true });
  } catch (e) { console.warn('Reaction upsert failed:', e.message); }

  // Update likes count on memories row
  try {
    const { error } = await sb().rpc('increment_likes', { memory_id: memId });
    if (error) throw error;
  } catch {
    try {
      const { data: row } = await sb().from('memories').select('likes').eq('id', memId).single();
      await sb().from('memories').update({ likes: (row?.likes || 0) + 1 }).eq('id', memId);
    } catch (e) { console.warn('likes count update failed:', e.message); }
  }
}

async function dbDeleteMemory(memId) {
  if (!SUPABASE_ENABLED || !sb()) {
    _ls('e_memories', _lg('e_memories').filter(m => m.id !== memId));
    return;
  }
  if (!_isUuid(memId)) return;
  await sb().from('memories').delete().eq('id', memId);
}

/* ═══════════════════════════════════════════════
   IMAGE UPLOAD
═══════════════════════════════════════════════ */
async function dbUploadImage(file, bucketPath) {
  if (!SUPABASE_ENABLED || !sb()) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  const [bucket, ...rest] = bucketPath.split('/');
  const path = rest.join('/');
  const { error } = await sb().storage.from(bucket).upload(path, file, {
    cacheControl: '3600', upsert: true
  });
  if (error) throw error;
  const { data } = sb().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/* ═══════════════════════════════════════════════
   MESSAGES
═══════════════════════════════════════════════ */
async function dbSaveMessage(data) {
  if (!SUPABASE_ENABLED || !sb()) return data.id;
  const uid = await _getUid();
  if (!uid) {
    console.warn('No uid — message cloud save skipped');
    return data.id;
  }

  const { data: r, error } = await sb().from('messages').insert({
    type:          data.type,
    text:          data.text,
    tagged_person: data.taggedPerson  || null,
    tagged_uid:    data.taggedUid     || null,
    category:      data.category      || 'nostalgia',
    lat:           data.lat,
    lng:           data.lng,
    location_name: data.locationName  || null,
    radius:        data.radius        || 100,
    locked:        true,
    image_url:     data.image         || null,
    sender_uid:    uid,
    sender_name:   data.sender        || 'Explorer',
    sender_av:     data.senderAv      || '🌙'
  }).select().single();

  if (error) throw error;
  return r.id;
}

async function dbGetMessagesForUser(uid) {
  if (!SUPABASE_ENABLED || !sb()) return _lg('e_messages');
  const { data, error } = await sb().from('messages').select('*')
    .eq('tagged_uid', uid).order('created_at', { ascending: false });
  if (error) { console.error(error); return _lg('e_messages'); }
  return (data || []).map(_msgf);
}

async function dbGetPublicMessages(count = 50) {
  if (!SUPABASE_ENABLED || !sb()) return _lg('e_messages').filter(m => m.type !== 'tagged');
  const { data, error } = await sb().from('messages').select('*')
    .in('type', ['public', 'interest'])
    .order('created_at', { ascending: false }).limit(count);
  if (error) { console.error(error); return []; }
  return (data || []).map(_msgf);
}

/* ═══════════════════════════════════════════════
   COMMENTS
═══════════════════════════════════════════════ */
async function dbAddComment(memId, text, uid, name) {
  if (!SUPABASE_ENABLED || !sb() || !_isUuid(memId)) return { synced: false };

  const sessionUid = await _getUid();
  if (!sessionUid) return { synced: false };

  const { error } = await sb().from('comments').insert({
    memory_id:   memId,
    text,
    author_uid:  sessionUid,
    author_name: name || 'Explorer'
  });

  if (error) { console.warn('Comment sync failed:', error.message); return { synced: false }; }
  return { synced: true };
}

async function dbGetComments(memId) {
  if (!SUPABASE_ENABLED || !sb() || !_isUuid(memId)) {
    const m = _lg('e_memories').find(x => x.id === memId);
    return m?.comments || [];
  }
  const { data, error } = await sb().from('comments').select('*')
    .eq('memory_id', memId).order('created_at', { ascending: true });
  if (error) { console.error(error); return []; }
  return (data || []).map(c => ({
    author: c.author_name || 'user',
    text:   c.text || '',
    ts:     new Date(c.created_at || Date.now()).getTime()
  }));
}

/* ═══════════════════════════════════════════════
   FEEDBACK
═══════════════════════════════════════════════ */
async function dbSaveFeedback(data) {
  // Save locally always
  const l = _lg('e_feedback');
  l.unshift(data);
  _ls('e_feedback', l);

  if (!SUPABASE_ENABLED || !sb()) return;

  const uid = await _getUid();

  const { error } = await sb().from('feedback').insert({
    name:     data.name     || 'Anonymous',
    rating:   data.rating,
    text:     data.text     || '',
    source:   data.source   || 'unknown',
    yn:       data.yn       || 'unknown',
    features: data.features || [],
    uid:      uid           || null
  });

  if (error) console.warn('Feedback cloud save failed:', error.message);
}

/* ═══════════════════════════════════════════════
   REAL-TIME NEARBY
═══════════════════════════════════════════════ */
let _nearbyChannel = null;

function dbListenNearby(onUpdate, count = 30) {
  if (_nearbyChannel) { _nearbyChannel.unsubscribe(); _nearbyChannel = null; }
  if (!SUPABASE_ENABLED || !sb()) {
    onUpdate(_lg('e_memories').filter(m => m.visibility === 'public'));
    return;
  }
  const fetch = () => sb().from('memories').select('*')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(count)
    .then(({ data }) => { if (data) onUpdate(data.map(_mf)); });

  fetch();
  _nearbyChannel = sb().channel('nearby')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'memories', filter: 'visibility=eq.public'
    }, fetch)
    .subscribe();
}

function dbStopNearby() {
  if (_nearbyChannel) { _nearbyChannel.unsubscribe(); _nearbyChannel = null; }
}

/* ═══════════════════════════════════════════════
   ADMIN
═══════════════════════════════════════════════ */
async function dbGetAllFeedback() {
  if (!SUPABASE_ENABLED || !sb()) return _lg('e_feedback');
  const { data } = await sb().from('feedback').select('*').order('created_at', { ascending: false });
  return data || _lg('e_feedback');
}

async function dbGetAllMemories(count = 200) {
  if (!SUPABASE_ENABLED || !sb()) return _lg('e_memories');
  const { data } = await sb().from('memories').select('*')
    .order('created_at', { ascending: false }).limit(count);
  return (data || []).map(_mf);
}

async function dbGetCounts() {
  if (!SUPABASE_ENABLED || !sb()) {
    return {
      memories: _lg('e_memories').length,
      messages: _lg('e_messages').length,
      feedback: _lg('e_feedback').length,
      users: 0
    };
  }
  const [m, msg, fb, u] = await Promise.all([
    sb().from('memories').select('*', { count: 'exact', head: true }),
    sb().from('messages').select('*', { count: 'exact', head: true }),
    sb().from('feedback').select('*', { count: 'exact', head: true }),
    sb().from('users').select('*',    { count: 'exact', head: true })
  ]);
  return {
    memories: m.count   || 0,
    messages: msg.count || 0,
    feedback: fb.count  || 0,
    users:    u.count   || 0
  };
}

/* ═══════════════════════════════════════════════
   FIELD CONVERTERS  (DB snake_case → app camelCase)
═══════════════════════════════════════════════ */
function _mf(r) {
  return {
    id:           r.id,
    caption:      r.caption,
    filter:       r.filter        || 'original',
    image:        r.image_url     || null,
    lat:          r.lat,
    lng:          r.lng,
    locationName: r.location_name || null,
    locked:       r.locked,
    visibility:   r.visibility,
    tag:          r.tag,
    likes:        r.likes         || 0,
    creator:      r.creator_name,
    creatorAv:    r.creator_av    || '🌙',
    creatorUid:   r.creator_uid,
    comments:     [],
    createdAt:    r.created_at
  };
}

function _msgf(r) {
  return {
    id:           r.id,
    type:         r.type,
    text:         r.text,
    taggedPerson: r.tagged_person,
    taggedUid:    r.tagged_uid,
    category:     r.category,
    lat:          r.lat,
    lng:          r.lng,
    locationName: r.location_name,
    radius:       r.radius,
    locked:       r.locked,
    image:        r.image_url,
    sender:       r.sender_name,
    senderAv:     r.sender_av    || '🌙',
    senderUid:    r.sender_uid,
    createdAt:    r.created_at
  };
}

/* ═══════════════════════════════════════════════
   localStorage HELPERS
═══════════════════════════════════════════════ */
function _lg(k) {
  try { return JSON.parse(localStorage.getItem(k) || '[]'); }
  catch { return []; }
}
function _ls(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function _isUuid(v) {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/* ═══════════════════════════════════════════════
   COMPATIBILITY ALIASES
═══════════════════════════════════════════════ */
const FIREBASE_ENABLED = SUPABASE_ENABLED;
const initFirebase     = initSupabase;
