import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const saveToHistory = async (name: string, analysis: any) => {
  try {
    const SCAN_HISTORY_KEY = 'scan_history';
    const existingHistory = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
    const history = existingHistory ? JSON.parse(existingHistory) : [];

    const newEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      analysis: analysis // This now contains the correctly selected name/calories
    };

    await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify([newEntry, ...history].slice(0, 500)));
  } catch (e) {
    console.error("Failed to save scan history", e);
  }
};