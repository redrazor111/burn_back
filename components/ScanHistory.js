import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { clearAllHistory } from '../utils/historyStorage';
import { useSubscriptionStatus } from '../utils/subscription';
import StatusCard from './StatusCard';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ScanHistory() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [history, setHistory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({});
  const { isPro } = useSubscriptionStatus();

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem('scan_history');
        if (stored) {
          const parsed = JSON.parse(stored);
          const historyData = Array.isArray(parsed) ? parsed : [];
          setHistory(historyData);

          const initialCollapsedState = {};
          historyData.forEach(item => {
            const key = getSafeDateKey(item.date);
            initialCollapsedState[key] = true;
          });
          setCollapsedSections(initialCollapsedState);
        }
      } catch (e) { console.error(e); }
    };
    if (isFocused) load();
  }, [isFocused]);

  const getSafeDateKey = (dateString) => {
    if (!dateString) return "Unknown";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Unknown";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  const groupedData = useMemo(() => {
    const groups = {};
    history.forEach(item => {
      const key = getSafeDateKey(item.date);
      if (!groups[key]) {
        groups[key] = { items: [], totalCalories: 0 };
      }
      groups[key].items.push(item);
      const itemCals = item.analysis?.calories ? Number(item.analysis.calories) : 0;
      groups[key].totalCalories += itemCals;
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
      "Delete All History",
      "This will permanently erase all past records. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            await clearAllHistory();
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
            <Text style={styles.title}>History</Text>
            {history.length > 0 && (
                <TouchableOpacity onPress={handleDeleteAll} style={styles.deleteAllBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FF5252" />
                    <Text style={styles.deleteAllText}>Clear History</Text>
                </TouchableOpacity>
            )}
        </View>
        <Text style={styles.subtitle}>Text-only records for maximum storage</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContentList} showsVerticalScrollIndicator={false}>
        {history.length === 0 ? (
          <View style={styles.placeholderContainer}>
            <MaterialCommunityIcons name="history" size={60} color="#E0E0E0" />
            <Text style={styles.placeholderText}>No scans found yet.</Text>
          </View>
        ) : (
          Object.keys(groupedData).sort((a, b) => b.localeCompare(a)).map((dateKey) => (
            <View key={dateKey} style={styles.sectionContainer}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(dateKey)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderTextGroup}>
                  <Text style={styles.sectionLabel}>{getReadableDate(dateKey).toUpperCase()}</Text>
                  <Text style={styles.sectionTotalCalories}>
                    {groupedData[dateKey].totalCalories} cal
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={collapsedSections[dateKey] ? "chevron-down" : "chevron-up"}
                  size={20}
                  color="#9E9E9E"
                />
              </TouchableOpacity>

              {!collapsedSections[dateKey] && (
                <View style={styles.itemsContainer}>
                  {groupedData[dateKey].items.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.historyCard} onPress={() => setSelectedItem(item)}>
                      <View style={styles.historyIconBg}>
                        <MaterialCommunityIcons name="food-apple" size={26} color="#2E7D32" />
                      </View>
                      <View style={styles.historyDetails}>
                        <Text style={styles.historyTime}>
                          {(() => {
                            const d = new Date(item.date);
                            if (isNaN(d.getTime())) return "00:00 AM";
                            let hours = d.getHours();
                            const minutes = String(d.getMinutes()).padStart(2, '0');
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            hours = hours % 12 || 12;
                            return `${hours}:${minutes} ${ampm}`;
                          })()}
                        </Text>
                        <Text style={styles.historyFoodName}>{item.analysis?.identifiedProduct || "Unknown Item"}</Text>
                        <Text style={styles.itemCalorieSnippet}>{item.analysis?.calories || 0} cal</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color="#CCC" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!selectedItem} animationType="slide">
        {selectedItem && (
          <View style={[styles.modalContent, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <MaterialCommunityIcons name="close" size={28} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Analysis Details</Text>
              <View style={{ width: 28 }} />
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.textDetailHeader}>
                 <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={40} color="#2E7D32" />
                 <Text style={styles.detailProductName}>{selectedItem.analysis?.identifiedProduct}</Text>
                 <Text style={styles.detailCalories}>{selectedItem.analysis?.calories} Total Calories</Text>
              </View>
              <View style={styles.divider} />
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <StatusCard
                  key={num}
                  title={["Running", "Walking", "Weights", "Cycling", "Swimming", "HIIT", "Yoga", "Rowing", "Jump Rope", "Hiking"][num - 1]}
                  data={selectedItem.analysis[`activity${num}`]}
                  icon={["run", "walk", "weight-lifter", "bike", "swim", "lightning-bolt", "yoga", "rowing", "jump-rope", "image-filter-hdr"][num - 1]}
                  isLocked={num > 2 && !isPro}
                  isParentLoading={false}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: '#FBFBFB' },
  header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#757575', marginTop: 4 },
  deleteAllBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  deleteAllText: { color: '#FF5252', fontSize: 11, fontWeight: '800', marginLeft: 4 },
  scrollContentList: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionContainer: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE', marginBottom: 10 },
  sectionHeaderTextGroup: { flexDirection: 'row', alignItems: 'baseline' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9E9E9E', letterSpacing: 1 },
  sectionTotalCalories: { fontSize: 13, fontWeight: '700', color: '#2E7D32', marginLeft: 10 },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5 },
  historyIconBg: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  historyDetails: { flex: 1 },
  historyTime: { fontSize: 11, fontWeight: '700', color: '#BDBDBD' },
  historyFoodName: { fontSize: 16, fontWeight: '800', color: '#212529', marginTop: 1 },
  itemCalorieSnippet: { fontSize: 13, color: '#2E7D32', fontWeight: '700', marginTop: 2 },
  modalContent: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  modalScroll: { padding: 20 },
  textDetailHeader: { alignItems: 'center', paddingVertical: 20 },
  detailProductName: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', marginTop: 10 },
  detailCalories: { fontSize: 18, fontWeight: '700', color: '#2E7D32', marginTop: 5 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 20 },
  placeholderContainer: { alignItems: 'center', marginTop: 100 },
  placeholderText: { color: '#BDBDBD', marginTop: 15, fontSize: 16, fontWeight: '600' }
});