const RECENT_FILES_KEY = 'kBMSE_recent_files';
const DB_NAME = 'kBMSE_DB';
const STORE_NAME = 'handles';

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveHandleToDB = async (id: string, handle: FileSystemFileHandle) => {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getHandleFromDB = async (id: string): Promise<FileSystemFileHandle | undefined> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(tx.error);
  });
};

export interface RecentFile {
  id: string;
  name: string;
}

export const getRecentFiles = (): RecentFile[] => {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error(e);
  }
  return [];
};

export const addRecentFile = async (handle: FileSystemFileHandle) => {
  const id = handle.name + '_' + Date.now();
  await saveHandleToDB(id, handle);
  
  let recents = getRecentFiles();
  // Remove existing entries with the same name
  recents = recents.filter(r => r.name !== handle.name);
  
  recents.unshift({ id, name: handle.name });
  
  // Keep only the top 5
  if (recents.length > 5) {
    recents = recents.slice(0, 5);
  }
  
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recents));
  return recents;
};

export const verifyPermission = async (fileHandle: FileSystemFileHandle, readWrite: boolean) => {
  const options = { mode: readWrite ? 'readwrite' : 'read' } as any;
  const handleAny = fileHandle as any;
  if ((await handleAny.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await handleAny.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
};

export const loadRecentFileHandle = async (id: string): Promise<FileSystemFileHandle | null> => {
  try {
    const handle = await getHandleFromDB(id);
    if (!handle) return null;
    
    const hasPermission = await verifyPermission(handle, false);
    if (!hasPermission) return null;
    return handle;
  } catch (e) {
    console.error("Failed to load recent file handle", e);
    return null;
  }
};
