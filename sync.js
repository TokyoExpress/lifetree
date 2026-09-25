// Cloud sync through Firebase (Google sign-in + one Firestore document per user).
// The app keeps working from localStorage; this module mirrors the save to users/{uid}
// and pulls changes made on other devices. Inert until firebase-config.js has a config.
import { firebaseConfig } from './firebase-config.js';

const lt = window.lifetree;
const FIREBASE = 'https://www.gstatic.com/firebasejs/10.12.2/';

if (firebaseConfig) start().catch(e => lt.status({ configured: true, msg: `Sync couldn't start (${e.message}).` }));

async function start() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FIREBASE + 'firebase-app.js'),
    import(FIREBASE + 'firebase-auth.js'),
    import(FIREBASE + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const client = crypto.randomUUID(); // tells our own writes apart from other devices'
  let ref = null, unsub = null, timer = null;
  lt.status({ configured: true });

  async function push() {
    if (!ref) return;
    const at = lt.updatedAt() || Date.now();
    try {
      await F.setDoc(ref, { data: JSON.stringify(lt.payload()), updatedAt: at, client });
      lt.markSynced(at);
      lt.status({ msg: `Last synced ${new Date().toLocaleTimeString()}.` });
    } catch (e) {
      lt.status({ msg: `Sync failed (${e.code || e.message}). Changes are saved on this device and will sync on your next change.` });
    }
  }
  const applyCloud = d => lt.applyRemote(JSON.parse(d.data), d.updatedAt);

  window.cloudPush = () => { clearTimeout(timer); timer = setTimeout(push, 1200); };
  window.addEventListener('online', () => { if (lt.updatedAt() > lt.lastSync()) push(); });

  window.cloudSignIn = async () => {
    const provider = new A.GoogleAuthProvider();
    try {
      await A.signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await A.signInWithRedirect(auth, provider);
      else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') lt.status({ msg: `Sign-in failed (${e.code}).` });
    }
  };
  window.cloudSignOut = () => A.signOut(auth);

  A.onAuthStateChanged(auth, user => {
    unsub?.(); unsub = null; ref = null;
    lt.status({ user: user ? (user.email || user.displayName) : null, msg: '' });
    if (!user) return;
    ref = F.doc(db, 'users', user.uid);
    let first = true;
    unsub = F.onSnapshot(ref, snap => {
      if (snap.metadata.hasPendingWrites) return;
      const d = snap.data(), wasFirst = first;
      first = false;
      if (!d) return push();            // nothing in the cloud yet: upload this device's data
      if (d.client === client) return;  // our own write coming back
      const local = lt.updatedAt(), synced = lt.lastSync();

      if (wasFirst && !synced) {
        // This device has never synced. A fresh device just takes the cloud save;
        // one with its own data asks which copy to keep.
        if (!lt.hasData()) return applyCloud(d);
        const useCloud = confirm(
          `There's already a cloud save (last changed ${new Date(d.updatedAt).toLocaleString()}).\n\n` +
          `OK: replace this device's data with the cloud save.\nCancel: keep this device's data and overwrite the cloud save.`);
        return useCloud ? applyCloud(d) : push();
      }
      if (d.updatedAt > synced) {
        // Another device changed the cloud copy. If this device also changed since then and is newer, it wins.
        if (local > synced && local > d.updatedAt) return push();
        return applyCloud(d);
      }
      if (local > synced) push(); // only this device has unsynced changes
    }, e => lt.status({ msg: `Sync error (${e.code}).` }));
  });
}
