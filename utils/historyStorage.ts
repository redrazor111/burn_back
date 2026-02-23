import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { MAX_HISTORY } from './constants';

export const saveToHistory = async (base64Data: string, analysisData: any) => {
  try {
    // 1. Ensure the URI has the correct prefix for the manipulator
    const imageUri = base64Data.startsWith('data:image')
      ? base64Data
      : `data:image/jpeg;base64,${base64Data}`;

    // 2. Shrink the image so it fits in the 2MB CursorWindow
    // We resize to 800px width and 60% quality
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 800 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    // 3. Fix the "Type undefined" error by providing a fallback string
    const compressedBase64 = manipulatedImage.base64 || "";

    if (!compressedBase64) {
      throw new Error("Failed to compress image");
    }

    // 4. Prepare the new history item
    const newEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(),
      uri: compressedBase64,
      analysis: analysisData,
    };

    // 5. Save to AsyncStorage
    const existingHistory = await AsyncStorage.getItem('scan_history');
    let history = existingHistory ? JSON.parse(existingHistory) : [];

    // Add to start and trim to max limit
    history = [newEntry, ...history].slice(0, MAX_HISTORY);

    await AsyncStorage.setItem('scan_history', JSON.stringify(history));
    console.log("Scan saved successfully (compressed)");

  } catch (error) {
    console.error("Could not save scan to history:", error);
  }
};