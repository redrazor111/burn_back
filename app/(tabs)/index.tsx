/* eslint-disable react/no-unescaped-entities */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'expo-camera';
import React, { ComponentProps, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// Navigation & Safe Area Imports
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Local Imports
import { saveToHistory } from '@/utils/historyStorage';
import { checkQuota, incrementQuota } from '@/utils/quotaService';
import * as ImageManipulator from 'expo-image-manipulator';
import Guide from '../../components/Guide'; // Restored Guide Import
import Ingredients from '../../components/Ingredients';
import PremiumModal from '../../components/PremiumModal';
import ScanHistory from '../../components/ScanHistory';
import Scanner from '../../components/Scanner';
import Shop from '../../components/Shop';
import StatusCard from '../../components/StatusCard';
import { analyzeImageWithGemini } from '../../utils/geminiService';
import { useSubscriptionStatus } from '../../utils/subscription';

const Tab = createMaterialTopTabNavigator();

// Storage Keys
const TARGET_CALORIE_KEY = '@daily_target_calories';
const CURRENT_DAY_SCANS_KEY = '@current_day_scans';
const LAST_SAVED_DATE_KEY = '@last_saved_date';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface AnalysisState {
  text: string;
  status: string;
}

interface ScanResult {
  id: string;
  imageUri: string;
  productName: string;
  calories: string;
  activities: AnalysisState[];
  isExpanded: boolean;
}

// --- CAMERA SCREEN COMPONENT ---
function CameraScreen({ onImageCaptured, onRecommendationsFound, pendingRerunUri, onRerunHandled }: any) {
  const insets = useSafeAreaInsets();
  const [targetCalories, setTargetCalories] = useState('2000');
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showPremium, setShowPremium] = useState(false);

  const { isPro, loading } = useSubscriptionStatus();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initializeAppData = async () => {
      await loadTargetCalories();
      await checkAndResetDailyData();
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    initializeAppData();
  }, []);

  useEffect(() => {
    if (scans.length >= 0) {
      AsyncStorage.setItem(CURRENT_DAY_SCANS_KEY, JSON.stringify(scans));
      AsyncStorage.setItem(LAST_SAVED_DATE_KEY, new Date().toDateString());
    }
  }, [scans]);

  useEffect(() => {
    if (pendingRerunUri) {
      handleScan(pendingRerunUri);
      onRerunHandled();
    }
  }, [pendingRerunUri]);

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

  const checkAndResetDailyData = async () => {
    try {
      const lastSavedDate = await AsyncStorage.getItem(LAST_SAVED_DATE_KEY);
      const today = new Date().toDateString();
      if (lastSavedDate && lastSavedDate !== today) {
        await AsyncStorage.removeItem(CURRENT_DAY_SCANS_KEY);
        setScans([]);
      } else {
        const savedScans = await AsyncStorage.getItem(CURRENT_DAY_SCANS_KEY);
        if (savedScans) setScans(JSON.parse(savedScans));
      }
    } catch (e) { console.error(e); }
  };

  const loadTargetCalories = async () => {
    try {
      const savedValue = await AsyncStorage.getItem(TARGET_CALORIE_KEY);
      if (savedValue !== null) setTargetCalories(savedValue);
    } catch (e) { console.error(e); }
  };

  const saveTargetCalories = async (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    await AsyncStorage.setItem(TARGET_CALORIE_KEY, numericValue);
    setTargetCalories(numericValue || '2000');
    setIsEditingTarget(false);
    Keyboard.dismiss();
  };

  const deleteScan = async (id: string) => {
    setScans(prev => prev.filter(s => s.id !== id));
  };

  const toggleExpand = (id: string) => {
    setScans(prev => prev.map(s => s.id === id ? { ...s, isExpanded: !s.isExpanded } : s));
  };

  const getStatusColor = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      const status = parsed?.status?.toUpperCase();
      if (status === "UNHEALTHY" || status === "UNSAFE") return "#FF5252";
      if (status === "MODERATE" || status === "CAUTION") return "#FFB300";
      if (status === "HEALTHY" || status === "SAFE") return "#2E7D32";
    } catch { return "#757575"; }
    return "#757575";
  };

  const handleScan = async (base64Data: string) => {
    if (!isPro) {
      const status = await checkQuota();
      if (status === 'LIMIT_REACHED') {
        setShowPremium(true);
        return;
      }
    }

    setIsLoading(true);
    const cleanBase64 = base64Data.replace('data:image/jpeg;base64,', '');
    onImageCaptured(cleanBase64);

    try {
      const rawResponse = await analyzeImageWithGemini(base64Data, isPro);
      const data = JSON.parse(rawResponse);
      await incrementQuota();

      const newScan: ScanResult = {
        id: Date.now().toString(),
        imageUri: base64Data.startsWith('data') ? base64Data : `data:image/jpeg;base64,${base64Data}`,
        productName: data.identifiedProduct || "Unknown Item",
        calories: data.calories || "0",
        isExpanded: true,
        activities: [
          data.activity1, data.activity2, data.activity3, data.activity4, data.activity5,
          data.activity6, data.activity7, data.activity8, data.activity9, data.activity10
        ].map(act => ({
          text: JSON.stringify(act),
          status: getStatusColor(JSON.stringify(act))
        }))
      };

      setScans(prev => [newScan, ...prev]);
      if (data.recommendations) onRecommendationsFound(data.recommendations);

      const compressedImage = await ImageManipulator.manipulateAsync(newScan.imageUri, [{ resize: { width: 800 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      await saveToHistory(compressedImage.base64!, data);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const totalSessionCalories = scans.reduce((sum, s) => sum + Number(s.calories), 0);
  const remainingCalories = Math.max(Number(targetCalories) - totalSessionCalories, 0);
  const translateY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 180] });

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.cameraTabContainer}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <Text style={styles.title}>Capture Image</Text>
        <Text style={styles.subtitle}>Take image of product or ingredients</Text>
      </View>

      <View style={styles.cameraViewHalf}>
        {hasPermission ? (
          <>
            <Scanner onScan={handleScan} disabled={isLoading} />
            <View style={styles.viewfinderOverlay} pointerEvents="none">
              <View style={styles.viewfinderBox}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                {isLoading && <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.placeholderCenter}><ActivityIndicator size="large" color="#ffffff" /></View>
        )}
      </View>

      <View style={styles.resultsHalf}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>

          <View style={styles.mainTargetBadge}>
            <View style={styles.targetSplitRow}>
              <TouchableOpacity style={styles.targetColumn} onPress={() => setIsEditingTarget(true)}>
                <Text style={styles.targetLabel}>Goal</Text>
                <Text style={styles.targetValue}>{targetCalories}</Text>
                <View style={styles.prominentEditBtn}>
                  <Ionicons name="pencil" size={12} color="#1B4D20" />
                  <Text style={styles.prominentEditBtnText}>Edit Goal</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.verticalDivider} />
              <View style={styles.targetColumn}>
                <Text style={styles.targetLabel}>Remaining</Text>
                <Text style={[styles.targetValue, { color: remainingCalories <= 200 ? '#FF5252' : '#2E7D32' }]}>
                  {remainingCalories}
                </Text>
                <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{remainingCalories > 0 ? 'On Track' : 'Limit Reached'}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Today's Meals</Text>
            {scans.length > 0 && (
                <TouchableOpacity onPress={() => setScans([])}>
                    <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
            )}
          </View>

          {scans.length === 0 && !isLoading && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={44} color="#E0E0E0" />
              <Text style={styles.emptyStateText}>Snap your first meal to start tracking today!</Text>
            </View>
          )}

          {scans.map((item) => (
            <View key={item.id} style={styles.collapsibleCard}>
              <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item.id)}>
                <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />
                <View style={styles.headerInfo}>
                  <Text style={styles.foodTitle}>{item.productName}</Text>
                  <Text style={styles.foodCals}>{item.calories} Calories</Text>
                </View>
                <TouchableOpacity onPress={() => deleteScan(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color="#FF5252" />
                </TouchableOpacity>
                <Ionicons name={item.isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#9E9E9E" style={{ marginLeft: 10 }} />
              </TouchableOpacity>

              {item.isExpanded && (
                <View style={styles.expandedContent}>
                    {item.activities.map((activity, index) => {
                        const titles = ["Running", "Walking", "Weights", "Cycling", "Swimming", "HIIT", "Yoga", "Rowing", "Jump Rope", "Hiking"];
                        const icons = ["run", "walk", "weight-lifter", "bike", "swim", "lightning-bolt", "yoga", "rowing", "jump-rope", "image-filter-hdr"];
                        return (
                            <StatusCard
                                key={index}
                                title={titles[index]}
                                data={activity}
                                icon={icons[index]}
                                isParentLoading={false}
                                isLocked={index > 1 && !isPro}
                            />
                        );
                    })}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />

      {isEditingTarget && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>Update Daily Goal</Text>
            <TextInput style={styles.editInput} value={targetCalories} onChangeText={setTargetCalories} keyboardType="numeric" autoFocus maxLength={4} />
            <View style={styles.editActions}>
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditingTarget(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={() => saveTargetCalories(targetCalories)}>
                    <Text style={styles.saveButtonText}>Save Goal</Text>
                </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// --- MAIN NAVIGATION LOGIC ---
function AppContent() {
  const insets = useSafeAreaInsets();
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [pendingRerunUri, setPendingRerunUri] = useState<string | null>(null);

  const iconMap: Record<string, IoniconsName> = {
    Camera: 'camera-outline',
    Guide: 'book-outline', // Added Guide Icon
    Product: 'nutrition-outline',
    History: 'time-outline',
    Shop: 'cart-outline',
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <Tab.Navigator
        tabBarPosition="bottom"
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: '#1B4D20',
          tabBarInactiveTintColor: '#9E9E9E',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', textTransform: 'none', paddingBottom: 5 },
          tabBarIndicatorStyle: { height: 0 },
          tabBarStyle: {
            backgroundColor: '#fff',
            height: 75 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 5,
            paddingTop: 5,
            shadowColor: "#000",
            elevation: 10,
          },
          tabBarIcon: ({ color, focused }) => {
            const iconName = iconMap[route.name] || 'help-circle-outline';
            const finalIconName = focused ? iconName.replace('-outline', '') as IoniconsName : iconName;
            return <Ionicons name={finalIconName} size={24} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Camera">
          {() => <CameraScreen onImageCaptured={setScannedImage} onRecommendationsFound={setRecommendations} pendingRerunUri={pendingRerunUri} onRerunHandled={() => setPendingRerunUri(null)} />}
        </Tab.Screen>
        <Tab.Screen name="Guide">{() => <Guide />}</Tab.Screen>
        <Tab.Screen name="History">
          {() => <ScanHistory onTriggerRerun={(rawUri: string) => { setScannedImage(rawUri); setPendingRerunUri(rawUri); }} />}
        </Tab.Screen>
        <Tab.Screen name="Product">{() => <Ingredients imageUri={scannedImage} />}</Tab.Screen>
        <Tab.Screen name="Shop">{() => <Shop recommendedProducts={recommendations} />}</Tab.Screen>
      </Tab.Navigator>
    </View>
  );
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  cameraTabContainer: { flex: 1, backgroundColor: '#FBFBFB' },
  header: { paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff', zIndex: 10, elevation: 10 },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#757575', marginTop: 4 },
  cameraViewHalf: { height: '35%', backgroundColor: '#000', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF', marginTop: 12, fontWeight: '700', fontSize: 16 },
  resultsHalf: { flex: 1, paddingHorizontal: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: 1.2 },
  clearAllText: { fontSize: 12, fontWeight: '700', color: '#FF5252' },
  mainTargetBadge: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 22, marginTop: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15, elevation: 5, borderWidth: 1, borderColor: '#F0F0F0' },
  targetSplitRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  targetColumn: { alignItems: 'center', flex: 1 },
  verticalDivider: { width: 1, height: 50, backgroundColor: '#F0F0F0' },
  targetLabel: { fontSize: 11, fontWeight: '800', color: '#9E9E9E', textTransform: 'uppercase', marginBottom: 4 },
  targetValue: { fontSize: 30, fontWeight: '900', color: '#1B4D20' },
  prominentEditBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  prominentEditBtnText: { fontSize: 11, fontWeight: '800', color: '#1B4D20', marginLeft: 4 },
  statusBadge: { backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', color: '#757575', textTransform: 'uppercase' },
  collapsibleCard: { backgroundColor: '#FFF', borderRadius: 22, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F2F2F2' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  thumbnail: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#F9F9F9' },
  headerInfo: { flex: 1, marginLeft: 16 },
  foodTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },
  foodCals: { fontSize: 14, fontWeight: '700', color: '#2E7D32', marginTop: 2 },
  deleteBtn: { padding: 8 },
  expandedContent: { paddingHorizontal: 14, paddingBottom: 18, backgroundColor: '#FAFAFA', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  emptyState: { alignItems: 'center', marginTop: 50, opacity: 0.6 },
  emptyStateText: { color: '#9E9E9E', marginTop: 12, fontWeight: '700', fontSize: 14, textAlign: 'center', paddingHorizontal: 50 },
  editOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  editBox: { backgroundColor: '#FFF', width: '88%', padding: 30, borderRadius: 35, alignItems: 'center' },
  editTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A1A', marginBottom: 24 },
  editInput: { width: '100%', fontSize: 52, fontWeight: '900', textAlign: 'center', color: '#1B4D20', marginBottom: 30 },
  editActions: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  modalBtn: { flex: 0.47, paddingVertical: 16, borderRadius: 18, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F5F5F5' },
  saveBtn: { backgroundColor: '#1B4D20' },
  cancelBtnText: { color: '#757575', fontWeight: '800', fontSize: 15 },
  saveButtonText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  scrollPadding: { paddingBottom: 50, paddingTop: 6 },
  viewfinderOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  viewfinderBox: { width: 260, height: 160 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#4CAF50', borderWidth: 4, borderRadius: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { height: 3, backgroundColor: '#4CAF50', width: '100%', borderRadius: 2 },
  placeholderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});