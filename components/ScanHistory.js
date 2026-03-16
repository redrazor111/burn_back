/* eslint-disable react/no-unescaped-entities */
import { auth, db } from '@/utils/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  useWindowDimensions
} from 'react-native';
import { LineChart, StackedBarChart } from "react-native-chart-kit";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Line, Text as SvgText } from 'react-native-svg';

// Import your components
import { useSubscriptionStatus } from '@/utils/subscription'; // Assuming this is your path
import Guide from '../components/Guide';
import Shop from '../components/Shop';
import PremiumModal from './PremiumModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Helper for date formatting
const getOrdinalDate = (date) => {
  const d = date.getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()];
  if (d > 3 && d < 21) return `${d}th ${month}`;
  switch (d % 10) {
    case 1: return `${d}st ${month}`;
    case 2: return `${d}nd ${month}`;
    case 3: return `${d}rd ${month}`;
    default: return `${d}th ${month}`;
  }
};

const ChartOverlay = ({ averageValue, chartData, chartHeight, windowWidth }) => {
  const dataPoints = chartData.map(d => d[0]);
  const maxVal = Math.max(...dataPoints, 1);
  const paddingBottom = 40;
  const paddingTop = 20;
  const usableHeight = chartHeight - paddingBottom - paddingTop;
  const lineY = chartHeight - paddingBottom - (averageValue / maxVal) * usableHeight;

  return (
    <View>
      <Line x1="45" y1={lineY} x2={windowWidth - 75} y2={lineY} stroke="#1B4D20" strokeWidth="1.5" strokeDasharray="5, 5" />
      {dataPoints.map((val, index) => {
        if (val <= 0) return null;
        // The labels will now fit because there are only 7-8 bars
        const chartAreaWidth = windowWidth - 110;
        const barX = 75 + (index * (chartAreaWidth / (dataPoints.length - 1 || 1)));
        const barHeight = (val / maxVal) * usableHeight;
        const textY = chartHeight - paddingBottom - (barHeight / 2);
        return (
          <SvgText key={index} x={barX} y={textY + 5} fill="white" fontSize="10" fontWeight="900" textAnchor="middle">
            {val}
          </SvgText>
        );
      })}
    </View>
  );
};
ChartOverlay.displayName = 'ChartOverlay';

