/* supabase-config.js — Echoes Supabase Integration */

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
      auth: { persistSession: true, autoRefreshToken: true }
    });
    window.SB = _supabase;
    _sbReady = true;
    console.log('[Echoes] Supabase connected');
    return true;
  } catch (err) { console.error('[Echoes] Supabase init failed:', err); return false; }
}

const sb = () => _supabase || window.SB;

/* ─── AUTH ─── */
async function signInWithGoogle() {
  if (!SUPABASE_ENABLED || !sb()) { showToast('Set SUPABASE_ENABLED=true'); return null; }
  const { data, error } = await sb().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) { showToast('Sign-in failed: ' + error.message); return null; }
  return data;
}
async function signInWithPhone(phone) {
  if (!sb()) return null;
  const { error } = await sb().auth.signInWithOtp({ phone });
  if (error) { showToast('OTP failed: ' + error.message); return null; }
  showToast('OTP sent!'); return true;
}
async function verifyOTP(phone, token) {
  const { data, error } = await sb().auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) { showToast('Wrong OTP'); return null; }
  return data.user;
}
function listenAuthState(cb) {
  if (!SUPABASE_ENABLED || !sb()) return;
  sb().auth.onAuthStateChange((_e, session) => cb(session?.user || null));
}
async function getCurrentUser() {
  if (!sb()) return null;
  const { data: { user } } = await sb().auth.getUser();
  return user;
}
async function fbSignOut() {
  if (sb()) await sb().auth.signOut();
}
async function upsertUserProfile(sbUser, name, avatar) {
  if (!sb()) return;
  await sb().from('users').upsert({
    uid: sbUser.id, name: name || sbUser.user_metadata?.full_name || 'Explorer',
    avatar: avatar || '🌙', email: sbUser.email || '',
    photo_url: sbUser.user_metadata?.avatar_url || '',
    last_seen: new Date().toISOString()
  }, { onConflict: 'uid' });
}

/* ─── MEMORIES ─── */
async function dbSaveMemory(data) {
  if (!SUPABASE_ENABLED || !sb()) {
    const l = _lg('e_memories'); l.push(data); _ls('e_memories', l); return data.id;
  }
  const { data: r, error } = await sb().from('memories').insert({
    caption: data.caption, filter: data.filter || 'original',
    image_url: data.image || null, lat: data.lat, lng: data.lng,
    location_name: data.locationName || null, locked: true,
    visibility: data.visibility || 'private', tag: data.tag || 'nostalgia',
    creator_uid: data.creatorUid, creator_name: data.creator, creator_avatar: data.creatorAv || '🌙'
  }).select().single();
  if (error) throw error;
  return r.id;
}
async function dbGetMyMemories(uid) {
  if (!SUPABASE_ENABLED || !sb()) return _lg('e_memories');
  const { data, error } = await sb().from('memories').select('*')
    .eq('creator_uid', uid).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(_mf);
}
async function dbGetPublicMemories(tag = null, count = 50) {
  if (!SUPABASE_ENABLED || !sb()) {
    let l = _lg('e_memories').filter(m => m.visibility === 'public');
    if (tag) l = l.filter(m => m.tag === tag); return l;
  }
  let q = sb().from('memories').select('*').eq('visibility', 'public');
  if (tag) q = q.eq('tag', tag);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(count);
  if (error) throw error;
  return data.map(_mf);
}
async function dbUnlockMemory(memId) {
  if (!SUPABASE_ENABLED || !sb()) {
    const l = _lg('e_memories'); const m = l.find(x => x.id === memId);
    if (m) { m.locked = false; _ls('e_memories', l); } return;
  }
  await sb().from('memories').update({ locked: false }).eq('id', memId);
}
async function dbLikeMemory(memId) {
  if (!SUPABASE_ENABLED || !sb()) {
    const l = _lg('e_memories'); const m = l.find(x => x.id === memId);
    if (m) { m.likes = (m.likes || 0) + 1; _ls('e_memories', l); } return;
  }
  await sb().rpc('increment_likes', { memory_id: memId });
}
async function dbDeleteMemory(memId) {
  if (!SUPABASE_ENABLED || !sb()) {
    _ls('e_memories', _lg('e_memories').filter(m => m.id !== memId)); return;
  }
  await sb().from('memories').delete().eq('id', memId);
}

