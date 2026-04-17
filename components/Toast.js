import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';

export function useToast() {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  const show = (message, type = 'success') => {
    setToast({ message, type });
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]),
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => setToast(null));
  };

  const config = {
    success: { icon: 'check-circle', containerStyle: styles.success, label: 'SUCCESS' },
    error:   { icon: 'alert-circle', containerStyle: styles.error,   label: 'ERROR'   },
  };

  const ToastComponent = (
    <Modal
      visible={!!toast}
      transparent
      animationType="none"
      statusBarTranslucent        // covers status bar on Android
      presentationStyle="overFullScreen"  // covers everything on iOS
    >
      <View style={styles.overlay} pointerEvents="none">
        <Animated.View style={[styles.container, toast && config[toast.type].containerStyle, { opacity, transform: [{ translateY }] }]}>
          <View style={styles.iconWrapper}>
            <MaterialCommunityIcons name={toast ? config[toast.type].icon : 'check-circle'} size={26} color="#FFFFFF" />
          </View>
          <View style={styles.textWrapper}>
            <Text style={styles.label}>{toast ? config[toast.type].label : ''}</Text>
            <Text style={styles.message}>{toast?.message}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  return { show, ToastComponent };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 70,
    pointerEvents: 'none',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    maxWidth: '88%',
    elevation: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  success: { backgroundColor: '#1B4D20' },
  error:   { backgroundColor: '#C62828' },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrapper: {
    flexShrink: 1,
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.2,
  },
  message: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
});