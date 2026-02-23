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

  // 10 Activity States
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
    [setA1, setA2, setA3, setA4, setA5, setA6, setA7, setA8, setA9, setA10].forEach(s => s(initialState));
  };

  const getStatusColor = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      const status = parsed.status?.toUpperCase();
      if (status === "UNSAFE") return "#FF5252";
      if (status === "CAUTION") return "#FFB300";
      if (status === "SAFE") return "#2E7D32";
    } catch { /* Fallback */ }
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

    handleReset();
    setIsLoading(true);
    lastImageRef.current = base64Data;
    const cleanBase64 = base64Data.replace('data:image/jpeg;base64,', '');
    onImageCaptured(cleanBase64);

    try {
      const rawResponse = await analyzeImageWithGemini(base64Data, isPro);
      const data = JSON.parse(rawResponse);
      await incrementQuota();

      if (data.recommendations) onRecommendationsFound(data.recommendations);

      const updateState = (categoryData: any, setter: any) => {
        setter({
          text: JSON.stringify(categoryData),
          status: getStatusColor(JSON.stringify(categoryData))
        });
      };

      // Map incoming data to the 10 states
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
      console.error("Analysis Failed", e);
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
        <Text style={styles.title}>Activity Scan</Text>
        <Text style={styles.subtitle}>Analyze your exercise and form</Text>
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
          <View style={styles.placeholderCenter}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}
      </View>

      <View style={styles.resultsHalf}>
        <View style={styles.headerRow}>
          <Text style={styles.resultsHeader}>Metrics</Text>
          <TouchableOpacity onPress={handleReset} style={styles.actionButton}>
            <Ionicons name="refresh" size={16} color="#2E7D32" />
            <Text style={styles.actionText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>
          {/* FREE ACTIVITIES (1-2) */}
          <StatusCard title="Cardio Form" data={a1} icon="run" isParentLoading={isLoading} isLocked={false} />
          <StatusCard title="Posture" data={a2} icon="human-greeting" isParentLoading={isLoading} isLocked={false} />

          {/* PRO ACTIVITIES (3-10) */}
          <StatusCard title="Weight Balance" data={a3} icon="weight-lifter" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Core Stability" data={a4} icon="pollen" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Range of Motion" data={a5} icon="moped" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Rep Quality" data={a6} icon="star-circle" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Rest Interval" data={a7} icon="timer-sand" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Intensity" data={a8} icon="lightning-bolt" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Flexibility" data={a9} icon="yoga" isParentLoading={isPro && isLoading} isLocked={!isPro} />
          <StatusCard title="Recovery Need" data={a10} icon="bed" isParentLoading={isPro && isLoading} isLocked={!isPro} />
        </ScrollView>
      </View>

      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  );
}

// ... Keep AppContent and App functions as they are in your original code ...

function AppContent() {
  const insets = useSafeAreaInsets();
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [pendingRerunUri, setPendingRerunUri] = useState<string | null>(null);

  const iconMap: Record<string, IoniconsName> = {
    Camera: 'camera-outline',
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
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700', // Slightly bolder for better visibility
            textTransform: 'none',
            marginTop: 0,
            paddingBottom: 5
          },
          tabBarIndicatorStyle: { height: 0 },
          tabBarStyle: {
            backgroundColor: '#fff',
            height: 75 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 5,
            paddingTop: 5,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 10,
          },
          swipeEnabled: true,
          tabBarIcon: ({ color, focused }) => {
            const iconName = iconMap[route.name] || 'help-circle-outline';
            // Logic to use filled icons when focused for a "darker" look
            const finalIconName = focused
              ? iconName.replace('-outline', '') as IoniconsName
              : iconName;

            return (
              <View style={{ marginBottom: 2 }}>
                <Ionicons name={finalIconName} size={26} color={color} />
              </View>
            );
          },
          tabBarItemStyle: {
            flexDirection: 'column',
            justifyContent: 'center',
            height: 65,
          },
        })}
      >
        <Tab.Screen name="Camera">
          {() => (
            <CameraScreen
              onImageCaptured={setScannedImage}
              onRecommendationsFound={setRecommendations}
              pendingRerunUri={pendingRerunUri}
              onRerunHandled={() => setPendingRerunUri(null)}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Product">
          {() => <Ingredients imageUri={scannedImage} />}
        </Tab.Screen>
        <Tab.Screen name="History">
          {() => (
            <ScanHistory
              onTriggerRerun={(rawUri: string) => {
                // 1. Update the image shown in the "Product" tab
                setScannedImage(rawUri);
                // 2. Trigger the Gemini analysis in the "Camera" tab
                setPendingRerunUri(rawUri);
              }}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Shop">
          {() => <Shop recommendedProducts={recommendations} />}
        </Tab.Screen>
      </Tab.Navigator>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  cameraTabContainer: {
    flex: 1,
    backgroundColor: '#FBFBFB'
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    zIndex: 10,
    elevation: 10,
    position: 'relative',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  cameraViewHalf: {
    height: '35%',
    backgroundColor: '#000',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  resultsHalf: {
    flex: 1,
    paddingHorizontal: 20
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  resultsHeader: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D32',
    marginLeft: 4,
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center'
  },
  viewfinderBox: {
    width: 260,
    height: 160,
    position: 'relative'
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#4CAF50',
    borderWidth: 4,
    borderRadius: 4
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: {
    height: 3,
    backgroundColor: '#4CAF50',
    width: '100%',
    borderRadius: 2
  },
  placeholderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollPadding: {
    paddingBottom: 30
  },
});