import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

export default function GuideScreen() {
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBFBFB' },
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
    color: '#1B4D20', // <--- Your primary brand green
    letterSpacing: -1, // Tight tracking looks better with colored titles
  },
  headerAccentBar: {
    width: 45,
    height: 4,
    backgroundColor: '#1B4D20',
    opacity: 0.2, // Making the bar semi-transparent makes the title the star
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