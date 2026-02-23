import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Ingredients({ imageUri }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
      {/* Consistent Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Scanned Food</Text>
        <Text style={styles.subtitle}>Image preview of your current food scan</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContentList}
        showsVerticalScrollIndicator={false}
      >
        {!imageUri ? (
          /* Placeholder at the top when empty */
          <View style={styles.placeholderContainer}>
            <MaterialCommunityIcons name="image-off-outline" size={60} color="#E0E0E0" />
            <Text style={styles.placeholderText}>
              No image scanned yet. Go to the Camera tab to analyze a product.
            </Text>
          </View>
        ) : (
          /* Active Card View */
          <View style={styles.listContainer}>
            <Text style={styles.sectionLabel}>CURRENT SCAN</Text>
            <View style={styles.card}>
              <View style={styles.imageContainer}>
                <Image
                  source={{
                    uri: imageUri?.startsWith('data:image')
                      ? imageUri
                      : `data:image/jpeg;base64,${imageUri}`
                  }}
                  style={styles.image}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.productIconBg}>
                  <MaterialCommunityIcons name="nutrition" size={20} color="#2E7D32" />
                </View>
                <View style={styles.productDetails}>
                  <Text style={styles.productName}>Captured Ingredient Label</Text>
                  <Text style={styles.viewOnAmazon}>High Resolution Analysis</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#FBFBFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  scrollContentList: {
    padding: 20,
    paddingBottom: 40,
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  placeholderText: {
    textAlign: 'center',
    color: '#9E9E9E',
    marginTop: 15,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  listContainer: {
    width: '100%',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1,
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  imageContainer: {
    width: '100%',
    height: 350, // Slightly taller for better label legibility
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
  },
  productIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  viewOnAmazon: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
    marginTop: 2,
  },
});