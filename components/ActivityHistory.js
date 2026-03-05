import { auth, db } from '@/utils/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
    LayoutAnimation,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ActivityHistory() {
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const [history, setHistory] = useState([]);
    const [collapsedSections, setCollapsedSections] = useState({});

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(
            collection(db, 'users', user.uid, 'activities'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const actData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setHistory(actData);

            const initialCollapsedState = {};
            actData.forEach(item => {
                initialCollapsedState[getSafeDateKey(item.date)] = true;
            });
            setCollapsedSections(prev => Object.keys(prev).length === 0 ? initialCollapsedState : prev);

        }, (error) => {
            console.error("Firebase History Load Error:", error);
        });

        return () => unsubscribe();
    }, [isFocused]);

    const getSafeDateKey = (dateString) => {
        if (!dateString) return "Unknown";
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return "Unknown";
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    const groupedData = useMemo(() => {
        const groups = {};
        history.forEach(item => {
            const key = getSafeDateKey(item.date);
            if (!groups[key]) groups[key] = { items: [], totalBurned: 0 };
            groups[key].items.push(item);
            groups[key].totalBurned += (item.caloriesBurned || 0);
        });
        return groups;
    }, [history]);

    const toggleSection = (section) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
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
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    return (
        <View style={styles.fullScreen}>
            <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
                <View style={styles.headerTopRow}>
                    <Text style={styles.title}>Activity History</Text>
                </View>
                <View style={styles.headerAccentBar} />
                <Text style={styles.subtitle}>TRACKS BURNT CALORIES</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContentList} showsVerticalScrollIndicator={false}>
                {history.length === 0 ? (
                    <View style={styles.placeholderContainer}>
                        <MaterialCommunityIcons name="run" size={60} color="#E0E0E0" />
                        <Text style={styles.placeholderText}>No activities logged yet.</Text>
                    </View>
                ) : (
                    Object.keys(groupedData).sort((a, b) => b.localeCompare(a)).map((dateKey) => (
                        <View key={dateKey} style={styles.sectionContainer}>
                            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(dateKey)}>
                                <View style={styles.sectionHeaderTextGroup}>
                                    <Text style={styles.sectionLabel}>{getReadableDate(dateKey).toUpperCase()}</Text>
                                    <Text style={styles.sectionTotalBurned}>{groupedData[dateKey].totalBurned} cal burned</Text>
                                </View>
                                <MaterialCommunityIcons name={collapsedSections[dateKey] ? "chevron-down" : "chevron-up"} size={20} color="#9E9E9E" />
                            </TouchableOpacity>

                            {!collapsedSections[dateKey] && (
                                <View style={styles.itemsContainer}>
                                    {groupedData[dateKey].items.map((item) => (
                                        <View key={item.id} style={styles.historyCard}>
                                            <View style={styles.historyIconBg}>
                                                <MaterialCommunityIcons name={item.icon || "run"} size={26} color="#1B4D20" />
                                            </View>
                                            <View style={styles.historyDetails}>
                                                <Text style={styles.historyTime}>
                                                    {(() => {
                                                        const d = new Date(item.date);
                                                        let h = d.getHours();
                                                        const m = String(d.getMinutes()).padStart(2, '0');
                                                        const ampm = h >= 12 ? 'PM' : 'AM';
                                                        h = h % 12 || 12;
                                                        return `${h}:${m} ${ampm}`;
                                                    })()}
                                                </Text>
                                                <Text style={styles.activityName}>{item.type}</Text>
                                                <Text style={styles.activityMeta}>{item.duration > 0 ? `${item.duration} mins` : 'Auto-Synced'}</Text>
                                            </View>
                                            <View style={styles.burnBadge}>
                                                <Text style={styles.burnText}>-{item.caloriesBurned} cal</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    fullScreen: { flex: 1, backgroundColor: '#FBFBFB' },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: '#fff',
        elevation: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#1B4D20',
        letterSpacing: -1,
    },
    headerAccentBar: {
        width: 45,
        height: 4,
        backgroundColor: '#1B4D20',
        opacity: 0.2,
        borderRadius: 2,
        marginTop: 2,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 12,
        color: '#666',
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    scrollContentList: { paddingHorizontal: 20, paddingBottom: 40 },
    sectionContainer: { marginTop: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    sectionHeaderTextGroup: { flexDirection: 'row', alignItems: 'baseline' },
    sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9E9E9E', letterSpacing: 1 },
    sectionTotalBurned: { fontSize: 13, fontWeight: '700', color: '#1B4D20', marginLeft: 10 },
    historyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#F5F5F5' },
    historyIconBg: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    historyDetails: { flex: 1 },
    historyTime: { fontSize: 10, fontWeight: '700', color: '#BDBDBD' },
    activityName: { fontSize: 16, fontWeight: '800', color: '#212529' },
    activityMeta: { fontSize: 12, color: '#9E9E9E', fontWeight: '700' },
    burnBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    burnText: { color: '#1B4D20', fontWeight: '800', fontSize: 13 },
    placeholderContainer: { alignItems: 'center', marginTop: 100 },
    placeholderText: { color: '#BDBDBD', marginTop: 15, fontSize: 16, fontWeight: '600' }
});