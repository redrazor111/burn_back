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

// Component Imports
import Guide from '../components/Guide';
import Shop from '../components/Shop';
import PremiumModal from './PremiumModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ActivityHistory() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [history, setHistory] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [userId, setUserId] = useState(auth.currentUser?.uid);
  const { isPro } = useSubscriptionStatus();
  const chartScrollRef = useRef(null);

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

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'users', userId, 'activities'), orderBy('createdAt', 'desc'));
    const actsUnsub = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { actsUnsub(); };
  }, [userId]);

    const handleOpenChart = () => {
    if (isPro) {
      setShowChart(true);
    } else {
      setShowChart(true);
    }
  };

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
      if (!groups[key]) groups[key] = { items: [], totalBurned: 0 };
      groups[key].items.push(item);
      groups[key].totalBurned += Number(item.caloriesBurned || 0);
    });
    return groups;
  }, [history]);

  const averages = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(now.getDate() - 7);
    const oneMonthAgo = new Date(); oneMonthAgo.setDate(now.getDate() - 30);
    const oneYearAgo = new Date(); oneYearAgo.setDate(now.getDate() - 365);

    const getAvgBurn = (sinceDate) => {
        const relevantDays = Object.keys(groupedData).filter(key => {
            const dayDate = new Date(key.replace(/\//g, '-'));
            return dayDate >= sinceDate;
        });
        if (relevantDays.length === 0) return 0;
        const total = relevantDays.reduce((sum, key) => sum + groupedData[key].totalBurned, 0);
        return Math.round(total / relevantDays.length);
    };

    const todayKey = getSafeDateKey(new Date().toISOString());
    const todayBurned = groupedData[todayKey]?.totalBurned || 0;

    return {
        today: todayBurned,
        weekly: getAvgBurn(oneWeekAgo),
        monthly: getAvgBurn(oneMonthAgo),
        yearly: getAvgBurn(oneYearAgo)
    };
  }, [groupedData]);

  const { sortedDates, maxVal } = useMemo(() => {
    const dates = Object.keys(groupedData).sort((a, b) => a.localeCompare(b));
    let highestBurn = 0;
    dates.forEach(key => {
      if (groupedData[key].totalBurned > highestBurn) highestBurn = groupedData[key].totalBurned;
    });
    return { sortedDates: dates, maxVal: Math.max(highestBurn + 150, 500) };
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

  return (
    <View style={styles.fullScreen}>
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Burned History</Text>
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
          <View>
            <Text style={styles.todayLabel}>TODAY'S CALORIES BURNED</Text>
            <Text style={styles.todayValue}>{averages.today.toLocaleString()} <Text style={styles.todayUnit}>cal</Text></Text>
          </View>
          <View style={styles.burnIconBg}><MaterialCommunityIcons name="fire" size={32} color="#FF9800" /></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContentList} showsVerticalScrollIndicator={false}>
        {Object.keys(groupedData).sort((a, b) => b.localeCompare(a)).map((dateKey) => (
            <View key={dateKey} style={styles.sectionContainer}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(dateKey)} activeOpacity={0.7}>
                    <View style={styles.sectionHeaderTextGroup}>
                        <Text style={styles.sectionLabel}>{getFullReadableDate(dateKey).toUpperCase()}</Text>
                        <Text style={styles.sectionTotalValue}>{groupedData[dateKey].totalBurned.toLocaleString()} cal</Text>
                    </View>
                    <MaterialCommunityIcons name={expandedSections[dateKey] ? "chevron-up" : "chevron-down"} size={20} color="#9E9E9E" />
                </TouchableOpacity>
                {expandedSections[dateKey] && (
                    <View style={styles.itemsContainer}>
                        {groupedData[dateKey].items.map((item) => (
                            <View key={item.id} style={styles.historyCard}>
                                <View style={styles.historyIconBg}><MaterialCommunityIcons name={item.icon || "run"} size={26} color="#1B4D20" /></View>
                                <View style={styles.historyDetails}>
                                    <Text style={styles.historyTime}>{item.type || 'Activity'}</Text>
                                    <Text style={styles.historyActivityName}>{item.duration ? `${item.duration} mins` : 'Active Session'}</Text>
                                </View>
                                <View style={styles.valueBadge}><Text style={styles.valueText}>{item.caloriesBurned || 0} cal</Text></View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        ))}
      </ScrollView>

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

      {/* TRENDS/CHART POP-UP MODAL */}
      <Modal visible={showChart} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowChart(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.modalTitle}>Burn Trends</Text>
            <TouchableOpacity onPress={() => setShowChart(false)}>
              <MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 50 }}>
            {/* 4-BOX SUMMARY GRID */}
            <View style={styles.averagesContainer}>
              <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                <View style={[styles.avgBoxSmall, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={styles.avgLabelCenter}>TODAY</Text>
                  <Text style={styles.avgValueCenter}>{averages.today.toLocaleString()} <Text style={styles.avgUnit}>cal</Text></Text>
                </View>
                <View style={[styles.avgBoxSmall, { marginLeft: 10 }]}>
                  <Text style={styles.avgLabelCenter}>DAILY AVG (WEEK)</Text>
                  <Text style={styles.avgValueCenter}>{averages.weekly.toLocaleString()} <Text style={styles.avgUnit}>cal</Text></Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row' }}>
                <View style={styles.avgBoxSmall}>
                  <Text style={styles.avgLabelCenter}>DAILY AVG (MONTH)</Text>
                  <Text style={styles.avgValueCenter}>{averages.monthly.toLocaleString()} <Text style={styles.avgUnit}>cal</Text></Text>
                </View>
                <View style={[styles.avgBoxSmall, { marginLeft: 10, backgroundColor: '#F1F8E9' }]}>
                  <Text style={styles.avgLabelCenter}>DAILY AVG (YEAR)</Text>
                  <Text style={styles.avgValueCenter}>{averages.yearly.toLocaleString()} <Text style={styles.avgUnit}>cal</Text></Text>
                </View>
              </View>
            </View>

            <View style={styles.comparisonCard}>
              <View style={styles.comparisonHeader}><Text style={styles.comparisonTitle}>Daily Activity History</Text></View>

              <View style={{ flexDirection: 'row', height: 320, marginTop: 20 }}>
                <View style={{ width: 85, height: 260, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 12 }}>
                  <Text style={styles.yAxisText}>{maxVal}</Text>
                  <Text style={styles.yAxisText}>{Math.round(maxVal / 2)}</Text>
                  <Text style={styles.yAxisText}>0</Text>
                </View>

                <View style={[styles.chartWrapper, { flex: 1, height: 260 }]}>
                  <ScrollView
                    horizontal
                    ref={chartScrollRef}
                    showsHorizontalScrollIndicator={false}
                    style={{ overflow: 'visible' }}
                    contentContainerStyle={{ paddingHorizontal: 15, alignItems: 'flex-end', height: 260, overflow: 'visible' }}
                  >
                    {sortedDates.map((dateKey) => {
                      const dayBurn = groupedData[dateKey].totalBurned;
                      const barHeight = (dayBurn / maxVal) * 260;

                      const parts = dateKey.split('/');
                      const isNorthAmerica = new Intl.DateTimeFormat().resolvedOptions().timeZone.includes('America');
                      const displayDate = isNorthAmerica
                        ? `${parts[1]}/${parts[2]}`
                        : `${parts[2]}/${parts[1]}`;

                      return (
                        <View key={dateKey} style={styles.barColumn}>
                          {dayBurn > 0 && <Text style={styles.barValueText}>+{Math.round(dayBurn)}</Text>}
                          <View style={[styles.barBase, { height: Math.max(barHeight, 4) }]} />
                          <Text style={styles.barDateTextAbsolute}>{displayDate}</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
              <Text style={styles.chartHint}>Daily calorie burn summary</Text>
            </View>
          </ScrollView>
          <TouchableOpacity style={[styles.bottomCloseBtn, { marginBottom: insets.bottom + 10 }]} onPress={() => setShowChart(false)}><Text style={styles.bottomCloseBtnText}>Close</Text></TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showGuide} animationType="slide" presentationStyle="pageSheet"><View style={styles.modalContainer}><View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}><Text style={styles.modalTitle}>Health Guide</Text><TouchableOpacity onPress={() => setShowGuide(false)}><MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" /></TouchableOpacity></View><View style={{ flex: 1 }}><Guide /></View><TouchableOpacity style={styles.bottomCloseBtn} onPress={() => setShowGuide(false)}><Text style={styles.bottomCloseBtnText}>Close</Text></TouchableOpacity></View></Modal>
      <Modal visible={showShop} animationType="slide" presentationStyle="pageSheet"><View style={styles.modalContainer}><View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}><Text style={styles.modalTitle}>Shop at Amazon</Text><TouchableOpacity onPress={() => setShowShop(false)}><MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" /></TouchableOpacity></View><View style={{ flex: 1 }}><Shop /></View><TouchableOpacity style={styles.bottomCloseBtn} onPress={() => setShowShop(false)}><Text style={styles.bottomCloseBtnText}>Close</Text></TouchableOpacity></View></Modal>
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
  todaySummaryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1B4D20', padding: 20, borderRadius: 24, elevation: 8 },
  todayLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
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
  historyTime: { fontSize: 10, fontWeight: '700', color: '#BDBDBD' },
  historyActivityName: { fontSize: 16, fontWeight: '800', color: '#212529' },
  valueBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  valueText: { color: '#1B4D20', fontWeight: '800', fontSize: 13 },
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1B4D20' },
  comparisonCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, paddingBottom: 45, marginVertical: 10, borderWidth: 1, borderColor: '#EEE', elevation: 3 },
  comparisonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  comparisonTitle: { fontSize: 16, fontWeight: '800', color: '#212529' },
  averagesContainer: { flexDirection: 'column', marginBottom: 20, marginTop: 5 },
  avgBoxSmall: { flex: 1, backgroundColor: '#F8F9FA', padding: 15, borderRadius: 20, alignItems: 'center' },
  avgLabelCenter: { fontSize: 9, fontWeight: '800', color: '#9E9E9E', marginBottom: 5 },
  avgValueCenter: { fontSize: 18, fontWeight: '900', color: '#1B4D20' },
  avgUnit: { fontSize: 12, fontWeight: '400', color: '#666' },
  chartWrapper: { backgroundColor: '#F9F9F9', borderRadius: 16, overflow: 'visible' },
  barColumn: { width: 65, marginHorizontal: 4, alignItems: 'center', justifyContent: 'flex-end', height: 260, overflow: 'visible' },
  barBase: { width: 26, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#1B4D20' },
  barValueText: { fontSize: 10, fontWeight: '900', textAlign: 'center', width: 60, zIndex: 10, color: '#1B4D20', marginBottom: 4 },
  barDateTextAbsolute: { position: 'absolute', bottom: -28, fontSize: 8, color: '#999', fontWeight: '700', width: 50, textAlign: 'center' },
  yAxisText: { fontSize: 9, color: '#999', fontWeight: '700' },
  chartHint: { textAlign: 'center', fontSize: 11, color: '#AAA', fontWeight: '600', marginTop: 45 },
  bottomCloseBtn: { backgroundColor: '#1B4D20', paddingVertical: 15, marginHorizontal: 20, borderRadius: 15, alignItems: 'center' },
  bottomCloseBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  placeholderContainer: { alignItems: 'center', marginTop: 100 },
  placeholderText: { color: '#BDBDBD', marginTop: 15, fontSize: 16, textAlign: 'center' },
  itemsContainer: { marginTop: 5 }
});