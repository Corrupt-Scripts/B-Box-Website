/* =========================================================
   B-Box back end (Firebase Auth + Firestore) behind a small interface.
   Only loads when js/firebase-config.js has a projectId.
   Data layout:
     users/{uid}/workspaces/{wsId}      -> {name, role}          (my list of shared calculators)
     workspaces/{wsId}                  -> {name, ownerUid}
       members/{uid}                    -> {uid, name, role, code}
       invites/{code}                   -> {wsName}
       items/{docId}                    -> {type, key, json, by, t}   (fixtures, rigs, saved addresses)
       work/current                     -> {json, by, t}              (the rig being edited)
       photos/{photoId}                 -> {data}                     (compressed photo as a data URL)
   ========================================================= */
const cfg = window.BBOX_FIREBASE_CONFIG || {};

async function build(cfg) {
  const V = '10.14.1';
  const base = `https://www.gstatic.com/firebasejs/${V}/`;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-auth.js'),
    import(base + 'firebase-firestore.js')
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);

  /* ---------- auth ---------- */
  let cur = null, first = true;
  const subs = new Set();
  const shape = u => u ? { uid: u.uid, email: u.email || '', name: u.displayName || (u.email || 'Someone').split('@')[0] } : null;
  const emit = () => subs.forEach(f => f(cur));
  await new Promise(res => A.onAuthStateChanged(auth, u => {
    cur = shape(u); emit();
    if (first) { first = false; res(); }
  }));
  const me = () => { if (!cur) throw new Error('not-signed-in'); return cur; };

  const rand = n => {
    const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
    return [...crypto.getRandomValues(new Uint8Array(n))].map(b => abc[b % abc.length]).join('');
  };
  const W = id => F.doc(db, 'workspaces', id);
  const sub = (id, name) => F.collection(db, 'workspaces', id, name);

  return {
    kind: 'firebase',
    getUser: () => cur,
    onUser(cb) { subs.add(cb); cb(cur); return () => subs.delete(cb); },
    async signUp({ name, email, password }) {
      const c = await A.createUserWithEmailAndPassword(auth, email, password);
      await A.updateProfile(c.user, { displayName: name });
      cur = shape(auth.currentUser); emit();
    },
    async signIn(email, password) { await A.signInWithEmailAndPassword(auth, email, password); },
    signOut: () => A.signOut(auth),

    workspaces: {
      async create(name) {
        const u = me();
        const ref = F.doc(F.collection(db, 'workspaces'));
        const b = F.writeBatch(db);
        b.set(ref, { name, ownerUid: u.uid, createdAt: F.serverTimestamp() });
        b.set(F.doc(db, 'workspaces', ref.id, 'members', u.uid), { uid: u.uid, name: u.name, role: 'owner', code: null, joinedAt: F.serverTimestamp() });
        b.set(F.doc(db, 'users', u.uid, 'workspaces', ref.id), { name, role: 'owner' });
        await b.commit();
        return ref.id;
      },
      async listMine() {
        const u = me();
        const snap = await F.getDocs(F.collection(db, 'users', u.uid, 'workspaces'));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      },
      subscribeMembers(id, cb, err) {
        return F.onSnapshot(sub(id, 'members'), s => cb(s.docs.map(d => d.data())), err);
      },
      async createInvite(id, wsName) {
        const u = me(), code = rand(20);
        await F.setDoc(F.doc(db, 'workspaces', id, 'invites', code), { wsName, by: u.uid, createdAt: F.serverTimestamp() });
        return code;
      },
      async revokeInvites(id) {
        const snap = await F.getDocs(sub(id, 'invites'));
        await Promise.all(snap.docs.map(d => F.deleteDoc(d.ref)));
      },
      async inviteInfo(id, code) {
        const d = await F.getDoc(F.doc(db, 'workspaces', id, 'invites', code));
        return d.exists() ? { id, name: d.data().wsName } : null;
      },
      async join(id, code) {
        const u = me();
        const mineRef = F.doc(db, 'users', u.uid, 'workspaces', id);
        if ((await F.getDoc(mineRef)).exists()) return; // already in
        const inv = await F.getDoc(F.doc(db, 'workspaces', id, 'invites', code));
        if (!inv.exists()) throw new Error('invite-invalid');
        const b = F.writeBatch(db);
        b.set(F.doc(db, 'workspaces', id, 'members', u.uid), { uid: u.uid, name: u.name, role: 'editor', code, joinedAt: F.serverTimestamp() });
        b.set(mineRef, { name: inv.data().wsName, role: 'editor' });
        await b.commit();
      },
      async leave(id) {
        const u = me();
        const b = F.writeBatch(db);
        b.delete(F.doc(db, 'workspaces', id, 'members', u.uid));
        b.delete(F.doc(db, 'users', u.uid, 'workspaces', id));
        await b.commit();
      },
      async removeMember(id, uid) { await F.deleteDoc(F.doc(db, 'workspaces', id, 'members', uid)); },
      async forget(id) { await F.deleteDoc(F.doc(db, 'users', me().uid, 'workspaces', id)); }
    },

    data: {
      subscribeItems(id, cb, err) {
        return F.onSnapshot(sub(id, 'items'), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err);
      },
      setItem: (id, docId, obj) => F.setDoc(F.doc(db, 'workspaces', id, 'items', docId), obj),
      deleteItem: (id, docId) => F.deleteDoc(F.doc(db, 'workspaces', id, 'items', docId)),
      subscribeWork(id, cb, err) {
        return F.onSnapshot(F.doc(db, 'workspaces', id, 'work', 'current'), s => cb(s.exists() ? s.data() : null), err);
      },
      setWork: (id, obj) => F.setDoc(F.doc(db, 'workspaces', id, 'work', 'current'), obj),
      async getPhoto(id, pid) {
        const d = await F.getDoc(F.doc(db, 'workspaces', id, 'photos', pid));
        return d.exists() ? d.data().data : null;
      },
      setPhoto: (id, pid, data) => F.setDoc(F.doc(db, 'workspaces', id, 'photos', pid), { data }),
      deletePhoto: (id, pid) => F.deleteDoc(F.doc(db, 'workspaces', id, 'photos', pid))
    }
  };
}

if (cfg.projectId) {
  try { window.__bboxFBResolve(await build(cfg)); }
  catch (e) { console.warn('[B-Box] Firebase could not start; running in demo mode.', e); window.__bboxFBResolve(null); }
}
