

import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Camera } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Firebase Imports
import { auth, db } from '@/utils/firebaseConfig';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

// Local Utilities & Components
import { saveToHistory } from '@/utils/historyStorage';
import { checkQuota, incrementQuota } from '@/utils/quotaService';
import { analyzeImageWithGemini } from '../utils/geminiService';
import { useSubscriptionStatus } from '../utils/subscription';
import PremiumModal from './PremiumModal';
import Scanner from './Scanner';

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isPro } = useSubscriptionStatus();
  const isFocused = useIsFocused();

  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPremium, setShowPremium] = useState(false);

  // Prompt/Result States
  const [pendingResult, setPendingResult] = useState(null);
  const [isEditingSelection, setIsEditingSelection] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCals, setEditCals] = useState('');

  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scanLineAnim.stopAnimation();
    }
  }, [isLoading]);

  const handleScan = async (base64Data) => {
    if (!isPro) {
      const status = await checkQuota();
      if (status === 'LIMIT_REACHED') {
        setShowPremium(true);
        return;
      }
    }

    setIsLoading(true);
    try {
      const rawResponse = await analyzeImageWithGemini(base64Data, isPro);
      const data = JSON.parse(rawResponse);
      await incrementQuota();

      setPendingResult({ options: data.identifiedOptions, rawResult: data });
    } catch (e) {
      console.error("Scan Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSelection = async (option) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // 1. Save to Firebase Firestore
      const docRef = await addDoc(collection(db, 'users', user.uid, 'meals'), {
        productName: option.name,
        calories: option.calories.toString(),
        isManual: false, // Flagged as AI scan
        date: new Date().toISOString(),
        createdAt: serverTimestamp(), // For accurate history sorting
      });

      // 2. Save to history using the docRef.id to fix the Type Error
      await saveToHistory(option.name, {
        id: docRef.id,
        identifiedProduct: option.name,
        calories: option.calories
      });

      // 3. Reset states & Navigate
      setPendingResult(null);
      setIsEditingSelection(false);
      navigation.navigate('Today');

    } catch (e) {
      console.error("Firebase Confirmation Error:", e);
      alert("Could not save to the cloud. Check your connection.");
    }
  };

  const startEditingOption = (opt) => {
    setEditName(opt.name);
    setEditCals(opt.calories.toString());
    setIsEditingSelection(true);
  };

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 280]
  });

  return (
    <View style={styles.container}>
      {/* UI Code stays identical to yours ... */}
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <Text style={styles.title}>AI Food Scanner</Text>
        <View style={styles.headerAccentBar} />
        <Text style={styles.subtitle}>ANALYZE NUTRITION INSTANTLY WITH AI</Text>
      </View>

      <View style={styles.cameraContainer}>
        {hasPermission && isFocused ? (
          <View style={styles.cameraWrapper}>
            <Scanner onScan={handleScan} disabled={isLoading} />
            <View style={styles.viewfinderOverlay} pointerEvents="none">
              <View style={styles.viewfinderBox}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                {isLoading && <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />}
              </View>
              <View style={styles.instructionContainer}>
                <Text style={styles.instructionText}>
                  {isLoading ? "Analyzing Nutrition..." : "Point at food label or meal"}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.placeholderCenter}>
            <ActivityIndicator size="large" color="#1B4D20" />
            <Text style={styles.errorText}>
              {!hasPermission ? "Waiting for Camera Permission..." : "Loading Camera..."}
            </Text>
          </View>
        )}
      </View>

      {pendingResult && (
        <Modal visible={!!pendingResult} transparent animationType="fade" statusBarTranslucent>
          <View style={styles.androidOverlay}>
            <View style={styles.androidSelectionBox}>
              <Text style={styles.editTitle}>{isEditingSelection ? "Adjust Details" : "Select Best Match"}</Text>

              {isEditingSelection ? (
                <View style={{ width: '100%', padding: 10 }}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Food Name</Text>
                    <TextInput style={[styles.editInputSmall, { textAlign: 'left' }]} value={editName} onChangeText={setEditName} />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Calories</Text>
                    <TextInput style={styles.editInputSmall} value={editCals} onChangeText={setEditCals} keyboardType="numeric" />
                  </View>
                  <View style={styles.editActions}>
                    <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditingSelection(false)}>
                      <Text>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={() => confirmSelection({ name: editName, calories: parseInt(editCals) || 0 })}>
                      <Text style={{ color: '#fff' }}>Add Meal</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                    {pendingResult?.options?.map((opt, idx) => (
                      <View key={idx} style={styles.optionCard}>
                        <TouchableOpacity style={{ flex: 1 }}>
                          <Text style={styles.optionName}>{opt.name}</Text>
                          <Text style={styles.optionCal}>{opt.calories} cal</Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity onPress={() => startEditingOption(opt)} style={{ padding: 8 }}>
                            <Ionicons name="pencil" size={20} color="#9E9E9E" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => confirmSelection(opt)} style={{ padding: 8 }}>
                            <Ionicons name="add-circle" size={28} color="#1B4D20" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <TouchableOpacity style={[styles.cancelBtn, { marginTop: 15 }]} onPress={() => setPendingResult(null)}>
                    <Text style={styles.closeText}>Cancel Scan</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBFBFB' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1B4D20', // <--- Your primary brand green
    letterSpacing: -1, // Tight tracking looks better with colored titles
  },
  headerAccentBar: {
    width: 45,
    height: 4,
    backgroundColor: '#1B4D20',
    opacity: 0.2, // Making the bar semi-transparent makes the title the star
    borderRadius: 2,
    marginTop: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraWrapper: { flex: 1 },
  viewfinderOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  viewfinderBox: { width: 280, height: 280, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#4CAF50', borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { height: 3, backgroundColor: '#4CAF50', width: '100%', elevation: 5 },
  instructionContainer: { marginTop: 40, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  instructionText: { color: '#FFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  placeholderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  errorText: { color: '#FFF', marginTop: 20, fontWeight: '600' },

  // Modal Styles
  androidOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  androidSelectionBox: { width: '90%', backgroundColor: '#FFF', borderRadius: 25, padding: 20 },
  editTitle: { fontSize: 18, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  optionName: { fontSize: 15, fontWeight: '800' },
  optionCal: { fontSize: 13, color: '#2E7D32', fontWeight: '700' },
  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#999', marginBottom: 5, textTransform: 'uppercase' },
  editInputSmall: { backgroundColor: '#F5F5F5', padding: 12, borderRadius: 12, fontSize: 16, fontWeight: '700' },
  editActions: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtn: { backgroundColor: '#1B4D20' },
  cancelBtn: { backgroundColor: '#F5F5F5', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  closeText: { color: '#9E9E9E', fontWeight: '800' }
});