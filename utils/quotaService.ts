// utils/quotaService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_SEARCHES } from './constants';

export const checkQuota = async () => {
  const today = new Date().toISOString().split('T')[0];
  const storedData = await AsyncStorage.getItem('gemini_quota');

  if (storedData) {
    const parsed = JSON.parse(storedData);
    if (parsed.date === today && parsed.count >= MAX_SEARCHES) {
      return 'LIMIT_REACHED';
    }
  }
  return 'OK';
};

export const incrementQuota = async () => {
  const today = new Date().toISOString().split('T')[0];
  const storedData = await AsyncStorage.getItem('gemini_quota');
  let count = 0;

  if (storedData) {
    const parsed = JSON.parse(storedData);
    if (parsed.date === today) count = parsed.count;
  }

  await AsyncStorage.setItem('gemini_quota', JSON.stringify({ date: today, count: count + 1 }));
};