 

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

 
async function _getUid() {
  if (!sb()) return null;
  const { data: { session } } = await sb().auth.getSession();
  if (session?.user?.id) return session.user.id;
  const { data: { user } } = await sb().auth.getUser();
  if (user?.id) return user.id;
  return null;
}

 

async function signInWithGoogle() {
  if (!SUPABASE_ENABLED || !sb()) { showToast('Supabase not connected'); return null; }
  const { data, error } = await sb().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/?oauth_return=1',
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  });
  if (error) { showToast('Sign-in failed: ' + error.message); return null; }
  return data;
}

async function signUpWithEmail(email, password, name, avatar) {
  if (!SUPABASE_ENABLED || !sb()) return null;
   if (!_sbReady) { showToast('Backend not ready. Refresh and try again.'); return null; }

  const { data, error } = await sb().auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        username:  name,
        avatar:    avatar || '🌙'
      }
    }
  });

  if (error) {
     const msg = error.message || '';
    if (msg.includes('already registered') || msg.includes('already exists') || error.status === 422) {
      showToast('This email is already registered. Try logging in instead.');
    } else if (msg.includes('Password')) {
      showToast('Password must be at least 6 characters.');
    } else if (msg.includes('valid email') || msg.includes('invalid')) {
      showToast('Please enter a valid email address.');
    } else {
      showToast('Sign up failed: ' + msg);
    }
    return null;
  }
   if (data?.user) {
    await upsertUserProfile(data.user, name, avatar, name);
  }

  return data?.user || null;
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
  const { data: { session } } = await sb().auth.getSession();
  if (session?.user) return session.user;
  const { data: { user: existingUser } } = await sb().auth.getUser();
  if (existingUser) return existingUser;
  const { data, error } = await sb().auth.signInAnonymously();
  if (error) { console.error('Anon sign-in failed:', error); return null; }
  return data.user;
}

async function getSessionUid() {
  if (!SUPABASE_ENABLED || !sb()) return null;
  const { data } = await sb().auth.getSession();
  return data?.session?.user?.id || null;
}

async function getSessionUser() {
  if (!SUPABASE_ENABLED || !sb()) return null;
  const { data } = await sb().auth.getSession();
  return data?.session?.user || null;
}

function listenAuthState(cb) {
  if (!SUPABASE_ENABLED || !sb()) return;
  sb().auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      await upsertUserProfile(session.user);
    }
    cb(event, session?.user || null);
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

 
async function userNeedsUsernameSetup(sbUser) {
  if (!sb() || !sbUser?.id) return false;
   const { data } = await sb().from('users').select('username, name').eq('auth_uid', sbUser.id).single();
  if (!data) return true; // no profile yet
   const emailPrefix = (sbUser.email || '').split('@')[0];
  const name = data.username || data.name || '';
  if (!name || name === 'Explorer' || name === emailPrefix) return true;
  return false;
}

 
async function upsertUserProfile(sbUser, name, avatar, username) {
  if (!sb() || !sbUser?.id) return;
  try {
    const resolvedName     = name || sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'Explorer';
    const resolvedUsername = username || sbUser.user_metadata?.username || resolvedName;
    const resolvedAvatar   = avatar || sbUser.user_metadata?.avatar || '🌙';
    await sb().from('users').upsert({
      auth_uid:  sbUser.id,
      name:      resolvedName,
      username:  resolvedUsername,
      avatar:    resolvedAvatar,
      email:     sbUser.email || '',
      photo_url: sbUser.user_metadata?.avatar_url || '',
      last_seen: new Date().toISOString()
    }, { onConflict: 'auth_uid' });
  } catch (e) { console.warn('upsertUserProfile failed:', e.message); }
}

