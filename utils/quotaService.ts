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

export const checkMealsQuota = async () => {
  const today = new Date().toISOString().split('T')[0];
  const storedData = await AsyncStorage.getItem('meals_quota');

  if (storedData) {
    const parsed = JSON.parse(storedData);
    // If it's a new day, return 0 (reset)
    if (parsed.date !== today) return 0;
    return parsed.count;
  }
  return 0;
};

export const incrementMealsQuota = async () => {
  const today = new Date().toISOString().split('T')[0];
  const currentCount = await checkMealsQuota();

  const newData = { date: today, count: currentCount + 1 };
  await AsyncStorage.setItem('meals_quota', JSON.stringify(newData));
  return newData.count;
};

export const decrementMealsQuota = async () => {
  const today = new Date().toISOString().split('T')[0];
  const currentCount = await checkMealsQuota();

  if (currentCount > 0) {
    const newData = { date: today, count: currentCount - 1 };
    await AsyncStorage.setItem('meals_quota', JSON.stringify(newData));
    return newData.count;
  }
  return 0;
};

export const checkActivitesQuota = async () => {
  const today = new Date().toISOString().split('T')[0];
  const storedData = await AsyncStorage.getItem('activities_quota');

  if (storedData) {
    const parsed = JSON.parse(storedData);
    // If it's a new day, return 0 (reset)
    if (parsed.date !== today) return 0;
    return parsed.count;
  }
  return 0;
};

export const incrementActivitesQuota = async () => {
  const today = new Date().toISOString().split('T')[0];
  const currentCount = await checkActivitesQuota();

  const newData = { date: today, count: currentCount + 1 };
  await AsyncStorage.setItem('activities_quota', JSON.stringify(newData));
  return newData.count;
};

export const decrementActivitesQuota = async () => {
  const today = new Date().toISOString().split('T')[0];
  const currentCount = await checkActivitesQuota();

  if (currentCount > 0) {
    const newData = { date: today, count: currentCount - 1 };
    await AsyncStorage.setItem('activities_quota', JSON.stringify(newData));
    return newData.count;
  }
  return 0;
};