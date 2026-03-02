import { Alert, Linking } from 'react-native';
import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

export const syncAndroidCalories = async () => {
  try {
    // 1. Check Status
    const status = await getSdkStatus();

    // Status 2 means supported but NOT installed (Common on S9)
    // Status 3 means update required
    if (status === 2 || status === 3) {
      Alert.alert(
        "Health Connect Required",
        "Your phone supports health syncing, but you need to install or update the Health Connect app from the Play Store.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Install", onPress: () => Linking.openURL('market://details?id=com.google.android.apps.healthdata') }
        ]
      );
      return 0;
    }

    if (status !== 1) return 0; // SDK not available on this hardware

    // 2. Initialize
    const isInitialized = await initialize();
    if (!isInitialized) return 0;

    // 3. Request Permissions (Wrap this specifically to catch crashes)
    try {
      await requestPermission([
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' }
      ]);
    } catch (permError) {
      console.warn("User cancelled or permission failed:", permError);
      return 0;
    }

    // 4. Time Range (Today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 5. Read Records
    const result = await readRecords('ActiveCaloriesBurned', {
      timeRangeFilter: {
        operator: 'after',
        startTime: todayStart.toISOString(),
      },
    });

    // 6. Sum Total
    const totalActive = result.records.reduce((sum, record) => {
      return sum + (record.energy.inCalories || 0);
    }, 0);

    return Math.round(totalActive);
  } catch (error) {
    console.error("Health Connect Sync Error:", error);
    return 0;
  }
};