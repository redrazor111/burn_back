import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function StatusCard({ title, data, icon, isParentLoading, isLocked }) {
  const [showSummary, setShowSummary] = useState(false);

  const hasData = !!(data && data.text);
  const isPending = isParentLoading && !hasData;

  useEffect(() => {
    if (!hasData || isLocked) setShowSummary(false);
  }, [hasData, isLocked]);

  const getSummaryText = (jsonString) => {
    try {
      if (!jsonString) return "";
      const parsed = JSON.parse(jsonString);
      return parsed.summary || jsonString;
    } catch { return jsonString; }
  };

  const getStatusText = (jsonString) => {
    if (isLocked) return "Premium Feature"; // Clearer text for locked state
    if (isPending) return "Analyzing...";
    try {
      if (!jsonString) return "Waiting...";
      const parsed = JSON.parse(jsonString);
      return parsed.status || "Pending";
    } catch { return "Pending"; }
  };

  const statusColor = isLocked ? '#9E9E9E' : (data?.status || '#757575');

  return (
    <TouchableOpacity
      activeOpacity={(hasData && !isLocked) ? 0.7 : 1}
      onPress={() => hasData && !isLocked && setShowSummary(!showSummary)}
      style={[
        styles.card,
        styles.shadow,
        isLocked && styles.lockedCard
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, isLocked && { backgroundColor: '#F5F5F5' }]}>
          <MaterialCommunityIcons
            name={icon}
            size={22}
            color={isLocked ? "#9E9E9E" : "#2E7D32"}
          />
        </View>

        <View style={styles.titleColumn}>
          <View style={styles.labelRow}>
            <Text style={styles.cardLabel}>{title}</Text>
            {isLocked && (
              <View style={styles.proBadge}>
                <Text style={styles.proText}>PRO</Text>
              </View>
            )}
          </View>

          <View style={[
            styles.statusPill,
            { backgroundColor: isPending ? '#F5F5F5' : `${statusColor}20` }
          ]}>
            {isPending ? (
              <ActivityIndicator size="small" color="#2E7D32" style={{ marginRight: 6, transform: [{ scale: 0.7 }] }} />
            ) : !isLocked && (
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
            )}

            <Text style={[styles.statusValue, { color: isPending || isLocked ? '#9E9E9E' : statusColor }]}>
              {getStatusText(data?.text)}
            </Text>
          </View>
        </View>

        {/* Dynamic Icon: Show Lock if locked, otherwise Chevron if data exists */}
        {isLocked ? (
          <MaterialCommunityIcons name="lock" size={20} color="#FFD700" />
        ) : hasData && (
          <Ionicons name={showSummary ? "chevron-up" : "chevron-down"} size={20} color="#CCC" />
        )}
      </View>

      {showSummary && !isLocked && (
        <View style={styles.summaryContainer}>
          <Text style={styles.analysisText}>{getSummaryText(data?.text)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  lockedCard: {
    backgroundColor: '#FAFAFA',
    opacity: 0.9,
    borderColor: '#EEEEEE',
  },
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F8E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleColumn: {
    flex: 1
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  proBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 8,
  },
  proText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#000',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '700'
  },
  summaryContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  analysisText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22
  },
});