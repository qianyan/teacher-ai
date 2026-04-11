import type { DraftRecord, HistoryRecord, ReportSnapshot } from "./types";

const DB_NAME = "teacher-ai-reports";
const DB_VERSION = 1;
const DRAFT_STORE = "draft";
const HISTORY_STORE = "history";
const DRAFT_KEY = "current" as const;

export const MAX_HISTORY = 20;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const store = db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
        store.createIndex("bySavedAt", "savedAt", { unique: false });
      }
    };
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  storeName: string,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = fn(store);
        req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
        req.onsuccess = () => resolve(req.result as T);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error("IDB transaction failed"));
      }),
  );
}

export async function getDraft(): Promise<DraftRecord | null> {
  const rec = await withStore<DraftRecord | undefined>("readonly", DRAFT_STORE, (s) =>
    s.get(DRAFT_KEY),
  );
  return rec ?? null;
}

export async function putDraft(snapshot: ReportSnapshot): Promise<void> {
  const record: DraftRecord = {
    key: DRAFT_KEY,
    updatedAt: Date.now(),
    snapshot,
  };
  await withStore<IDBValidKey>("readwrite", DRAFT_STORE, (s) => s.put(record));
}

export async function clearDraftStore(): Promise<void> {
  await withStore<undefined>("readwrite", DRAFT_STORE, (s) => s.delete(DRAFT_KEY));
}

export async function listHistory(): Promise<HistoryRecord[]> {
  const all = await withStore<HistoryRecord[]>("readonly", HISTORY_STORE, (s) => s.getAll());
  return all.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}

export async function addHistory(snapshot: ReportSnapshot): Promise<HistoryRecord> {
  const record: HistoryRecord = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    snapshot,
  };
  await withStore<IDBValidKey>("readwrite", HISTORY_STORE, (s) => s.add(record));
  await trimHistory();
  return record;
}

export async function deleteHistory(id: string): Promise<void> {
  await withStore<undefined>("readwrite", HISTORY_STORE, (s) => s.delete(id));
}

async function trimHistory(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, "readwrite");
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const rows = req.result as HistoryRecord[];
      rows.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
      const overflow = rows.slice(MAX_HISTORY);
      for (const r of overflow) {
        store.delete(r.id);
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getHistoryEntry(id: string): Promise<HistoryRecord | null> {
  const rec = await withStore<HistoryRecord | undefined>("readonly", HISTORY_STORE, (s) =>
    s.get(id),
  );
  return rec ?? null;
}
