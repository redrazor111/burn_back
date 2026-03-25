/* eslint-disable react/no-unescaped-entities */
import { auth, db } from '@/utils/firebaseConfig';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
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

    // Modal States
    const [showShop, setShowShop] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const [showPremium, setShowPremium] = useState(false);

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
        } else {
            setShowPremium(true);
        }
    };

    const handleUpdateGoal = () => {
        Alert.alert(
            "Update Daily Goal",
            "Select a new calorie target:",
            [
                { text: "1500", onPress: () => updateFirebaseGoal(1500) },
                { text: "1800", onPress: () => updateFirebaseGoal(1800) },
                { text: "2000", onPress: () => updateFirebaseGoal(2000) },
                { text: "2500", onPress: () => updateFirebaseGoal(2500) },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const updateFirebaseGoal = async (val) => {
        try {
            await setDoc(doc(db, 'users', userId, 'profile', 'data'), {
                targetCalories: val
            }, { merge: true });
        } catch (e) { console.error(e); }
    };

    const getSafeDateKey = (dateString) => {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return "Unknown";
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    const stats = useMemo(() => {
        const groups = {};
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
        return groups;
    }, [meals, activities, targetCalories, searchQuery]);

    const todayStats = useMemo(() => {
        const todayKey = getSafeDateKey(new Date().toISOString());
        const day = stats[todayKey] || { intake: 0, burned: 0 };
        return { ...day, remaining: targetCalories + day.burned - day.intake };
    }, [stats, targetCalories]);

    const sortedDates = Object.keys(stats).sort((a, b) => b.localeCompare(a));

    const weeklyImpact = useMemo(() => {
        const last7DaysKeys = sortedDates.slice(0, 7);
        let totalNet = 0;
        last7DaysKeys.forEach(date => {
            const day = stats[date];
            totalNet += (day.target + day.burned - day.intake);
        });
        const weightChange = (totalNet / 3500).toFixed(2);
        // Convert lbs to kg (1 lb = 0.453592 kg)
        const weightChangeKg = (Math.abs(totalNet / 3500) * 0.453592).toFixed(2);
        return { totalNet, weightChange, weightChangeKg, count: last7DaysKeys.length };
    }, [stats, sortedDates]);

    const averages = useMemo(() => {
        const now = new Date();
        const todayKey = getSafeDateKey(now.toISOString());
        const oneWeekAgo = new Date().setDate(now.getDate() - 7);
        const oneMonthAgo = new Date().setDate(now.getDate() - 30);
        const oneYearAgo = new Date().setDate(now.getDate() - 365);

        const getAvg = (sinceDate) => {
            const relevantDays = Object.keys(stats).filter(key => {
                const dayDate = new Date(key);
                return dayDate >= sinceDate && stats[key].intake > 0;
            });
            if (relevantDays.length === 0) return 0;
            const total = relevantDays.reduce((sum, key) => sum + stats[key].intake, 0);
            return Math.round(total / relevantDays.length);
        };

        return {
            today: stats[todayKey]?.intake || 0,
            weekly: getAvg(oneWeekAgo),
            monthly: getAvg(oneMonthAgo),
            yearly: getAvg(oneYearAgo)
        };
    }, [stats]);

    const toggleSection = (key) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <View style={styles.fullScreen}>
            <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
                <View style={styles.headerTopRow}>
                    <Text style={styles.title}>History Balance</Text>
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
                        <TouchableOpacity onPress={handleUpdateGoal} style={styles.goalPill}>
                            <Text style={styles.goalPillText}>GOAL: {targetCalories}</Text>
                            <MaterialCommunityIcons name="pencil" size={10} color="rgba(255,255,255,0.7)" style={{ marginLeft: 5 }} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.fireIconBg}>
                        <MaterialCommunityIcons name="fire" size={32} color="#FF9800" />
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>
                {/* 7-DAY IMPACT CARD (Display Only) */}
                {weeklyImpact.count > 0 && !searchQuery && (
                    <View style={styles.weeklyCard}>
                        <View style={styles.weeklyHeader}>
                            <MaterialCommunityIcons name="trending-up" size={18} color="#FFF" />
                            <Text style={styles.weeklyTitle}>7-DAY IMPACT</Text>
                        </View>
                        <View style={styles.weeklyBody}>
                            <View style={styles.weeklyStat}>
                                <Text style={styles.weeklyLabel}>{weeklyImpact.totalNet >= 0 ? 'Saved' : 'Extra'}</Text>
                                <Text style={[styles.weeklyValue, { color: weeklyImpact.totalNet >= 0 ? '#81C784' : '#FF8A80' }]}>
                                    {Math.abs(weeklyImpact.totalNet)} <Text style={styles.weeklyUnit}>cal</Text>
                                </Text>
                            </View>
                            <View style={styles.weeklyDivider} />
                            <View style={styles.weeklyStat}>
                                <Text style={styles.weeklyLabel}>Projected Change</Text>
                                <Text style={styles.weeklyValue}>
                                    {weeklyImpact.totalNet >= 0 ? '-' : '+'}{Math.abs(weeklyImpact.weightChange)}
                                    <Text style={styles.weeklyUnit}>lb</Text>

                                    {/* Added KG projection below */}
                                    <Text style={[styles.weeklyUnit, { opacity: 0.5 }]}> • </Text>

                                    {weeklyImpact.totalNet >= 0 ? '-' : '+'}{weeklyImpact.weightChangeKg}
                                    <Text style={styles.weeklyUnit}>kg</Text>
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* SEARCH BAR */}
                <View style={[styles.searchContainer, styles.searchMargin]}>
                    <Ionicons name="search" size={16} color="#999" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search food or activity..."
                        placeholderTextColor="#999"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color="#CCC" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* HISTORY LIST */}
                {sortedDates.map(dateKey => {
                    const data = stats[dateKey];
                    const netRemaining = targetCalories + data.burned - data.intake;
                    const isDeficit = netRemaining >= 0;
                    const readableDate = dateKey === getSafeDateKey(new Date().toISOString()) ? "Today" : getOrdinalDate(new Date(dateKey));

                    return (
                        <View key={dateKey} style={styles.daySection}>
                            <TouchableOpacity
                                style={[styles.summaryCard, !isDeficit && styles.summaryCardSurplus]}
                                onPress={() => toggleSection(dateKey)}
                                activeOpacity={0.9}
                            >
                                <View style={styles.cardTop}>
                                    <Text style={styles.dateText}>{readableDate}</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: isDeficit ? '#E8F5E9' : '#FFEBEE' }]}>
                                        <Text style={[styles.statusText, { color: isDeficit ? '#2E7D32' : '#C62828' }]}>
                                            {isDeficit ? 'UNDER' : 'OVER'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.mathRow}>
                                    <View style={styles.mathItem}><Text style={styles.mathLabel}>Goal</Text><Text style={styles.mathValue}>{targetCalories}</Text></View>
                                    <Text style={styles.mathOperator}>+</Text>
                                    <View style={styles.mathItem}><Text style={styles.mathLabel}>Burn</Text><Text style={styles.mathValue}>{data.burned}</Text></View>
                                    <Text style={styles.mathOperator}>-</Text>
                                    <View style={styles.mathItem}><Text style={styles.mathLabel}>In</Text><Text style={styles.mathValue}>{data.intake}</Text></View>
                                    <Text style={styles.mathOperator}>=</Text>
                                    <View style={styles.mathItem}>
                                        <Text style={styles.mathLabel}>Result</Text>
                                        <Text style={[styles.mathValue, { color: isDeficit ? '#1B4D20' : '#C62828' }]}>{Math.abs(netRemaining)}</Text>
                                    </View>
                                </View>

                                {(expandedSections[dateKey] || searchQuery) && (
                                    <View style={styles.detailsList}>
                                        {data.rawMeals.map(m => (
                                            <View key={m.id} style={styles.detailRow}>
                                                <Text style={styles.detailName}>{m.productName || m.identifiedProduct}</Text>
                                                <Text style={styles.detailValue}>-{m.calories}</Text>
                                            </View>
                                        ))}
                                        {data.rawActs.map(a => (
                                            <View key={a.id} style={styles.detailRow}>
                                                <Text style={[styles.detailName, { color: '#1B4D20' }]}>{a.type || 'Exercise'}</Text>
                                                <Text style={[styles.detailValue, { color: '#1B4D20' }]}>+{a.caloriesBurned}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </ScrollView>

            <Modal
                visible={showChart}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowChart(false)}
            >
                <View style={styles.modalContainer}>
                    {/* Header with Insets */}
                    <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
                        <Text style={styles.modalTitle}>Intake Trends</Text>
                        <TouchableOpacity onPress={() => setShowChart(false)}>
                            <MaterialCommunityIcons name="close-circle" size={32} color="#1B4D20" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1 }}>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}>

                            {/* Averages Section */}
                            <View style={styles.averagesContainer}>
                                {/* Row 1: Today & Weekly */}
                                <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                                    <View style={[styles.avgBoxSmall, { backgroundColor: '#E8F5E9' }]}>
                                        <Text style={styles.avgLabelCenter}>TODAY</Text>
                                        <Text style={styles.avgValueCenter}>
                                            {averages.today.toLocaleString()} <Text style={styles.avgUnit}>cal</Text>
                                        </Text>
                                    </View>
                                    <View style={[styles.avgBoxSmall, { marginLeft: 10, backgroundColor: '#FFF8E1' }]}>
                                        <Text style={styles.avgLabelCenter}>DAILY GOAL</Text>
                                        <Text style={[styles.avgValueCenter, { color: '#B8860B' }]}>
                                            {targetCalories.toLocaleString()} <Text style={styles.avgUnit}>cal</Text>
                                        </Text>
                                    </View>
                                </View>

                                {/* Row 2: Weekly & Monthly */}
                                <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                                    <View style={styles.avgBoxSmall}>
                                        <Text style={styles.avgLabelCenter}>DAILY AVG (WEEK)</Text>
                                        <Text style={styles.avgValueCenter}>
                                            {averages.weekly.toLocaleString()} <Text style={styles.avgUnit}>cal</Text>
                                        </Text>
                                    </View>
                                    <View style={[styles.avgBoxSmall, { marginLeft: 10 }]}>
                                        <Text style={styles.avgLabelCenter}>DAILY AVG (MONTH)</Text>
                                        <Text style={styles.avgValueCenter}>
                                            {averages.monthly.toLocaleString()} <Text style={styles.avgUnit}>cal</Text>
                                        </Text>
                                    </View>
                                </View>

                                {/* Optional Row 3: Yearly (Centered or full width) */}
                                <View style={{ flexDirection: 'row' }}>
                                    <View style={[styles.avgBoxSmall, { backgroundColor: '#F1F8E9' }]}>
                                        <Text style={styles.avgLabelCenter}>DAILY AVG (YEAR)</Text>
                                        <Text style={styles.avgValueCenter}>
                                            {averages.yearly.toLocaleString()} <Text style={styles.avgUnit}>cal</Text>
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* The Bar Chart Card */}
                            <View style={styles.comparisonCard}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                    <Text style={styles.comparisonTitle}>Daily Calorie History</Text>
                                    <View style={{ backgroundColor: '#1B4D20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ fontSize: 10, color: '#FFF', fontWeight: 'bold' }}>GOAL: {targetCalories}</Text>
                                    </View>
                                </View>

                                <View style={[styles.chartWrapper, { backgroundColor: 'transparent', height: 230 }]}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScrollContent}>
                                        {/* The Goal Line Overlay */}
                                        <View style={[styles.goalLine, { bottom: 85, opacity: 0.2 }]} />

                                        {sortedDates.slice().reverse().map((dateKey) => {
                                            const data = stats[dateKey];
                                            const barHeight = Math.min((data.intake / targetCalories) * 100, 150);
                                            const isOver = data.intake > targetCalories;

                                            return (
                                                <View key={dateKey} style={[styles.barColumn, { justifyContent: 'flex-end', height: 180 }]}>
                                                    {!isOver && (
                                                        <Text style={[styles.barValueText, { position: 'absolute', bottom: barHeight + 20, width: '100%', textAlign: 'center', fontSize: 8 }]}>
                                                            {data.intake}
                                                        </Text>
                                                    )}
                                                    <View style={[
                                                        styles.barBase,
                                                        {
                                                            height: barHeight,
                                                            backgroundColor: isOver ? '#FF5252' : '#4CAF50',
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            width: 25,
                                                            borderRadius: 4
                                                        }
                                                    ]}>
                                                        {isOver && <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>{data.intake}</Text>}
                                                    </View>
                                                    <Text style={[styles.barDateText, { fontSize: 9 }]}>{dateKey.split('/').slice(1).join('/')}</Text>
                                                </View>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                                <Text style={styles.graphHint}>Scroll left to see older logs</Text>
                            </View>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>

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
    todaySummaryCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1B4D20',
        padding: 20,
        borderRadius: 24,
        elevation: 8
    },
    todayLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900' },
    todayValue: { color: '#FFF', fontSize: 32, fontWeight: '900' },
    todayUnit: { fontSize: 14, fontWeight: '400', opacity: 0.7 },
    goalPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        marginTop: 8,
        alignSelf: 'flex-start'
    },
    goalPillText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
    fireIconBg: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 10, borderRadius: 15 },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 45
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 14, color: '#333', fontWeight: '600' },
    searchMargin: {
        marginBottom: 20,
    },
    scrollPadding: { padding: 20, paddingBottom: 100 },
    weeklyCard: { backgroundColor: '#1B4D20', borderRadius: 20, padding: 15, marginBottom: 20 },
    weeklyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    weeklyTitle: { color: '#FFF', fontSize: 11, fontWeight: '900', marginLeft: 8 },
    weeklyBody: { flexDirection: 'row', justifyContent: 'space-between' },
    weeklyStat: { flex: 1 },
    weeklyLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '700' },
    weeklyValue: { color: '#FFF', fontSize: 18, fontWeight: '900' },
    weeklyUnit: { fontSize: 11, opacity: 0.7 },
    weeklyDivider: { width: 1, height: 25, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 15 },

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

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    graphContainer: { backgroundColor: '#FFF', width: '95%', borderRadius: 24, padding: 20 },
    breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    breakdownTitle: { fontSize: 18, fontWeight: '900', color: '#1B4D20' },
    chartWrapper: { height: 260, backgroundColor: '#F9F9F9', borderRadius: 16, position: 'relative', overflow: 'hidden' },
    chartScrollContent: { paddingHorizontal: 20, alignItems: 'flex-end', paddingBottom: 40 },
    barColumn: { width: 50, alignItems: 'center', marginHorizontal: 8 },
    barBase: { width: 30, borderRadius: 6, minHeight: 5 },
    barValueText: { fontSize: 10, fontWeight: '800', color: '#666' },
    barDateText: { fontSize: 10, color: '#999', marginTop: 8, fontWeight: '700' },
    goalLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#1B4D20', borderStyle: 'dashed', zIndex: 1, opacity: 0.3 },
    goalLineLabel: { position: 'absolute', left: 10, zIndex: 2, backgroundColor: '#1B4D20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    goalLineText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
    graphHint: { textAlign: 'center', fontSize: 11, color: '#999', marginTop: 15, fontStyle: 'italic' },
    modalContainer: { flex: 1, backgroundColor: '#FFF' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    modalTitle: { fontSize: 24, fontWeight: '900', color: '#1B4D20' },
    bottomCloseBtn: { backgroundColor: '#1B4D20', paddingVertical: 15, marginHorizontal: 20, borderRadius: 15, alignItems: 'center', marginBottom: 20 },
    bottomCloseBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
    averagesContainer: {
        flexDirection: 'column',
        marginBottom: 20,
        marginTop: 5,
    },
    avgBoxSmall: {
        flex: 1,
        backgroundColor: '#F8F9FA',
        padding: 15,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avgLabelCenter: {
        fontSize: 9,
        fontWeight: '800',
        color: '#9E9E9E',
        marginBottom: 5,
        textAlign: 'center',
    },
    avgValueCenter: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1B4D20',
    },
    avgUnit: {
        fontSize: 12,
        fontWeight: '400',
        color: '#666',
    },
    comparisonCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: '#EEE',
        elevation: 3,
    },
    comparisonTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1B4D20',
    },
});