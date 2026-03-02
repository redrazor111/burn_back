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
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Local Utilities & Components
import { removeFromHistory, saveToHistory } from '@/utils/historyStorage';
import ActivityHistory from '../../components/ActivityHistory';
import CameraScreen from '../../components/CameraScreen';
import Guide from '../../components/Guide';
import PremiumModal from '../../components/PremiumModal';
import ScanHistory from '../../components/ScanHistory';
import Shop from '../../components/Shop';
import { useSubscriptionStatus } from '../../utils/subscription';

import { syncAndroidCalories } from '@/utils/syncAndroidCalories';
import { MAX_ACTIVITIES, MAX_SEARCHES } from '../../utils/constants';

const Tab = createMaterialTopTabNavigator();

const TARGET_CALORIE_KEY = '@daily_target_calories';
const CURRENT_DAY_SCANS_KEY = '@current_day_scans';
const CURRENT_DAY_ACTIVITIES_KEY = '@current_day_activities';
const CURRENT_DAY_WATER_KEY = '@current_day_water';
const LAST_SAVED_DATE_KEY = '@last_saved_date';
const USER_GENDER_KEY = '@user_gender';
const USER_AGE_KEY = '@user_age';
const USER_WEIGHT_KEY = '@user_weight';

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface ScanResult {
  id: string;
  productName: string;
  calories: string;
}

interface PendingResult {
  options: { name: string; calories: number }[];
  rawResult: any;
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
  { label: "Cardio", met: 8.0, icon: "heart-pulse" },
  { label: "Other", met: 4.5, icon: "dots-horizontal" },
];

