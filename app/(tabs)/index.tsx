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
  Platform,
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

  const [targetCalories, setTargetCalories] = useState('2000');
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState('25');
  const [weight, setWeight] = useState('70');

  const [tempCalories, setTempCalories] = useState('2000');
  const [tempGender, setTempGender] = useState('Male');
  const [tempAge, setTempAge] = useState('25');
  const [tempWeight, setTempWeight] = useState('70');

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [isLoggingActivity, setIsLoggingActivity] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(ACTIVITY_TYPES[0]);
  const [activityDuration, setActivityDuration] = useState('30');
  const [showGuidePopup, setShowGuidePopup] = useState(false);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showPremium, setShowPremium] = useState(false);

  const isInitialLoadComplete = useRef(false);
  const { isPro } = useSubscriptionStatus();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

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

        if (savedTarget) setTargetCalories(savedTarget);
        if (savedGender) setGender(savedGender);
        if (savedAge) setAge(savedAge);
        if (savedWeight) setWeight(savedWeight);

        const today = new Date().toDateString();

        if (lastSavedDate === today) {
          const [savedScans, savedActs] = await Promise.all([
            AsyncStorage.getItem(CURRENT_DAY_SCANS_KEY),
            AsyncStorage.getItem(CURRENT_DAY_ACTIVITIES_KEY)
          ]);
          if (savedScans) setScans(JSON.parse(savedScans));
          if (savedActs) setActivities(JSON.parse(savedActs));
        } else {
          await AsyncStorage.removeItem(CURRENT_DAY_SCANS_KEY);
          await AsyncStorage.removeItem(CURRENT_DAY_ACTIVITIES_KEY);
          await AsyncStorage.setItem(LAST_SAVED_DATE_KEY, today);
          setScans([]);
          setActivities([]);
        }
      } catch (e) { console.error(e); } finally { isInitialLoadComplete.current = true; }

      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    initializeAppData();
  }, []);

  useEffect(() => {
    if (isInitialLoadComplete.current) {
      AsyncStorage.setItem(CURRENT_DAY_SCANS_KEY, JSON.stringify(scans));
      AsyncStorage.setItem(CURRENT_DAY_ACTIVITIES_KEY, JSON.stringify(activities));
    }
  }, [scans, activities]);

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
    const numWeight = parseInt(tempWeight, 10);

    if (isNaN(numCal) || numCal < 500 || numAge < 1 || numWeight < 30) {
      const msg = "Please enter valid profile details.";
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert("Invalid Input", msg);
      return;
    }

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

  const handleAddActivity = async () => {
    // Check quota logic similar to scanning
    if (!isPro && activities.length >= MAX_ACTIVITIES) {
      setIsLoggingActivity(false); // Close the logger
      setShowPremium(true);        // Show upgrade modal
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

    const updatedActivities = [newActivity, ...activities];
    setActivities(updatedActivities);

    try {
      // 1. Update Daily Storage
      await AsyncStorage.setItem(CURRENT_DAY_ACTIVITIES_KEY, JSON.stringify(updatedActivities));

      // 2. Update Permanent History (for History Tab summaries)
      const existingHistory = await AsyncStorage.getItem('activity_history');
      const historyData = existingHistory ? JSON.parse(existingHistory) : [];
      await AsyncStorage.setItem('activity_history', JSON.stringify([newActivity, ...historyData].slice(0, 500)));
    } catch (e) {
      console.error("Error saving activity:", e);
    }

    setIsLoggingActivity(false);
  };

  // DELETE LOGIC FOR ACTIVITY
  const deleteActivity = async (id: string) => {
    // 1. Update Today's UI State
    const updatedActivities = activities.filter(a => a.id !== id);
    setActivities(updatedActivities);

    // 2. Update Daily Storage
    await AsyncStorage.setItem(CURRENT_DAY_ACTIVITIES_KEY, JSON.stringify(updatedActivities));

    // 3. Update Permanent Activity History (for summaries)
    try {
      const storedHistory = await AsyncStorage.getItem('activity_history');
      if (storedHistory) {
        const historyData = JSON.parse(storedHistory);
        const filteredHistory = historyData.filter((item: any) => item.id !== id);
        await AsyncStorage.setItem('activity_history', JSON.stringify(filteredHistory));
      }
    } catch (e) {
      console.error("Failed to update permanent activity history", e);
    }
  };
  const deleteScan = async (id: string) => {
    // 1. Update Today's UI State
    const updatedScans = scans.filter(s => s.id !== id);
    setScans(updatedScans);

    // 2. Update Daily Storage
    await AsyncStorage.setItem(CURRENT_DAY_SCANS_KEY, JSON.stringify(updatedScans));

    // 3. Remove from Permanent History (Calls your existing utility)
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

      const newScan: ScanResult = {
        id: Date.now().toString(),
        productName: data.identifiedProduct || "Unknown Item",
        calories: data.calories || "0",
        isExpanded: false,
        activities: [data.activity1, data.activity2, data.activity3, data.activity4, data.activity5, data.activity6, data.activity7, data.activity8, data.activity9, data.activity10]
          .map(act => ({ text: JSON.stringify(act), status: act.status === "UNHEALTHY" ? "#FF5252" : act.status === "MODERATE" ? "#FFB300" : "#2E7D32" }))
      };
      setScans(prev => [newScan, ...prev]);
      if (data.recommendations) onRecommendationsFound(data.recommendations);
      await saveToHistory("", data);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
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

          <TouchableOpacity style={styles.mainTargetBadge} onPress={() => setIsEditingTarget(true)} activeOpacity={0.9}>
            <View style={styles.targetSplitRow}>
              <View style={styles.targetColumn}>
                <Text style={styles.targetLabel}>Goal</Text>
                <Text style={styles.targetValue}>{targetCalories}</Text>
                <Text style={styles.unitLabel}>cal</Text>
              </View>
              <View style={styles.verticalDivider} />
              <View style={styles.targetColumn}>
                <Text style={styles.targetLabel}>Food</Text>
                <Text style={styles.targetValue}>{totalConsumed}</Text>
                <Text style={styles.unitLabel}>cal</Text>
              </View>
              <View style={styles.verticalDivider} />
              <View style={styles.targetColumn}>
                <Text style={styles.targetLabel}>Burned</Text>
                <Text style={[styles.targetValue, { color: '#1976D2' }]}>{totalBurned}</Text>
                <Text style={styles.unitLabel}>cal</Text>
              </View>
              <View style={styles.verticalDivider} />
              <View style={styles.targetColumn}>
                <Text style={styles.targetLabel}>Left</Text>
                <Text style={[styles.targetValue, { color: remainingCalories <= 200 ? '#FF5252' : '#1B4D20' }]}>{remainingCalories}</Text>
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
                <Text style={styles.profileItemText}>{age}yo • {weight}kg</Text>
              </View>
              <View style={styles.editCircle}><Ionicons name="pencil" size={14} color="#1B4D20" /></View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.logActivityBtn, (!isPro && activities.length >= MAX_ACTIVITIES) && styles.logActivityBtnLocked]}
            onPress={handleOpenActivityLogger}
          >
            <MaterialCommunityIcons name={(!isPro && activities.length >= MAX_ACTIVITIES) ? "lock" : "plus-circle"} size={20} color={(!isPro && activities.length >= MAX_ACTIVITIES) ? "#9E9E9E" : "#1B4D20"} />
            <Text style={[styles.logActivityBtnText, (!isPro && activities.length >= MAX_ACTIVITIES) && { color: "#9E9E9E" }]}>
              {(!isPro && activities.length >= MAX_ACTIVITIES) ? "Upgrade to log more" : "Log Exercise / Activity"}
            </Text>
          </TouchableOpacity>

          {activities.length > 0 && (
            <View style={styles.activitiesList}>
              {activities.map((act) => (
                <View key={act.id} style={styles.activityItem}>
                  <MaterialCommunityIcons name={act.icon as any} size={20} color="#2E7D32" />
                  <View style={styles.activityInfo}><Text style={styles.activityName}>{act.type}</Text><Text style={styles.activitySubText}>{act.duration} mins</Text></View>
                  <Text style={styles.activityBurn}>-{act.caloriesBurned} cal</Text>
                  {/* TRASH ICON FOR ACTIVITY */}
                  <TouchableOpacity onPress={() => deleteActivity(act.id)} style={{ marginLeft: 10 }}>
                    <Ionicons name="trash-outline" size={18} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Today's Meals</Text></View>
          {scans.map((item) => (
            <View key={item.id} style={styles.collapsibleCard}>
              <View style={styles.cardHeader}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => { setScans(prev => prev.map(s => s.id === item.id ? { ...s, isExpanded: !s.isExpanded } : s)); }}>
                  <View style={styles.iconPlaceholder}><MaterialCommunityIcons name="food-apple" size={24} color="#1B4D20" /></View>
                  <View style={styles.headerInfo}><Text style={styles.foodTitle}>{item.productName}</Text><Text style={styles.foodCals}>{item.calories} Calories</Text></View>
                </TouchableOpacity>

                {/* TRASH ICON FOR SCAN */}
                <TouchableOpacity onPress={() => deleteScan(item.id)} style={{ padding: 10 }}>
                  <Ionicons name="trash-outline" size={20} color="#FF5252" />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setScans(prev => prev.map(s => s.id === item.id ? { ...s, isExpanded: !s.isExpanded } : s)); }}>
                  <Ionicons name={item.isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#9E9E9E" />
                </TouchableOpacity>
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
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsLoggingActivity(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleAddActivity}>
                <Text style={styles.saveButtonText}>Log Activity</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {isEditingTarget && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>Profile & Goal</Text>
            <View style={styles.inputGroup}><Text style={styles.inputLabel}>Calorie Goal</Text><TextInput style={styles.editInputSmall} value={tempCalories} onChangeText={setTempCalories} keyboardType="numeric" /></View>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.genderPicker}>{['Male', 'Female'].map(g => (
                  <TouchableOpacity key={g} onPress={() => setTempGender(g)} style={[styles.genderBtn, tempGender === g && styles.genderBtnActive]}><Text style={tempGender === g ? { color: '#1B4D20' } : { color: '#999' }}>{g}</Text></TouchableOpacity>
                ))}</View>
              </View>
              <View style={{ width: 50, marginRight: 10 }}><Text style={styles.inputLabel}>Age</Text><TextInput style={styles.editInputSmall} value={tempAge} onChangeText={setTempAge} keyboardType="numeric" /></View>
              <View style={{ width: 70 }}><Text style={styles.inputLabel}>Weight</Text><TextInput style={styles.editInputSmall} value={tempWeight} onChangeText={setTempWeight} keyboardType="numeric" /></View>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditingTarget(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={saveProfileData}><Text style={styles.saveButtonText}>Save</Text></TouchableOpacity>
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
      })}
      >
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
  header: { paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#757575', marginTop: 4 },
  cameraViewHalf: { height: '35%', backgroundColor: '#000', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' },
  resultsHalf: { flex: 1, paddingHorizontal: 16 },
  mainTargetBadge: { backgroundColor: '#FFFFFF', borderRadius: 30, marginTop: 20, elevation: 8, shadowOpacity: 0.1, shadowRadius: 10, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden' },
  targetSplitRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', padding: 18 },
  targetColumn: { alignItems: 'center', flex: 1 },
  targetLabel: { fontSize: 10, fontWeight: '800', color: '#9E9E9E', textTransform: 'uppercase', marginBottom: 4 },
  targetValue: { fontSize: 22, fontWeight: '900', color: '#1A1A1A' },
  unitLabel: { fontSize: 10, color: '#BDBDBD' },
  verticalDivider: { width: 1, height: 30, backgroundColor: '#F0F0F0' },
  profileStrip: { flexDirection: 'row', backgroundColor: '#1B4D20', paddingVertical: 10, justifyContent: 'center', alignItems: 'center' },
  profileItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  profileItemText: { color: '#FFF', fontSize: 11, fontWeight: '700', marginLeft: 5 },
  stripDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.3)' },
  editCircle: { position: 'absolute', right: 10, backgroundColor: '#FFF', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  logActivityBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5E9', marginTop: 15, paddingVertical: 12, borderRadius: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#C8E6C9' },
  logActivityBtnLocked: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  logActivityBtnText: { color: '#1B4D20', fontWeight: '800', marginLeft: 8 },
  activitiesList: { marginTop: 15 },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 15, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  activityInfo: { flex: 1, marginLeft: 12 },
  activityName: { fontSize: 14, fontWeight: '800' },
  activitySubText: { fontSize: 12, color: '#9E9E9E', fontWeight: '600', marginTop: 2 },
  activityBurn: { fontSize: 15, fontWeight: '900', color: '#2E7D32', marginRight: 5 },
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
  scrollPadding: { paddingBottom: 50 },
  viewfinderOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  viewfinderBox: { width: 200, height: 120 },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: '#4CAF50', borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { height: 2, backgroundColor: '#4CAF50', width: '100%' },
  placeholderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activitySelector: { flexDirection: 'row', marginBottom: 20, paddingVertical: 5 },
  activityTypeBtn: { alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 18, backgroundColor: '#F5F5F5', marginRight: 12, width: 100, height: 100, borderWidth: 1, borderColor: '#EEEEEE' },
  activityTypeBtnActive: { backgroundColor: '#1B4D20', borderColor: '#1B4D20', elevation: 4 },
  activityTypeLabel: { fontSize: 11, fontWeight: '800', color: '#1B4D20', marginTop: 8, textAlign: 'center' },
  activityTypeLabelActive: { color: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancelBtnText: { color: '#757575', fontWeight: '800', fontSize: 14 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: 1.2 },
});