// utils/quotaService.ts
import { doc, getDoc, increment, setDoc } from 'firebase/firestore';
import { MAX_SEARCHES } from './constants';
import { db, silentSignIn } from './firebaseConfig';

const getProfileDoc = async () => {
  const userId = await silentSignIn();
  if (!userId) return null;
  return doc(db, 'users', userId, 'profile', 'data');
};

export const getGeminiCount = async (): Promise<number> => {
  const userRef = await getProfileDoc();
  if (!userRef) return 0;

  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    const today = new Date().toDateString();
    return data.lastSavedDate === today ? (data.geminiCount || 0) : 0;
  }
  return 0;
};

export const checkQuota = async () => {
  const userRef = await getProfileDoc();
  if (!userRef) return 'OK';

  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    if (data.lastSavedDate === new Date().toDateString() && (data.geminiCount || 0) >= MAX_SEARCHES) {
      return 'LIMIT_REACHED';
    }
  }
  return 'OK';
};

export const incrementQuota = async () => {
  const userRef = await getProfileDoc();
  if (userRef) await setDoc(userRef, { geminiCount: increment(1) }, { merge: true });
};

export const checkMealsQuota = async () => {
  const userRef = await getProfileDoc();
  if (!userRef) return 0;
  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return data.lastSavedDate === new Date().toDateString() ? (data.mealsCount || 0) : 0;
  }
  return 0;
};

export const incrementMealsQuota = async () => {
  const userRef = await getProfileDoc();
  if (userRef) await setDoc(userRef, { mealsCount: increment(1) }, { merge: true });
  return 0;
};

export const decrementMealsQuota = async () => {
  const userRef = await getProfileDoc();
  if (userRef) await setDoc(userRef, { mealsCount: increment(-1) }, { merge: true });
  return 0;
};

export const checkActivitesQuota = async () => {
  const userRef = await getProfileDoc();
  if (!userRef) return 0;
  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return data.lastSavedDate === new Date().toDateString() ? (data.activitiesCount || 0) : 0;
  }
  return 0;
};

export const incrementActivitesQuota = async () => {
  const userRef = await getProfileDoc();
  if (userRef) await setDoc(userRef, { activitiesCount: increment(1) }, { merge: true });
  return 0;
};

export const decrementActivitesQuota = async () => {
  const userRef = await getProfileDoc();
  if (userRef) await setDoc(userRef, { activitiesCount: increment(-1) }, { merge: true });
  return 0;
};