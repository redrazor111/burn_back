import { deleteDoc, doc } from 'firebase/firestore';
import { db, silentSignIn } from './firebaseConfig';

export const removeFromHistory = async (id: string) => {
  try {
    const userId = await silentSignIn();
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'meals', id));
  } catch (e) {
    console.error("Error deleting from Firebase history:", e);
  }
};