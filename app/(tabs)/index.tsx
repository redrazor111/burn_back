/* eslint-disable react/no-unescaped-entities */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'expo-camera';
import React, { ComponentProps, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Local Imports
import { saveToHistory } from '@/utils/historyStorage';
import { checkQuota, incrementQuota } from '@/utils/quotaService';
import Guide from '../../components/Guide';
import PremiumModal from '../../components/PremiumModal';
import ScanHistory from '../../components/ScanHistory';
import Scanner from '../../components/Scanner';
import Shop from '../../components/Shop';
import StatusCard from '../../components/StatusCard';
import { analyzeImageWithGemini } from '../../utils/geminiService';
import { useSubscriptionStatus } from '../../utils/subscription';

const Tab = createMaterialTopTabNavigator();

const TARGET_CALORIE_KEY = '@daily_target_calories';
const CURRENT_DAY_SCANS_KEY = '@current_day_scans';
const LAST_SAVED_DATE_KEY = '@last_saved_date';
const USER_GENDER_KEY = '@user_gender';
const USER_AGE_KEY = '@user_age';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface AnalysisState {
  text: string;
  status: string;
}

interface ScanResult {
  id: string;
  productName: string;
  calories: string;
  activities: AnalysisState[];
  isExpanded: boolean;
}

function CameraScreen({ onImageCaptured, onRecommendationsFound }: any) {
  const insets = useSafeAreaInsets();

  // Persistent Profile State
  const [targetCalories, setTargetCalories] = useState('2000');
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState('25');

  // Buffer State for Modal (Prevents "Sticky" changes on Cancel)
  const [tempCalories, setTempCalories] = useState('2000');
  const [tempGender, setTempGender] = useState('Male');
  const [tempAge, setTempAge] = useState('25');

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [showGuidePopup, setShowGuidePopup] = useState(false);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showPremium, setShowPremium] = useState(false);

  const isInitialLoadComplete = useRef(false);
  const { isPro, loading: subscriptionLoading } = useSubscriptionStatus();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initializeAppData = async () => {
      try {
        const [savedTarget, savedGender, savedAge, lastSavedDate] = await Promise.all([
          AsyncStorage.getItem(TARGET_CALORIE_KEY),
          AsyncStorage.getItem(USER_GENDER_KEY),
          AsyncStorage.getItem(USER_AGE_KEY),
          AsyncStorage.getItem(LAST_SAVED_DATE_KEY)
        ]);

        if (savedTarget) setTargetCalories(savedTarget);
        if (savedGender) setGender(savedGender);
        if (savedAge) setAge(savedAge);

        const today = new Date().toDateString();

        if (lastSavedDate === today) {
          const savedScans = await AsyncStorage.getItem(CURRENT_DAY_SCANS_KEY);
          if (savedScans) setScans(JSON.parse(savedScans));
        } else {
          await AsyncStorage.removeItem(CURRENT_DAY_SCANS_KEY);
          await AsyncStorage.setItem(LAST_SAVED_DATE_KEY, today);
          setScans([]);
        }
      } catch (e) {
        console.error("Initialization Error:", e);
      } finally {
        isInitialLoadComplete.current = true;
      }

      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    initializeAppData();
  }, []);

  // Reset Buffer State when modal opens
  useEffect(() => {
    if (isEditingTarget) {
      setTempCalories(targetCalories);
      setTempGender(gender);
      setTempAge(age);
    }
  }, [isEditingTarget]);

  // Save Today's Session Scans
  useEffect(() => {
    if (isInitialLoadComplete.current) {
      AsyncStorage.setItem(CURRENT_DAY_SCANS_KEY, JSON.stringify(scans));
    }
  }, [scans]);

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

  const saveProfileData = async () => {
    const numCal = parseInt(tempCalories, 10);
    const numAge = parseInt(tempAge, 10);

    if (isNaN(numCal) || numCal < 500 || numCal > 10000) {
      Alert.alert("Invalid Input", "Please enter a calorie goal between 500 and 10,000.");
      return;
    }
    if (isNaN(numAge) || numAge < 1 || numAge > 120) {
      Alert.alert("Invalid Input", "Please enter a valid age.");
      return;
    }

    try {
      setTargetCalories(tempCalories);
      setGender(tempGender);
      setAge(tempAge);
      await Promise.all([
        AsyncStorage.setItem(TARGET_CALORIE_KEY, tempCalories),
        AsyncStorage.setItem(USER_GENDER_KEY, tempGender),
        AsyncStorage.setItem(USER_AGE_KEY, tempAge),
      ]);
      setIsEditingTarget(false);
      Keyboard.dismiss();
    } catch (e) { console.error(e); }
  };

  const deleteScan = async (id: string) => {
    // Only removes from Today's Meals list
    setScans(prev => prev.filter(s => s.id !== id));
  };

  const handleClearToday = async () => {
    Alert.alert(
      "Clear Today's Meals",
      "This only clears your tracker for today. Your history records will be saved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Today",
          onPress: async () => {
            setScans([]);
            await AsyncStorage.removeItem(CURRENT_DAY_SCANS_KEY);
          }
        }
      ]
    );
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
    try {
      const userContext = { gender, age, targetCalories };
      const rawResponse = await analyzeImageWithGemini(base64Data, isPro, userContext);
      const data = JSON.parse(rawResponse);
      await incrementQuota();

      const newScan: ScanResult = {
        id: Date.now().toString(),
        productName: data.identifiedProduct || "Unknown Item",
        calories: data.calories || "0",
        isExpanded: false,
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

      // SAVE TO PERMANENT HISTORY (Text only)
      await saveToHistory("", data);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  if (subscriptionLoading) {
    return (
      <View style={styles.placeholderCenter}>
        <ActivityIndicator size="large" color="#1B4D20" />
      </View>
    );
  }

  const totalSessionCalories = scans.reduce((sum, s) => sum + Number(s.calories), 0);
  const remainingCalories = Math.max(Number(targetCalories) - totalSessionCalories, 0);
  const translateY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 180] });

  return (
    <View style={styles.cameraTabContainer}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <Text style={styles.title}>Capture Image</Text>
        <Text style={styles.subtitle}>{age}yo {gender} Profile Active</Text>
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

          <TouchableOpacity
            style={styles.mainTargetBadge}
            onPress={() => setIsEditingTarget(true)}
            activeOpacity={0.9}
          >
            <View style={styles.targetSplitRow}>
              <View style={styles.targetColumn}>
                <Text style={styles.targetLabel}>Daily Goal</Text>
                <View style={styles.valueRow}>
                  <MaterialCommunityIcons name="target" size={20} color="#1B4D20" style={{ marginRight: 4 }} />
                  <Text style={styles.targetValue}>{targetCalories}</Text>
                </View>
                <Text style={styles.unitLabel}>cal</Text>
              </View>
              <View style={styles.verticalDivider} />
              <View style={styles.targetColumn}>
                <Text style={styles.targetLabel}>Remaining</Text>
                <View style={styles.valueRow}>
                  <MaterialCommunityIcons
                    name="lightning-bolt"
                    size={20}
                    color={remainingCalories <= 200 ? '#FF5252' : '#2E7D32'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.targetValue, { color: remainingCalories <= 200 ? '#FF5252' : '#2E7D32' }]}>
                    {remainingCalories}
                  </Text>
                </View>
                <Text style={styles.unitLabel}>cal</Text>
              </View>
            </View>

            <View style={styles.profileStrip}>
              <View style={styles.profileItem}>
                <MaterialCommunityIcons name={gender === 'Male' ? "gender-male" : "gender-female"} size={18} color="#FFF" />
                <Text style={styles.profileItemText}>{gender.toUpperCase()}</Text>
              </View>
              <View style={styles.stripDivider} />
              <View style={styles.profileItem}>
                <MaterialCommunityIcons name="account-clock" size={18} color="#FFF" />
                <Text style={styles.profileItemText}>{age} YEARS OLD</Text>
              </View>
              <View style={styles.editCircle}>
                <Ionicons name="pencil" size={14} color="#1B4D20" />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Today's Meals</Text>
            {scans.length > 0 && (
              <TouchableOpacity onPress={handleClearToday}>
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
                <View style={styles.iconPlaceholder}>
                   <MaterialCommunityIcons name="food-apple" size={24} color="#1B4D20" />
                </View>
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
                  {item.activities.map((activity, index) => (
                    <StatusCard
                      key={index}
                      title={["Running", "Walking", "Weights", "Cycling", "Swimming", "HIIT", "Yoga", "Rowing", "Jump Rope", "Hiking"][index]}
                      data={activity}
                      icon={["run", "walk", "weight-lifter", "bike", "swim", "lightning-bolt", "yoga", "rowing", "jump-rope", "image-filter-hdr"][index]}
                      isParentLoading={isLoading}
                      isLocked={index > 1 && !isPro}
                    />
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Profile Edit Overlay */}
      {isEditingTarget && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <View style={styles.editModalHeaderRow}>
              <View style={{ width: 70 }} />
              <Text style={styles.editTitle}>Profile & Goal</Text>
              <TouchableOpacity style={styles.headerGuideBtn} onPress={() => setShowGuidePopup(true)}>
                <Text style={styles.headerGuideBtnText}>Guide</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Daily Calorie Goal</Text>
              <TextInput style={styles.editInputSmall} value={tempCalories} onChangeText={setTempCalories} keyboardType="numeric" maxLength={4} />
            </View>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.genderPicker}>
                  {['Male', 'Female'].map(g => (
                    <TouchableOpacity key={g} onPress={() => setTempGender(g)} style={[styles.genderBtn, tempGender === g && styles.genderBtnActive]}>
                      <Text style={[styles.genderBtnText, tempGender === g && styles.genderBtnTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={[styles.inputGroup, { width: 80 }]}>
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput style={styles.editInputSmall} value={tempAge} onChangeText={setTempAge} keyboardType="numeric" maxLength={3} />
              </View>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditingTarget(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={saveProfileData}>
                <Text style={styles.saveButtonText}>Save Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Modal visible={showGuidePopup} animationType="slide" transparent={true}>
            <View style={styles.nestedModalOverlay}>
              <View style={styles.nestedModalContent}>
                <View style={styles.nestedModalHeader}>
                  <Text style={styles.nestedModalTitle}>Calorie Guide</Text>
                  <TouchableOpacity onPress={() => setShowGuidePopup(false)}>
                    <Ionicons name="close-circle" size={32} color="#1B4D20" />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                  <Guide />
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      )}
      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const iconMap: Record<string, IoniconsName> = {
    Camera: 'camera-outline',
    History: 'time-outline',
    Guide: 'book-outline',
    Shop: 'cart-outline',
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
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
          },
          tabBarIcon: ({ color, focused }) => {
            const iconName = iconMap[route.name] || 'help-circle-outline';
            const finalIconName = focused ? iconName.replace('-outline', '') as IoniconsName : iconName;
            return <Ionicons name={finalIconName} size={24} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Camera">
          {() => <CameraScreen onRecommendationsFound={setRecommendations} />}
        </Tab.Screen>
        <Tab.Screen name="History">{() => <ScanHistory />}</Tab.Screen>
        <Tab.Screen name="Guide">{() => <Guide />}</Tab.Screen>
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
  resultsHalf: { flex: 1, paddingHorizontal: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: 1.2 },
  clearAllText: { fontSize: 12, fontWeight: '700', color: '#FF5252' },
  mainTargetBadge: { backgroundColor: '#FFFFFF', borderRadius: 30, marginTop: 20, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, elevation: 8, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden' },
  targetSplitRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', padding: 22, paddingBottom: 20 },
  targetColumn: { alignItems: 'center', flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'center' },
  targetLabel: { fontSize: 12, fontWeight: '800', color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  targetValue: { fontSize: 34, fontWeight: '900', color: '#1B4D20', letterSpacing: -1 },
  unitLabel: { fontSize: 10, fontWeight: '700', color: '#BDBDBD', marginTop: -2 },
  verticalDivider: { width: 1.5, height: 60, backgroundColor: '#F0F0F0' },
  profileStrip: { flexDirection: 'row', backgroundColor: '#1B4D20', paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  profileItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 15 },
  profileItemText: { color: '#FFF', fontSize: 12, fontWeight: '800', marginLeft: 8, letterSpacing: 0.8 },
  stripDivider: { width: 1, height: 15, backgroundColor: 'rgba(255,255,255,0.2)' },
  editCircle: { position: 'absolute', right: 15, backgroundColor: '#FFF', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  collapsibleCard: { backgroundColor: '#FFF', borderRadius: 22, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F2F2F2' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  iconPlaceholder: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 16 },
  foodTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },
  foodCals: { fontSize: 14, fontWeight: '700', color: '#2E7D32', marginTop: 2 },
  deleteBtn: { padding: 8 },
  expandedContent: { paddingHorizontal: 14, paddingBottom: 18, backgroundColor: '#FAFAFA', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  emptyState: { alignItems: 'center', marginTop: 50, opacity: 0.6 },
  emptyStateText: { color: '#9E9E9E', marginTop: 12, fontWeight: '700', fontSize: 14, textAlign: 'center', paddingHorizontal: 50 },
  editOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  editBox: { backgroundColor: '#FFF', width: '90%', padding: 25, borderRadius: 30 },
  editModalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 25, alignItems: 'center' },
  editTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A1A', textAlign: 'center' },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#9E9E9E', marginBottom: 8, textTransform: 'uppercase' },
  editInputSmall: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, fontSize: 18, fontWeight: '700', color: '#1B4D20' },
  row: { flexDirection: 'row', alignItems: 'center' },
  genderPicker: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 12, padding: 4 },
  genderBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  genderBtnActive: { backgroundColor: '#FFF', elevation: 2 },
  genderBtnText: { fontSize: 14, fontWeight: '700', color: '#9E9E9E' },
  genderBtnTextActive: { color: '#1B4D20' },
  editActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 15, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F5F5F5' },
  saveBtn: { backgroundColor: '#1B4D20' },
  cancelBtnText: { color: '#757575', fontWeight: '800' },
  saveButtonText: { color: '#FFF', fontWeight: '800' },
  scrollPadding: { paddingBottom: 50, paddingTop: 6 },
  placeholderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  nestedModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  nestedModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '85%', overflow: 'hidden' },
  nestedModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  nestedModalTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  viewfinderOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  viewfinderBox: { width: 260, height: 160 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#4CAF50', borderWidth: 4, borderRadius: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { height: 3, backgroundColor: '#4CAF50', width: '100%', borderRadius: 2 },
  headerGuideBtn: { backgroundColor: '#1B4D20', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, elevation: 2 },
  headerGuideBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
});