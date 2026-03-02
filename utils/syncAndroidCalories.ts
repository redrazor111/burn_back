import { Alert } from 'react-native';
import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

export const syncAndroidCalories = async () => {
  try {
    const status = await getSdkStatus();

    if (status !== 1) {
      Alert.alert(
        "Health Connect unavailable",
        "Please ensure the Health Connect app is installed."
      );
      return 0;
    }

    // 2. Initialize
    const isInitialized = await initialize();
    if (!isInitialized) return 0;

    // 3. Request Permissions
    await requestPermission([
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' }
    ]);

    // 4. Time Range (Today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 5. Read Records
    const result = await readRecords('ActiveCaloriesBurned', {
      timeRangeFilter: {
        operator: 'after' as const,
        startTime: todayStart.toISOString(),
      },
    });

    // 6. Sum Total
    const totalActive = result.records.reduce((sum, record) => {
      return sum + (record.energy.inCalories || 0);
    }, 0);

    return Math.round(totalActive);
  } catch (error: any) {
    console.error("Health Connect Sync Error:", error);
    return 0;
  }
};