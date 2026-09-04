export interface ClientCV {
  name: string;
  type: string;
  dataBase64: string;
  size: number;
  lastModified: number;
}

const DB_NAME = 'jobcrawling_local_storage';
const STORE_NAME = 'user_cv_store';
const KEY = 'active_cv';
const LOCAL_STORAGE_KEY = 'jobcrawling_active_cv_meta';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveClientCV(file: File): Promise<ClientCV> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error reading file as Base64'));
    reader.onload = async () => {
      try {
        const dataBase64 = reader.result as string;
        const cvData: ClientCV = {
          name: file.name,
          type: file.type || 'application/pdf',
          dataBase64,
          size: file.size,
          lastModified: file.lastModified || Date.now()
        };

        try {
          const db = await openDatabase();
          await new Promise<void>((res, rej) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(cvData, KEY);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
          });
        } catch (idbErr) {
          console.warn('IndexedDB write failed, falling back to localStorage:', idbErr);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cvData));
        }

        resolve(cvData);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}

export async function getClientCV(): Promise<ClientCV | null> {
  try {
    const db = await openDatabase();
    const result = await new Promise<ClientCV | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (result) return result;
  } catch (err) {
    console.warn('IndexedDB read failed, trying localStorage fallback:', err);
  }

  // Fallback
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as ClientCV;
    }
  } catch {
    // Ignore fallback errors
  }

  return null;
}

export async function removeClientCV(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete failed:', err);
  }

  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // Ignore localStorage cleanup errors
  }
}

export function clientCVToFile(cv: ClientCV): File {
  const arr = cv.dataBase64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || cv.type || 'application/octet-stream';
  const bstr = atob(arr[1] || arr[0]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  const blob = new Blob([u8arr], { type: mime });
  return new File([blob], cv.name, { type: mime, lastModified: cv.lastModified });
}
