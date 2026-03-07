import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
 apiKey: "AIzaSyDKkQjb8wmZjWs37kbD202A6q-dk4inwog",
  authDomain: "isitgood-54705.firebaseapp.com",
  projectId: "isitgood-54705",
  storageBucket: "isitgood-54705.firebasestorage.app",
  messagingSenderId: "1026350183360",
  appId: "1:1026350183360:android:a4c4bd90eaae66b2134e25"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const silentSignIn = async () => {
  try {
    if (auth.currentUser) return auth.currentUser.uid;
    const userCredential = await signInAnonymously(auth);
    return userCredential.user.uid;
  } catch (error) {
    console.error("Auth Error", error);
    return null;
  }
};