/* ─── IMAGE UPLOAD ─── */
async function dbUploadImage(file, bucketPath, onProgress) {
  if (!SUPABASE_ENABLED || !sb()) {
    return new Promise((res, rej) => {
      const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(file);
    });
  }
  const [bucket, ...rest] = bucketPath.split('/');
  const path = rest.join('/');
  const { error } = await sb().storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = sb().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/* ─── MESSAGES ─── */
async function dbSaveMessage(data) {
  if (!SUPABASE_ENABLED || !sb()) {
    const l = _lg('e_messages'); l.push(data); _ls('e_messages', l); return data.id;
  }
  const { data: r, error } = await sb().from('messages').insert({
    type: data.type, text: data.text, tagged_person: data.taggedPerson || null,
    tagged_uid: data.taggedUid || null, category: data.category || 'nostalgia',
    lat: data.lat, lng: data.lng, location_name: data.locationName || null,
    radius: data.radius || 100, locked: true, image_url: data.image || null,
    sender_uid: data.senderUid, sender_name: data.sender, sender_avatar: data.senderAv || '🌙'
  }).select().single();
  if (error) throw error;
  return r.id;
}
async function dbGetMessagesForUser(uid) {
  if (!SUPABASE_ENABLED || !sb()) return _lg('e_messages');
  const { data, error } = await sb().from('messages').select('*')
    .eq('tagged_uid', uid).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(_msgf);
}
async function dbGetPublicMessages(count = 50) {
  if (!SUPABASE_ENABLED || !sb()) return _lg('e_messages').filter(m => m.type !== 'tagged');
  const { data, error } = await sb().from('messages').select('*')
    .in('type', ['public','interest']).order('created_at', { ascending: false }).limit(count);
  if (error) throw error;
  return data.map(_msgf);
}

/* ─── COMMENTS ─── */
async function dbAddComment(memId, text, uid, name) {
  if (!SUPABASE_ENABLED || !sb()) {
    const l = _lg('e_memories'); const m = l.find(x => x.id === memId);
    if (m) { m.comments = m.comments||[]; m.comments.push({author:name,authorUid:uid,text,ts:Date.now()}); _ls('e_memories',l); } return;
  }
  await sb().from('comments').insert({ memory_id: memId, text, author_uid: uid, author_name: name });
}
async function dbGetComments(memId) {
  if (!SUPABASE_ENABLED || !sb()) {
    const m = _lg('e_memories').find(x => x.id === memId); return m?.comments || [];
  }
  const { data, error } = await sb().from('comments').select('*')
    .eq('memory_id', memId).order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(c => ({ author: c.author_name, text: c.text, ts: new Date(c.created_at).getTime() }));
}

/* ─── FEEDBACK ─── */
async function dbSaveFeedback(data) {
  if (!SUPABASE_ENABLED || !sb()) {
    const l = _lg('e_feedback'); l.unshift(data); _ls('e_feedback', l); return;
  }
  await sb().from('feedback').insert({
    name: data.name||'Anonymous', rating: data.rating, text: data.text||'',
    source: data.source||'unknown', yn: data.yn||'unknown',
    features: data.features||[], uid: data.uid||null
  });
}

/* ─── REAL-TIME NEARBY ─── */
let _nearbyChannel = null;
function dbListenNearby(onUpdate, count = 30) {
  if (_nearbyChannel) { _nearbyChannel.unsubscribe(); _nearbyChannel = null; }
  if (!SUPABASE_ENABLED || !sb()) {
    onUpdate(_lg('e_memories').filter(m => m.visibility === 'public')); return;
  }
  const fetch = () => sb().from('memories').select('*').eq('visibility','public')
    .order('created_at',{ascending:false}).limit(count)
    .then(({data}) => { if (data) onUpdate(data.map(_mf)); });
  fetch();
  _nearbyChannel = sb().channel('nearby')
    .on('postgres_changes',{event:'*',schema:'public',table:'memories',filter:'visibility=eq.public'}, fetch)
    .subscribe();
}
function dbStopNearby() {
  if (_nearbyChannel) { _nearbyChannel.unsubscribe(); _nearbyChannel = null; }
}

/* ─── ADMIN ─── */
async function dbGetAllFeedback() {
  if (!SUPABASE_ENABLED || !sb()) return _lg('e_feedback');
  const { data } = await sb().from('feedback').select('*').order('created_at',{ascending:false});
  return data || _lg('e_feedback');
}
async function dbGetAllMemories(count = 200) {
  if (!SUPABASE_ENABLED || !sb()) return _lg('e_memories');
  const { data } = await sb().from('memories').select('*').order('created_at',{ascending:false}).limit(count);
  return (data || []).map(_mf);
}
async function dbGetCounts() {
  if (!SUPABASE_ENABLED || !sb()) {
    return { memories:_lg('e_memories').length, messages:_lg('e_messages').length, feedback:_lg('e_feedback').length, users:0 };
  }
  const [m,msg,fb,u] = await Promise.all([
    sb().from('memories').select('*',{count:'exact',head:true}),
    sb().from('messages').select('*',{count:'exact',head:true}),
    sb().from('feedback').select('*',{count:'exact',head:true}),
    sb().from('users').select('*',{count:'exact',head:true})
  ]);
  return { memories:m.count||0, messages:msg.count||0, feedback:fb.count||0, users:u.count||0 };
}

/* ─── CONVERTERS ─── */
function _mf(r) {
  return { id:r.id, caption:r.caption, filter:r.filter||'original', image:r.image_url||null,
    lat:r.lat, lng:r.lng, locationName:r.location_name||null, locked:r.locked,
    visibility:r.visibility, tag:r.tag, likes:r.likes||0,
    creator:r.creator_name, creatorAv:r.creator_avatar, creatorUid:r.creator_uid,
    comments:[], createdAt:r.created_at };
}
function _msgf(r) {
  return { id:r.id, type:r.type, text:r.text, taggedPerson:r.tagged_person, taggedUid:r.tagged_uid,
    category:r.category, lat:r.lat, lng:r.lng, locationName:r.location_name, radius:r.radius,
    locked:r.locked, image:r.image_url, sender:r.sender_name, senderAv:r.sender_avatar,
    senderUid:r.sender_uid, createdAt:r.created_at };
}

/* ─── localStorage FALLBACKS ─── */
function _lg(k) { try { return JSON.parse(localStorage.getItem(k)||'[]'); } catch { return []; } }
function _ls(k,v) { localStorage.setItem(k, JSON.stringify(v)); }

/* ════════════════════════════════════
   COMPATIBILITY ALIASES
   So app.js works without changes when
   switching between Firebase and Supabase
════════════════════════════════════ */
// FIREBASE_ENABLED alias — prevents ReferenceError in app.js
const FIREBASE_ENABLED = SUPABASE_ENABLED;

// initFirebase alias — app.js calls initFirebase()
const initFirebase = initSupabase;