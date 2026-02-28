import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Purchases from 'react-native-purchases';
import { GOOGLE_API_KEY_IN_RC, MAX_ACTIVITIES, MAX_SEARCHES } from '../utils/constants';

export default function PremiumModal({ visible, onClose }) {
  const [packageToBuy, setPackageToBuy] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const isConfigured = await Purchases.isConfigured();
        if (!isConfigured) {
          await Purchases.configure({ apiKey: GOOGLE_API_KEY_IN_RC });
        }

        const offerings = await Purchases.getOfferings();

        if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
          setPackageToBuy(offerings.current.availablePackages[0]);
        } else {
          console.warn("RevenueCat: No current offerings found. Check your Dashboard.");
        }
      } catch (e) {
        if (visible) {
          Alert.alert("Connection Error", "Could not load subscription price. " + e);
        }
      }
    };

    if (visible) loadOfferings();
  }, [visible]);

  const handleUpgrade = async () => {
    if (!packageToBuy) return;

    setIsPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToBuy);

      // Updated to match your specific Entitlement ID
      if (customerInfo.entitlements.active['softywareai Pro'] !== undefined) {
        Alert.alert("Success!", "Premium features unlocked.");
        onClose();
      }
    } catch (e) {
      if (!e.userCancelled) {
        Alert.alert("Purchase Error", e.message);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContent}>

          {/* Close X Button */}
          <TouchableOpacity
            style={styles.absCloseBtn}
            onPress={onClose}
            disabled={isPurchasing}
          >
            <MaterialCommunityIcons name="close" size={24} color="#9E9E9E" />
          </TouchableOpacity>

          <View style={styles.iconBg}>
            <MaterialCommunityIcons name="crown" size={40} color="#FFD700" />
          </View>

          <Text style={styles.title}>Unlock BurnBack Premium</Text>
          <Text style={styles.description}>
            You have reached your <Text style={styles.boldText}>{MAX_SEARCHES}</Text> daily scans or <Text style={styles.boldText}>{MAX_ACTIVITIES}</Text> logging activity. Upgrade to Premium for the following features:
          </Text>

          <View style={styles.featureList}>
            {[
              "Unlimited Scans",
              "Unlimited Activities",
              "Detail Extra Activities"
            ].map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#2E7D32" />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.upgradeBtn, !packageToBuy && { backgroundColor: '#ccc' }]}
            onPress={handleUpgrade}
            disabled={!packageToBuy || isPurchasing}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.upgradeText}>
                {packageToBuy
                  ? `Upgrade for ${packageToBuy.product.priceString}/mo`
                  : "Loading Price..."}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={isPurchasing}>
            <Text style={styles.closeText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 25
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 25,
    alignItems: 'center',
    position: 'relative' // Required for absolute positioning of the X
  },
  absCloseBtn: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
    zIndex: 10
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF9C4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', textAlign: 'center' },
  description: { fontSize: 15, color: '#666', textAlign: 'center', marginVertical: 15, lineHeight: 22 },
  boldText: { fontWeight: '800', color: '#1A1A1A' },
  featureList: { alignSelf: 'stretch', marginBottom: 20 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingLeft: 10 },
  featureText: { fontSize: 14, color: '#444', marginLeft: 10, fontWeight: '500' },
  upgradeBtn: {
    backgroundColor: '#2E7D32',
    width: '100%',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 4
  },
  upgradeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  closeBtn: { marginTop: 20 },
  closeText: { color: '#9E9E9E', fontWeight: '600' }
});