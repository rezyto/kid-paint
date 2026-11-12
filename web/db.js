/* Armazenamento local (IndexedDB). Os desenhos ficam no tablet, não vão para a internet. */
'use strict';
const PCDB = (() => {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const rq = indexedDB.open('pintacomigo', 1);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('drawings')) {
          const st = db.createObjectStore('drawings', { keyPath: 'id' });
          st.createIndex('updated', 'updated');
        }
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('drawings', mode);
      const st = t.objectStore('drawings');
      let out;
      Promise.resolve(fn(st)).then(v => { out = v; });
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return {
    async put(rec) { return tx('readwrite', st => req(st.put(rec))); },
    async get(id) { const db = await open(); return req(db.transaction('drawings').objectStore('drawings').get(id)); },
    async del(id) { return tx('readwrite', st => req(st.delete(id))); },
    async all() {
      const db = await open();
      const list = await req(db.transaction('drawings').objectStore('drawings').getAll());
      return list.sort((a, b) => b.updated - a.updated);
    },
    async count() { const db = await open(); return req(db.transaction('drawings').objectStore('drawings').count()); },
  };
})();
window.PCDB = PCDB;