async function updateUsername(uid, username, avatar) {
  if (!sb() || !uid) return false;
  try {
    const { error } = await sb().from('users').update({
      name:     username,
      username: username,
      avatar:   avatar || '🌙',
      last_seen: new Date().toISOString()
    }).eq('auth_uid', uid);
    if (error) throw error;
     await sb().auth.updateUser({ data: { full_name: username, username, avatar } });
    return true;
  } catch (e) { console.warn('updateUsername failed:', e.message); return false; }
}

 
async function dbSaveMemory(data) {
  if (!SUPABASE_ENABLED || !sb()) return data.id;
  const uid = await _getUid();
  if (!uid) { console.warn('No uid — cloud save skipped'); return data.id; }

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

 
async function dbLikeMemory(memId) {
  if (!SUPABASE_ENABLED || !sb() || !_isUuid(memId)) return;
  const uid = await _getUid();
  try {
    await sb().from('reactions').upsert({
      memory_id: memId,
      uid:       uid || 'anon',
      emoji:     'heart'
    }, { onConflict: 'memory_id,uid,emoji', ignoreDuplicates: true });
  } catch (e) { console.warn('Reaction upsert failed:', e.message); }
   const { data: mem } = await sb().from('memories').select('likes').eq('id', memId).single();
  if (mem) {
    await sb().from('memories').update({ likes: (mem.likes || 0) + 1 }).eq('id', memId);
  }
}

async function dbEmojiReact(memId, emoji) {
  if (!SUPABASE_ENABLED || !sb() || !_isUuid(memId)) return;
  const uid = await _getUid();
  try {
    await sb().from('reactions').upsert({
      memory_id: memId,
      uid:       uid || 'anon',
      emoji
    }, { onConflict: 'memory_id,uid,emoji', ignoreDuplicates: true });
  } catch (e) { console.warn('Emoji react failed:', e.message); }
}

 
async function dbSaveMessage(data) {
  if (!SUPABASE_ENABLED || !sb()) return data.id;
  const uid = await _getUid();
  if (!uid) { console.warn('No uid — cloud save skipped'); return data.id; }

  const { data: r, error } = await sb().from('messages').insert({
    type:          data.type,
    text:          data.text,
    tagged_person: data.taggedPerson || null,
    tagged_uid:    data.taggedUid    || null,
    category:      data.category     || 'nostalgia',
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

 
async function dbSaveFeedback(data) {
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

async function dbGetFeedbackForUser() {
  if (!SUPABASE_ENABLED || !sb()) return [];
  const { data, error } = await sb().from('feedback').select('*')
    .order('created_at', { ascending: false }).limit(20);
  if (error) return [];
  return data || [];
}

 
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

 
async function dbGetAllFeedback() {
  if (!SUPABASE_ENABLED || !sb()) return [];
  const { data } = await sb().from('feedback').select('*').order('created_at', { ascending: false });
  return data || [];
}

async function dbGetAllMemories(count = 200) {
  if (!SUPABASE_ENABLED || !sb()) return [];
  const { data } = await sb().from('memories').select('*')
    .order('created_at', { ascending: false }).limit(count);
  return (data || []).map(_mf);
}

async function dbGetAllUsers(count = 200) {
  if (!SUPABASE_ENABLED || !sb()) return [];
  const { data } = await sb().from('users').select('*')
    .order('last_seen', { ascending: false }).limit(count);
  return data || [];
}

async function dbGetCounts() {
  if (!SUPABASE_ENABLED || !sb()) {
    return { memories: 0, messages: 0, feedback: 0, users: 0 };
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

async function dbDeleteMemory(id) {
  if (!SUPABASE_ENABLED || !sb()) return;
  await sb().from('memories').delete().eq('id', id);
}

async function dbDeleteFeedback(id) {
  if (!SUPABASE_ENABLED || !sb()) return;
  await sb().from('feedback').delete().eq('id', id);
}

async function dbBanUser(authUid) {
  if (!SUPABASE_ENABLED || !sb()) return;
  await sb().from('users').update({ banned: true }).eq('auth_uid', authUid);
}

 
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

 
function _lg(k) {
  try { return JSON.parse(localStorage.getItem(k) || '[]'); }
  catch { return []; }
}
function _ls(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function _isUuid(v) {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

 
const FIREBASE_ENABLED = SUPABASE_ENABLED;
const initFirebase     = initSupabase;