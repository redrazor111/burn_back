import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function Scanner({ onScan, disabled }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  if (!permission) return <View />;

  const takePicture = async () => {
    if (cameraRef.current && !disabled) {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        imageType: 'jpg'
      });
      onScan(photo.base64);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef}>
        <View style={styles.overlay}>
          {/* Outer Ring */}
          <View style={styles.outerRing}>
            <TouchableOpacity
              disabled={disabled}
              style={[
                styles.captureBtn,
                disabled ? styles.disabledBtn : styles.enabledBtn
              ]}
              onPress={takePicture}
            >
              {disabled && <ActivityIndicator color="white" />}
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '100%', // Match parent exactly
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  camera: {
    height: '100%',
    width: '100%',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 15, // Adjusted for better button clearance
  },
  outerRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  captureBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enabledBtn: {
    backgroundColor: 'white',
  },
  disabledBtn: {
    backgroundColor: '#666',
  },
});