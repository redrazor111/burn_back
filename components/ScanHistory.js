/* eslint-disable react/no-unescaped-entities */
import { auth, db } from '@/utils/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
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
import { LineChart } from "react-native-chart-kit";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ScanHistory() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { width: windowWidth } = useWindowDimensions();
  const [history, setHistory] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [userId, setUserId] = useState(auth.currentUser?.uid);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) setUserId(user.uid);
  }, [isFocused]);

  useEffect(() => {
    if (isFocused) setExpandedSections({});
  }, [isFocused]);

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
    }, (error) => console.error("Firebase Error:", error));
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
      if (!groups[key]) groups[key] = { items: [], totalCalories: 0 };
      groups[key].items.push(item);
      groups[key].totalCalories += Number(item.calories || 0);
    });
    return groups;
  }, [history]);

  const todayTotal = useMemo(() => {
    const todayKey = getSafeDateKey(new Date().toISOString());
    return groupedData[todayKey]?.totalCalories || 0;
  }, [groupedData]);

  const weeklyStats = useMemo(() => {
    const now = new Date();
    const getSumForRange = (daysAgoStart, daysAgoEnd) => {
      let total = 0;
      for (let i = daysAgoStart; i <= daysAgoEnd; i++) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = getSafeDateKey(d.toISOString());
        total += groupedData[key]?.totalCalories || 0;
      }
      return total;
    };
    const thisWeek = getSumForRange(0, 6);
    const lastWeek = getSumForRange(7, 13);
    const diff = thisWeek - lastWeek;
    const percent = lastWeek > 0 ? (diff / lastWeek) * 100 : 0;
    return { thisWeek, lastWeek, diff, percent: percent.toFixed(1) };
  }, [groupedData]);

  const { chartData, monthlyAverage } = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyTotals = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const ymKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyTotals[ymKey] = { label: monthNames[d.getMonth()], total: 0 };
    }
    Object.keys(groupedData).forEach(dateKey => {
      if (dateKey === "Unknown") return;
      const [year, month] = dateKey.split('/');
      const ymKey = `${year}-${month}`;
      if (monthlyTotals[ymKey]) monthlyTotals[ymKey].total += groupedData[dateKey].totalCalories;
    });
    const finalData = Object.values(monthlyTotals).map(m => m.total);
    const activeMonths = finalData.filter(v => v > 0);
    const avg = activeMonths.length > 0 ? Math.round(activeMonths.reduce((a, b) => a + b, 0) / activeMonths.length) : 0;

    if (finalData.every(v => v === 0)) return { chartData: null, monthlyAverage: 0 };

    return {
      monthlyAverage: avg,
      chartData: {
        // Show every other label to fit on screen
        labels: Object.values(monthlyTotals).map((m, i) => (i % 2 === 0 ? m.label : "")),
        datasets: [{ data: finalData, color: (opacity = 1) => `rgba(27, 77, 32, ${opacity})`, strokeWidth: 2 }],
        legend: ["Annual Intake"]
      }
    };
  }, [groupedData]);

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
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  return (
    <View style={styles.fullScreen}>
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Calorie Intake History</Text>
          <TouchableOpacity onPress={() => setShowChart(true)} style={styles.chartBtn}>
            <MaterialCommunityIcons name="finance" size={30} color="#1B4D20" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerAccentBar} />

        <View style={styles.todaySummaryCard}>
          <View>
            <Text style={styles.todayLabel}>TODAY'S CALORIES INTAKE</Text>
            <Text style={styles.todayValue}>{todayTotal} <Text style={styles.todayUnit}>cal</Text></Text>
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
                        <Text style={styles.historyTime}>{item.date ? new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'}</Text>
                        <Text style={styles.historyFoodName}>{item.identifiedProduct || "Unknown Item"}</Text>
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

      <Modal visible={showChart} animationType="slide" onRequestClose={() => setShowChart(false)}>
        <View style={[styles.modalContainer, { paddingTop: insets.top + 20 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Calories Intake Trends</Text>
            <TouchableOpacity onPress={() => setShowChart(false)}><MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" /></TouchableOpacity>
          </View>

          {chartData ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.comparisonCard}>
                <View style={styles.comparisonHeader}>
                  <Text style={styles.comparisonTitle}>Weekly Progress</Text>
                  <View style={[styles.trendBadge, { backgroundColor: weeklyStats.diff <= 0 ? '#E8F5E9' : '#FFEBEE' }]}>
                  </View>
                </View>
                <View style={styles.comparisonRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.compLabel}>THIS WEEK</Text>
                    <Text style={styles.compValue}>{weeklyStats.thisWeek} <Text style={styles.compUnit}>cal</Text></Text>
                  </View>
                  <View style={styles.compDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.compLabel}>LAST WEEK</Text>
                    <Text style={styles.compValue}>{weeklyStats.lastWeek} <Text style={styles.compUnit}>cal</Text></Text>
                  </View>
                </View>
              </View>

              <View style={styles.avgFullWidth}>
                <Text style={styles.avgLabelCenter}>12-MONTH AVERAGE</Text>
                <Text style={styles.avgValueCenter}>{monthlyAverage} <Text style={styles.avgUnit}>cal / mo</Text></Text>
              </View>

              <View style={styles.chartContainer}>
                <LineChart
                  data={chartData}
                  width={windowWidth - 40} // Strictly fits window width minus padding
                  height={220}
                  chartConfig={{
                    backgroundColor: "#fff",
                    backgroundGradientFrom: "#fff",
                    backgroundGradientTo: "#fff",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(27, 77, 32, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
                    propsForDots: { r: "3", strokeWidth: "1.5", stroke: "#1B4D20" },
                    propsForLabels: { fontSize: 9 },
                    count: 6 // Limits vertical lines
                  }}
                  bezier
                  style={styles.chartStyle}
                  withInnerLines={false}
                  withOuterLines={true}
                  withVerticalLines={false}
                  withHorizontalLines={true}
                />
              </View>
              <Text style={styles.chartHint}>Yearly intake summary</Text>
              <View style={{ height: 50 }} />
            </ScrollView>
          ) : (
            <View style={styles.noDataChart}>
              <MaterialCommunityIcons name="chart-line-variant" size={80} color="#EEE" />
              <Text style={styles.placeholderText}>Not enough data for yearly trends.</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: '#FBFBFB' },
  header: { paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: '#1B4D20', letterSpacing: -0.5 },
  headerAccentBar: { width: 45, height: 4, backgroundColor: '#1B4D20', opacity: 0.2, borderRadius: 2, marginTop: 4, marginBottom: 15 },
  todaySummaryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1B4D20', padding: 18, borderRadius: 20, elevation: 8 },
  todayLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  todayValue: { color: '#FFF', fontSize: 26, fontWeight: '900' },
  todayUnit: { fontSize: 14, fontWeight: '400', opacity: 0.8 },
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
  historyTime: { fontSize: 10, fontWeight: '700', color: '#BDBDBD' },
  historyFoodName: { fontSize: 16, fontWeight: '800', color: '#212529' },
  calorieBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  calorieText: { color: '#1B4D20', fontWeight: '800', fontSize: 13 },
  modalContainer: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1B4D20' },
  comparisonCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#EEE' },
  comparisonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  comparisonTitle: { fontSize: 16, fontWeight: '800', color: '#212529' },
  trendBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trendText: { fontSize: 12, fontWeight: '800', marginLeft: 4 },
  comparisonRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statBox: { alignItems: 'center' },
  compLabel: { fontSize: 9, fontWeight: '800', color: '#9E9E9E', marginBottom: 5 },
  compValue: { fontSize: 18, fontWeight: '900', color: '#1B4D20' },
  compUnit: { fontSize: 11, fontWeight: '400', color: '#666' },
  compDivider: { width: 1, height: 30, backgroundColor: '#EEE' },
  avgFullWidth: { backgroundColor: '#F8F9FA', padding: 15, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  avgLabelCenter: { fontSize: 10, fontWeight: '800', color: '#9E9E9E', marginBottom: 5 },
  avgValueCenter: { fontSize: 22, fontWeight: '900', color: '#1B4D20' },
  chartContainer: { alignItems: 'center', marginTop: 10 },
  chartStyle: { borderRadius: 16, paddingRight: 40 },
  chartHint: { textAlign: 'center', fontSize: 11, color: '#AAA', fontWeight: '600', marginTop: 5 },
  placeholderContainer: { alignItems: 'center', marginTop: 100 },
  placeholderText: { color: '#BDBDBD', marginTop: 15, fontSize: 16, textAlign: 'center' },
  noDataChart: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});