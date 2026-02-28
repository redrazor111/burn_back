 
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
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

const ACTIVITY_HISTORY_KEY = 'activity_history';

export default function ActivityHistory() {
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const [history, setHistory] = useState([]);
    const [collapsedSections, setCollapsedSections] = useState({});

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const actStored = await AsyncStorage.getItem(ACTIVITY_HISTORY_KEY);
                const actData = actStored ? JSON.parse(actStored) : [];

                setHistory(actData);

                // Default sections to collapsed
                const initialCollapsedState = {};
                actData.forEach(item => {
                    initialCollapsedState[getSafeDateKey(item.date)] = true;
                });
                setCollapsedSections(initialCollapsedState);
            } catch (e) { console.error(e); }
        };
        if (isFocused) loadHistory();
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

    const handleDeleteAll = () => {
        Alert.alert(
            "Clear Activity History",
            "This will permanently erase all past exercise records.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete All",
                    style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.removeItem(ACTIVITY_HISTORY_KEY);
                        setHistory([]);
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View style={styles.headerTopRow}>
                    <Text style={styles.title}>Activity Log</Text>
                    {history.length > 0 && (
                        <TouchableOpacity onPress={handleDeleteAll} style={styles.deleteAllBtn}>
                            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FF5252" />
                            <Text style={styles.deleteAllText}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <Text style={styles.subtitle}>Scientific burn tracking</Text>
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
                                    <Text style={styles.sectionTotalBurn}>{groupedData[dateKey].totalBurned} cal</Text>
                                </View>
                                <MaterialCommunityIcons name={collapsedSections[dateKey] ? "chevron-down" : "chevron-up"} size={20} color="#9E9E9E" />
                            </TouchableOpacity>

                            {!collapsedSections[dateKey] && (
                                <View style={styles.itemsContainer}>
                                    {groupedData[dateKey].items.map((item) => (
                                        <View key={item.id} style={styles.historyCard}>
                                            <View style={[styles.historyIconBg, { backgroundColor: '#E3F2FD' }]}>
                                                <MaterialCommunityIcons name={item.icon || "run"} size={26} color="#1976D2" />
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
                                                <Text style={styles.activityMeta}>{item.duration} mins</Text>
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
    header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A' },
    subtitle: { fontSize: 13, color: '#757575', marginTop: 4 },
    deleteAllBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    deleteAllText: { color: '#FF5252', fontSize: 11, fontWeight: '800', marginLeft: 4 },
    scrollContentList: { paddingHorizontal: 20, paddingBottom: 40 },
    sectionContainer: { marginTop: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    sectionHeaderTextGroup: { flexDirection: 'row', alignItems: 'baseline' },
    sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9E9E9E', letterSpacing: 1 },
    sectionTotalBurn: { fontSize: 13, fontWeight: '700', color: '#1976D2', marginLeft: 10 },
    historyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#F5F5F5' },
    historyIconBg: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    historyDetails: { flex: 1 },
    historyTime: { fontSize: 10, fontWeight: '700', color: '#BDBDBD' },
    activityName: { fontSize: 16, fontWeight: '800', color: '#212529' },
    activityMeta: { fontSize: 12, color: '#9E9E9E', fontWeight: '700' },
    burnBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    burnText: { color: '#2E7D32', fontWeight: '800', fontSize: 13 },
    placeholderContainer: { alignItems: 'center', marginTop: 100 },
    placeholderText: { color: '#BDBDBD', marginTop: 15, fontSize: 16, fontWeight: '600' }
});