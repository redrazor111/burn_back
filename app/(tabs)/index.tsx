/* eslint-disable react/no-unescaped-entities */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'expo-camera';
import React, { ComponentProps, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
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

// Local Utilities & Components
import { removeFromHistory, saveToHistory } from '@/utils/historyStorage';
import { checkQuota, incrementQuota } from '@/utils/quotaService';
import ActivityHistory from '../../components/ActivityHistory';
import Guide from '../../components/Guide';
import PremiumModal from '../../components/PremiumModal';
import ScanHistory from '../../components/ScanHistory';
import Scanner from '../../components/Scanner';
import Shop from '../../components/Shop';
import StatusCard from '../../components/StatusCard';
import { analyzeImageWithGemini } from '../../utils/geminiService';
import { useSubscriptionStatus } from '../../utils/subscription';

import { MAX_ACTIVITIES } from '../../utils/constants';

const Tab = createMaterialTopTabNavigator();

const TARGET_CALORIE_KEY = '@daily_target_calories';
const CURRENT_DAY_SCANS_KEY = '@current_day_scans';
const CURRENT_DAY_ACTIVITIES_KEY = '@current_day_activities';
const CURRENT_DAY_WATER_KEY = '@current_day_water'; // NEW
const LAST_SAVED_DATE_KEY = '@last_saved_date';
const USER_GENDER_KEY = '@user_gender';
const USER_AGE_KEY = '@user_age';
const USER_WEIGHT_KEY = '@user_weight';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];
type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

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

interface PendingResult {
  options: { name: string; calories: number }[];
  rawActivities: any;
}

const ACTIVITY_TYPES: { label: string; met: number; icon: MaterialIconName }[] = [
  { label: "Running", met: 10.0, icon: "run" },
  { label: "Walking", met: 3.5, icon: "walk" },
  { label: "Weights", met: 6.0, icon: "weight-lifter" },
  { label: "Cycling", met: 7.5, icon: "bike" },
  { label: "Swimming", met: 8.0, icon: "swim" },
  { label: "HIIT", met: 11.0, icon: "lightning-bolt" },
  { label: "Yoga", met: 2.5, icon: "yoga" },
  { label: "Rowing", met: 7.0, icon: "rowing" },
  { label: "Jump Rope", met: 12.0, icon: "jump-rope" },
  { label: "Hiking", met: 6.5, icon: "image-filter-hdr" },
];

