import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 1. Standard imports from 'firebase/auth'
import {
  getAuth,
  initializeAuth,
  signInAnonymously
} from 'firebase/auth';

// 2. Import the persistence function from the internal package to fix the 'Module not found' error
// @ts-ignore
import { getReactNativePersistence } from '@firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 3. Initialize with a check to prevent "Already Initialized" errors during Fast Refresh
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (error) {
  authInstance = getAuth(app);
}

export const auth = authInstance;

export const silentSignIn = async () => {
  try {
    // Wait for the "Memory" to be read from the phone's disk
    if (auth.authStateReady) {
      await auth.authStateReady();
    }

    if (auth.currentUser) {
      return auth.currentUser.uid;
    }

    const userCredential = await signInAnonymously(auth);
    return userCredential.user.uid;
  } catch (error) {
    console.error("Auth Error", error);
    return null;
  }
};