import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_HISTORY } from './constants';

const HISTORY_KEY = 'scan_history';

export const removeFromHistory = async (id: string) => {
  try {
    const existing = await AsyncStorage.getItem(HISTORY_KEY);
    if (!existing) return;
    const history = JSON.parse(existing);
    const filtered = history.filter((item: any) => item.id !== id);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Error deleting from history storage:", e);
  }
};

export const clearAllHistory = async () => {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.error("Error clearing history storage:", e);
  }
};

export const saveToHistory = async (_base64Ignored: string, analysisData: any) => {
  try {
    const newEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      analysis: analysisData,
      // uri is removed from the storage object entirely
    };

    const existingHistory = await AsyncStorage.getItem(HISTORY_KEY);
    let history = existingHistory ? JSON.parse(existingHistory) : [];

    history = [newEntry, ...history].slice(0, MAX_HISTORY);

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    console.log("Scan saved successfully (text-only)");
  } catch (error) {
    console.error("Could not save scan to history:", error);
  }
};