function CameraScreen({ onRecommendationsFound }: any) {
  const insets = useSafeAreaInsets();

  // Core State
  const [targetCalories, setTargetCalories] = useState('2000');
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState('25');
  const [weight, setWeight] = useState('70');
  const [waterCups, setWaterCups] = useState(0); // NEW

  // Buffer States for Modals
  const [tempCalories, setTempCalories] = useState('2000');
  const [tempGender, setTempGender] = useState('Male');
  const [tempAge, setTempAge] = useState('25');
  const [tempWeight, setTempWeight] = useState('70');

  // UI States
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [isLoggingActivity, setIsLoggingActivity] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(ACTIVITY_TYPES[0]);
  const [activityDuration, setActivityDuration] = useState('30');
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showPremium, setShowPremium] = useState(false);

  const isInitialLoadComplete = useRef(false);
  const { isPro } = useSubscriptionStatus();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // 1. INITIALIZATION & DATA LOADING
  useEffect(() => {
    const initializeAppData = async () => {
      try {
        const [savedTarget, savedGender, savedAge, savedWeight, lastSavedDate] = await Promise.all([
          AsyncStorage.getItem(TARGET_CALORIE_KEY),
          AsyncStorage.getItem(USER_GENDER_KEY),
          AsyncStorage.getItem(USER_AGE_KEY),
          AsyncStorage.getItem(USER_WEIGHT_KEY),
          AsyncStorage.getItem(LAST_SAVED_DATE_KEY)
        ]);

        if (savedTarget) { setTargetCalories(savedTarget); setTempCalories(savedTarget); }
        if (savedGender) { setGender(savedGender); setTempGender(savedGender); }
        if (savedAge) { setAge(savedAge); setTempAge(savedAge); }
        if (savedWeight) { setWeight(savedWeight); setTempWeight(savedWeight); }

        const today = new Date().toDateString();

        if (lastSavedDate === today) {
          const [savedScans, savedActs, savedWater] = await Promise.all([
            AsyncStorage.getItem(CURRENT_DAY_SCANS_KEY),
            AsyncStorage.getItem(CURRENT_DAY_ACTIVITIES_KEY),
            AsyncStorage.getItem(CURRENT_DAY_WATER_KEY)
          ]);
          if (savedScans) setScans(JSON.parse(savedScans));
          if (savedActs) setActivities(JSON.parse(savedActs));
          if (savedWater) setWaterCups(parseInt(savedWater, 10));
        } else {
          await AsyncStorage.multiRemove([CURRENT_DAY_SCANS_KEY, CURRENT_DAY_ACTIVITIES_KEY, CURRENT_DAY_WATER_KEY]);
          await AsyncStorage.setItem(LAST_SAVED_DATE_KEY, today);
          setScans([]);
          setActivities([]);
          setWaterCups(0);
        }
      } catch (e) { console.error(e); } finally { isInitialLoadComplete.current = true; }

      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    initializeAppData();
  }, []);

  // Sync Daily State to Storage
  useEffect(() => {
    if (isInitialLoadComplete.current) {
      AsyncStorage.setItem(CURRENT_DAY_SCANS_KEY, JSON.stringify(scans));
      AsyncStorage.setItem(CURRENT_DAY_ACTIVITIES_KEY, JSON.stringify(activities));
      AsyncStorage.setItem(CURRENT_DAY_WATER_KEY, waterCups.toString());
    }
  }, [scans, activities, waterCups]);

  // Loading Animation logic
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

  // Profile Save Logic
  const saveProfileData = async () => {
    try {
      setTargetCalories(tempCalories); setGender(tempGender); setAge(tempAge); setWeight(tempWeight);
      await Promise.all([
        AsyncStorage.setItem(TARGET_CALORIE_KEY, tempCalories),
        AsyncStorage.setItem(USER_GENDER_KEY, tempGender),
        AsyncStorage.setItem(USER_AGE_KEY, tempAge),
        AsyncStorage.setItem(USER_WEIGHT_KEY, tempWeight),
      ]);
      setIsEditingTarget(false);
      Keyboard.dismiss();
    } catch (e) { console.error(e); }
  };

  // Activity Logging Logic
  const handleAddActivity = async () => {
    if (!isPro && activities.length >= MAX_ACTIVITIES) {
      setIsLoggingActivity(false);
      setShowPremium(true);
      return;
    }
    const mins = parseInt(activityDuration);
    if (isNaN(mins) || mins <= 0) return;

    const burnPerMin = (selectedActivity.met * parseFloat(weight) * 3.5) / 200;
    const totalBurned = Math.round(burnPerMin * mins);

    const newActivity = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: selectedActivity.label,
      icon: selectedActivity.icon,
      duration: mins,
      caloriesBurned: totalBurned
    };

    const updated = [newActivity, ...activities];
    setActivities(updated);

    const existingHistory = await AsyncStorage.getItem('activity_history');
    const historyData = existingHistory ? JSON.parse(existingHistory) : [];
    await AsyncStorage.setItem('activity_history', JSON.stringify([newActivity, ...historyData].slice(0, 500)));

    setIsLoggingActivity(false);
  };

  const deleteActivity = async (id: string) => {
    const updated = activities.filter(a => a.id !== id);
    setActivities(updated);
    const storedHistory = await AsyncStorage.getItem('activity_history');
    if (storedHistory) {
      const filtered = JSON.parse(storedHistory).filter((i: any) => i.id !== id);
      await AsyncStorage.setItem('activity_history', JSON.stringify(filtered));
    }
  };

  const deleteScan = async (id: string) => {
    setScans(prev => prev.filter(s => s.id !== id));
    await removeFromHistory(id);
  };

  const handleOpenActivityLogger = () => {
    if (!isPro && activities.length >= MAX_ACTIVITIES) {
      setShowPremium(true);
    } else {
      setIsLoggingActivity(true);
    }
  };

  const handleScan = async (base64Data: string) => {
    if (!isPro) {
      const status = await checkQuota();
      if (status === 'LIMIT_REACHED') { setShowPremium(true); return; }
    }
    setIsLoading(true);
    try {
      const userContext = { gender, age, targetCalories, weight };
      const rawResponse = await analyzeImageWithGemini(base64Data, isPro, userContext);
      const data = JSON.parse(rawResponse);
      await incrementQuota();

      setPendingResult({
        options: data.identifiedOptions,
        rawActivities: data
      });
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const confirmSelection = async (option: { name: string; calories: number }) => {
    if (!pendingResult) return;

    // Create the cleaned-up analysis object for history storage
    const selectedAnalysis = {
      ...pendingResult.rawActivities,
      identifiedProduct: option.name,
      calories: option.calories
    };

    const newScan: ScanResult = {
      id: Date.now().toString(),
      productName: option.name,
      calories: option.calories.toString(),
      isExpanded: false,
      activities: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => ({
        text: pendingResult.rawActivities[`activity${i}`]?.summary || "",
        status: pendingResult.rawActivities[`activity${i}`]?.status || "MODERATE"
      }))
    };

    setScans(prev => [newScan, ...(prev || [])]);

    if (pendingResult.rawActivities.recommendations) {
      onRecommendationsFound(pendingResult.rawActivities.recommendations);
    }

    // UPDATED: Save the specific selection to permanent history
    await saveToHistory(option.name, selectedAnalysis);

    setPendingResult(null);
  };

  // Water Control
  const adjustWater = (amount: number) => {
    setWaterCups(prev => Math.max(0, prev + amount));
  };

  const totalConsumed = scans.reduce((sum, s) => sum + Number(s.calories), 0);
  const totalBurned = activities.reduce((sum, a) => sum + a.caloriesBurned, 0);
  const remainingCalories = Math.max(Number(targetCalories) - totalConsumed + totalBurned, 0);
  const translateY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 180] });

  return (
    <View style={styles.cameraTabContainer}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <Text style={styles.title}>Capture Image</Text>
        <Text style={styles.subtitle}>{age}yo {gender} • {weight}kg Profile Active</Text>
      </View>

      <View style={styles.cameraViewHalf}>
        {hasPermission ? (
          <>
            <Scanner onScan={handleScan} disabled={isLoading} />
            <View style={styles.viewfinderOverlay} pointerEvents="none">
              <View style={styles.viewfinderBox}>
                <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
                {isLoading && <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />}
              </View>
            </View>
          </>
        ) : <View style={styles.placeholderCenter}><ActivityIndicator size="large" color="#ffffff" /></View>}
      </View>

      <View style={styles.resultsHalf}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>

          <TouchableOpacity
            style={styles.mainTargetBadge}
            onPress={() => {
              setTempCalories(targetCalories); setTempGender(gender); setTempAge(age); setTempWeight(weight);
              setIsEditingTarget(true);
            }}
            activeOpacity={0.9}
          >
            <View style={styles.targetSplitRow}>
              <View style={styles.targetColumn}><Text style={styles.targetLabel}>Goal</Text><Text style={styles.targetValue}>{targetCalories}</Text></View>
              <View style={styles.verticalDivider} />
              <View style={styles.targetColumn}><Text style={styles.targetLabel}>Food</Text><Text style={styles.targetValue}>{totalConsumed}</Text></View>
              <View style={styles.verticalDivider} />
              <View style={styles.targetColumn}><Text style={styles.targetLabel}>Burned</Text><Text style={[styles.targetValue, { color: '#1976D2' }]}>{totalBurned}</Text></View>
              <View style={styles.verticalDivider} />
              <View style={styles.targetColumn}><Text style={styles.targetLabel}>Left</Text><Text style={[styles.targetValue, { color: remainingCalories <= 200 ? '#FF5252' : '#1B4D20' }]}>{remainingCalories}</Text></View>
            </View>
            <View style={styles.profileStrip}>
              <View style={styles.profileItem}><MaterialCommunityIcons name={gender === 'Male' ? "gender-male" : "gender-female"} size={16} color="#FFF" /><Text style={styles.profileItemText}>{gender.toUpperCase()}</Text></View>
              <View style={styles.stripDivider} />
              <View style={styles.profileItem}><MaterialCommunityIcons name="account-clock" size={16} color="#FFF" /><Text style={styles.profileItemText}>{age}yo • {weight}kg</Text></View>
              <View style={styles.editCircle}><Ionicons name="pencil" size={12} color="#1B4D20" /></View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.logActivityBtn, (!isPro && activities.length >= MAX_ACTIVITIES) && styles.logActivityBtnLocked]} onPress={handleOpenActivityLogger}>
            <MaterialCommunityIcons name={(!isPro && activities.length >= MAX_ACTIVITIES) ? "lock" : "plus-circle"} size={20} color={(!isPro && activities.length >= MAX_ACTIVITIES) ? "#9E9E9E" : "#1B4D20"} />
            <Text style={[styles.logActivityBtnText, (!isPro && activities.length >= MAX_ACTIVITIES) && { color: "#9E9E9E" }]}>
              {(!isPro && activities.length >= MAX_ACTIVITIES) ? `Upgrade to log more` : "Log Exercise / Activity"}
            </Text>
          </TouchableOpacity>

          {activities.map((act) => (
            <View key={act.id} style={styles.activityItem}>
              <MaterialCommunityIcons name={act.icon as any} size={20} color="#2E7D32" />
              <View style={styles.activityInfo}><Text style={styles.activityName}>{act.type}</Text><Text style={styles.activitySubText}>{act.duration} mins</Text></View>
              <Text style={styles.activityBurn}>-{act.caloriesBurned} cal</Text>
              <TouchableOpacity onPress={() => deleteActivity(act.id)}><Ionicons name="trash-outline" size={18} color="#FF5252" /></TouchableOpacity>
            </View>
          ))}

          {/* NEW: WATER INTAKE TRACKER */}
          <View style={styles.waterTrackerContainer}>
            <View style={styles.waterHeader}>
              <MaterialCommunityIcons name="water" size={20} color="#2196F3" />
              <Text style={styles.waterTitle}>Daily Water Intake</Text>
              <Text style={styles.waterCount}>{waterCups} <Text style={{ fontSize: 12, color: '#999' }}>cups</Text></Text>
            </View>
            <View style={styles.waterControls}>
              <TouchableOpacity style={styles.waterBtn} onPress={() => adjustWater(-1)}>
                <Ionicons name="remove-circle-outline" size={28} color="#9E9E9E" />
              </TouchableOpacity>

              <View style={styles.waterProgressTrack}>
                {/* Visual indicator of 8 cups goal */}
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <View key={i} style={[styles.waterDrop, waterCups >= i && styles.waterDropActive]} />
                ))}
              </View>

              <TouchableOpacity style={styles.waterBtn} onPress={() => adjustWater(1)}>
                <Ionicons name="add-circle-outline" size={28} color="#2196F3" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Today's Meals</Text></View>
          {scans.map((item) => (
            <View key={item.id} style={styles.collapsibleCard}>
              <View style={styles.cardHeader}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => { setScans(prev => prev.map(s => s.id === item.id ? { ...s, isExpanded: !s.isExpanded } : s)); }}>
                  <View style={styles.iconPlaceholder}><MaterialCommunityIcons name="food-apple" size={24} color="#1B4D20" /></View>
                  <View style={styles.headerInfo}><Text style={styles.foodTitle}>{item.productName}</Text><Text style={styles.foodCals}>{item.calories} Calories</Text></View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteScan(item.id)} style={{ padding: 10 }}><Ionicons name="trash-outline" size={20} color="#FF5252" /></TouchableOpacity>
                <Ionicons name={item.isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#9E9E9E" />
              </View>
              {item.isExpanded && (
                <View style={styles.expandedContent}>
                  {item.activities.map((activity, index) => (
                    <StatusCard key={index} title={ACTIVITY_TYPES[index].label} data={activity} icon={ACTIVITY_TYPES[index].icon} isParentLoading={isLoading} isLocked={index > 1 && !isPro} />
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* SELECTION MODAL */}
      {pendingResult && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>Select Best Match</Text>
            {pendingResult.options.map((opt, idx) => (
              <TouchableOpacity key={idx} style={styles.optionCard} onPress={() => confirmSelection(opt)}>
                <View><Text style={styles.optionName}>{opt.name}</Text><Text style={styles.optionCal}>{opt.calories} cal</Text></View>
                <Ionicons name="add-circle" size={26} color="#1B4D20" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn, { width: '100%', marginTop: 10 }]} onPress={() => setPendingResult(null)}><Text>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* ACTIVITY MODAL */}
      {isLoggingActivity && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>Log Exercise</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activitySelector}>
              {ACTIVITY_TYPES.map((act) => (
                <TouchableOpacity key={act.label} style={[styles.activityTypeBtn, selectedActivity.label === act.label && styles.activityTypeBtnActive]} onPress={() => setSelectedActivity(act)}>
                  <MaterialCommunityIcons name={act.icon as any} size={24} color={selectedActivity.label === act.label ? "#FFF" : "#1B4D20"} />
                  <Text style={[styles.activityTypeLabel, selectedActivity.label === act.label && styles.activityTypeLabelActive]}>{act.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.inputGroup}><Text style={styles.inputLabel}>Duration (Minutes)</Text><TextInput style={styles.editInputSmall} value={activityDuration} onChangeText={setActivityDuration} keyboardType="numeric" maxLength={3} /></View>
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsLoggingActivity(false)}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleAddActivity}><Text style={{ color: '#fff' }}>Log Activity</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* PROFILE MODAL */}
      {isEditingTarget && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>Edit Profile</Text>
            <View style={styles.inputGroup}><Text style={styles.inputLabel}>Calorie Goal</Text><TextInput style={styles.editInputSmall} value={tempCalories} onChangeText={setTempCalories} keyboardType="numeric" /></View>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}><Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.genderPicker}>{['Male', 'Female'].map(g => (
                  <TouchableOpacity key={g} onPress={() => setTempGender(g)} style={[styles.genderBtn, tempGender === g && styles.genderBtnActive]}><Text style={tempGender === g ? { color: '#1B4D20' } : { color: '#999' }}>{g}</Text></TouchableOpacity>
                ))}</View>
              </View>
              <View style={{ width: 50, marginRight: 10 }}><Text style={styles.inputLabel}>Age</Text><TextInput style={styles.editInputSmall} value={tempAge} onChangeText={setTempAge} keyboardType="numeric" /></View>
              <View style={{ width: 60 }}><Text style={styles.inputLabel}>Weight</Text><TextInput style={styles.editInputSmall} value={tempWeight} onChangeText={setTempWeight} keyboardType="numeric" /></View>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditingTarget(false)}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={saveProfileData}><Text style={{ color: '#fff' }}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const iconMap: Record<string, IoniconsName> = { Camera: 'camera-outline', Meals: 'time-outline', Activities: 'fitness-outline', Guide: 'book-outline', Shop: 'cart-outline' };
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Tab.Navigator tabBarPosition="bottom" screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#1B4D20', tabBarInactiveTintColor: '#9E9E9E',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', textTransform: 'none' },
        tabBarStyle: { height: 75 + insets.bottom, paddingBottom: insets.bottom },
        tabBarIcon: ({ color, focused }) => {
          const iconName = iconMap[route.name] || 'help-circle-outline';
          return <Ionicons name={focused ? iconName.replace('-outline', '') as any : iconName as any} size={24} color={color} />;
        },
      })}>
        <Tab.Screen name="Camera">{() => <CameraScreen onRecommendationsFound={setRecommendations} />}</Tab.Screen>
        <Tab.Screen name="Meals">{() => <ScanHistory />}</Tab.Screen>
        <Tab.Screen name="Activities">{() => <ActivityHistory />}</Tab.Screen>
        <Tab.Screen name="Guide">{() => <Guide />}</Tab.Screen>
        <Tab.Screen name="Shop">{() => <Shop recommendedProducts={recommendations} />}</Tab.Screen>
      </Tab.Navigator>
    </View>
  );
}

