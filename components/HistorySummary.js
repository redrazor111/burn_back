/* eslint-disable react/no-unescaped-entities */
import { auth, db } from '@/utils/firebaseConfig';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    LayoutAnimation,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Component Imports
import { useSubscriptionStatus } from '@/utils/subscription';
import Guide from '../components/Guide';
import Shop from '../components/Shop';
import PremiumModal from './PremiumModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const getOrdinalDate = (dateKey) => {
    if (!dateKey || dateKey === "Unknown") return "Unknown Date";
    const parts = dateKey.split('-');
    if (parts.length !== 3) return dateKey;
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[monthIndex];
    if (isNaN(day) || !month) return dateKey;
    let suffix = 'th';
    if (day < 11 || day > 13) {
        switch (day % 10) {
            case 1: suffix = 'st'; break;
            case 2: suffix = 'nd'; break;
            case 3: suffix = 'rd'; break;
        }
    }
    return `${day}${suffix} ${month} ${year}`;
};

const HALF_HEIGHT = 130;

export default function HistorySummary() {
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const { isPro } = useSubscriptionStatus();
    const [userId, setUserId] = useState(auth.currentUser?.uid);
    const [showChart, setShowChart] = useState(false);
    const [meals, setMeals] = useState([]);
    const [activities, setActivities] = useState([]);
    const [targetCalories, setTargetCalories] = useState(2000);
    const [expandedSections, setExpandedSections] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [showShop, setShowShop] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const [showPremium, setShowPremium] = useState(false);
    const chartScrollRef = useRef(null);

    useEffect(() => {
        const user = auth.currentUser;
        if (user) setUserId(user.uid);
    }, [isFocused]);

    useEffect(() => {
        if (!userId) return;
        const profileUnsub = onSnapshot(doc(db, 'users', userId, 'profile', 'data'), (snap) => {
            if (snap.exists()) setTargetCalories(Number(snap.data().targetCalories || 2000));
        });
        const mealsUnsub = onSnapshot(query(collection(db, 'users', userId, 'meals'), orderBy('createdAt', 'desc')), (snap) => {
            setMeals(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        });
        const actsUnsub = onSnapshot(query(collection(db, 'users', userId, 'activities'), orderBy('createdAt', 'desc')), (snap) => {
            setActivities(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        });
        return () => { profileUnsub(); mealsUnsub(); actsUnsub(); };
    }, [userId]);

    const handleOpenChart = () => {
        if (isPro) {
            setShowChart(true);
            setTimeout(() => {
                chartScrollRef.current?.scrollToEnd({ animated: false });
            }, 500);
        } else {
            setShowPremium(true);
        }
    };

    useEffect(() => {
        if (isFocused) {
            setExpandedSections({});
            setShowPremium(false);
            setShowShop(false);
            setShowChart(false);
            setShowGuide(false);
        }
    }, [isFocused]);

    const getSafeDateKey = (dateString) => {
        if (!dateString) return "Unknown";
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return "Unknown";
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const { stats, maxVal } = useMemo(() => {
        const groups = {};
        let maxBalanceFound = 0;
        const lowerQuery = searchQuery.toLowerCase().trim();

        meals.forEach(m => {
            const name = (m.productName || m.identifiedProduct || "").toLowerCase();
            if (lowerQuery && !name.includes(lowerQuery)) return;
            const key = getSafeDateKey(m.date || m.createdAt?.toDate?.()?.toISOString());
            if (!groups[key]) groups[key] = { intake: 0, burned: 0, target: targetCalories, rawMeals: [], rawActs: [] };
            groups[key].intake += Number(m.calories || 0);
            groups[key].rawMeals.push(m);
        });

        activities.forEach(a => {
            const type = (a.type || "").toLowerCase();
            if (lowerQuery && !type.includes(lowerQuery)) return;
            const key = getSafeDateKey(a.date || a.createdAt?.toDate?.()?.toISOString());
            if (!groups[key]) groups[key] = { intake: 0, burned: 0, target: targetCalories, rawMeals: [], rawActs: [] };
            groups[key].burned += Number(a.caloriesBurned || 0);
            groups[key].rawActs.push(a);
        });

        Object.keys(groups).forEach(key => {
            const netIntake = groups[key].intake - groups[key].burned;
            const balance = targetCalories - netIntake;
            const absDiff = Math.abs(balance);
            if (absDiff > maxBalanceFound) maxBalanceFound = absDiff;
        });

        const scaleLimit = Math.max(maxBalanceFound + 450, 600);
        return { stats: groups, maxVal: scaleLimit * 2 };
    }, [meals, activities, targetCalories, searchQuery]);

    const todayStats = useMemo(() => {
        const todayKey = getSafeDateKey(new Date().toISOString());
        const day = stats[todayKey] || { intake: 0, burned: 0 };
        return { ...day, remaining: targetCalories + day.burned - day.intake };
    }, [stats, targetCalories]);

    const sortedDates = Object.keys(stats).sort((a, b) => b.localeCompare(a));

    const averages = useMemo(() => {
        const now = new Date();
        const oneWeekAgo = new Date().setDate(now.getDate() - 7);
        const oneMonthAgo = new Date().setDate(now.getDate() - 30);
        const oneYearAgo = new Date().setDate(now.getDate() - 365);

        const getAvgBalance = (sinceDate) => {
            const relevantDays = Object.keys(stats).filter(key => {
                const dayDate = new Date(key);
                return dayDate >= sinceDate && (stats[key].intake > 0 || stats[key].burned > 0);
            });
            if (relevantDays.length === 0) return 0;
            const totalBalance = relevantDays.reduce((sum, key) => {
                const dayBalance = targetCalories + stats[key].burned - stats[key].intake;
                return sum + dayBalance;
            }, 0);
            return Math.round(totalBalance / relevantDays.length);
        };

        return {
            today: todayStats.remaining,
            weekly: getAvgBalance(oneWeekAgo),
            monthly: getAvgBalance(oneMonthAgo),
            yearly: getAvgBalance(oneYearAgo)
        };
    }, [stats, targetCalories, todayStats]);

    const toggleSection = (key) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <View style={styles.fullScreen}>
            <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
                <View style={styles.headerTopRow}>
                    <Text style={styles.title}>Balance History</Text>
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
                        <Text style={styles.todayLabel}>TODAY'S REMAINING</Text>
                        <Text style={styles.todayValue}>{todayStats.remaining} <Text style={styles.todayUnit}>cal</Text></Text>
                        <Text style={styles.goalText}>DAILY GOAL: {targetCalories} cal</Text>
                    </View>
                    <View style={styles.fireIconBg}>
                        <MaterialCommunityIcons name="fire" size={32} color="#FF9800" />
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>
                <View style={[styles.searchContainer, styles.searchMargin]}>
                    <Ionicons name="search" size={22} color="#999" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search food or activity..."
                        placeholderTextColor="#999"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearchQuery('')}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            <Ionicons name="close-circle" size={22} color="#CCC" />
                        </TouchableOpacity>
                    )}
                </View>

                {sortedDates.map(dateKey => {
                    const data = stats[dateKey];
                    const netRemaining = targetCalories + data.burned - data.intake;
                    const isDeficit = netRemaining >= 0;
                    const todayKey = getSafeDateKey(new Date().toISOString());
                    const readableDate = dateKey === todayKey ? "Today" : getOrdinalDate(dateKey);

                    return (
                        <View key={dateKey} style={styles.daySection}>
                            <TouchableOpacity style={[styles.summaryCard, !isDeficit && styles.summaryCardSurplus]} onPress={() => toggleSection(dateKey)} activeOpacity={0.9}>
                                <View style={styles.cardTop}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.dateText}>{readableDate}</Text>
                                        <MaterialCommunityIcons name={expandedSections[dateKey] ? "chevron-up" : "chevron-down"} size={20} color="#999" style={{ marginLeft: 5 }} />
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: isDeficit ? '#E8F5E9' : '#FFEBEE' }]}>
                                        <Text style={[styles.statusText, { color: isDeficit ? '#2E7D32' : '#C62828' }]}>{isDeficit ? 'UNDER' : 'OVER'}</Text>
                                    </View>
                                </View>
                                <View style={styles.mathRow}>
                                    <View style={styles.mathItem}><Text style={styles.mathLabel}>Goal</Text><Text style={styles.mathValue}>{targetCalories}</Text></View>
                                    <Text style={styles.mathOperator}>+</Text>
                                    <View style={styles.mathItem}><Text style={styles.mathLabel}>Burn</Text><Text style={styles.mathValue}>{data.burned}</Text></View>
                                    <Text style={styles.mathOperator}>-</Text>
                                    <View style={styles.mathItem}><Text style={styles.mathLabel}>In</Text><Text style={styles.mathValue}>{data.intake}</Text></View>
                                    <Text style={styles.mathOperator}>=</Text>
                                    <View style={styles.mathItem}><Text style={styles.mathLabel}>Balance</Text><Text style={[styles.mathValue, { color: isDeficit ? '#1B4D20' : '#C62828' }]}>{Math.abs(netRemaining)} cal</Text></View>
                                </View>
                                {(expandedSections[dateKey] || searchQuery) && (
                                    <View style={styles.detailsList}>
                                        {data.rawMeals.map(m => (<View key={m.id} style={styles.detailRow}><Text style={styles.detailName}>{m.productName || m.identifiedProduct}</Text><Text style={styles.detailValue}>-{m.calories} cal</Text></View>))}
                                        {data.rawActs.map(a => (<View key={a.id} style={styles.detailRow}><Text style={[styles.detailName, { color: '#1B4D20' }]}>{a.type || 'Exercise'}</Text><Text style={[styles.detailValue, { color: '#1B4D20' }]}>+{a.caloriesBurned} cal</Text></View>))}
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </ScrollView>

            <Modal visible={showChart} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowChart(false)}>
                <View style={styles.modalContainer}>
                    <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
                        <Text style={styles.modalTitle}>Balance Trends</Text>
                        <TouchableOpacity onPress={() => setShowChart(false)}>
                            <MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 50 }}>
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
                            <View style={{ flexDirection: 'row', marginBottom: 10 }}>
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
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                <Text style={styles.comparisonTitle}>Remaining Calories History</Text>
                                <View style={{ backgroundColor: '#B8860B', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 10, color: '#FFF', fontWeight: 'bold' }}>GOAL: {targetCalories}</Text>
                                </View>
                            </View>

                            <View style={{ marginTop: 20 }}>
                                <View style={[styles.chartWrapper, { height: 280 }]}>

                                    {/* Goal Line */}
                                    <View style={[styles.targetBaseline, { top: 130 }]} />
                                    <View style={{ position: 'absolute', top: 120, left: 8, zIndex: 25 }}>
                                        <Text style={{ fontSize: 8, color: '#B8860B', fontWeight: '900', letterSpacing: 0.5 }}>GOAL</Text>
                                    </View>
                                    <ScrollView
                                        horizontal
                                        ref={chartScrollRef}
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={{
                                            paddingHorizontal: 15,
                                            alignItems: 'center',
                                            height: 280,
                                            backgroundColor: '#F9F9F9',
                                        }}
                                        onContentSizeChange={() => chartScrollRef.current?.scrollToEnd({ animated: false })}
                                    >
                                        {sortedDates.slice().reverse().map((dateKey) => {
                                            const data = stats[dateKey] || { intake: 0, burned: 0 };
                                            const balance = targetCalories - (data.intake - data.burned);
                                            const isOver = balance < 0;
                                            const barHeight = Math.min(
                                                (Math.abs(balance) / (maxVal / 2)) * HALF_HEIGHT,
                                                HALF_HEIGHT - 2
                                            );

                                            const parts = dateKey.split('-');
                                            const dDate = `${parts[2]}/${parts[1]}`;

                                            return (
                                                <View key={dateKey} style={styles.barColumn}>

                                                    {/* Upper half — under goal (green bar grows upward) */}
                                                    <View style={styles.chartHalfUnder}>
                                                        {!isOver && balance !== 0 && (
                                                            <>
                                                                <Text style={[styles.barValueText, { color: '#2E7D32', marginBottom: 2 }]}>
                                                                    +{Math.round(balance)}
                                                                </Text>
                                                                <View style={[styles.barBase, { height: barHeight, backgroundColor: '#4CAF50' }]} />
                                                            </>
                                                        )}
                                                    </View>

                                                    {/* Lower half — over goal (red bar grows downward) */}
                                                    <View style={styles.chartHalfOver}>
                                                        {isOver && (
                                                            <>
                                                                <View style={[styles.barBase, { height: barHeight, backgroundColor: '#FF5252' }]} />
                                                                <Text style={[styles.barValueText, { color: '#C62828', marginTop: 2 }]}>
                                                                    {Math.round(balance)}
                                                                </Text>
                                                            </>
                                                        )}
                                                    </View>

                                                    {/* Date label */}
                                                    <Text style={styles.barDateLabel}>{dDate}</Text>
                                                </View>
                                            );
                                        })}
                                    </ScrollView>
                                </View>

                                <Text style={styles.chartHint}>Daily calorie balance trend</Text>
                            </View>
                        </View>
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.bottomCloseBtn, { marginBottom: insets.bottom + 10 }]}
                        onPress={() => setShowChart(false)}
                    >
                        <Text style={styles.bottomCloseBtnText}>Close</Text>
                    </TouchableOpacity>
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
    todayLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900' },
    todayValue: { color: '#FFF', fontSize: 32, fontWeight: '900' },
    todayUnit: { fontSize: 14, fontWeight: '400', opacity: 0.7 },
    goalText: { color: '#FFF', fontSize: 10, fontWeight: '800', marginTop: 8 },
    fireIconBg: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 10, borderRadius: 15 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 15, height: 45 },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 14, color: '#333', fontWeight: '600' },
    searchMargin: { marginBottom: 20 },
    scrollPadding: { padding: 20, paddingBottom: 100 },
    daySection: { marginBottom: 12 },
    summaryCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 15, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#4CAF50' },
    summaryCardSurplus: { borderLeftColor: '#FF5252' },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    dateText: { fontSize: 16, fontWeight: '800', color: '#333' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: '900' },
    mathRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    mathItem: { alignItems: 'center', flex: 1 },
    mathLabel: { fontSize: 9, color: '#999', fontWeight: '800', textTransform: 'uppercase' },
    mathValue: { fontSize: 14, fontWeight: '900', color: '#333' },
    mathOperator: { fontSize: 14, fontWeight: 'bold', color: '#DDD' },
    detailsList: { borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 15, paddingTop: 10 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    detailName: { fontSize: 12, color: '#666', fontWeight: '600' },
    detailValue: { fontSize: 12, fontWeight: '800', color: '#C62828' },
    modalContainer: { flex: 1, backgroundColor: '#FFF' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    modalTitle: { fontSize: 24, fontWeight: '900', color: '#1B4D20' },
    bottomCloseBtn: { backgroundColor: '#1B4D20', paddingVertical: 15, marginHorizontal: 20, borderRadius: 15, alignItems: 'center' },
    bottomCloseBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
    comparisonTitle: { fontSize: 16, fontWeight: '900', color: '#1B4D20' },
    averagesContainer: { flexDirection: 'column', marginBottom: 20, marginTop: 5 },
    avgBoxSmall: { flex: 1, backgroundColor: '#F8F9FA', padding: 15, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avgLabelCenter: { fontSize: 9, fontWeight: '800', color: '#9E9E9E', marginBottom: 5, textAlign: 'center' },
    avgValueCenter: { fontSize: 18, fontWeight: '900', color: '#1B4D20' },
    avgUnit: { fontSize: 12, fontWeight: '400', color: '#666' },
    chartWrapper: {
        backgroundColor: '#F9F9F9',
        borderRadius: 16,
        overflow: 'hidden', // CRITICAL: This clips the bars if they try to go outside
        borderWidth: 1,
        borderColor: '#EEE'
    },
    targetBaseline: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#B8860B',
        zIndex: 20,
        elevation: 20, // Android needs this too
    },
    barColumn: {
        width: 52,
        marginHorizontal: 3,
        alignItems: 'center',
        height: 280,
    },
    comparisonCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 12,
        paddingBottom: 45,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: '#EEE',
        elevation: 3,
    },
    chartHint: {
        textAlign: 'center',
        fontSize: 11,
        color: '#AAA',
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 4,
    },
    chartHalfUnder: {
        height: HALF_HEIGHT,
        justifyContent: 'flex-end',
        alignItems: 'center',
        width: '100%',
        paddingBottom: 1,
    },
    chartHalfOver: {
        height: HALF_HEIGHT,
        justifyContent: 'flex-start',
        alignItems: 'center',
        width: '100%',
        paddingTop: 1,
    },
    barDateLabel: {
        fontSize: 9,
        color: '#999',
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 4,
        width: 52,
    },
    barBase: {
        width: 20,
        borderRadius: 4,
    },
    barDateTextAbsolute: {
        position: 'absolute',
        bottom: 5,           // Moved up since it's only one line now
        fontSize: 9,
        color: '#999',
        fontWeight: '700',
        width: 45,
        textAlign: 'center',
    },
    barValueText: {
        fontSize: 9,         // Slightly smaller text to prevent overlapping
        fontWeight: '900',
        textAlign: 'center',
        width: 40,
        zIndex: 10
    },
    yAxisText: { fontSize: 9, color: '#999', fontWeight: '700' }
});