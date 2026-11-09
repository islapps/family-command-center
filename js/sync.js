// Family sync through Cloud Firestore.
// Loaded only on devices that have the private family link, so the public page never downloads Firebase.
// Data lives at families/{familyKey}/{events|shopping|notes|meals|members}/{id}.
import { FIREBASE_CONFIG } from './firebase-config.js';

export const COLLECTIONS = ['events', 'shopping', 'notes', 'meals', 'members'];

let F = null;
let db = null;
let base = null;
let report = () => {};

export async function connect(familyKey, { onCollection, onStatus }) {
  report = onStatus;
  F = await import('./vendor/firebase.js');
  const app = F.initializeApp(FIREBASE_CONFIG);
  try {
    // Keeps a copy on the device (IndexedDB), so a reload without Wi-Fi still shows everything
    // and changes made offline are sent when the connection returns.
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) {
    db = F.initializeFirestore(app, { localCache: F.memoryLocalCache() });
  }
  base = F.doc(db, 'families', familyKey);
  COLLECTIONS.forEach(name => {
    F.onSnapshot(F.collection(base, name), { includeMetadataChanges: true },
      snap => onCollection(name, snap.docs.map(d => Object.assign({}, d.data(), { id: d.id })), { fromCache: snap.metadata.fromCache }),
      err => onStatus({ state: 'error', code: err.code || 'unknown' }));
  });
}

// changes: [{ coll, id, data }] — data null means delete.
export async function write(changes) {
  if (!db || !changes.length) return;
  for (let i = 0; i < changes.length; i += 400) {
    const batch = F.writeBatch(db);
    changes.slice(i, i + 400).forEach(c => {
      const ref = F.doc(base, c.coll, c.id);
      if (c.data) batch.set(ref, c.data); else batch.delete(ref);
    });
    // Resolves once the server has it; offline it waits and the change still shows locally.
    batch.commit().catch(err => report({ state: 'error', code: err.code || 'unknown' }));
  }
}
