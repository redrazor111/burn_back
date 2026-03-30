/* eslint-disable react/no-unescaped-entities */
import { auth, db } from '@/utils/firebaseConfig';
import { useSubscriptionStatus } from '@/utils/subscription';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Guide from '../components/Guide';
import Shop from '../components/Shop';
import PremiumModal from './PremiumModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BAR_CHART_HEIGHT = 240;

export default function ScanHistory() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { isPro } = useSubscriptionStatus();
  const [history, setHistory] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [userId, setUserId] = useState(auth.currentUser?.uid);

  const calScrollRef = useRef(null);
  const protScrollRef = useRef(null);
  const carbScrollRef = useRef(null);

  const [showChart, setShowChart] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showPremium, setShowPremium] = useState(false);

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

  const handleOpenChart = () => {
    if (isPro) {
      setShowChart(true);
      setTimeout(() => {
        calScrollRef.current?.scrollToEnd({ animated: false });
        protScrollRef.current?.scrollToEnd({ animated: false });
        carbScrollRef.current?.scrollToEnd({ animated: false });
      }, 500);
    } else {
      setShowPremium(true);
    }
  };

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'users', userId, 'meals'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        identifiedProduct: doc.data().productName || doc.data().identifiedProduct,
      })));
    });
    return () => { unsubscribe(); };
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

  const averages = useMemo(() => {
    const now = new Date();
    const dates = Object.keys(groupedData);
    const activeDays = dates.length || 1;
    const totalCals = dates.reduce((sum, k) => sum + groupedData[k].totalCalories, 0);
    const totalProt = dates.reduce((sum, k) => sum + groupedData[k].totalProtein, 0);
    const totalCarb = dates.reduce((sum, k) => sum + groupedData[k].totalCarbs, 0);
    const todayKey = getSafeDateKey(now.toISOString());
    return {
      today: groupedData[todayKey]?.totalCalories || 0,
      todayProt: groupedData[todayKey]?.totalProtein || 0, // Added Today Protein
      todayCarb: groupedData[todayKey]?.totalCarbs || 0,   // Added Today Carbs
      dailyAvg: Math.round(totalCals / activeDays),
      protAvg: Math.round(totalProt / activeDays),
      carbAvg: Math.round(totalCarb / activeDays)
    };
  }, [groupedData]);

  const chartMaxes = useMemo(() => {
    let maxC = 500, maxP = 50, maxCarb = 100;
    Object.values(groupedData).forEach(d => {
      if (d.totalCalories > maxC) maxC = d.totalCalories;
      if (d.totalProtein > maxP) maxP = d.totalProtein;
      if (d.totalCarbs > maxCarb) maxCarb = d.totalCarbs;
    });
    return { cal: maxC + 200, prot: maxP + 20, carb: maxCarb + 30 };
  }, [groupedData]);

  const toggleSection = (section) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getFullReadableDate = (dateKey) => {
    if (!dateKey || dateKey === "Unknown") return "Unknown Date";
    const parts = dateKey.split('/');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const sortedDates = useMemo(() =>
    Object.keys(groupedData).sort((a, b) => a.localeCompare(b)),
    [groupedData]
  );

  const CustomBarChart = ({ type, dataKey, maxVal, color, scrollRef }) => (
    <View style={styles.comparisonCard}>
      <View style={styles.comparisonHeader}>
        <Text style={styles.comparisonTitle}>{type} History</Text>
      </View>

      <View style={{ marginTop: 10 }}>
        <View style={[styles.chartWrapper, { height: 280 }]}>
          <ScrollView
            horizontal
            ref={scrollRef}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 15,
              alignItems: 'flex-end',
              height: 280,
              backgroundColor: '#F9F9F9',
            }}
            onContentSizeChange={() => scrollRef?.current?.scrollToEnd({ animated: false })}
            onLayout={() => scrollRef?.current?.scrollToEnd({ animated: false })}
          >
            {sortedDates.map((key) => {
              const val = groupedData[key][dataKey];
              const barHeight = Math.min(
                (val / maxVal) * BAR_CHART_HEIGHT,
                BAR_CHART_HEIGHT - 2
              );
              const parts = key.split('/');
              const dDate = `${parts[2]}/${parts[1]}`;

              return (
                <View key={key} style={styles.barColumn}>
                  {val > 0 && (
                    <Text style={[styles.barValueText, { color }]}>
                      {Math.round(val)}
                    </Text>
                  )}
                  <View style={[styles.barBase, { height: Math.max(barHeight, 4), backgroundColor: color }]} />
                  <Text style={styles.barDateLabel}>{dDate}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
        <Text style={styles.chartHint}>Daily {type.toLowerCase()} summary</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.fullScreen}>
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Intake History</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleOpenChart} style={styles.actionBtn}>
              <MaterialCommunityIcons name="finance" size={28} color="#B8860B" />
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
          <View style={{ flex: 1 }}>
            <Text style={styles.todayLabel}>TODAY'S INTAKE</Text>
            <Text style={styles.todayValue}>{averages.today.toLocaleString()} <Text style={styles.todayUnit}>cal</Text></Text>

            {/* Added Divider */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 8, width: '80%' }} />

            {/* Added Macros Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
                <MaterialCommunityIcons name="molecule" size={14} color="rgba(255,255,255,0.6)" style={{ marginRight: 4 }} />
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{averages.todayProt}g <Text style={{ fontSize: 10, opacity: 0.7 }}>PROT</Text></Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="barley" size={14} color="rgba(255,255,255,0.6)" style={{ marginRight: 4 }} />
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{averages.todayCarb}g <Text style={{ fontSize: 10, opacity: 0.7 }}>CARB</Text></Text>
              </View>
            </View>
          </View>

          <View style={styles.burnIconBg}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={32} color="#FF9800" />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContentList} showsVerticalScrollIndicator={false}>
        {Object.keys(groupedData).sort((a, b) => b.localeCompare(a)).map((dateKey) => (
          <View key={dateKey} style={styles.sectionContainer}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(dateKey)}>
              <View style={styles.sectionHeaderTextGroup}>
                <Text style={styles.sectionLabel}>{getFullReadableDate(dateKey).toUpperCase()}</Text>
                <Text style={styles.sectionTotalValue}>Cal {groupedData[dateKey].totalCalories.toLocaleString()} cal • Prot {groupedData[dateKey].totalProtein.toLocaleString()}g • Carb {groupedData[dateKey].totalCarbs.toLocaleString()}g</Text>
              </View>
              <MaterialCommunityIcons name={expandedSections[dateKey] ? "chevron-up" : "chevron-down"} size={20} color="#9E9E9E" />
            </TouchableOpacity>
            {expandedSections[dateKey] && (
              <View style={styles.itemsContainer}>
                {groupedData[dateKey].items.map((item) => (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.historyIconBg}>
                      <MaterialCommunityIcons name="food-apple" size={26} color="#1B4D20" />
                    </View>
                    <View style={styles.historyDetails}>
                      <Text style={styles.historyFoodName}>{item.identifiedProduct || 'Meal'}</Text>
                      <Text style={styles.historyMacroSub}>Prot {item.protein}g • Carb {item.carbs}g</Text>
                    </View>
                    <View style={styles.valueBadge}>
                      <Text style={styles.valueText}>{item.calories} cal</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* SHOP MODAL */}
      <Modal visible={showShop} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowShop(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.modalTitle}>Shop at Amazon</Text>
            <TouchableOpacity onPress={() => setShowShop(false)}>
              <MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}><Shop /></View>
          <TouchableOpacity style={[styles.bottomCloseBtn, { marginBottom: insets.bottom + 10 }]} onPress={() => setShowShop(false)}>
            <Text style={styles.bottomCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* GUIDE MODAL */}
      <Modal visible={showGuide} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowGuide(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.modalTitle}>Health Guide</Text>
            <TouchableOpacity onPress={() => setShowGuide(false)}>
              <MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}><Guide /></View>
          <TouchableOpacity style={[styles.bottomCloseBtn, { marginBottom: insets.bottom + 10 }]} onPress={() => setShowGuide(false)}>
            <Text style={styles.bottomCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* TRENDS MODAL */}
      <Modal visible={showChart} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowChart(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.modalTitle}>Nutrient Trends</Text>
            <TouchableOpacity onPress={() => setShowChart(false)}>
              <MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 50 }}>
            <View style={styles.averagesContainer}>
              <View style={{ flexDirection: 'row' }}>
                <View style={[styles.avgBoxSmall, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={styles.avgLabelCenter}>AVG CAL</Text>
                  <Text style={styles.avgValueCenter}>{averages.dailyAvg}<Text style={styles.avgUnit}>cal</Text></Text>
                </View>
                <View style={[styles.avgBoxSmall, { marginLeft: 8, backgroundColor: '#F1F8E9' }]}>
                  <Text style={styles.avgLabelCenter}>AVG PROT</Text>
                  <Text style={styles.avgValueCenter}>{averages.protAvg}<Text style={styles.avgUnit}>g</Text></Text>
                </View>
                <View style={[styles.avgBoxSmall, { marginLeft: 8, backgroundColor: '#F9FBE7' }]}>
                  <Text style={styles.avgLabelCenter}>AVG CARBS</Text>
                  <Text style={styles.avgValueCenter}>{averages.carbAvg}<Text style={styles.avgUnit}>g</Text></Text>
                </View>
              </View>
            </View>

            <CustomBarChart type="Calories" dataKey="totalCalories" maxVal={chartMaxes.cal} color="#1B4D20" scrollRef={calScrollRef} />
            <CustomBarChart type="Protein" dataKey="totalProtein" maxVal={chartMaxes.prot} color="#2E7D32" scrollRef={protScrollRef} />
            <CustomBarChart type="Carbs" dataKey="totalCarbs" maxVal={chartMaxes.carb} color="#4CAF50" scrollRef={carbScrollRef} />
          </ScrollView>

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
  title: { fontSize: 22, fontWeight: '900', color: '#1B4D20' },
  headerAccentBar: { width: 45, height: 4, backgroundColor: '#1B4D20', opacity: 0.2, borderRadius: 2, marginVertical: 10 },
  todaySummaryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1B4D20', padding: 20, borderRadius: 24 },
  todayLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' },
  todayValue: { color: '#FFF', fontSize: 26, fontWeight: '900' },
  todayUnit: { fontSize: 14, fontWeight: '400', opacity: 0.8 },
  burnIconBg: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 10, borderRadius: 15 },
  scrollContentList: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionContainer: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  sectionHeaderTextGroup: { flexDirection: 'row', alignItems: 'baseline' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9E9E9E' },
  sectionTotalValue: { fontSize: 13, fontWeight: '700', color: '#1B4D20', marginLeft: 10 },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#F5F5F5' },
  historyIconBg: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  historyDetails: { flex: 1 },
  historyFoodName: { fontSize: 16, fontWeight: '800', color: '#212529' },
  historyMacroSub: { fontSize: 12, color: '#666' },
  valueBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  valueText: { color: '#1B4D20', fontWeight: '800', fontSize: 13 },
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1B4D20' },
  averagesContainer: { flexDirection: 'column', marginBottom: 15, marginTop: 5 },
  avgBoxSmall: { flex: 1, backgroundColor: '#F8F9FA', paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avgLabelCenter: { fontSize: 8, fontWeight: '800', color: '#9E9E9E', marginBottom: 3 },
  avgValueCenter: { fontSize: 16, fontWeight: '900', color: '#1B4D20' },
  avgUnit: { fontSize: 12, fontWeight: '400', color: '#666' },
  comparisonCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 12, paddingBottom: 20, marginVertical: 10, borderWidth: 1, borderColor: '#EEE', elevation: 3 },
  comparisonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  comparisonTitle: { fontSize: 16, fontWeight: '800', color: '#212529' },
  chartWrapper: { backgroundColor: '#F9F9F9', borderRadius: 16, overflow: 'hidden' },
  barColumn: { width: 52, marginHorizontal: 3, alignItems: 'center', justifyContent: 'flex-end', height: 280 },
  barBase: { width: 20, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barValueText: { fontSize: 9, fontWeight: '900', textAlign: 'center', width: 50, marginBottom: 2 },
  barDateLabel: { fontSize: 9, color: '#999', fontWeight: '700', textAlign: 'center', marginTop: 4, width: 52 },
  chartHint: { textAlign: 'center', fontSize: 11, color: '#AAA', fontWeight: '600', marginTop: 8, marginBottom: 4 },
  yAxisText: { fontSize: 9, color: '#999', fontWeight: '700' },
  bottomCloseBtn: { backgroundColor: '#1B4D20', paddingVertical: 15, marginHorizontal: 20, borderRadius: 15, alignItems: 'center' },
  bottomCloseBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  itemsContainer: { marginTop: 5 },
});