export default function App() { return <SafeAreaProvider><AppContent /></SafeAreaProvider>; }

const styles = StyleSheet.create({
  cameraTabContainer: { flex: 1, backgroundColor: '#FBFBFB' },
  header: { paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff', zIndex: 10, elevation: 5 },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#757575', marginTop: 4 },
  cameraViewHalf: { height: '35%', backgroundColor: '#000', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' },
  resultsHalf: { flex: 1, paddingHorizontal: 16 },
  mainTargetBadge: { backgroundColor: '#FFFFFF', borderRadius: 30, marginTop: 20, elevation: 8, shadowOpacity: 0.1, shadowRadius: 10, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden' },
  targetSplitRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', padding: 18 },
  targetColumn: { alignItems: 'center', flex: 1 },
  targetLabel: { fontSize: 10, fontWeight: '800', color: '#9E9E9E', textTransform: 'uppercase', marginBottom: 4 },
  targetValue: { fontSize: 22, fontWeight: '900', color: '#1A1A1A' },
  verticalDivider: { width: 1, height: 30, backgroundColor: '#F0F0F0' },
  profileStrip: { flexDirection: 'row', backgroundColor: '#1B4D20', paddingVertical: 10, justifyContent: 'center', alignItems: 'center' },
  profileItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  profileItemText: { color: '#FFF', fontSize: 11, fontWeight: '700', marginLeft: 5 },
  stripDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 5 },
  editCircle: { position: 'absolute', right: 10, backgroundColor: '#FFF', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  logActivityBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5E9', marginTop: 15, paddingVertical: 12, borderRadius: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#C8E6C9' },
  logActivityBtnLocked: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  logActivityBtnText: { color: '#1B4D20', fontWeight: '800', marginLeft: 8 },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 15, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  activityInfo: { flex: 1, marginLeft: 12 },
  activityName: { fontSize: 14, fontWeight: '800' },
  activitySubText: { fontSize: 11, color: '#9E9E9E', fontWeight: '600' },
  activityBurn: { fontSize: 15, fontWeight: '900', color: '#2E7D32', marginRight: 10 },

  // NEW WATER STYLES
  waterTrackerContainer: { backgroundColor: '#FFF', borderRadius: 20, padding: 15, marginTop: 15, borderWidth: 1, borderColor: '#F2F2F2' },
  waterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  waterTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginLeft: 8 },
  waterCount: { fontSize: 18, fontWeight: '900', color: '#2196F3' },
  waterControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  waterBtn: { padding: 5 },
  waterProgressTrack: { flexDirection: 'row', flex: 1, justifyContent: 'center', marginHorizontal: 10 },
  waterDrop: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E3F2FD', marginHorizontal: 4 },
  waterDropActive: { backgroundColor: '#2196F3' },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: 1.2 },
  collapsibleCard: { backgroundColor: '#FFF', borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F2F2F2' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  iconPlaceholder: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 12 },
  foodTitle: { fontSize: 16, fontWeight: '800' },
  foodCals: { fontSize: 13, color: '#2E7D32', fontWeight: '700' },
  expandedContent: { padding: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  editOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  editBox: { backgroundColor: '#FFF', width: '90%', padding: 20, borderRadius: 25 },
  editTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15, textAlign: 'center' },
  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#999', marginBottom: 5 },
  editInputSmall: { backgroundColor: '#F5F5F5', padding: 10, borderRadius: 10, fontSize: 16, fontWeight: '700' },
  genderPicker: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 10, padding: 3 },
  genderBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  genderBtnActive: { backgroundColor: '#FFF' },
  editActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { flex: 0.48, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F5F5F5' },
  saveBtn: { backgroundColor: '#1B4D20' },
  optionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9F9F9', padding: 15, borderRadius: 18, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  optionName: { fontSize: 16, fontWeight: '800' },
  optionCal: { fontSize: 14, color: '#2E7D32', fontWeight: '700' },
  activitySelector: { flexDirection: 'row', marginBottom: 20 },
  activityTypeBtn: { alignItems: 'center', padding: 15, borderRadius: 18, backgroundColor: '#F5F5F5', marginRight: 10, width: 90 },
  activityTypeBtnActive: { backgroundColor: '#1B4D20' },
  activityTypeLabel: { fontSize: 10, fontWeight: '800', marginTop: 5, color: '#1B4D20' },
  activityTypeLabelActive: { color: '#FFF' },
  scrollPadding: { paddingBottom: 60 },
  placeholderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewfinderOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  viewfinderBox: { width: 220, height: 140 },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: '#4CAF50', borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { height: 2, backgroundColor: '#4CAF50', width: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
});