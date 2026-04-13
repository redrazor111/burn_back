
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Purchases from 'react-native-purchases';
import { GOOGLE_API_KEY_IN_RC } from '../utils/constants';

export default function PremiumModal({ visible, onClose }) {
  const [packageToBuy, setPackageToBuy] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false); // New state for restore

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
      if (customerInfo.entitlements.active['softywareai Pro'] !== undefined) {
        Alert.alert("Success!", "Your trial has started and Premium features are unlocked.");
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

  // RESTORE PURCHASES LOGIC
  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active['softywareai Pro'] !== undefined) {
        Alert.alert("Success!", "Your subscription has been restored.");
        onClose();
      } else {
        Alert.alert("No Subscription Found", "We couldn't find an active subscription for this account.");
      }
    } catch (e) {
      Alert.alert("Restore Error", e.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const hasFreeTrial =
    !!packageToBuy?.product?.introPrice ||
    packageToBuy?.product?.subscriptionOptions?.some(opt => opt.isFreeTrial) ||
    false;

  const displayPrice = packageToBuy?.product?.priceString || "Price Unavailable";

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={styles.absCloseBtn}
            onPress={onClose}
            disabled={isPurchasing || isRestoring}
          >
            <MaterialCommunityIcons name="close" size={24} color="#9E9E9E" />
          </TouchableOpacity>

          <View style={styles.iconBg}>
            <MaterialCommunityIcons name="crown" size={40} color="#FFD700" />
          </View>

          <Text style={styles.title}>BurnBack Premium</Text>

          {hasFreeTrial && (
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>7 DAYS FREE</Text>
            </View>
          )}

          <Text style={styles.description}>
            Upgrade to unlock unlimited AI power and professional health features.
          </Text>

          <View style={styles.featureList}>
            {[
              "Unlimited AI Meal Scans",
              "Unlimited AI Text Descriptions",
              "AI Health Plan",
              "Full Graphical Trend Analysis",
              "Sync with Google Fit & Samsung Health"
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
            disabled={!packageToBuy || isPurchasing || isRestoring}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.upgradeText}>
                  {hasFreeTrial ? "Start 7-Day Free Trial" : `Upgrade for ${displayPrice}/mo`}
                </Text>
                {hasFreeTrial && (
                  <Text style={styles.subPriceText}>Then only {displayPrice}/mo</Text>
                )}
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.legalText}>
            Recurring billing. Cancel anytime in Google Play settings at least 24h before trial ends.
          </Text>

          <View style={styles.footerActions}>
            <TouchableOpacity
              onPress={handleRestore}
              disabled={isRestoring || isPurchasing}
              style={styles.footerBtn}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color="#9E9E9E" />
              ) : (
                <Text style={styles.footerBtnText}>Restore Purchases</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerDivider} />

            <TouchableOpacity style={styles.footerBtn} onPress={onClose}>
              <Text style={styles.footerBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 25 },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 25, alignItems: 'center', position: 'relative' },
  absCloseBtn: { position: 'absolute', top: 15, right: 15, padding: 5, zIndex: 10 },
  iconBg: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF9C4', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', textAlign: 'center' },
  trialBadge: { backgroundColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginTop: 8 },
  trialBadgeText: { fontSize: 12, fontWeight: '900', color: '#1B4D20' },
  description: { fontSize: 14, color: '#666', textAlign: 'center', marginVertical: 15, lineHeight: 20, paddingHorizontal: 10 },
  featureList: { alignSelf: 'stretch', marginBottom: 25 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: 5 },
  featureText: { fontSize: 14, color: '#333', marginLeft: 10, fontWeight: '600' },
  upgradeBtn: { backgroundColor: '#1B4D20', width: '100%', paddingVertical: 16, borderRadius: 15, alignItems: 'center', elevation: 4 },
  upgradeText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  subPriceText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  legalText: { fontSize: 9, color: '#BBB', textAlign: 'center', marginTop: 15, paddingHorizontal: 10, lineHeight: 14 },
  footerActions: { flexDirection: 'row', alignItems: 'center', marginTop: 25, justifyContent: 'center', width: '100%' },
  footerBtn: { paddingHorizontal: 15, paddingVertical: 5 },
  footerBtnText: { color: '#9E9E9E', fontWeight: '700', fontSize: 12 },
  footerDivider: { width: 1, height: 12, backgroundColor: '#EEE' }
});