export default function ScanHistory() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { width: windowWidth } = useWindowDimensions();
  const { isPro } = useSubscriptionStatus();

  const [history, setHistory] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [userId, setUserId] = useState(auth.currentUser?.uid);

  // Modal & View States
  const [showChart, setShowChart] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [timeframe, setTimeframe] = useState(7);
  const [showPremium, setShowPremium] = useState(false);
  const [targetCalories, setTargetCalories] = useState(2000);
  const [weight, setWeight] = useState(70);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) setUserId(user.uid);
  }, [isFocused]);

  useEffect(() => {
    if (isFocused) {
      setExpandedSections({});
      setShowPremium(false);
      setShowShop(false);
      setShowChart(false);
      setShowGuide(false);
    }
  }, [isFocused]);

  // Handler for Chart Icon
  const handleOpenChart = () => {
    // if (isPro) {
    setShowChart(true);
    // } else {
    //   setShowPremium(true);
    // }
  };

  // Meals Listener
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'users', userId, 'meals'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        identifiedProduct: doc.data().productName || doc.data().identifiedProduct,
      }));
      setHistory(historyData);
    });
    return () => unsubscribe();
  }, [userId]);

  // Profile Listener for targetCalories and weight
  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, 'users', userId, 'profile', 'data');
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.targetCalories) setTargetCalories(Number(data.targetCalories));
        if (data.weight) setWeight(Number(data.weight)); // Capture weight here
      }
    });
    return () => unsubscribe();
  }, [userId]);

  const getSafeDateKey = (dateString) => {
    if (!dateString) return "Unknown";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Unknown";
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const groupedData = useMemo(() => {
    const groups = {};
    history.forEach(item => {
      const key = getSafeDateKey(item.date || item.createdAt?.toDate?.()?.toISOString());
      if (!groups[key]) groups[key] = { items: [], totalCalories: 0, totalProtein: 0, totalCarbs: 0 };
      groups[key].items.push(item);
      groups[key].totalCalories += Number(item.calories || 0);
      groups[key].totalProtein += Number(item.protein || 0);
      groups[key].totalCarbs += Number(item.carbs || 0);
    });
    return groups;
  }, [history]);

  const todayStats = useMemo(() => {
    const todayKey = getSafeDateKey(new Date().toISOString());
    return groupedData[todayKey] || { totalCalories: 0, totalProtein: 0, totalCarbs: 0 };
  }, [groupedData]);

  const stats = useMemo(() => {
    const dailyValues = [];
    const dailyProtein = [];
    const dailyCarbs = [];
    const labels = [];
    const now = new Date();

    if (timeframe === 7) {
      // --- STANDARD 7-DAY DAILY VIEW ---
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = getSafeDateKey(d.toISOString());
        const dayData = groupedData[key] || { totalCalories: 0, totalProtein: 0, totalCarbs: 0 };
        dailyValues.push(Number(dayData.totalCalories));
        dailyProtein.push(Number(dayData.totalProtein));
        dailyCarbs.push(Number(dayData.totalCarbs));
        labels.push(getOrdinalDate(d));
      }
    } else {
      // --- 60-DAY WEEKLY AGGREGATE VIEW (8 PILLARS) ---
      for (let i = 7; i >= 0; i--) {
        let weekCal = 0, weekProt = 0, weekCarb = 0, activeDays = 0;

        for (let j = 0; j < 7; j++) {
          const d = new Date(now);
          d.setDate(now.getDate() - (i * 7 + j));
          const key = getSafeDateKey(d.toISOString());
          const dayData = groupedData[key];

          if (dayData) {
            weekCal += Number(dayData.totalCalories || 0);
            weekProt += Number(dayData.totalProtein || 0);
            weekCarb += Number(dayData.totalCarbs || 0);
            if (dayData.totalCalories > 0) activeDays++;
          }
        }

        // Push the average of active days so the bar height matches the daily goal
        dailyValues.push(activeDays > 0 ? Math.round(weekCal / activeDays) : 0);
        dailyProtein.push(activeDays > 0 ? Math.round(weekProt / activeDays) : 0);
        dailyCarbs.push(activeDays > 0 ? Math.round(weekCarb / activeDays) : 0);
        labels.push(`Wk ${8 - i}`);
      }
    }

    // Averages for the top summary boxes
    const activeDaysTotal = dailyValues.filter(v => v > 0).length;
    const dAvg = activeDaysTotal > 0 ? Math.round(dailyValues.reduce((a, b) => a + b, 0) / activeDaysTotal) : 0;
    const pAvg = activeDaysTotal > 0 ? Math.round(dailyProtein.reduce((a, b) => a + b, 0) / activeDaysTotal) : 0;
    const cAvg = activeDaysTotal > 0 ? Math.round(dailyCarbs.reduce((a, b) => a + b, 0) / activeDaysTotal) : 0;

    const monthlyDiff = (dAvg - targetCalories) * 30;
    const pGoal = Math.round((parseFloat(weight) || 70) * 1.6);

    return {
      dailyAverage: dAvg,
      monthlyAverage: dAvg * 30,
      avgProtein: pAvg,
      avgCarbs: cAvg,
      weightProjectionLbs: (monthlyDiff / 3500).toFixed(1),
      weightProjectionKg: ((monthlyDiff / 3500) / 2.2046).toFixed(1),
      dailyProteinGoal: pGoal,
      proteinGoalMet: pAvg > 0 ? Math.round((pAvg / pGoal) * 100) : 0,
      calorieChart: { labels, datasets: [{ data: dailyValues, color: (opacity = 1) => `rgba(27, 77, 32, ${opacity})`, strokeWidth: 2 }] },
      proteinChart: { labels, data: dailyProtein.map(v => [v]), barColors: ["#81C784"] },
      carbsChart: { labels, data: dailyCarbs.map(v => [v]), barColors: ["#81C784"] }
    };
  }, [groupedData, timeframe, targetCalories, weight]);

  const chartConfig = {
    backgroundColor: "#fff",
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(27, 77, 32, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(50, 50, 50, ${opacity})`, // Darkened for better visibility
    style: {
      borderRadius: 16,
    },
    propsForBackgroundLines: {
      strokeDasharray: "", // solid background lines for easier reading
      stroke: "#E0E0E0"
    },
    propsForLabels: {
      fontSize: 10,
      fontWeight: "700",
    },
    barPercentage: 0.6,
  };

  const toggleSection = (section) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getReadableDate = (dateKey) => {
    if (!dateKey || dateKey === "Unknown") return "Unknown Date";
    const parts = dateKey.split('/');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return getOrdinalDate(date);
  };

  return (
    <View style={styles.fullScreen}>
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Intake History</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleOpenChart} style={styles.actionBtn}>
              <MaterialCommunityIcons name="finance" size={28} color="#1B4D20" />
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

        <View style={styles.todaySummaryCard}>
          <View>
            <Text style={styles.todayLabel}>TODAY'S INTAKE</Text>
            <Text style={styles.todayValue}>{todayStats.totalCalories} <Text style={styles.todayUnit}>cal</Text></Text>
            <View style={styles.todayMacroRow}>
              <Text style={styles.todayMacroText}>Protein: {todayStats.totalProtein}g</Text>
              <View style={styles.todayMacroDivider} />
              <Text style={styles.todayMacroText}>Carbs: {todayStats.totalCarbs}g</Text>
            </View>
          </View>
          <View style={styles.fireIconBg}>
            <MaterialCommunityIcons name="fire" size={28} color="#FF9800" />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContentList} showsVerticalScrollIndicator={false}>
        {history.length === 0 ? (
          <View style={styles.placeholderContainer}>
            <MaterialCommunityIcons name="food-off" size={60} color="#E0E0E0" />
            <Text style={styles.placeholderText}>No meals logged yet.</Text>
          </View>
        ) : (
          Object.keys(groupedData).sort((a, b) => b.localeCompare(a)).map((dateKey) => (
            <View key={dateKey} style={styles.sectionContainer}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(dateKey)} activeOpacity={0.7}>
                <View style={styles.sectionHeaderTextGroup}>
                  <Text style={styles.sectionLabel}>{getReadableDate(dateKey).toUpperCase()}</Text>
                  <Text style={styles.sectionTotalCalories}>{groupedData[dateKey].totalCalories} cal</Text>
                </View>
                <MaterialCommunityIcons name={expandedSections[dateKey] ? "chevron-up" : "chevron-down"} size={20} color="#9E9E9E" />
              </TouchableOpacity>
              {expandedSections[dateKey] && (
                <View style={styles.itemsContainer}>
                  {groupedData[dateKey].items.map((item) => (
                    <View key={item.id} style={styles.historyCard}>
                      <View style={styles.historyIconBg}><MaterialCommunityIcons name={item.isManual ? "food-apple" : "camera"} size={26} color="#1B4D20" /></View>
                      <View style={styles.historyDetails}>
                        <Text style={styles.historyFoodName}>{item.identifiedProduct || "Unknown Item"}</Text>
                        <Text style={styles.historyMacroSub}>{Number(item.protein || 0)}g Protein • {Number(item.carbs || 0)}g Carbs</Text>
                      </View>
                      <View style={styles.calorieBadge}><Text style={styles.calorieText}>{item.calories || 0} cal</Text></View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* SHOP MODAL */}
      <Modal visible={showShop} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowShop(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.modalTitle}>Shop at Amazon</Text>
            <TouchableOpacity onPress={() => setShowShop(false)}><MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" /></TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}><Shop /></View>
          <TouchableOpacity style={[styles.bottomCloseBtn, { marginBottom: insets.bottom + 10 }]} onPress={() => setShowShop(false)}><Text style={styles.bottomCloseBtnText}>Close</Text></TouchableOpacity>
        </View>
      </Modal>

      {/* GUIDE MODAL */}
      <Modal visible={showGuide} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowGuide(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.modalTitle}>Health Guide</Text>
            <TouchableOpacity onPress={() => setShowGuide(false)}><MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" /></TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}><Guide /></View>
          <TouchableOpacity style={[styles.bottomCloseBtn, { marginBottom: insets.bottom + 10 }]} onPress={() => setShowGuide(false)}><Text style={styles.bottomCloseBtnText}>Close</Text></TouchableOpacity>
        </View>
      </Modal>

      {/* TRENDS MODAL */}
      <Modal visible={showChart} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowChart(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.modalTitle}>Intake Trends</Text>
            <TouchableOpacity onPress={() => setShowChart(false)}>
              <MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {/* We check stats instead of chartData */}
              {stats ? (
                <>
                  <View style={styles.averagesContainer}>
                    <View style={{ flex: 1 }}>
                      {/* ROW 1: Calories */}
                      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                        <View style={styles.avgBoxSmall}>
                          <Text style={styles.avgLabelCenter}>AVG DAILY AVG</Text>
                          <Text style={styles.avgValueCenter}>{stats.dailyAverage.toLocaleString()} <Text style={styles.avgUnit}>cal</Text></Text>
                        </View>
                        <View style={[styles.avgBoxSmall, { marginLeft: 10 }]}>
                          <Text style={styles.avgLabelCenter}>PROJECTED</Text>
                          <Text style={styles.avgValueCenter}>{stats.monthlyAverage.toLocaleString()} <Text style={styles.avgUnit}>cal</Text></Text>
                        </View>
                      </View>

                      {/* ROW 2: Macros */}
                      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                        <View style={[styles.avgBoxSmall, { backgroundColor: '#E8F5E9', alignItems: 'flex-start', paddingHorizontal: 12 }]}>
                          <Text style={styles.avgLabelCenter}>AVG DAILY PROTEIN</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                            <Text style={styles.avgValueCenter}>{stats.avgProtein}<Text style={styles.avgUnit}>g</Text></Text>
                            <View style={{
                              marginLeft: 6,
                              backgroundColor: stats.proteinGoalMet >= 100 ? '#2E7D32' : '#81C784',
                              paddingHorizontal: 5,
                              borderRadius: 5
                            }}>
                              <Text style={{ fontSize: 9, color: '#FFF', fontWeight: '900' }}>{stats.proteinGoalMet}%</Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>Goal: {stats.dailyProteinGoal}g</Text>
                        </View>

                        <View style={[styles.avgBoxSmall, { marginLeft: 10, backgroundColor: '#F1F8E9', alignItems: 'flex-start', paddingHorizontal: 12 }]}>
                          <Text style={styles.avgLabelCenter}>AVG DAILY CARBS</Text>
                          <Text style={styles.avgValueCenter}>{stats.avgCarbs}<Text style={styles.avgUnit}>g</Text></Text>
                          <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>Daily Average</Text>
                        </View>
                      </View>

                      {/* ROW 3: Forecast */}
                      <View style={[styles.avgBoxSmall, {
                        backgroundColor: Number(stats.weightProjectionLbs) > 0 ? '#FFEBEE' : '#E8F5E9',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingHorizontal: 15,
                        marginTop: 5
                      }]}>
                        <Text style={[styles.avgLabelCenter, { marginBottom: 0 }]}>30-DAY FORECAST</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                          <Text style={[styles.avgValueCenter, { color: Number(stats.weightProjectionLbs) > 0 ? '#D32F2F' : '#2E7D32' }]}>
                            {Number(stats.weightProjectionKg) > 0 ? `+${stats.weightProjectionKg}` : stats.weightProjectionKg}
                            <Text style={styles.avgUnit}> kg</Text>
                          </Text>
                          <View style={{ width: 1, height: 12, backgroundColor: 'rgba(0,0,0,0.1)', marginHorizontal: 8 }} />
                          <Text style={[styles.avgValueCenter, { color: Number(stats.weightProjectionLbs) > 0 ? '#D32F2F' : '#2E7D32', fontSize: 14, opacity: 0.8 }]}>
                            {Number(stats.weightProjectionLbs) > 0 ? `+${stats.weightProjectionLbs}` : stats.weightProjectionLbs}
                            <Text style={styles.avgUnit}> lbs</Text>
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.timeframeContainer}>
                    {[7, 60].map((days) => (
                      <TouchableOpacity
                        key={days}
                        style={[styles.timeframeBtn, timeframe === days && styles.timeframeBtnActive]}
                        onPress={() => setTimeframe(days)}
                      >
                        <Text style={[styles.timeframeText, timeframe === days && styles.timeframeTextActive]}>
                          {days === 7 ? "7 Days" : "8 Weeks"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.comparisonCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.comparisonTitle}>{timeframe === 7 ? "7-Day" : "8-Week"} Calorie Trend</Text>
                      <Text style={{ fontSize: 10, color: '#FF5252', fontWeight: 'bold' }}>GOAL: {targetCalories}</Text>
                    </View>
                    {/* FIXED: Changed chartData to stats.calorieChart */}
                    <LineChart
                      data={{
                        ...stats.calorieChart,
                        datasets: [...stats.calorieChart.datasets, {
                          data: new Array(stats.calorieChart.labels.length).fill(targetCalories),
                          color: (opacity = 1) => `rgba(255, 82, 82, ${opacity * 0.4})`,
                          strokeWidth: 2,
                          withDots: false,
                        }]
                      }}
                      width={windowWidth - 40}
                      height={220}
                      chartConfig={chartConfig}
                      bezier
                      withDots={timeframe === 7}
                      style={styles.chartStyle}
                    />
                  </View>

                  {/* Protein Graph */}
                  <View style={styles.comparisonCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <Text style={styles.comparisonTitle}>Protein Trend (g)</Text>
                      <Text style={{ fontSize: 10, color: '#1B4D20', fontWeight: 'bold' }}>AVG: {stats.avgProtein}g</Text>
                    </View>
                    <StackedBarChart
                      /* CHANGED: analysisData.proteinChart -> stats.proteinChart */
                      data={stats.proteinChart}
                      width={windowWidth - 40}
                      height={200}
                      chartConfig={chartConfig}
                      hideLegend={true}
                      style={styles.chartStyle}
                      decorator={() => <ChartOverlay
                        timeframe={timeframe}
                        averageValue={stats.avgProtein}
                        /* CHANGED: analysisData.proteinChart.data -> stats.proteinChart.data */
                        chartData={stats.proteinChart.data}
                        chartHeight={200}
                        windowWidth={windowWidth}
                      />}
                    />
                  </View>

                  {/* Carbs Graph */}
                  <View style={styles.comparisonCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <Text style={styles.comparisonTitle}>Carbs Trend (g)</Text>
                      <Text style={{ fontSize: 10, color: '#1B4D20', fontWeight: 'bold' }}>AVG: {stats.avgCarbs}g</Text>
                    </View>
                    <StackedBarChart
                      /* CHANGED: analysisData.carbsChart -> stats.carbsChart */
                      data={stats.carbsChart}
                      width={windowWidth - 40}
                      height={200}
                      chartConfig={chartConfig}
                      hideLegend={true}
                      style={styles.chartStyle}
                      decorator={() => <ChartOverlay
                        timeframe={timeframe}
                        averageValue={stats.avgCarbs}
                        /* CHANGED: analysisData.carbsChart.data -> stats.carbsChart.data */
                        chartData={stats.carbsChart.data}
                        chartHeight={200}
                        windowWidth={windowWidth}
                      />}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.noDataChart}>
                  <MaterialCommunityIcons name="chart-line-variant" size={80} color="#EEE" />
                  <Text style={styles.placeholderText}>Not enough data for trends.</Text>
                </View>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>

          <TouchableOpacity style={[styles.bottomCloseBtn, { marginBottom: insets.bottom + 10 }]} onPress={() => setShowChart(false)}>
            <Text style={styles.bottomCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: '#FBFBFB' },
  header: { paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { marginLeft: 15 },
  title: { fontSize: 22, fontWeight: '900', color: '#1B4D20', letterSpacing: -0.5 },
  headerAccentBar: { width: 45, height: 4, backgroundColor: '#1B4D20', opacity: 0.2, borderRadius: 2, marginTop: 4, marginBottom: 15 },
  todaySummaryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1B4D20', padding: 18, borderRadius: 20, elevation: 8 },
  todayLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  todayValue: { color: '#FFF', fontSize: 26, fontWeight: '900' },
  todayUnit: { fontSize: 14, fontWeight: '400', opacity: 0.8 },
  todayMacroRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  todayMacroText: { color: '#FFF', fontSize: 12, fontWeight: '700', opacity: 0.9 },
  todayMacroDivider: { width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 8 },
  fireIconBg: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 8, borderRadius: 12 },
  scrollContentList: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionContainer: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  sectionHeaderTextGroup: { flexDirection: 'row', alignItems: 'baseline' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9E9E9E' },
  sectionTotalCalories: { fontSize: 13, fontWeight: '700', color: '#1B4D20', marginLeft: 10 },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#F5F5F5' },
  historyIconBg: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  historyDetails: { flex: 1 },
  historyFoodName: { fontSize: 16, fontWeight: '800', color: '#212529' },
  historyMacroSub: { fontSize: 11, color: '#666', fontWeight: '600', marginTop: 2 },
  calorieBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  calorieText: { color: '#1B4D20', fontWeight: '800', fontSize: 13 },
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1B4D20' },
  comparisonCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginVertical: 15, borderWidth: 1, borderColor: '#EEE' },
  averagesContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  avgBoxSmall: { flex: 1, backgroundColor: '#F8F9FA', padding: 15, borderRadius: 20, alignItems: 'center' },
  avgLabelCenter: { fontSize: 9, fontWeight: '800', color: '#9E9E9E', marginBottom: 5 },
  avgValueCenter: { fontSize: 18, fontWeight: '900', color: '#1B4D20' },
  avgUnit: { fontSize: 12, fontWeight: '400', color: '#666' },
  chartStyle: { marginVertical: 8, borderRadius: 16 },
  bottomCloseBtn: { backgroundColor: '#1B4D20', paddingVertical: 15, marginHorizontal: 20, borderRadius: 15, alignItems: 'center' },
  bottomCloseBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  placeholderContainer: { alignItems: 'center', marginTop: 100 },
  placeholderText: { color: '#BDBDBD', marginTop: 15, fontSize: 16, textAlign: 'center' },
  noDataChart: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 },
  timeframeContainer: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 12, padding: 4, marginBottom: 10 },
  timeframeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  timeframeBtnActive: { backgroundColor: '#FFF' },
  timeframeText: { fontSize: 12, fontWeight: '800', color: '#9E9E9E' },
  timeframeTextActive: { color: '#1B4D20' },
});