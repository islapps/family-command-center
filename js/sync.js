// Family sync through Cloud Firestore.
// Loaded only on devices that have the private family link, so the public page never downloads Firebase.
// Data lives at families/{familyKey}/{events|shopping|notes|meals|members|todos}/{id}.
import { FIREBASE_CONFIG } from './firebase-config.js';

export const COLLECTIONS = ['events', 'shopping', 'notes', 'meals', 'members', 'todos'];

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
  // A refused listener stops for good, so try again every minute: when the database rules are
  // updated (e.g. to allow to-dos), an always-on iPad picks it up without being reopened.
  const retryMs = window.__fccRetryMs || 60000;
  const listen = name => {
    F.onSnapshot(F.collection(base, name), { includeMetadataChanges: true },
      snap => onCollection(name, snap.docs.map(d => Object.assign({}, d.data(), { id: d.id })), { fromCache: snap.metadata.fromCache }),
      err => {
        onStatus({ state: 'error', code: err.code || 'unknown', coll: name });
        if (err.code === 'permission-denied') setTimeout(() => listen(name), retryMs);
      });
  };
  COLLECTIONS.forEach(listen);
}

// changes: [{ coll, id, data }] — data null means delete.
// Written in one batch per collection, so a refusal can be traced to the kind of data it was.
export async function write(changes) {
  if (!db || !changes.length) return;
  COLLECTIONS.forEach(coll => {
    const mine = changes.filter(c => c.coll === coll);
    for (let i = 0; i < mine.length; i += 400) {
      const batch = F.writeBatch(db);
      mine.slice(i, i + 400).forEach(c => {
        const ref = F.doc(base, c.coll, c.id);
        if (c.data) batch.set(ref, c.data); else batch.delete(ref);
      });
      // Resolves once the server has it; offline it waits and the change still shows locally.
      batch.commit().catch(err => report({ state: 'error', code: err.code || 'unknown', coll }));
    }
  });
}
