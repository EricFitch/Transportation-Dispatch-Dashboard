let firebaseApp = null;
let firestoreDb = null;
let firebaseAuth = null;
let firebaseModules = null;
let initPromise = null;

async function loadFirebaseModules() {
  if (firebaseModules) {
    return firebaseModules;
  }

  const [appModule, firestoreModule, authModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js')
  ]);

  firebaseModules = {
    initializeApp: appModule.initializeApp,
    getApps: appModule.getApps,
    getApp: appModule.getApp,
    // Prefer initializeFirestore so we can pass settings (long polling fallback)
    initializeFirestore: firestoreModule.initializeFirestore,
    getFirestore: firestoreModule.getFirestore,
    getAuth: authModule.getAuth,
    enableIndexedDbPersistence: firestoreModule.enableIndexedDbPersistence,
    doc: firestoreModule.doc,
    setDoc: firestoreModule.setDoc,
    updateDoc: firestoreModule.updateDoc,
    deleteDoc: firestoreModule.deleteDoc,
    getDoc: firestoreModule.getDoc,
    collection: firestoreModule.collection,
    onSnapshot: firestoreModule.onSnapshot,
    serverTimestamp: firestoreModule.serverTimestamp,
    runTransaction: firestoreModule.runTransaction,
    signInAnonymously: authModule.signInAnonymously,
    onAuthStateChanged: authModule.onAuthStateChanged
  };

  return firebaseModules;
}

export async function initFirebase(config) {
  if (!config || !config.apiKey) {
    throw new Error('Firebase configuration with an apiKey is required');
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const modules = await loadFirebaseModules();

    if (!firebaseApp) {
      firebaseApp = modules.initializeApp(config);
    }

    if (!firestoreDb) {
      // Use initializeFirestore when available to pass transport settings that work behind proxies/VPNs
      if (modules.initializeFirestore) {
        try {
          firestoreDb = modules.initializeFirestore(firebaseApp, {
            experimentalAutoDetectLongPolling: true,
            useFetchStreams: false
          });
        } catch (e) {
          console.warn('⚠️ initializeFirestore failed, falling back to getFirestore:', e?.message || e);
          firestoreDb = modules.getFirestore(firebaseApp);
        }
      } else {
        firestoreDb = modules.getFirestore(firebaseApp);
      }
      if (modules.enableIndexedDbPersistence) {
        try {
          await modules.enableIndexedDbPersistence(firestoreDb);
        } catch (error) {
          const code = error?.code || error?.message;
          if (code !== 'failed-precondition' && code !== 'unimplemented') {
            console.warn('⚠️ IndexedDB persistence unavailable:', error);
          }
        }
      }
    }

    if (!firebaseAuth && modules.getAuth) {
      firebaseAuth = modules.getAuth(firebaseApp);
      if (firebaseAuth && !firebaseAuth.currentUser && modules.signInAnonymously) {
        try {
          await modules.signInAnonymously(firebaseAuth);
        } catch (error) {
          const code = error?.code || error?.message;
          if (code === 'auth/operation-not-allowed') {
            throw new Error('Anonymous authentication is not enabled for this Firebase project. Enable it in the Firebase console or adjust the security rules.');
          }
          console.error('❌ Anonymous Firebase authentication failed:', error);
          throw error;
        }
      }
    }

    return { app: firebaseApp, db: firestoreDb, auth: firebaseAuth, modules };
  })();

  return initPromise;
}

export function isFirebaseInitialized() {
  return !!firestoreDb;
}

export async function getFirebaseModules() {
  return loadFirebaseModules();
}
