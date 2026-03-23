/* eslint-disable react/no-unescaped-entities */
import React, { ComponentProps, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, // Added for Health Check
  Alert,
  Keyboard,
  Modal, // Added for Health Check
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import {
  aggregateRecord,
  initialize,
  requestPermission
} from 'react-native-health-connect';

import { analyzeImageWithGemini } from '@/utils/geminiService';
import {
  checkActivitesQuota,
  checkMealsQuota,
  checkQuota,
  decrementMealsQuota,
  getGeminiCount,
  incrementActivitesQuota,
  incrementMealsQuota,
  incrementQuota
} from '@/utils/quotaService';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { removeFromHistory } from '@/utils/historyStorage';
import ActivityHistory from '../../components/ActivityHistory';
import CameraScreen from '../../components/CameraScreen';
import Guide from '../../components/Guide';
import PremiumModal from '../../components/PremiumModal';
import ScanHistory from '../../components/ScanHistory';
import Shop from '../../components/Shop';
import { useSubscriptionStatus } from '../../utils/subscription';

import { db, silentSignIn } from '@/utils/firebaseConfig';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';

import { MAX_ACTIVITIES, MAX_MEALS, MAX_SEARCHES } from '../../utils/constants';

const Tab = createMaterialTopTabNavigator();

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface ScanResult {
  id: string;
  productName: string;
  calories: number;
  carbs?: number;
  protein?: number;
  isManual: boolean;
}

interface PendingResult {
  options: { name: string; calories: number, protein: number, carbs: number }[];
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
  { label: "Hiking", met: 6.0, icon: "terrain" },
  { label: "Boxing", met: 9.0, icon: "boxing-glove" },
  { label: "Other", met: 4.5, icon: "dots-horizontal" },
];

function SummaryScreen({ onRecommendationsFound }: any) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [userId, setUserId] = useState<string | null | undefined>(null);

  const [targetCalories, setTargetCalories] = useState(0);
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState(0);
  const [weight, setWeight] = useState(0);
  const [waterCups, setWaterCups] = useState(0);
  const [mealQuotaCount, setMealQuotaCount] = useState(0);
  const [geminiQuotaCount, setGeminiQuotaCount] = useState('OK');
  const [geminiCount, setGeminiCount] = useState(0);
  const [activityQuotaCount, setActivityQuotaCount] = useState(0);

  const [tempCalories, setTempCalories] = useState('');
  const [tempGender, setTempGender] = useState('Male');
  const [tempAge, setTempAge] = useState('');
  const [tempWeight, setTempWeight] = useState('');

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [isLoggingActivity, setIsLoggingActivity] = useState(false);
  const [isLoggingFood, setIsLoggingFood] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false); // New State
  const [isAITextModal, setIsAITextModal] = useState(false);
  const [aiTextQuery, setAiTextQuery] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedActivity, setSelectedActivity] = useState(ACTIVITY_TYPES[0]);
  const [activityDuration, setActivityDuration] = useState('');
  const [manualFoodName, setManualFoodName] = useState('');
  const [manualFoodCals, setManualFoodCals] = useState('');
  const [manualFoodProtein, setManualFoodProtein] = useState('');
  const [manualFoodCarbs, setManualFoodCarbs] = useState('');

  const [scans, setScans] = useState<ScanResult[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isHealthModalVisible, setIsHealthModalVisible] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const [isEditingSelection, setIsEditingSelection] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCals, setEditCals] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');

  const isInitialLoadComplete = useRef(false);
  const { isPro } = useSubscriptionStatus();
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  const handleHealthSync = async () => {
    if (!isPro) {
      setIsHealthModalVisible(false);
      setShowPremium(true);
      return;
    }
    setIsSyncing(true);
    try {
      await initialize();

      const granted = await requestPermission([
        { accessType: 'read', recordType: 'TotalCaloriesBurned' }
      ]);

      const totalCaloriesBurned = granted.some(
        (p: any) => p.recordType === 'TotalCaloriesBurned'
      );

      if (!totalCaloriesBurned) {
        Alert.alert(
          "Permission Required",
          "Please enable 'Total Calories Burned' in the Health Connect menu."
        );
        setIsSyncing(false);
        return;
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const now = new Date();

      const aggregation = await aggregateRecord({
        recordType: 'TotalCaloriesBurned',
        timeRangeFilter: {
          operator: 'between',
          startTime: startOfDay.toISOString(),
          endTime: now.toISOString(),
        },
      });

      let totalBurned = 0;
      if (aggregation?.ENERGY_TOTAL) {
        totalBurned = Math.round(
          aggregation.ENERGY_TOTAL.inKilocalories
        );
      }

      if (totalBurned > 0 && userId) {
        const syncQ = query(
          collection(db, 'users', userId, 'activities'),
          where('type', '==', 'Health Sync'),
          where('date', '>=', startOfDay.toISOString())
        );

        const snap = await getDocs(syncQ);
        const delPromises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(delPromises);

        // 4. Save to Firestore
        await addDoc(collection(db, 'users', userId, 'activities'), {
          type: "Health Sync",
          icon: "google-fit",
          duration: 0,
          caloriesBurned: totalBurned,
          date: new Date().toISOString(),
          createdAt: serverTimestamp(),
        });

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncedTime(timestamp);
        setLastSyncTime(timestamp);

        if (userId) {
          await setDoc(doc(db, 'users', userId, 'profile', 'data'), {
            lastSyncedTime: timestamp
          }, { merge: true });
        }
      }
    } catch (err: any) {
      const errorMessage = typeof err === 'string' ? err : (err.message || "Unknown Error");
      Alert.alert("Sync Error", errorMessage);
    } finally {
      setIsSyncing(false);
      refreshQuotas();
    }
  };

  const refreshQuotas = async () => {
    const [mQ, gStatus, aQ, gCount] = await Promise.all([
      checkMealsQuota(),
      checkQuota(),
      checkActivitesQuota(),
      getGeminiCount()
    ]);

    setMealQuotaCount(mQ);
    setGeminiCount(gCount);
    setActivityQuotaCount(aQ);
    setGeminiQuotaCount(gStatus);
  };

  useEffect(() => {
    const init = async () => {
      const uid = await silentSignIn();
      if (uid) {
        setUserId(uid);
        const userRef = doc(db, 'users', uid, 'profile', 'data');
        const docSnap = await getDoc(userRef);
        const today = new Date().toDateString();

        if (docSnap.exists()) {
          const data = docSnap.data();
          setTargetCalories(data.targetCalories || 0);
          setGender(data.gender || 'Male');
          setAge(Number(data.age) || 0);
          setWeight(Number(data.weight) || 0);
          setTempCalories((data.targetCalories || '').toString());
          setTempGender(data.gender || 'Male');
          setTempAge((data.age || '').toString());
          setTempWeight((data.weight || '').toString());

          // Persist Sync Status
          const isAutoSync = data.autoSyncEnabled || false;
          setAutoSyncEnabled(isAutoSync);
          setLastSyncedTime(data.lastSyncedTime || 'Never');

          if (data.isNewUser !== false || data.targetCalories === 0) {
            setIsEditingTarget(true);
          }

          if (data.lastSavedDate !== today) {
            await setDoc(userRef, { lastSavedDate: today, waterCups: 0, geminiCount: 0, mealsCount: 0, activitiesCount: 0 }, { merge: true });
          }

          if (isAutoSync && isPro) {
            handleHealthSync();
          }
        } else {
          await setDoc(userRef, { lastSavedDate: today, waterCups: 0, geminiCount: 0, mealsCount: 0, activitiesCount: 0, targetCalories: 0, gender: 'Male', age: 0, weight: 0, isNewUser: true, autoSyncEnabled: false }, { merge: true });
          setIsEditingTarget(true);
        }
      }
      setIsProfileLoading(false);
      isInitialLoadComplete.current = true;
      refreshQuotas();
    };
    init();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const unsubscribeProfile = onSnapshot(doc(db, 'users', userId, 'profile', 'data'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTargetCalories(Number(data.targetCalories) || 0);
        setGender(data.gender || 'Male');
        setAge(Number(data.age) || 0);
        setWeight(Number(data.weight) || 0);
        setWaterCups(data.waterCups || 0);
        setAutoSyncEnabled(data.autoSyncEnabled || false);
      }
      setIsProfileLoading(false);
    }, (err) => {
      console.error(err);
      setIsProfileLoading(false);
    });

    const mealsQuery = query(
      collection(db, 'users', userId, 'meals'),
      where('createdAt', '>=', startOfToday),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeMeals = onSnapshot(mealsQuery, (snapshot) => {
      const loadedScans = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          calories: Number(data.calories),
          protein: Number(data.protein || 0),
          carbs: Number(data.carbs || 0)
        };
      }) as ScanResult[];
      setScans(loadedScans);
    }, (error) => console.error("Meals Listener Error:", error));

    const activitiesQuery = query(
      collection(db, 'users', userId, 'activities'),
      where('createdAt', '>=', startOfToday),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeActivities = onSnapshot(activitiesQuery, (snapshot) => {
      const loadedActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivities(loadedActivities);
    }, (error) => console.error("Activities Listener Error:", error));

    return () => {
      unsubscribeProfile();
      unsubscribeMeals();
      unsubscribeActivities();
    };
  }, [userId]);

  useEffect(() => {
    const disableSyncIfNonPro = async () => {
      if (!isPro && autoSyncEnabled && userId) {
        setAutoSyncEnabled(false);
        try {
          await setDoc(doc(db, 'users', userId, 'profile', 'data'), {
            autoSyncEnabled: false
          }, { merge: true });
        } catch (e) {
          console.error("Failed to disable sync on premium loss:", e);
        }
      }
    };
    disableSyncIfNonPro();
  }, [isPro, autoSyncEnabled, userId]);

  useFocusEffect(
    React.useCallback(() => {
      refreshQuotas();
      if (autoSyncEnabled && isPro) {
        handleHealthSync();
      }
    }, [autoSyncEnabled, isPro])
  );

  const calculateSuggestedGoal = () => {
    const w = parseFloat(tempWeight);
    const a = parseInt(tempAge);

    if (isNaN(w) || w <= 0 || isNaN(a) || a <= 0) {
      alert("Please enter a valid Age and Weight.");
      return;
    }

    // Standard averages for height since it's not in your profile yet
    const height = tempGender === 'Male' ? 175 : 162;

    let bmr = (10 * w) + (6.25 * height) - (5 * a);
    bmr = tempGender === 'Male' ? bmr + 5 : bmr - 161;

    // Apply a 1.2x multiplier for "Sedentary/Maintenance" activity level
    const suggestion = Math.round(bmr * 1.2);
    setTempCalories(suggestion.toString());
  };

  const saveProfileData = async () => {
    // 1. Convert inputs to numbers
    const cals = Math.floor(Number(tempCalories));
    const ageNum = Math.floor(Number(tempAge));
    const weightNum = Math.floor(Number(tempWeight));

    // 2. Calorie Validation (500 - 10,000)
    if (isNaN(cals) || cals < 500 || cals > 10000) {
      Alert.alert("Invalid Calories", "Please enter a goal between 500 and 10,000.");
      return;
    }

    // 3. Age Validation (13 - 120) - FIXED: Now checks ageNum
    if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
      Alert.alert("Invalid Age", "Please enter a valid age between 13 and 120.");
      return;
    }

    // 4. Weight Validation (30 - 500) - FIXED: Now checks weightNum
    if (isNaN(weightNum) || weightNum < 30 || weightNum > 500) {
      Alert.alert("Invalid Weight", "Please enter a weight between 30kg and 500kg.");
      return;
    }

    // 5. Database Save (Only reaches here if all values are valid)
    try {
      if (userId) {
        setIsSaving(true); // Assuming you have a loading state

        await setDoc(doc(db, 'users', userId, 'profile', 'data'), {
          targetCalories: cals,
          gender: tempGender,
          age: ageNum,
          weight: weightNum,
          isNewUser: false,
          updatedAt: serverTimestamp()
        }, { merge: true });

        await refreshQuotas();
        setIsEditingTarget(false);
        Keyboard.dismiss();
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      Alert.alert("Error", "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const adjustWater = async (amount: number) => {
    if (!userId) return;
    const newCount = Math.max(0, waterCups + amount);
    try {
      await setDoc(doc(db, 'users', userId, 'profile', 'data'), { waterCups: newCount }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const handleEditMeal = (item: ScanResult) => {
    setEditingMealId(item.id);
    setEditName(item.productName);
    setEditCals(item.calories.toString());
    setEditProtein((item.protein || 0).toString());
    setEditCarbs((item.carbs || 0).toString());
    setIsEditingSelection(true); // Re-use the existing modal logic
  };

  const handleEditActivity = (act: any) => {
    setEditingActivityId(act.id);
    const match = ACTIVITY_TYPES.find(a => a.label === act.type) || ACTIVITY_TYPES[0];
    setSelectedActivity(match);
    setActivityDuration(act.duration.toString());
    setIsLoggingActivity(true);
  };

  const handleAddActivity = async () => {
    if (!userId || isSaving) return;

    const mins = Number(activityDuration);
    if (!Number.isInteger(mins) || mins <= 0 || mins > 1440) {
      Alert.alert(
        "Invalid Duration",
        "Please enter a whole number of minutes (1 to 1440)."
      );
      return;
    }

    setIsSaving(true);

    try {
      if (!editingActivityId) {
        const currentActCount = await checkActivitesQuota();
        if (!isPro && currentActCount >= MAX_ACTIVITIES) {
          setIsLoggingActivity(false);
          setShowPremium(true);
          return;
        }
      }
      const burnPerMin = (selectedActivity.met * weight * 3.5) / 200;
      const totalBurned = Math.round(burnPerMin * mins);

      const activityData = {
        type: selectedActivity.label,
        icon: selectedActivity.icon,
        duration: mins,
        caloriesBurned: totalBurned,
        updatedAt: serverTimestamp(),
      };

      if (editingActivityId) {
        await setDoc(
          doc(db, 'users', userId, 'activities', editingActivityId),
          activityData,
          { merge: true }
        );
      } else {
        await addDoc(collection(db, 'users', userId, 'activities'), {
          ...activityData,
          date: new Date().toISOString(),
          createdAt: serverTimestamp(),
        });
        await incrementActivitesQuota();
      }

      await refreshQuotas();
      setIsLoggingActivity(false);
      setEditingActivityId(null);
      setActivityDuration("");

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      Alert.alert("Error", "Could not save activity. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAITextSearch = async () => {
    if (!isPro) {
      const status = await checkQuota();
      if (status === 'LIMIT_REACHED') {
        setIsAITextModal(false);
        setShowPremium(true);
        return;
      }
    }

    if (!aiTextQuery.trim()) return;

    setIsAILoading(true);

    try {
      const rawResponse = await analyzeImageWithGemini(
        isPro,
        { gender, age, targetCalories },
        undefined,
        aiTextQuery
      );

      const data = JSON.parse(rawResponse);
      await incrementQuota();
      setPendingResult({
        options: data.identifiedOptions.slice(0, 3),
        rawResult: data
      });

      setIsAITextModal(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      Alert.alert("AI Error", "Failed to analyze your meal. Please try again.");
    } finally {
      setIsAILoading(false);
      setAiTextQuery('');
      refreshQuotas();
    }
  };

  const handleManualFoodLog = async () => {
    if (!userId) return;

    // Validation
    const cals = parseInt(manualFoodCals);
    if (!manualFoodName.trim()) {
      Alert.alert("Missing Info", "Please enter a food or drink name.");
      return;
    }
    if (isNaN(cals) || cals <= 0) {
      Alert.alert("Invalid Calories", "Please enter a valid calorie amount greater than 0.");
      return;
    }

    const currentCount = await checkMealsQuota();
    if (!isPro && currentCount >= MAX_MEALS) {
      setIsLoggingFood(false); setShowPremium(true); return;
    }

    const protein = parseInt(manualFoodProtein) || 0;
    const carbs = parseInt(manualFoodCarbs) || 0;

    try {
      await addDoc(collection(db, 'users', userId, 'meals'), {
        productName: manualFoodName,
        calories: cals,
        protein: protein,
        carbs: carbs,
        isManual: true,
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });
      await incrementMealsQuota();
      await refreshQuotas();
      setIsLoggingFood(false);
      setManualFoodName('');
      setManualFoodCals('');
      setManualFoodProtein('');
      setManualFoodCarbs('');
    } catch (error) { console.error(error); }
  };

  const deleteActivity = async (id: string) => {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'activities', id));
      await refreshQuotas();
    } catch (e) { console.error(e); }
  };

  const deleteScan = async (id: string) => {
    if (!userId) return;
    const itemToDelete = scans.find(s => s.id === id);
    try {
      await deleteDoc(doc(db, 'users', userId, 'meals', id));
      if (itemToDelete && itemToDelete.isManual) { await decrementMealsQuota(); }
      await removeFromHistory(id);
      await refreshQuotas();
    } catch (error) { console.error(error); }
  };

  const handleOpenActivityLogger = async () => {
    const currentActCount = await checkActivitesQuota();
    if (!isPro && currentActCount >= MAX_ACTIVITIES) setShowPremium(true);
    else setIsLoggingActivity(true);
  };

  const handleOpenFoodLogger = async () => {
    const currentCount = await checkMealsQuota();
    if (!isPro && currentCount >= MAX_MEALS) setShowPremium(true);
    else setIsLoggingFood(true);
  };

  const handleOpenScanScanner = async () => {
    const geminiQuotaCount = await checkQuota();
    if (!isPro && geminiQuotaCount === 'LIMIT_REACHED') setShowPremium(true);
    else navigation.navigate('AI Scan');
  };

  const confirmSelection = async (option: { name: string; calories: number; protein: number; carbs: number }) => {
    if (!userId) return;

    // Validation
    if (!option.name.trim()) {
      Alert.alert("Missing Info", "Product name cannot be empty.");
      return;
    }
    if (isNaN(option.calories) || option.calories <= 0) {
      Alert.alert("Invalid Calories", "Calories must be a valid number greater than 0.");
      return;
    }

    try {
      if (editingMealId) {
        const mealRef = doc(db, 'users', userId, 'meals', editingMealId);
        await setDoc(mealRef, {
          productName: option.name,
          calories: option.calories,
          protein: option.protein,
          carbs: option.carbs,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        await addDoc(collection(db, 'users', userId, 'meals'), {
          productName: option.name,
          calories: option.calories,
          protein: option.protein,
          carbs: option.carbs,
          isManual: false,
          date: new Date().toISOString(),
          createdAt: serverTimestamp(),
        });
      }

      setPendingResult(null);
      setIsEditingSelection(false);
      setEditingMealId(null);
    } catch (e) { console.error(e); }
  };

  const startEditingOption = (opt: { name: string; calories: number; protein: number; carbs: number }) => {
    setEditName(opt.name);
    setEditCals(opt.calories.toString());
    setEditProtein(opt.protein.toString());
    setEditCarbs(opt.carbs.toString());
    setIsEditingSelection(true);
  };

  const totalConsumed = (scans || []).reduce((sum, s) => sum + (s.calories || 0), 0);
  const totalProteinGrams = (scans || []).reduce((sum, s) => sum + (s.protein || 0), 0);
  const totalCarbsGrams = (scans || []).reduce((sum, s) => sum + (s.carbs || 0), 0);

  const totalBurned = (activities || []).reduce((sum, a) => sum + (a.caloriesBurned || 0), 0);
  const remainingCalories = Math.max(targetCalories - totalConsumed + totalBurned, 0);

  if (isProfileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1B4D20" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }
  return (
    <View style={styles.cameraTabContainer}>
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Daily Dashboard</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                if (!isPro) {
                  setShowPremium(true);
                } else {
                  setIsHealthModalVisible(true);
                }
              }}
              style={styles.actionBtn}
            >
              <MaterialCommunityIcons
                name="google-fit"
                size={28}
                color={autoSyncEnabled ? "#FFD700" : "#B8860B"}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowGuide(true)} style={styles.actionBtn}>
              <MaterialCommunityIcons name="book-open-variant" size={28} color="#1B4D20" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowShop(true)} style={styles.actionBtn}>
              <MaterialCommunityIcons name="cart-variant" size={28} color="#1B4D20" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerAccentBar} />
        <Text style={styles.subtitle}>{age}yr {gender} • {weight}kg Profile Active</Text>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>

          <TouchableOpacity style={styles.mainTargetBadge} activeOpacity={0.9} onPress={() => setIsEditingTarget(true)}>
            <View style={styles.targetSplitRow}>
              <View style={styles.targetColumn}><Text style={styles.targetLabel}>Goal</Text><Text style={styles.targetValue}>{targetCalories}<Text style={styles.unitSmall}> CAL</Text></Text></View>
              <View style={styles.verticalDivider} /><View style={styles.targetColumn}><Text style={styles.targetLabel}>Intake</Text><Text style={styles.targetValue}>{totalConsumed}<Text style={styles.unitSmall}> CAL</Text></Text></View>
              <View style={styles.verticalDivider} /><View style={styles.targetColumn}><Text style={styles.targetLabel}>Burned</Text><Text style={[styles.targetValue, { color: '#1976D2' }]}>{totalBurned}<Text style={styles.unitSmall}> CAL</Text></Text></View>
              <View style={styles.verticalDivider} /><View style={styles.targetColumn}><Text style={styles.targetLabel}>Left</Text><Text style={[styles.targetValue, { color: remainingCalories <= 200 ? '#FF5252' : '#1B4D20' }]}>{remainingCalories}<Text style={styles.unitSmall}> CAL</Text></Text></View>
            </View>

            <View style={styles.macroSummaryRow}>
              <Text style={styles.macroSummaryText}>TODAY'S TOTAL <View style={styles.dotSeparator} /> CAL <Text style={{ fontWeight: '900' }}>{totalConsumed}</Text></Text>
              <View style={styles.dotSeparator} />
              <Text style={styles.macroSummaryText}>PROTEIN: <Text style={{ fontWeight: '900' }}>{totalProteinGrams}g</Text></Text>
              <View style={styles.dotSeparator} />
              <Text style={styles.macroSummaryText}>CARBS: <Text style={{ fontWeight: '900' }}>{totalCarbsGrams}g</Text></Text>
            </View>

            <View style={styles.profileStrip}>
              <View style={styles.profileItem}><MaterialCommunityIcons name={gender === 'Male' ? "gender-male" : "gender-female"} size={14} color="#FFF" /><Text style={styles.profileItemText}>{gender.toUpperCase()}</Text></View>
              <View style={styles.stripDivider} /><View style={styles.profileItem}><MaterialCommunityIcons name="account-clock" size={14} color="#FFF" /><Text style={styles.profileItemText}>{age}yr • {weight}kg</Text></View>
            </View>
          </TouchableOpacity>

          {/* Water Tracker */}
          <View style={styles.waterTrackerContainer}>
            <View style={styles.waterHeader}><MaterialCommunityIcons name="water" size={20} color="#2196F3" /><Text style={styles.waterTitle}>Daily Water Intake</Text><Text style={styles.waterCount}>{waterCups} <Text style={{ fontSize: 12, color: '#999' }}>cups</Text></Text></View>
            <View style={styles.waterControls}>
              <TouchableOpacity style={styles.waterBtn} onPress={() => adjustWater(-1)}><Ionicons name="remove-circle-outline" size={28} color="#9E9E9E" /></TouchableOpacity>
              <View style={styles.waterProgressTrack}>{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (<View key={i} style={[styles.waterDrop, waterCups >= i && styles.waterDropActive]} />))}</View>
              <TouchableOpacity style={styles.waterBtn} onPress={() => adjustWater(1)}><Ionicons name="add-circle-outline" size={28} color="#2196F3" /></TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.btnActionRow}>
            {/* LOG MEALS */}
            <TouchableOpacity
              style={[styles.quadBtn, (!isPro && mealQuotaCount >= MAX_MEALS) && styles.logActivityBtnLocked]}
              onPress={handleOpenFoodLogger}
            >
              <MaterialCommunityIcons
                name={((!isPro && mealQuotaCount >= MAX_MEALS) ? "lock" : "food-apple") as any}
                size={22}
                color={(!isPro && mealQuotaCount >= MAX_MEALS) ? "#9E9E9E" : "#1B4D20"}
              />
              <Text style={styles.tripleBtnText}>{(!isPro && mealQuotaCount >= MAX_MEALS) ? `Upgrade` : "Intake"}</Text>
            </TouchableOpacity>

            {/* LOG ACTIVITY */}
            <TouchableOpacity
              style={[styles.quadBtn, (!isPro && activityQuotaCount >= MAX_ACTIVITIES) && styles.logActivityBtnLocked]}
              onPress={handleOpenActivityLogger}
            >
              <MaterialCommunityIcons
                name={(!isPro && activityQuotaCount >= MAX_ACTIVITIES) ? "lock" : "run"}
                size={22}
                color={(!isPro && activityQuotaCount >= MAX_ACTIVITIES) ? "#9E9E9E" : "#1B4D20"}
              />
              <Text style={styles.tripleBtnText}>{(!isPro && activityQuotaCount >= MAX_ACTIVITIES) ? `Upgrade` : "Activity"}</Text>
            </TouchableOpacity>

            {/* AI SCAN */}
            <TouchableOpacity
              style={[styles.quadBtn, (!isPro && geminiCount >= MAX_SEARCHES) && styles.logActivityBtnLocked]}
              onPress={handleOpenScanScanner}
            >
              <MaterialCommunityIcons
                name={(!isPro && geminiCount >= MAX_SEARCHES) ? "lock" : "camera"}
                size={22}
                color="#B8860B"
              />
              <Text style={styles.tripleBtnText}>
                {(!isPro && geminiCount >= MAX_SEARCHES)
                  ? "Upgrade"
                  : `AI Scan ${!isPro ? `(${MAX_SEARCHES - Number(geminiCount || 0)} free)` : "(Pro)"}`}
              </Text>
              {!isPro && (
                <View style={[styles.quotaBarWrapper, { width: '70%', marginTop: 4 }]}>
                  <View
                    style={[
                      styles.quotaBarFill,
                      {
                        width: `${Math.min(100, (Number(geminiCount || 0) / MAX_SEARCHES) * 100)}%`,
                        backgroundColor: geminiCount >= MAX_SEARCHES ? '#FF5252' : '#4CAF50'
                      }
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* NEW AI TEXT BUTTON */}
            <TouchableOpacity
              style={[styles.quadBtn, (!isPro && geminiCount >= MAX_SEARCHES) && styles.logActivityBtnLocked]}
              onPress={() => (geminiCount >= MAX_SEARCHES && !isPro) ? setShowPremium(true) : setIsAITextModal(true)}
            >
              <MaterialCommunityIcons
                name={(!isPro && geminiCount >= MAX_SEARCHES) ? "lock" : "text-search"}
                size={22}
                color="#B8860B"
              />
              <Text style={styles.tripleBtnText}>
                {(!isPro && geminiCount >= MAX_SEARCHES)
                  ? "Upgrade"
                  : `AI Text ${!isPro ? `(${MAX_SEARCHES - Number(geminiCount || 0)} free)` : "(Pro)"}`}
              </Text>

              {!isPro && (
                <View style={[styles.quotaBarWrapper, { width: '75%', marginTop: 4 }]}>
                  <View
                    style={[
                      styles.quotaBarFill,
                      {
                        width: `${Math.min(100, (Number(geminiCount || 0) / MAX_SEARCHES) * 100)}%`,
                        backgroundColor: geminiCount >= MAX_SEARCHES ? '#FF5252' : '#4CAF50'
                      }
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {lastSyncTime && (
            <View style={[styles.syncRow, styles.premiumSyncRow]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons
                  name={autoSyncEnabled ? "sync" : "sync-off"}
                  size={16}
                  color="#DAA520"
                  style={{ marginRight: 6 }}
                />
                <View style={[styles.syncIndicator, styles.premiumSyncIndicator]} />
                <Text style={[styles.syncText, styles.premiumSyncText]}>
                  {autoSyncEnabled ? 'Auto-Synced' : 'Last Sync'} at {lastSyncTime}
                </Text>
              </View>

              <TouchableOpacity onPress={handleHealthSync} style={styles.refreshIcon}>
                <Text style={{ fontSize: 14, color: '#B8860B', fontWeight: '800' }}>Refresh</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Today's Intake</Text></View>

          {scans?.map((item) => (
            <View key={item.id} style={styles.collapsibleCard}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={styles.iconPlaceholder}><MaterialCommunityIcons name={item.isManual ? "food-apple" : "camera"} size={24} color="#1B4D20" /></View>
                  <View style={styles.headerInfo}>
                    <Text style={styles.foodTitle}>{item.productName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Text style={styles.foodCals}>Cal: {item.calories || 0}</Text>
                      {(item.protein !== undefined || item.carbs !== undefined) && (
                        <>
                          <View style={styles.miniDot} />
                          <Text style={styles.foodCals}>Pro: {(item.protein || 0)}g</Text>
                          <View style={styles.miniDot} />
                          <Text style={styles.foodCals}>Carb: {(item.carbs || 0)}g</Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleEditMeal(item)}
                  style={styles.rowActionBtn} // New specific style
                >
                  <MaterialCommunityIcons name="pencil" size={18} color="#1B4D20" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => deleteScan(item.id)}
                  style={styles.rowActionBtn}
                >
                  <MaterialCommunityIcons name="trash-can" size={18} color="#FF5252" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Activities Section */}
          <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Today's Activities</Text></View>

          {activities?.map((act) => (
            <View key={act.id} style={styles.collapsibleCard}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={styles.iconPlaceholder}>
                    <MaterialCommunityIcons name={act.icon as any} size={24} color="#1B4D20" />
                  </View>
                  <View style={styles.headerInfo}>
                    <Text style={styles.foodTitle}>{act.type}</Text>
                    <Text style={styles.foodCals}>
                      {act.duration} mins • {act.caloriesBurned} cal Burned
                    </Text>
                  </View>
                </View>

                {act.type !== "Health Sync" && (
                  <TouchableOpacity
                    onPress={() => handleEditActivity(act)}
                    style={styles.rowActionBtn}
                  >
                    <MaterialCommunityIcons name="pencil" size={18} color="#1B4D20" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => deleteActivity(act.id)}
                  style={[styles.rowActionBtn, { backgroundColor: '#FFEBEE' }]}
                >
                  <MaterialCommunityIcons name="trash-can" size={18} color="#FF5252" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>

        <Modal visible={isEditingSelection} transparent animationType="fade" onRequestClose={() => setIsEditingSelection(false)}>
          <View style={styles.androidOverlay}>
            <View style={styles.androidSelectionBox}>
              <TouchableOpacity
                style={styles.absCloseBtn}
                onPress={() => { setIsEditingSelection(false); setEditingMealId(null); }}
              >
                <MaterialCommunityIcons name="close" size={24} color="#9E9E9E" />
              </TouchableOpacity>

              <Text style={styles.editTitle}>{editingMealId ? "Edit Meal" : "Meal Details"}</Text>

              <View style={{ width: '100%', padding: 10 }}>
                <View style={styles.inputGroup}><Text style={styles.inputLabel}>Food Name</Text><TextInput style={[styles.editInputSmall, { textAlign: 'left' }]} value={editName} onChangeText={setEditName} /></View>
                <View style={styles.inputGroup}><Text style={styles.inputLabel}>Calories</Text><TextInput style={styles.editInputSmall} value={editCals} onChangeText={setEditCals} keyboardType="numeric" /></View>
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}><Text style={styles.inputLabel}>Protein</Text><TextInput style={styles.editInputSmall} value={editProtein} onChangeText={setEditProtein} keyboardType="numeric" /></View>
                  <View style={[styles.inputGroup, { flex: 1 }]}><Text style={styles.inputLabel}>Carbs</Text><TextInput style={styles.editInputSmall} value={editCarbs} onChangeText={setEditCarbs} keyboardType="numeric" /></View>
                </View>

                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={() => { setIsEditingSelection(false); setEditingMealId(null); }}
                  >
                    <Text>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.saveBtn]}
                    onPress={() => confirmSelection({
                      name: editName,
                      calories: parseInt(editCals) || 0,
                      protein: parseInt(editProtein) || 0,
                      carbs: parseInt(editCarbs) || 0
                    })}
                  >
                    <Text style={{ color: '#fff' }}>{editingMealId ? "Update" : "Add"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
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
                  <View style={styles.inputGroup}><Text style={styles.inputLabel}>Protein</Text><TextInput style={styles.editInputSmall} value={editProtein} onChangeText={setEditProtein} keyboardType="numeric" /></View>
                  <View style={styles.inputGroup}><Text style={styles.inputLabel}>Carbs</Text><TextInput style={styles.editInputSmall} value={editCarbs} onChangeText={setEditCarbs} keyboardType="numeric" /></View>
                  <View style={styles.editActions}>
                    <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditingSelection(false)}><Text>Back</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={() => confirmSelection({ name: editName, calories: parseInt(editCals) || 0, protein: parseInt(editProtein) || 0, carbs: parseInt(editCarbs) || 0 })}><Text style={{ color: '#fff' }}>Add</Text></TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={{ flexShrink: 1, marginBottom: 10 }}>
                    <ScrollView showsVerticalScrollIndicator onStartShouldSetResponderCapture={() => true}>
                      {pendingResult?.options?.map((opt, idx) => (
                        <View key={idx} style={styles.optionCard}>
                          <TouchableOpacity style={{ flex: 1 }}><Text style={styles.optionName}>{opt.name}</Text><Text style={styles.optionCal}>{opt.calories} cal</Text></TouchableOpacity>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => startEditingOption(opt)} style={{ padding: 8 }}><Ionicons name="pencil" size={20} color="#9E9E9E" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => confirmSelection(opt)} style={{ padding: 8 }}><Ionicons name="add-circle" size={28} color="#1B4D20" /></TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setPendingResult(null)}><Text style={{ color: '#9E9E9E', fontWeight: '800', textAlign: 'center' }}>Cancel Scan</Text></TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {isLoggingFood && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>Log Meals/Drink</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Food / Drink Name</Text>
              <TextInput
                style={[styles.editInputSmall, { textAlign: 'left' }]}
                value={manualFoodName}
                onChangeText={setManualFoodName}
                placeholder="e.g. Protein Shake"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Calories (cal)</Text>
              <TextInput
                style={styles.editInputSmall}
                value={manualFoodCals}
                onChangeText={setManualFoodCals}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.editInputSmall}
                  value={manualFoodProtein}
                  onChangeText={setManualFoodProtein}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.editInputSmall}
                  value={manualFoodCarbs}
                  onChangeText={setManualFoodCarbs}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsLoggingFood(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleManualFoodLog}>
                <Text style={{ color: '#fff' }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {isLoggingActivity && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>Log Exercise/Activity</Text>
            <Text style={styles.sectionLabel}>Common Activities</Text>
            <View style={styles.gridContainer}>
              {ACTIVITY_TYPES.map((act) => ( // Show top 6 as quick-select
                <TouchableOpacity
                  key={act.label}
                  style={[
                    styles.gridItem,
                    selectedActivity.label === act.label && styles.gridItemActive
                  ]}
                  onPress={() => setSelectedActivity(act)}
                >
                  <MaterialCommunityIcons
                    name={act.icon as any}
                    size={24}
                    color={selectedActivity.label === act.label ? "#FFF" : "#1B4D20"}
                  />
                  <Text style={[
                    styles.gridLabel,
                    selectedActivity.label === act.label && styles.gridLabelActive
                  ]}>
                    {act.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Duration (Minutes)</Text>
              <TextInput
                style={styles.editInputSmall}
                value={activityDuration}
                onChangeText={setActivityDuration}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setIsLoggingActivity(false)}
              >
                <Text style={{ fontWeight: '600', color: '#666' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleAddActivity}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Add Activity</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {isEditingTarget && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>
              {targetCalories === 0 ? "Welcome! Setup Profile" : "Edit Profile"}
            </Text>

            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <Text style={styles.inputLabel}>Daily Calorie Goal</Text>
                <TouchableOpacity onPress={calculateSuggestedGoal}>
                  <Text style={{ fontSize: 10, color: '#1B4D20', fontWeight: '900' }}>✨ AUTO-CALCULATE</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.editInputSmall}
                value={tempCalories}
                onChangeText={setTempCalories}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 2, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.genderPicker}>
                  {['Male', 'Female'].map(g => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setTempGender(g)}
                      style={[styles.genderBtn, tempGender === g && styles.genderBtnActive]}
                    >
                      <Text style={{ fontSize: 12, color: tempGender === g ? '#1B4D20' : '#999' }}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput
                  style={styles.editInputSmall}
                  value={tempAge}
                  onChangeText={setTempAge}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1.2 }]}>
                <Text style={styles.inputLabel}>Wt (kg)</Text>
                <TextInput
                  style={styles.editInputSmall}
                  value={tempWeight}
                  onChangeText={setTempWeight}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.editActions}>
              {targetCalories !== 0 && (
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditingTarget(false)}>
                  <Text>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn, { flex: targetCalories === 0 ? 1 : 0.48 }]}
                onPress={saveProfileData}
              >
                <Text style={{ color: '#fff' }}>{targetCalories === 0 ? "Get Started" : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* GUIDE POP-UP MODAL */}
      <Modal visible={showGuide} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowGuide(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.modalTitle}>Health Guide</Text>
            <TouchableOpacity onPress={() => setShowGuide(false)}>
              <MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Guide />
          </View>
          <TouchableOpacity
            style={[styles.bottomCloseBtn, { marginBottom: insets.bottom + 10 }]}
            onPress={() => setShowGuide(false)}
          >
            <Text style={styles.bottomCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* SHOP POP-UP MODAL */}
      <Modal visible={showShop} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowShop(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.modalTitle}>Shop at Amazon</Text>
            <TouchableOpacity onPress={() => setShowShop(false)}>
              <MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Shop />
          </View>
          <TouchableOpacity
            style={[styles.bottomCloseBtn, { marginBottom: insets.bottom + 10 }]}
            onPress={() => setShowShop(false)}
          >
            <Text style={styles.bottomCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={isAITextModal} transparent animationType="slide">
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            {isAILoading ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#1B4D20" />
                <Text style={[styles.editTitle, { marginTop: 20 }]}>AI is thinking...</Text>
                <Text style={{ color: '#666', textAlign: 'center', fontSize: 13 }}>
                  Calculating nutrition for your description
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.editTitle}>Describe your Meal</Text>

                {/* WRAPPER: This locks the dimensions regardless of content */}
                <View style={styles.fixedInputWrapper}>
                  <TextInput
                    style={styles.fixedInternalInput}
                    placeholder="e.g. 2 eggs on sourdough toast with half an avocado"
                    placeholderTextColor="#999"
                    multiline={true}
                    scrollEnabled={true}
                    blurOnSubmit={false} // Keeps the box from jumping on 'Enter'
                    value={aiTextQuery}
                    onChangeText={setAiTextQuery}
                    editable={!isAILoading}
                    underlineColorAndroid="transparent" // Clean look for Android
                  />
                </View>

                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={() => setIsAITextModal(false)}
                    disabled={isAILoading}
                  >
                    <Text style={{ fontWeight: '700', color: '#666' }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtn, styles.saveBtn]}
                    onPress={handleAITextSearch}
                    disabled={isAILoading}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Ask AI</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* UPDATED HEALTH SETTINGS MODAL */}
      <Modal visible={isHealthModalVisible} transparent animationType="slide">
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <MaterialCommunityIcons name="google-fit" size={50} color={autoSyncEnabled ? "#2196F3" : "#1B4D20"} />
            <Text style={styles.editTitle}>Health Connect Sync</Text>

            {/* LAST SYNCED BADGE */}
            <View style={{ backgroundColor: '#E3F2FD', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginBottom: 10 }}>
              <Text style={{ fontSize: 11, color: '#1976D2', fontWeight: '800' }}>
                LAST SYNCED: {lastSyncedTime}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginVertical: 10 }}>
              <View>
                <Text style={{ fontWeight: '700', color: '#333' }}>Auto-Sync on Load</Text>
                <Text style={{ fontSize: 10, color: '#999' }}>Samsung Health & Google Fit</Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  if (!isPro) {
                    setIsHealthModalVisible(false);
                    setShowPremium(true);
                    return;
                  }
                  const newValue = !autoSyncEnabled;
                  setAutoSyncEnabled(newValue);
                  if (userId) {
                    await setDoc(doc(db, 'users', userId, 'profile', 'data'), { autoSyncEnabled: newValue }, { merge: true });
                  }
                }}
              >
                <MaterialCommunityIcons
                  name={autoSyncEnabled ? "toggle-switch" : "toggle-switch-off"}
                  size={50}
                  color={autoSyncEnabled ? "#4CAF50" : "#CCC"}
                />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 }}>
              Syncs total calories burned today from your wearable devices and health apps.
            </Text>

            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsHealthModalVisible(false)}>
                <Text style={{ fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn, { backgroundColor: isSyncing ? '#999' : '#1B4D20' }]}
                onPress={handleHealthSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Sync Now</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  );
}

// Tab Navigator and Styles remain unchanged
function AppContent() {
  const insets = useSafeAreaInsets();
  const iconMap: Record<string, any> = { Today: 'calendar-outline', "AI Scan": 'camera-outline', "Intake": 'fast-food-outline', "Burned": 'fitness-outline', Guide: 'book-outline', Shop: 'cart-outline' };
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Tab.Navigator tabBarPosition="bottom" screenOptions={({ route }) => ({ tabBarActiveTintColor: '#1B4D20', tabBarInactiveTintColor: '#9E9E9E', tabBarLabelStyle: { fontSize: 10, fontWeight: '700', textTransform: 'none' }, tabBarStyle: { height: 75 + insets.bottom, paddingBottom: insets.bottom }, tabBarIcon: ({ color, focused }) => { const baseIconName = iconMap[route.name] || 'help-circle-outline'; const finalIconName = focused ? baseIconName.replace('-outline', '') : baseIconName; return <Ionicons name={finalIconName as any} size={24} color={color} />; }, })}>
        <Tab.Screen name="Today">{() => <SummaryScreen />}</Tab.Screen>
        <Tab.Screen name="AI Scan">{() => <CameraScreen />}</Tab.Screen>
        <Tab.Screen name="Intake">{() => <ScanHistory />}</Tab.Screen>
        <Tab.Screen name="Burned">{() => <ActivityHistory />}</Tab.Screen>
      </Tab.Navigator>
    </View>
  );
}

export default function App() { return <SafeAreaProvider><AppContent /></SafeAreaProvider>; }

const styles = StyleSheet.create({
  cameraTabContainer: { flex: 1, backgroundColor: '#FBFBFB' },
  header: { paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { marginLeft: 15 },
  title: { fontSize: 22, fontWeight: '900', color: '#1B4D20', letterSpacing: -0.5 },
  headerAccentBar: { width: 45, height: 4, backgroundColor: '#1B4D20', opacity: 0.2, borderRadius: 2, marginTop: 4, marginBottom: 15 },
  subtitle: { fontSize: 10, color: '#666', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
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
  btnActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginBottom: 15,
    marginTop: 10
  },
  quadBtn: {
    flex: 1,
    marginHorizontal: 2, // Reduced margin to fit 4
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 12,
    borderRadius: 15,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    minHeight: 80
  },
  tripleBtnText: {
    color: '#1B4D20',
    fontWeight: '900',
    fontSize: 9, // Slightly smaller font to prevent wrapping
    marginTop: 6,
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  logActivityBtnLocked: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  quotaBarWrapper: { height: 3, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden', width: '70%', marginTop: 4 },
  quotaBarFill: { height: '100%' },
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  iconPlaceholder: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 12 },
  foodTitle: { fontSize: 16, fontWeight: '800' },
  foodCals: { fontSize: 13, color: '#2E7D32', fontWeight: '700' },
  rowActionBtn: { padding: 8, marginLeft: 4, backgroundColor: '#F5F5F5', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  editOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  editBox: { backgroundColor: '#FFF', width: '92%', padding: 25, borderRadius: 25, position: 'relative', elevation: 20, alignItems: 'center' },
  editTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15, textAlign: 'center' },
  editInputSmall: {
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 10,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center'
  },
  editActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, width: '100%' },
  modalBtn: { flex: 0.48, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  saveBtn: { backgroundColor: '#1B4D20' },
  cancelBtn: { backgroundColor: '#F5F5F5', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  genderPicker: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 10, padding: 3, width: '100%' },
  genderBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  genderBtnActive: { backgroundColor: '#FFF' },
  activityTypeBtn: { alignItems: 'center', padding: 15, borderRadius: 18, backgroundColor: '#F5F5F5', marginRight: 10, width: 100, height: 100, elevation: 2 },
  activityTypeBtnActive: { backgroundColor: '#1B4D20', elevation: 4 },
  activityTypeLabel: { fontSize: 11, fontWeight: '800', marginTop: 8, color: '#1B4D20' },
  activityTypeLabelActive: { color: '#FFF' },
  scrollPadding: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100 },
  unitSmall: { fontSize: 8, fontWeight: '700', color: '#9E9E9E' },
  activitySelector: { flexDirection: 'row', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' },
  androidOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  androidSelectionBox: { width: '94%', maxHeight: '90%', backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 50 },
  absCloseBtn: { position: 'absolute', right: 15, top: 15, zIndex: 10, padding: 5 },
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1B4D20' },
  bottomCloseBtn: { backgroundColor: '#1B4D20', paddingVertical: 15, marginHorizontal: 20, borderRadius: 15, alignItems: 'center', marginBottom: 20 },
  bottomCloseBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  macroSummaryRow: { flexDirection: 'row', backgroundColor: '#F1F8E9', paddingVertical: 6, justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E8F5E9' },
  macroSummaryText: { fontSize: 10, color: '#2E7D32', fontWeight: '700', letterSpacing: 0.5 },
  dotSeparator: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#A5D6A7', marginHorizontal: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FBFBFB' },
  loadingText: { marginTop: 15, fontSize: 12, fontWeight: '800', color: '#1B4D20', textTransform: 'uppercase', letterSpacing: 1 },
  miniDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#CCC',
    marginHorizontal: 6
  },
  optionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F5F5', padding: 16, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#E0E0E0' },
  optionName: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  optionCal: { fontSize: 14, color: '#2E7D32', fontWeight: '700', marginTop: 2 },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  gridItem: {
    width: '31%', // Fits 3 per row with spacing
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  gridItemActive: {
    backgroundColor: '#1B4D20',
    borderColor: '#1B4D20',
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B4D20',
    marginTop: 4,
  },
  gridLabelActive: {
    color: '#FFF',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9E9E9E',
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 15,
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    marginBottom: 5,
  },
  fixedInputWrapper: {
    height: 120,
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 12,
    marginBottom: 15,
    overflow: 'hidden', // Forces content to stay inside
  },
  fixedInternalInput: {
    flex: 1, // Fills the wrapper
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    textAlignVertical: 'top', // Critical for Android
    padding: 0, // Reset default padding since wrapper handles it
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 5,
    backgroundColor: '#F0F7F0',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'center',
  },
  premiumSyncRow: {
    backgroundColor: '#FFF8E1', // Light Gold Background
    borderColor: '#FFD700',      // Solid Gold Border
    borderWidth: 1,
    paddingVertical: 8,         // Making it bigger
    paddingHorizontal: 16,
    borderRadius: 25,
    justifyContent: 'space-between', // Push text and refresh apart
    width: '90%',               // Expanding width
  },
  syncIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50', // Original Green dot
    marginRight: 6,
  },
  premiumSyncIndicator: {
    width: 10,                  // Making the dot bigger
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD700', // Gold Dot
    marginRight: 8,
  },
  syncText: {
    fontSize: 11,               // Original size
    color: '#666',              // Original color
    fontWeight: '500',
  },
  premiumSyncText: {
    fontSize: 13,               // Making it bigger
    color: '#B8860B',           // Dark Goldenrod
    fontWeight: '700',          // Bolder
  },
  refreshIcon: {
    marginLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#DDD',
    paddingLeft: 8,
  },
});