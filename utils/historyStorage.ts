import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = 'scan_history';

interface ScanHistoryData {
  id: string;
  identifiedProduct: string;
  calories: number;
  date?: string;
}

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

export const saveToHistory = async (name: string, data: ScanHistoryData) => {
  const existing = await AsyncStorage.getItem('scan_history');
  const history = existing ? JSON.parse(existing) : [];

  const newEntry = {
    ...data,
    id: data.id || Date.now().toString(), // Use passed ID or fallback
    date: new Date().toISOString(),
  };

  await AsyncStorage.setItem('scan_history', JSON.stringify([newEntry, ...history]));
};