import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { checkQuota, incrementQuota } from '@/utils/quotaService';
import Guide from '../components/Guide';
import Shop from '../components/Shop';
import { analyzeImageWithGemini } from '../utils/geminiService';
import { useSubscriptionStatus } from '../utils/subscription';
import PremiumModal from './PremiumModal';
import Scanner from './Scanner';

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isPro } = useSubscriptionStatus();
  const isFocused = useIsFocused();

  // Permissions State (null = determining, false = denied, true = granted)
  const [hasPermission, setHasPermission] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showShop, setShowShop] = useState(false);

  // Result States
  const [pendingResult, setPendingResult] = useState(null);
  const [isEditingSelection, setIsEditingSelection] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCals, setEditCals] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');

  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // 1. Handle Camera Permissions ONLY when tab is focused
  useEffect(() => {
    if (isFocused && hasPermission === null) {
      (async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      })();
    }
  }, [isFocused]);

  // 2. Handle Scanning Line Animation
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
      const rawResponse = await analyzeImageWithGemini(isPro, undefined, base64Data, undefined);
      const data = JSON.parse(rawResponse);
      await incrementQuota();
      setPendingResult({ options: data.identifiedOptions.slice(0, 3), rawResult: data });
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
      await addDoc(collection(db, 'users', user.uid, 'meals'), {
        productName: option.name,
        calories: option.calories.toString(),
        protein: parseInt(option.protein || 0),
        carbs: parseInt(option.carbs || 0),
        isManual: false,
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });

      setPendingResult(null);
      setIsEditingSelection(false);
      navigation.navigate('Today');
    } catch (e) {
      console.error("Firebase Error:", e);
    }
  };

  const startEditingOption = (opt) => {
    setEditName(opt.name);
    setEditCals(opt.calories.toString());
    setEditProtein((opt.protein || 0).toString());
    setEditCarbs((opt.carbs || 0).toString());
    setIsEditingSelection(true);
  };

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 280]
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>AI Scanner</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setShowGuide(true)} style={styles.actionBtn}>
              <MaterialCommunityIcons name="book-open-variant" size={28} color="#1B4D20" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowShop(true)} style={styles.actionBtn}>
              <MaterialCommunityIcons name="cart-variant" size={28} color="#1B4D20" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerAccentBar} />
        <Text style={styles.subtitle}>ANALYZE NUTRITION INSTANTLY</Text>
      </View>

      {/* Camera Viewport */}
      <View style={styles.cameraContainer}>
        {hasPermission === true && isFocused ? (
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
            {hasPermission === false ? (
              <Text style={styles.errorText}>Camera permission denied. Enable it in settings.</Text>
            ) : (
              <ActivityIndicator size="large" color="#1B4D20" />
            )}
          </View>
        )}
      </View>

      {/* Results Selection Modal */}
      {pendingResult && (
        <Modal visible={!!pendingResult} transparent animationType="fade" statusBarTranslucent>
          <View style={styles.androidOverlay}>
            <View style={styles.androidSelectionBox}>
              <Text style={styles.editTitle}>{isEditingSelection ? "Adjust Details" : "Select Best Match"}</Text>

              {isEditingSelection ? (
                <ScrollView style={{ width: '100%', padding: 10 }}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Food Name</Text>
                    <TextInput style={styles.editInputSmall} value={editName} onChangeText={setEditName} />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Calories</Text>
                    <TextInput style={styles.editInputSmall} value={editCals} onChangeText={setEditCals} keyboardType="numeric" />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={[styles.inputGroup, { flex: 0.48 }]}>
                      <Text style={styles.inputLabel}>Protein (g)</Text>
                      <TextInput style={styles.editInputSmall} value={editProtein} onChangeText={setEditProtein} keyboardType="numeric" />
                    </View>
                    <View style={[styles.inputGroup, { flex: 0.48 }]}>
                      <Text style={styles.inputLabel}>Carbs (g)</Text>
                      <TextInput style={styles.editInputSmall} value={editCarbs} onChangeText={setEditCarbs} keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={styles.editActions}>
                    <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditingSelection(false)}>
                      <Text>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={() => confirmSelection({
                      name: editName,
                      calories: parseInt(editCals) || 0,
                      protein: parseInt(editProtein) || 0,
                      carbs: parseInt(editCarbs) || 0
                    })}>
                      <Text style={{ color: '#fff' }}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              ) : (
                <>
                  <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                    {pendingResult?.options?.map((opt, idx) => (
                      <View key={idx} style={styles.optionCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optionName}>{opt.name}</Text>
                          <Text style={styles.optionCal}>{opt.calories} cal</Text>
                          <Text style={{fontSize: 11, color: '#666'}}>P: {opt.protein || 0}g | C: {opt.carbs || 0}g</Text>
                        </View>
                        <View style={{ flexDirection: 'row' }}>
                          <TouchableOpacity onPress={() => startEditingOption(opt)} style={styles.rowActionBtn}>
                            <MaterialCommunityIcons name="pencil" size={18} color="#1B4D20" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => confirmSelection(opt)} style={[styles.rowActionBtn, {backgroundColor: '#E8F5E9'}]}>
                            <Ionicons name="add-circle" size={24} color="#1B4D20" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <TouchableOpacity style={[styles.cancelBtn, { marginTop: 15 }]} onPress={() => setPendingResult(null)}>
                    <Text style={{fontWeight: '800', color: '#999'}}>Cancel Scan</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Guide & Shop Modals */}
      <Modal visible={showGuide} animationType="slide"><View style={styles.modalContainer}><Guide /><TouchableOpacity style={styles.bottomCloseBtn} onPress={() => setShowGuide(false)}><Text style={{color: '#fff'}}>Close</Text></TouchableOpacity></View></Modal>
      <Modal visible={showShop} animationType="slide"><View style={styles.modalContainer}><Shop /><TouchableOpacity style={styles.bottomCloseBtn} onPress={() => setShowShop(false)}><Text style={{color: '#fff'}}>Close</Text></TouchableOpacity></View></Modal>
      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBFBFB' },
  header: { paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { marginLeft: 15 },
  title: { fontSize: 22, fontWeight: '900', color: '#1B4D20' },
  headerAccentBar: { width: 45, height: 4, backgroundColor: '#1B4D20', opacity: 0.2, borderRadius: 2, marginTop: 4, marginBottom: 15 },
  subtitle: { fontSize: 10, color: '#666', fontWeight: '800', letterSpacing: 1.2 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraWrapper: { flex: 1 },
  viewfinderOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  viewfinderBox: { width: 280, height: 280, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#4CAF50', borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { height: 3, backgroundColor: '#4CAF50', width: '100%' },
  instructionContainer: { marginTop: 40, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  instructionText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  placeholderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#FFF', textAlign: 'center', padding: 20 },
  androidOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  androidSelectionBox: { width: '90%', backgroundColor: '#FFF', borderRadius: 25, padding: 20 },
  editTitle: { fontSize: 18, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 12, borderRadius: 18, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  optionName: { fontSize: 15, fontWeight: '800' },
  optionCal: { fontSize: 13, color: '#2E7D32', fontWeight: '700' },
  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#999', marginBottom: 5 },
  editInputSmall: { backgroundColor: '#F5F5F5', padding: 12, borderRadius: 12, fontSize: 16, fontWeight: '700' },
  editActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtn: { backgroundColor: '#1B4D20' },
  cancelBtn: { backgroundColor: '#F5F5F5', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  rowActionBtn: { padding: 8, marginLeft: 6, backgroundColor: '#F0F0F0', borderRadius: 10, width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  bottomCloseBtn: { backgroundColor: '#1B4D20', padding: 15, margin: 20, borderRadius: 12, alignItems: 'center' },
});