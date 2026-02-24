import { Camera } from 'expo-camera';
import React, { ComponentProps, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// Navigation & Safe Area Imports
import { Ionicons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Local Imports
import { saveToHistory } from '@/utils/historyStorage';
import { checkQuota, incrementQuota } from '@/utils/quotaService';
import * as ImageManipulator from 'expo-image-manipulator';
import Guide from '../../components/Guide';
import Ingredients from '../../components/Ingredients';
import PremiumModal from '../../components/PremiumModal';
import ScanHistory from '../../components/ScanHistory';
import Scanner from '../../components/Scanner';
import Shop from '../../components/Shop';
import StatusCard from '../../components/StatusCard';

import { analyzeImageWithGemini } from '../../utils/geminiService';
import { useSubscriptionStatus } from '../../utils/subscription';

const Tab = createMaterialTopTabNavigator();

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface AnalysisState {
  text: string;
  status: string;
}

// --- CAMERA SCREEN COMPONENT ---
function CameraScreen({ onImageCaptured, onRecommendationsFound,
  pendingRerunUri,
  onRerunHandled }: {
    onImageCaptured: (base64: string) => void,
    onRecommendationsFound: (products: string[]) => void,
    pendingRerunUri: string | null,
    onRerunHandled: () => void
  }) {
  const insets = useSafeAreaInsets();
  const initialState: AnalysisState = { text: "", status: "gray" };
  const lastImageRef = useRef<string | null>(null);

  // New Data States
  const [identifiedProduct, setIdentifiedProduct] = useState<string | null>(null);
  const [calories, setCalories] = useState<string | number | null>(null);
  const [hasScannedOnce, setHasScannedOnce] = useState(false); // New flag to keep card visible

  const [a1, setA1] = useState<AnalysisState>(initialState);
  const [a2, setA2] = useState<AnalysisState>(initialState);
  const [a3, setA3] = useState<AnalysisState>(initialState);
  const [a4, setA4] = useState<AnalysisState>(initialState);
  const [a5, setA5] = useState<AnalysisState>(initialState);
  const [a6, setA6] = useState<AnalysisState>(initialState);
  const [a7, setA7] = useState<AnalysisState>(initialState);
  const [a8, setA8] = useState<AnalysisState>(initialState);
  const [a9, setA9] = useState<AnalysisState>(initialState);
  const [a10, setA10] = useState<AnalysisState>(initialState);

  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const { isPro, loading } = useSubscriptionStatus();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

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

  const handleReset = () => {
    lastImageRef.current = null;
    setIdentifiedProduct(null);
    setCalories(null);
    setHasScannedOnce(false);
    [setA1, setA2, setA3, setA4, setA5, setA6, setA7, setA8, setA9, setA10].forEach(s => s(initialState));
  };

  const getStatusColor = (data: string) => {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      const status = parsed?.status?.toUpperCase();
      if (status === "UNHEALTHY") return "#FF5252";
      if (status === "MODERATE") return "#FFB300";
      if (status === "HEALTHY") return "#2E7D32";
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

    // Partially reset activities but keep the 'hasScannedOnce' flag
    // to keep the Product Info Card UI structure present while loading
    setIsLoading(true);
    setHasScannedOnce(true);

    lastImageRef.current = base64Data;
    const cleanBase64 = base64Data.replace('data:image/jpeg;base64,', '');
    onImageCaptured(cleanBase64);

    try {
      const rawResponse = await analyzeImageWithGemini(base64Data, isPro);
      const data = JSON.parse(rawResponse);
      await incrementQuota();

      // Update data states
      setIdentifiedProduct(data.identifiedProduct || "Unknown Item");
      setCalories(data.calories || "0");

      if (data.recommendations) onRecommendationsFound(data.recommendations);

      const updateState = (categoryData: any, setter: any) => {
        setter({
          text: JSON.stringify(categoryData),
          status: getStatusColor(JSON.stringify(categoryData))
        });
      };
      updateState(data.activity1, setA1);
      updateState(data.activity2, setA2);
      updateState(data.activity3, setA3);
      updateState(data.activity4, setA4);
      updateState(data.activity5, setA5);
      updateState(data.activity6, setA6);
      updateState(data.activity7, setA7);
      updateState(data.activity8, setA8);
      updateState(data.activity9, setA9);
      updateState(data.activity10, setA10);

      const compressedImage = await ImageManipulator.manipulateAsync(
        base64Data.startsWith('data') ? base64Data : `data:image/jpeg;base64,${base64Data}`,
        [{ resize: { width: 800 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      await saveToHistory(compressedImage.base64!, data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180],
  });

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.cameraTabContainer}>
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <Text style={styles.title}>Burn Back</Text>
        <Text style={styles.subtitle}>Scan your meal to see your burn options</Text>
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

        {/* Identified Product & Calorie Display - Always visible after first scan */}
        {hasScannedOnce && (
          <View style={[styles.productInfoCard, isLoading && { opacity: 0.7 }]}>
            <View>
              <Text style={styles.productLabel}>{isLoading ? "Analyzing..." : "Identified"}</Text>
              <Text style={styles.productName}>
                {isLoading ? "Fetching details..." : (identifiedProduct || "Unknown Item")}
              </Text>
            </View>
            <View style={[styles.calorieBadge, isLoading && { backgroundColor: '#4a4a4a' }]}>
              {isLoading ? (
                 <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.calorieValue}>{calories}</Text>
                  <Text style={styles.calorieLabel}>cal</Text>
                </>
              )}
            </View>
          </View>
        )}

        <View style={styles.headerRow}>
          <Text style={styles.resultsHeader}>Burn Options</Text>
          <TouchableOpacity onPress={handleReset} style={styles.actionButton}>
            <Ionicons name="refresh" size={16} color="#2E7D32" />
            <Text style={styles.actionText}>Reset</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>
          <StatusCard title="Running" data={a1} icon="run" isParentLoading={isLoading} isLocked={false} />
          <StatusCard title="Walking" data={a2} icon="walk" isParentLoading={isLoading} isLocked={false} />
          <StatusCard title="Weights" data={a3} icon="weight-lifter" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Cycling" data={a4} icon="bike" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Swimming" data={a5} icon="swim" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="HIIT" data={a6} icon="lightning-bolt" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Yoga" data={a7} icon="yoga" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Rowing" data={a8} icon="rowing" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Jump Rope" data={a9} icon="jump-rope" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Hiking" data={a10} icon="image-filter-hdr" isParentLoading={isPro && isLoading} isLocked={!isPro} />
        </ScrollView>
      </View>
      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [pendingRerunUri, setPendingRerunUri] = useState<string | null>(null);

  const iconMap: Record<string, IoniconsName> = {
    Camera: 'camera-outline',
    Product: 'nutrition-outline',
    History: 'time-outline',
    Guide: 'book-outline',
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
        <Tab.Screen name="Product">{() => <Ingredients imageUri={scannedImage} />}</Tab.Screen>
        <Tab.Screen name="History">
          {() => <ScanHistory onTriggerRerun={(rawUri: string) => { setScannedImage(rawUri); setPendingRerunUri(rawUri); }} />}
        </Tab.Screen>
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
  header: { paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#757575', marginTop: 4 },
  cameraViewHalf: { height: '35%', backgroundColor: '#000', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' },
  resultsHalf: { flex: 1, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 10 },
  resultsHeader: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  actionText: { fontSize: 12, fontWeight: '700', color: '#2E7D32', marginLeft: 4 },
  viewfinderOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  viewfinderBox: { width: 260, height: 160 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#4CAF50', borderWidth: 4, borderRadius: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { height: 3, backgroundColor: '#4CAF50', width: '100%' },
  placeholderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollPadding: { paddingBottom: 30 },

  productInfoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginTop: -30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  productLabel: { fontSize: 10, color: '#9E9E9E', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  productName: { fontSize: 20, fontWeight: '800', color: '#1B4D20', marginTop: 2 },
  calorieBadge: { backgroundColor: '#1B4D20', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, alignItems: 'center', minWidth: 60 },
  calorieValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  calorieLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
});