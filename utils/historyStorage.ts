import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, silentSignIn } from './firebaseConfig';

interface ScanHistoryData {
  id: string;
  identifiedProduct: string;
  calories: number;
  protein: number;
  carbs: number;
  date?: string;
  isManual?: boolean;
}

export const removeFromHistory = async (id: string) => {
  try {
    const userId = await silentSignIn();
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'meals', id));
  } catch (e) {
    console.error("Error deleting from Firebase history:", e);
  }
};

export const saveToHistory = async (name: string, data: ScanHistoryData) => {
  try {
    const userId = await silentSignIn();
    if (!userId) return;

    const mealId = data.id || Date.now().toString();

    await setDoc(doc(db, 'users', userId, 'meals', mealId), {
      productName: name,
      calories: data.calories.toString(),
      protein: data.protein.toString(),
      carbs:data.carbs.toString(),
      isManual: data.isManual ?? false,
      date: data.date || new Date().toISOString(),
      createdAt: serverTimestamp(),
    }, { merge: true });

  } catch (e) {
    console.error("Error saving to Firebase history:", e);
  }
};