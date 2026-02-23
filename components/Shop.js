import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Comprehensive Amazon Global Map
const AMAZON_CONFIG = {
  US: { domain: 'amazon.com', tag: 'softywareai-20' },
  GB: { domain: 'amazon.co.uk', tag: 'softywareai-21' },
  CA: { domain: 'amazon.ca', tag: 'softywareai-20' },
  DE: { domain: 'amazon.de', tag: 'softywareai-21' },
  FR: { domain: 'amazon.fr', tag: 'softywareai-21' },
  ES: { domain: 'amazon.es', tag: 'softywareai-21' },
  IT: { domain: 'amazon.it', tag: 'softywareai-21' },
  IN: { domain: 'amazon.in', tag: 'softywareai-21' },
  JP: { domain: 'amazon.co.jp', tag: 'softywareai-22' },
  AU: { domain: 'amazon.com.au', tag: 'softywareai-22' },
  MX: { domain: 'amazon.com.mx', tag: 'softywareai-20' },
  BR: { domain: 'amazon.com.br', tag: 'softywareai-20' },
  NL: { domain: 'amazon.nl', tag: 'softywareai-21' },
  PL: { domain: 'amazon.pl', tag: 'softywareai-21' },
  SE: { domain: 'amazon.se', tag: 'softywareai-21' },
  TR: { domain: 'amazon.com.tr', tag: 'softywareai-21' },
  SG: { domain: 'amazon.sg', tag: 'softywareai-22' },
  AE: { domain: 'amazon.ae', tag: 'softywareai-21' },
  SA: { domain: 'amazon.sa', tag: 'softywareai-21' },
  BE: { domain: 'amazon.com.be', tag: 'softywareai-21' },
  EG: { domain: 'amazon.eg', tag: 'softywareai-21' },
};

export default function Shop({ recommendedProducts }) {
  const insets = useSafeAreaInsets();

  const locales = Localization.getLocales();
  const countryCode = locales[0]?.regionCode || 'US';
  const config = AMAZON_CONFIG[countryCode] || AMAZON_CONFIG.US;
  const domain = config.domain;
  const trackingId = config.tag;

  const webUri = `https://www.${domain}/?tag=${trackingId}`;

  const handleOpenAmazonHome = async () => {
    const intentUri = `com.amazon.mobile.shopping://www.${domain}/?tag=${trackingId}`;

    try {
      await Linking.openURL(intentUri);
    } catch (error) {
      Linking.openURL(webUri);
    }
  };

  return (
    <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Shop at Amazon</Text>
        <Text style={styles.subtitle}>Sourced from Amazon {countryCode}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContentList} showsVerticalScrollIndicator={false}>
        <View style={styles.placeholderContainer}>
          <MaterialCommunityIcons
            name={recommendedProducts.length > 0 ? "magnify-expand" : "cart-off"}
            size={64}
            color="#E0E0E0"
          />

          <Text style={styles.placeholderText}>Tap to search specifically on Amazon.</Text>

          <TouchableOpacity style={styles.amazonButton} onPress={handleOpenAmazonHome}>
            <MaterialCommunityIcons name="cart" size={20} color="#000" />
            <Text style={styles.amazonButtonText}>Shop at Amazon {countryCode}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <Text style={styles.disclosureText}>
          As an Amazon Associate, I earn from qualifying purchases.
          Support this app by shopping through these links!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: '#FBFBFB' },
  header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#757575', marginTop: 4 },
  scrollContentList: { padding: 20, paddingBottom: 40 },
  placeholderContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  placeholderText: { textAlign: 'center', color: '#9E9E9E', marginTop: 15, marginBottom: 25, fontSize: 15, paddingHorizontal: 20 },
  amazonButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF9900', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 },
  amazonButtonText: { color: '#000', fontWeight: '700', fontSize: 16, marginLeft: 8 },
  footer: { paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#EEEEEE', backgroundColor: '#fff', paddingTop: 10 },
  disclosureText: { fontSize: 11, color: '#9E9E9E', textAlign: 'center', fontStyle: 'italic' }
});