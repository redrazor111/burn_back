import { Ionicons } from '@expo/vector-icons';
import {
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GuideScreen() {
  const insets = useSafeAreaInsets();

  const GuideSection = ({ title, data }) => (
    <View style={styles.guideSection}>
      <Text style={styles.guideSectionTitle}>{title}</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Age Range</Text>
        <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Daily Calories</Text>
      </View>
      {data.map((item, index) => (
        <View key={index} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
          <Text style={styles.tableCell}>{item.age}</Text>
          <Text style={[styles.tableCell, { fontWeight: '700', color: '#2E7D32' }]}>{item.cal}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Calorie Guide</Text>
        <Text style={styles.subtitle}>Recommended daily intake for maintenance</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>
        <GuideSection
          title="Women (Moderate Activity)"
          data={[
            { age: "19–30 years", cal: "2,000–2,200" },
            { age: "31–50 years", cal: "2,000" },
            { age: "51+ years", cal: "1,800" },
          ]}
        />
        <GuideSection
          title="Men (Moderate Activity)"
          data={[
            { age: "19–30 years", cal: "2,600–2,800" },
            { age: "31–50 years", cal: "2,400–2,600" },
            { age: "51+ years", cal: "2,200–2,400" },
          ]}
        />
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#757575" />
          <Text style={styles.infoText}>
            Note: These are general estimates. Exact needs vary based on height, current weight, and metabolic health.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBFBFB' },
  header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#757575', marginTop: 4 },
  scrollPadding: { paddingHorizontal: 20, paddingBottom: 30 },
  guideSection: { marginTop: 20, backgroundColor: '#fff', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#F0F0F0' },
  guideSectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  tableHeaderText: { fontSize: 12, fontWeight: '600', color: '#9E9E9E', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 10 },
  tableRowEven: { backgroundColor: '#F9F9F9' },
  tableCell: { flex: 1, fontSize: 14, color: '#424242' },
  infoBox: { flexDirection: 'row', backgroundColor: '#F5F5F5', padding: 12, borderRadius: 10, marginTop: 20, alignItems: 'center' },
  infoText: { flex: 1, fontSize: 12, color: '#757575', marginLeft: 10, lineHeight: 18 }
});