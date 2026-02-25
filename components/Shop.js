import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import React, { useState } from 'react'; // Added useState
import { Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'; // Added TextInput
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [searchTerm, setSearchTerm] = useState(''); // State for the search box

  const locales = Localization.getLocales();
  const countryCode = locales[0]?.regionCode || 'US';
  const config = AMAZON_CONFIG[countryCode] || AMAZON_CONFIG.US;
  const domain = config.domain;
  const trackingId = config.tag;

  const webUri = `https://www.${domain}/?tag=${trackingId}`;

  const handleOpenAmazonSearch = async (productName) => {
    const path = searchTerm.trim()
      ? `s?k=${encodeURIComponent(searchTerm.trim())}&tag=${trackingId}`
      : `?tag=${trackingId}`;
    const affiliateUrl =
      `https://www.${domain}/${path}`;

    try {
      await Linking.openURL(affiliateUrl);
      // eslint-disable-next-line no-unused-vars
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
            name="magnify-expand"
            size={64}
            color="#E0E0E0"
          />

          <Text style={styles.placeholderText}>Search for items to "Burn Back" on Amazon.</Text>

          {/* Search Input Field */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. Protein Powder, Running Shoes"
              placeholderTextColor="#9E9E9E"
              value={searchTerm}
              onChangeText={setSearchTerm}
              returnKeyType="search"
              onSubmitEditing={handleOpenAmazonSearch}
            />
          </View>

          <TouchableOpacity style={styles.amazonButton} onPress={handleOpenAmazonSearch}>
            <MaterialCommunityIcons name="magnify" size={20} color="#000" />
            <Text style={styles.amazonButtonText}>
              {searchTerm.trim() ? `Search "${searchTerm}"` : `Shop Amazon ${countryCode}`}
            </Text>
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
  placeholderContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  placeholderText: { textAlign: 'center', color: '#9E9E9E', marginTop: 15, marginBottom: 20, fontSize: 15, paddingHorizontal: 20 },

  // New Search Styles
  searchContainer: { width: '100%', marginBottom: 20, paddingHorizontal: 10 },
  searchInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  amazonButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF9900', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 },
  amazonButtonText: { color: '#000', fontWeight: '700', fontSize: 16, marginLeft: 8 },
  footer: { paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#EEEEEE', backgroundColor: '#fff', paddingTop: 10 },
  disclosureText: { fontSize: 11, color: '#9E9E9E', textAlign: 'center', fontStyle: 'italic' }
});