function SummaryScreen({ onRecommendationsFound }: any) {
  const insets = useSafeAreaInsets();

  const [targetCalories, setTargetCalories] = useState('2000');
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState('25');
  const [weight, setWeight] = useState('70');
  const [waterCups, setWaterCups] = useState(0);

  const [tempCalories, setTempCalories] = useState('2000');
  const [tempGender, setTempGender] = useState('Male');
  const [tempAge, setTempAge] = useState('25');
  const [tempWeight, setTempWeight] = useState('70');

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [isLoggingActivity, setIsLoggingActivity] = useState(false);
  const [isLoggingFood, setIsLoggingFood] = useState(false); // Manual food log state

  const [selectedActivity, setSelectedActivity] = useState(ACTIVITY_TYPES[0]);
  const [activityDuration, setActivityDuration] = useState('30');
  const [manualFoodName, setManualFoodName] = useState('');
  const [manualFoodCals, setManualFoodCals] = useState('');

  const [scans, setScans] = useState<ScanResult[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingWatch, setIsSyncingWatch] = useState(false);
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showPremium, setShowPremium] = useState(false);

  const [isEditingSelection, setIsEditingSelection] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCals, setEditCals] = useState('');

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
          setScans(savedScans ? JSON.parse(savedScans) : []);
          setActivities(savedActs ? JSON.parse(savedActs) : []);
          setWaterCups(savedWater ? parseInt(savedWater, 10) : 0);
        } else {
          await AsyncStorage.multiRemove([CURRENT_DAY_SCANS_KEY, CURRENT_DAY_ACTIVITIES_KEY, CURRENT_DAY_WATER_KEY]);
          await AsyncStorage.setItem(LAST_SAVED_DATE_KEY, today);
          setScans([]); setActivities([]); setWaterCups(0);
        }
      } catch (e) { console.error(e); } finally { isInitialLoadComplete.current = true; }
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    initializeAppData();
  }, []);

  const syncWatchData = async () => {
    if (isSyncingWatch || !isInitialLoadComplete.current) return;
    setIsSyncingWatch(true);
    try {
      const watchCalories = await syncAndroidCalories();
      if (watchCalories > 0) {
        const todayStr = new Date().toDateString();
        const syncId = `watch-${todayStr}`;
        const watchEntry = {
          id: syncId,
          date: new Date().toISOString(),
          type: 'Other',
          icon: 'dots-horizontal',
          duration: 0,
          caloriesBurned: watchCalories
        };
        setActivities(prev => [watchEntry, ...prev.filter(a => a.id !== syncId)]);
        const existingHistory = await AsyncStorage.getItem('activity_history');
        let historyData = existingHistory ? JSON.parse(existingHistory) : [];
        historyData = [watchEntry, ...historyData.filter((a: any) => a.id !== syncId)].slice(0, 500);
        await AsyncStorage.setItem('activity_history', JSON.stringify(historyData));
      }
    } catch (e) { console.error("Watch sync failed", e); } finally {
      setTimeout(() => setIsSyncingWatch(false), 2000);
    }
  };

  useFocusEffect(React.useCallback(() => { if (isInitialLoadComplete.current) syncWatchData(); }, []));
  useFocusEffect(
    React.useCallback(() => {
      const loadFreshData = async () => {
        const savedScans = await AsyncStorage.getItem('@current_day_scans');
        if (savedScans) {
          setScans(JSON.parse(savedScans));
        }
      };
      loadFreshData();
    }, [])
  );

  useEffect(() => {
    if (isInitialLoadComplete.current) {
      AsyncStorage.setItem(CURRENT_DAY_SCANS_KEY, JSON.stringify(scans || []));
      AsyncStorage.setItem(CURRENT_DAY_ACTIVITIES_KEY, JSON.stringify(activities || []));
      AsyncStorage.setItem(CURRENT_DAY_WATER_KEY, waterCups.toString());
    }
  }, [scans, activities, waterCups]);

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        ])
      ).start();
    } else { scanLineAnim.stopAnimation(); }
  }, [isLoading]);

  const saveProfileData = async () => {
    try {
      setTargetCalories(tempCalories); setGender(tempGender); setAge(tempAge); setWeight(tempWeight);
      await Promise.all([
        AsyncStorage.setItem(TARGET_CALORIE_KEY, tempCalories),
        AsyncStorage.setItem(USER_GENDER_KEY, tempGender),
        AsyncStorage.setItem(USER_AGE_KEY, tempAge),
        AsyncStorage.setItem(USER_WEIGHT_KEY, tempWeight),
      ]);
      setIsEditingTarget(false); Keyboard.dismiss();
    } catch (e) { console.error(e); }
  };

  const handleAddActivity = async () => {
    if (!isPro && activities?.length >= MAX_ACTIVITIES) {
      setIsLoggingActivity(false); setShowPremium(true); return;
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
    setActivities([newActivity, ...(activities || [])]);
    const existingHistory = await AsyncStorage.getItem('activity_history');
    const historyData = existingHistory ? JSON.parse(existingHistory) : [];
    await AsyncStorage.setItem('activity_history', JSON.stringify([newActivity, ...historyData].slice(0, 500)));
    setIsLoggingActivity(false);
  };

  const handleManualFoodLog = async () => {
    if (!isPro && scans?.length >= MAX_SEARCHES) {
      setIsLoggingFood(false); setShowPremium(true); return;
    }
    const cals = parseInt(manualFoodCals);
    if (!manualFoodName || isNaN(cals)) return;

    const uniqueId = Date.now().toString();

    const newScan: ScanResult = {
      id: uniqueId,
      productName: manualFoodName,
      calories: cals.toString(),
    };

    setScans(prev => [newScan, ...(prev || [])]);

    await saveToHistory(manualFoodName, {
      id: uniqueId,
      identifiedProduct: manualFoodName,
      calories: cals
    });

    setIsLoggingFood(false);
    setManualFoodName('');
    setManualFoodCals('');
  };

  const deleteActivity = async (id: string) => {
    const updatedActivities = activities.filter(a => a.id !== id);
    setActivities(updatedActivities);

    await AsyncStorage.setItem(CURRENT_DAY_ACTIVITIES_KEY, JSON.stringify(updatedActivities));

    const storedHistory = await AsyncStorage.getItem('activity_history');
    if (storedHistory) {
      const filtered = JSON.parse(storedHistory).filter((i: any) => i.id !== id);
      await AsyncStorage.setItem('activity_history', JSON.stringify(filtered));
    }
  };

  const deleteScan = async (id: string) => {
    // 1. Update local state
    const updatedScans = scans.filter(s => s.id !== id);
    setScans(updatedScans);

    await AsyncStorage.setItem(CURRENT_DAY_SCANS_KEY, JSON.stringify(updatedScans));
    await removeFromHistory(id);
  };

  const handleOpenActivityLogger = () => {
    if (!isPro && activities?.length >= MAX_ACTIVITIES) setShowPremium(true);
    else setIsLoggingActivity(true);
  };

  const handleOpenFoodLogger = () => {
    if (!isPro && scans?.length >= MAX_SEARCHES) setShowPremium(true);
    else setIsLoggingFood(true);
  };

  const handleGoogleFitSync = async () => {
    if (isSyncingWatch) return;
    setIsSyncingWatch(true);
    try {
      const watchCalories = await syncAndroidCalories();
      if (watchCalories > 0) {
        const todayStr = new Date().toDateString();
        const syncId = `watch-${todayStr}`;
        const watchEntry = {
          id: syncId,
          date: new Date().toISOString(),
          type: 'Google Fit Sync',
          icon: 'google-fit',
          duration: 0,
          caloriesBurned: watchCalories
        };

        // Update local and storage
        const updatedActivities = [watchEntry, ...activities.filter(a => a.id !== syncId)];
        setActivities(updatedActivities);
        await AsyncStorage.setItem(CURRENT_DAY_ACTIVITIES_KEY, JSON.stringify(updatedActivities));

        // Update Global History
        const existingHistory = await AsyncStorage.getItem('activity_history');
        let historyData = existingHistory ? JSON.parse(existingHistory) : [];
        historyData = [watchEntry, ...historyData.filter((a: any) => a.id !== syncId)].slice(0, 500);
        await AsyncStorage.setItem('activity_history', JSON.stringify(historyData));

        Alert.alert("Sync Complete", `Imported ${watchCalories} calories from Google Fit.`);
      } else {
        Alert.alert("Sync", "No new active calories found for today in Google Fit.");
      }
    } catch (e) {
      console.error("Manual sync failed", e);
    } finally {
      setIsSyncingWatch(false);
    }
  };

  const confirmSelection = async (option: { name: string; calories: number }) => {
    if (!pendingResult) return;

    const uniqueId = Date.now().toString();

    const newScan: ScanResult = {
      id: uniqueId, // Use the shared ID
      productName: option.name,
      calories: option.calories.toString(),
    };

    setScans(prev => [newScan, ...(prev || [])]);

    await saveToHistory(option.name, {
      id: uniqueId, // Pass ID here
      identifiedProduct: option.name,
      calories: option.calories
    });

    setPendingResult(null);
    setIsEditingSelection(false);
  };

  const startEditingOption = (opt: { name: string; calories: number }) => {
    setEditName(opt.name); setEditCals(opt.calories.toString()); setIsEditingSelection(true);
  };

  const adjustWater = (amount: number) => setWaterCups(prev => Math.max(0, prev + amount));

  const totalConsumed = (scans || []).reduce((sum, s) => sum + Number(s.calories), 0);
  const totalBurned = (activities || []).reduce((sum, a) => sum + a.caloriesBurned, 0);
  const remainingCalories = Math.max(Number(targetCalories) - totalConsumed + totalBurned, 0);

  return (
    <View style={styles.cameraTabContainer}>
      <StatusBar barStyle="dark-content" />

      {/* Static Header */}
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.title}>Daily Dashboard</Text>
            <Text style={styles.subtitle}>{age}yr {gender} • {weight}kg Profile Active</Text>
          </View>
          {isSyncingWatch && (
            <View style={styles.syncIndicator}>
              <ActivityIndicator size="small" color="#2196F3" />
              <Text style={styles.syncText}>Watch Sync</Text>
            </View>
          )}
        </View>
      </View>

      {/* Wrap everything below the header in flex: 1 to enable scrolling */}
      <View style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollPadding}
        >
          {/* 1. Profile Badge */}
          <TouchableOpacity
            style={styles.mainTargetBadge}
            onPress={() => {
              setTempCalories(targetCalories); setTempGender(gender); setTempAge(age); setTempWeight(weight);
              setIsEditingTarget(true);
            }}
            activeOpacity={0.9}
          >
            <View style={styles.targetSplitRow}>
              <View style={styles.targetColumn}><Text style={styles.targetLabel}>Goal</Text><Text style={styles.targetValue}>{targetCalories}<Text style={styles.unitSmall}> CAL</Text></Text></View>
              <View style={styles.verticalDivider} />
              <View style={styles.targetColumn}><Text style={styles.targetLabel}>Intake</Text><Text style={styles.targetValue}>{totalConsumed}<Text style={styles.unitSmall}> CAL</Text></Text></View>
              <View style={styles.verticalDivider} />
              <View style={styles.targetColumn}><Text style={styles.targetLabel}>Burned</Text><Text style={[styles.targetValue, { color: '#1976D2' }]}>{totalBurned}<Text style={styles.unitSmall}> CAL</Text></Text></View>
              <View style={styles.verticalDivider} />
              <View style={styles.targetColumn}><Text style={styles.targetLabel}>Left</Text><Text style={[styles.targetValue, { color: remainingCalories <= 200 ? '#FF5252' : '#1B4D20' }]}>{remainingCalories}<Text style={styles.unitSmall}> CAL</Text></Text></View>
            </View>
            <View style={styles.profileStrip}>
              <View style={styles.profileItem}><MaterialCommunityIcons name={gender === 'Male' ? "gender-male" : "gender-female"} size={16} color="#FFF" /><Text style={styles.profileItemText}>{gender.toUpperCase()}</Text></View>
              <View style={styles.stripDivider} />
              <View style={styles.profileItem}><MaterialCommunityIcons name="account-clock" size={16} color="#FFF" /><Text style={styles.profileItemText}>{age}yo • {weight}kg</Text></View>
              <View style={styles.editCircle}><Ionicons name="pencil" size={12} color="#1B4D20" /></View>
            </View>
          </TouchableOpacity>

          {/* 2. Water Tracker */}
          <View style={styles.waterTrackerContainer}>
            <View style={styles.waterHeader}>
              <MaterialCommunityIcons name="water" size={20} color="#2196F3" />
              <Text style={styles.waterTitle}>Daily Water Intake</Text>
              <Text style={styles.waterCount}>{waterCups} <Text style={{ fontSize: 12, color: '#999' }}>cups</Text></Text>
            </View>
            <View style={styles.waterControls}>
              <TouchableOpacity style={styles.waterBtn} onPress={() => adjustWater(-1)}><Ionicons name="remove-circle-outline" size={28} color="#9E9E9E" /></TouchableOpacity>
              <View style={styles.waterProgressTrack}>{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (<View key={i} style={[styles.waterDrop, waterCups >= i && styles.waterDropActive]} />))}</View>
              <TouchableOpacity style={styles.waterBtn} onPress={() => adjustWater(1)}><Ionicons name="add-circle-outline" size={28} color="#2196F3" /></TouchableOpacity>
            </View>
          </View>

          {/* 3. Meals Section */}
          <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Today's Meals/Drinks</Text></View>
          <TouchableOpacity style={[styles.logActivityBtn, (!isPro && scans?.length >= MAX_SEARCHES) && styles.logActivityBtnLocked, { marginTop: 0, marginBottom: 15 }]} onPress={handleOpenFoodLogger}>
            <MaterialCommunityIcons name={(!isPro && scans?.length >= MAX_SEARCHES) ? "lock" : "plus-circle"} size={20} color={(!isPro && scans?.length >= MAX_SEARCHES) ? "#9E9E9E" : "#1B4D20"} />
            <Text style={styles.logActivityBtnText}>
              {(!isPro && scans?.length >= MAX_SEARCHES) ? `Upgrade to log more` : "Log Meals/Drink"}
            </Text>
          </TouchableOpacity>

          {scans?.map((item) => (
            <View key={item.id} style={styles.collapsibleCard}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={styles.iconPlaceholder}><MaterialCommunityIcons name="food-apple" size={24} color="#1B4D20" /></View>
                  <View style={styles.headerInfo}><Text style={styles.foodTitle}>{item.productName}</Text><Text style={styles.foodCals}>{item.calories} Calories</Text></View>
                </View>
                <TouchableOpacity onPress={() => deleteScan(item.id)} style={{ padding: 10 }}><Ionicons name="trash-outline" size={20} color="#FF5252" /></TouchableOpacity>
              </View>
            </View>
          ))}

          {/* 4. Activities Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Today's Activities</Text>
            {/* <TouchableOpacity onPress={handleGoogleFitSync} style={styles.manualSyncHeaderBtn}>
              {isSyncingWatch ? <ActivityIndicator size="small" color="#2196F3" /> : <MaterialCommunityIcons name="sync" size={18} color="#2196F3" />}
            </TouchableOpacity> */}
          </View>

          {/* Sync Google Fit Button (Visible if no watch sync yet) */}
          {/* {activities.filter(a => a.id.toString().includes('watch')).length === 0 && (
            <TouchableOpacity
              style={styles.googleFitBtn}
              onPress={handleGoogleFitSync}
              disabled={isSyncingWatch}
            >
              <MaterialCommunityIcons name="google-fit" size={22} color="#FFF" />
              <Text style={styles.googleFitBtnText}>
                {isSyncingWatch ? "Syncing..." : "Sync Google Fit Calories"}
              </Text>
            </TouchableOpacity>
          )} */}

          <TouchableOpacity style={styles.logActivityBtn} onPress={handleOpenActivityLogger}>
            <MaterialCommunityIcons name="plus-circle" size={20} color="#1B4D20" />
            <Text style={styles.logActivityBtnText}>Log Exercise/Activity</Text>
          </TouchableOpacity>

          {activities?.map((act) => (
            <View key={act.id} style={styles.activityItem}>
              <MaterialCommunityIcons name={act.icon as any} size={20} color={act.id.toString().includes('watch') ? "#2196F3" : "#2E7D32"} />
              <View style={styles.activityInfo}><Text style={styles.activityName}>{act.type}</Text><Text style={styles.activitySubText}>{act.duration > 0 ? `${act.duration} mins` : 'Auto-Synced'}</Text></View>
              <Text style={styles.activityBurn}>-{act.caloriesBurned} cal</Text>
              <TouchableOpacity onPress={() => deleteActivity(act.id)}><Ionicons name="trash-outline" size={18} color="#FF5252" /></TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* MODALS SECTION */}
      {pendingResult && (
        <Modal visible={!!pendingResult} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { setPendingResult(null); setIsEditingSelection(false); }}>
          <View style={styles.androidOverlay}>
            <View style={styles.androidSelectionBox}>
              <TouchableOpacity style={styles.absCloseBtn} onPress={() => { setPendingResult(null); setIsEditingSelection(false); }}><MaterialCommunityIcons name="close" size={24} color="#9E9E9E" /></TouchableOpacity>
              <Text style={styles.editTitle}>{isEditingSelection ? "Adjust Details" : "Select Best Match"}</Text>
              {isEditingSelection ? (
                <View style={{ width: '100%', padding: 10 }}>
                  <View style={styles.inputGroup}><Text style={styles.inputLabel}>Food Name</Text><TextInput style={[styles.editInputSmall, { textAlign: 'left' }]} value={editName} onChangeText={setEditName} /></View>
                  <View style={styles.inputGroup}><Text style={styles.inputLabel}>Calories</Text><TextInput style={styles.editInputSmall} value={editCals} onChangeText={setEditCals} keyboardType="numeric" /></View>
                  <View style={styles.editActions}>
                    <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditingSelection(false)}><Text>Back</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={() => confirmSelection({ name: editName, calories: parseInt(editCals) || 0 })}><Text style={{ color: '#fff' }}>Add Meal</Text></TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={{ flexShrink: 1, marginBottom: 10 }}>
                    <ScrollView showsVerticalScrollIndicator onStartShouldSetResponderCapture={() => true}>
                      {pendingResult?.options?.map((opt, idx) => (
                        <View key={idx} style={styles.optionCard}>
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => confirmSelection(opt)}><Text style={styles.optionName}>{opt.name}</Text><Text style={styles.optionCal}>{opt.calories} cal</Text></TouchableOpacity>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => startEditingOption(opt)} style={{ padding: 8 }}><Ionicons name="pencil" size={20} color="#9E9E9E" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => confirmSelection(opt)} style={{ padding: 8 }}><Ionicons name="add-circle" size={28} color="#1B4D20" /></TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setPendingResult(null)}><Text style={styles.closeText}>Cancel Scan</Text></TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* MANUAL FOOD LOG MODAL */}
      {isLoggingFood && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>Manual Food Log</Text>
            <View style={styles.inputGroup}><Text style={styles.inputLabel}>Food / Drink Name</Text><TextInput style={[styles.editInputSmall, { textAlign: 'left' }]} value={manualFoodName} onChangeText={setManualFoodName} placeholder="e.g. Protein Shake" /></View>
            <View style={styles.inputGroup}><Text style={styles.inputLabel}>Calories</Text><TextInput style={styles.editInputSmall} value={manualFoodCals} onChangeText={setManualFoodCals} keyboardType="numeric" placeholder="0" /></View>
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsLoggingFood(false)}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleManualFoodLog}><Text style={{ color: '#fff' }}>Add Log</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ACTIVITY LOGGING MODAL */}
      {isLoggingActivity && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>Log Exercise</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activitySelector} onStartShouldSetResponderCapture={() => true} onTouchEnd={(e) => e.stopPropagation()}>
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
              <View style={[styles.inputGroup, { flex: 2, marginRight: 8 }]}><Text style={styles.inputLabel}>Gender</Text><View style={styles.genderPicker}>{['Male', 'Female'].map(g => (<TouchableOpacity key={g} onPress={() => setTempGender(g)} style={[styles.genderBtn, tempGender === g && styles.genderBtnActive]}><Text style={{ fontSize: 12, color: tempGender === g ? '#1B4D20' : '#999' }}>{g}</Text></TouchableOpacity>))}</View></View>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}><Text style={styles.inputLabel} numberOfLines={1}>Age</Text><TextInput style={styles.editInputSmall} value={tempAge} onChangeText={setTempAge} keyboardType="numeric" /></View>
              <View style={[styles.inputGroup, { flex: 1.2 }]}><Text style={styles.inputLabel} numberOfLines={1}>Wt (kg)</Text><TextInput style={styles.editInputSmall} value={tempWeight} onChangeText={setTempWeight} keyboardType="numeric" /></View>
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

  // FIX: Add Record<string, string> or Record<string, any>
  const iconMap: Record<string, any> = {
    Today: 'calendar-outline',
    Scan: 'camera-outline',
    Meals: 'fast-food-outline',
    Cardio: 'fitness-outline',
    Guide: 'book-outline',
    Shop: 'cart-outline'
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Tab.Navigator
        tabBarPosition="bottom"
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: '#1B4D20',
          tabBarInactiveTintColor: '#9E9E9E',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', textTransform: 'none' },
          tabBarStyle: { height: 75 + insets.bottom, paddingBottom: insets.bottom },
          tabBarIcon: ({ color, focused }) => {
            // TypeScript is now happy because iconMap is a Record
            const baseIconName = iconMap[route.name] || 'help-circle-outline';

            const finalIconName = focused
              ? baseIconName.replace('-outline', '')
              : baseIconName;

            return <Ionicons name={finalIconName as any} size={24} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Today">{() => <SummaryScreen />}</Tab.Screen>
        <Tab.Screen name="Scan">{() => <CameraScreen />}</Tab.Screen>
        <Tab.Screen name="Meals">{() => <ScanHistory />}</Tab.Screen>
        <Tab.Screen name="Cardio">{() => <ActivityHistory />}</Tab.Screen>
        <Tab.Screen name="Guide">{() => <Guide />}</Tab.Screen>
        <Tab.Screen name="Shop">{() => <Shop />}</Tab.Screen>
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
  syncIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  syncText: { fontSize: 10, fontWeight: '800', color: '#2196F3', marginLeft: 5, textTransform: 'uppercase' },
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
  editOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  editTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15, textAlign: 'center' },
  genderPicker: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 10, padding: 3 },
  genderBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  genderBtnActive: { backgroundColor: '#FFF' },
  editActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { flex: 0.48, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  saveBtn: { backgroundColor: '#1B4D20' },
  activitySelector: { flexDirection: 'row', marginBottom: 20 },
  activityTypeBtn: { alignItems: 'center', padding: 15, borderRadius: 18, backgroundColor: '#F5F5F5', marginRight: 10, width: 90 },
  activityTypeBtnActive: { backgroundColor: '#1B4D20' },
  activityTypeLabel: { fontSize: 10, fontWeight: '800', marginTop: 5, color: '#1B4D20' },
  activityTypeLabelActive: { color: '#FFF' },
  scrollPadding: {
    paddingHorizontal: 16, // Matches your resultsHalf padding
    paddingTop: 10,
    paddingBottom: 100, // Extra space at the bottom to ensure activities are fully visible
  },
  placeholderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewfinderOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  viewfinderBox: { width: 220, height: 140 },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: '#4CAF50', borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { height: 2, backgroundColor: '#4CAF50', width: '100%' },
  absCloseBtn: { position: 'absolute', top: 15, right: 15, zIndex: 10, padding: 5 },
  editBox: { backgroundColor: '#FFF', width: '92%', padding: 25, borderRadius: 25, position: 'relative', elevation: 20, alignItems: 'center' },
  optionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F5F5', padding: 16, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#E0E0E0' },
  optionName: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  optionCal: { fontSize: 14, color: '#2E7D32', fontWeight: '700', marginTop: 2 },
  closeText: { color: '#9E9E9E', fontWeight: '800', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' },
  inputGroup: { marginBottom: 15, width: '100%' },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#999', marginBottom: 5, textTransform: 'uppercase' },
  editInputSmall: { backgroundColor: '#F5F5F5', padding: 10, borderRadius: 10, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  cancelBtn: { backgroundColor: '#F5F5F5', paddingVertical: 14, borderRadius: 12, alignItems: 'center', width: '100%' },
  androidOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  androidSelectionBox: { width: '94%', maxHeight: '90%', backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 50 },
  unitSmall: { fontSize: 8, fontWeight: '700', color: '#9E9E9E' },
  googleFitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4', // Google Blue
    paddingVertical: 14,
    borderRadius: 15,
    marginBottom: 10,
    elevation: 2,
  },
  googleFitBtnText: {
    color: '#FFF',
    fontWeight: '800',
    marginLeft: 10,
    fontSize: 14,
  },
  manualSyncHeaderBtn: {
    padding: 5,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
  },
});