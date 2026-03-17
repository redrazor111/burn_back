import { auth, db } from '@/utils/firebaseConfig'; // Ensure this path is correct
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function GuideScreen() {
  const [weight, setWeight] = useState(70);
  const userId = auth.currentUser?.uid;

  // Fetch weight directly from Firebase
  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, 'users', userId, 'profile', 'data');
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.weight) setWeight(Number(data.weight));
      }
    });
    return () => unsubscribe();
  }, [userId]);

  // Calculations based on the fetched weight
  const minProtein = Math.round(weight * 1.6);
  const maxProtein = Math.round(weight * 2.2);

  const GuideSection = ({ title, data, headerLeft = "Age Range", headerRight = "Daily Calories" }) => (
    <View style={styles.guideSection}>
      <Text style={styles.guideSectionTitle}>{title}</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>{headerLeft}</Text>
        <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>{headerRight}</Text>
      </View>
      {data.map((item, index) => (
        <View key={index} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
          <Text style={[styles.tableCell, { flex: 1.5 }]}>{item.label}</Text>
          <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontWeight: '700', color: '#2E7D32' }]}>{item.value}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>

      {/* PERSONALIZED CALCULATION BOX */}
      <View style={styles.personalBox}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={styles.highlightHeader}>
              <Ionicons name="person" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.personalTitle}>YOUR PERSONAL PROTEIN GOAL</Text>
            </View>
            <Text style={styles.personalText}>
              Based on your weight: <Text style={styles.boldWhite}>{weight}kg</Text>
            </Text>
            <Text style={styles.personalResult}>
              Aim for <Text style={styles.boldWhite}>{minProtein}g – {maxProtein}g</Text> of Protein to build muscle.
            </Text>
          </View>
        </View>

        <View style={styles.divider} />
        <Text style={styles.personalSubText}>
          Standard range for muscle building (1.6g - 2.2g per kg).
        </Text>
      </View>

      {/* HOW TO CALCULATE BOX */}
      <View style={styles.highlightBox}>
        <View style={styles.highlightHeader}>
          <Ionicons name="calculator" size={18} color="#1B4D20" />
          <Text style={styles.highlightTitle}>HOW TO CALCULATE</Text>
        </View>
        <Text style={styles.exampleText}>
          Weight <Text style={styles.boldText}>(kg)</Text> × Factor <Text style={styles.boldText}>(g)</Text> = Daily Target
        </Text>
      </View>

      <GuideSection
        title="Protein Multipliers"
        headerLeft="Your Goal"
        headerRight="g per kg"
        data={[
          { label: "Sedentary / Maintenance", value: "0.8g" },
          { label: "Active / Tone Muscle", value: "1.2g – 1.4g" },
          { label: "Build Muscle / Athlete", value: "1.6g – 2.2g" },
          { label: "Weight Loss (Protect Muscle)", value: "1.8g – 2.0g" },
        ]}
      />

      <GuideSection
        title="General Calorie Guide (Women)"
        data={[
          { label: "19–30 years", value: "2,000–2,200" },
          { label: "31–50 years", value: "2,000" },
          { label: "51+ years", value: "1,800" },
        ]}
      />

      <GuideSection
        title="General Calorie Guide (Men)"
        data={[
          { label: "19–30 years", value: "2,600–2,800" },
          { label: "31–50 years", value: "2,400–2,600" },
          { label: "51+ years", value: "2,200–2,400" },
        ]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollPadding: { paddingHorizontal: 20, paddingBottom: 30 },
  personalBox: {
    backgroundColor: '#1B4D20',
    padding: 18,
    borderRadius: 20,
    marginTop: 20,
    elevation: 4,
  },
  highlightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  personalTitle: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.6)', marginLeft: 6, letterSpacing: 1 },
  personalText: { fontSize: 14, color: '#FFF', marginTop: 5, opacity: 0.9 },
  personalResult: { fontSize: 20, color: '#FFF', fontWeight: '400', marginTop: 2 },
  personalSubText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' },
  boldWhite: { fontWeight: '900', color: '#FFF' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 },
  updateBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  updateBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  highlightBox: { backgroundColor: '#E8F5E9', padding: 14, borderRadius: 15, marginTop: 15, borderWidth: 1, borderColor: '#C8E6C9' },
  highlightTitle: { fontSize: 11, fontWeight: '900', color: '#1B4D20', marginLeft: 8 },
  exampleText: { fontSize: 14, color: '#1B4D20', marginTop: 6 },
  boldText: { fontWeight: '900' },
  guideSection: { marginTop: 20, backgroundColor: '#fff', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#F0F0F0' },
  guideSectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  tableHeaderText: { fontSize: 10, fontWeight: '600', color: '#9E9E9E', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, alignItems: 'center' },
  tableRowEven: { backgroundColor: '#F9F9F9' },
  tableCell: { fontSize: 14, color: '#424242' },
});