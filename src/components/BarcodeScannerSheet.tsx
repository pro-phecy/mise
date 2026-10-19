import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResponsiveText as Text } from './ResponsiveUI';

export function BarcodeScannerSheet({ visible, onClose, onScanned }: {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);
  useEffect(() => { if (visible) handled.current = false; }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        {permission?.granted ? <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
          onBarcodeScanned={({ data }) => { if (!handled.current) { handled.current = true; onScanned(data); } }}
        /> : <View style={styles.permission}>
          <Text style={styles.permissionTitle}>{permission ? 'Camera access needed' : 'Starting scanner…'}</Text>
          <Text style={styles.permissionCopy}>Use your camera to scan the barcode on a packaged food.</Text>
          {permission && <Pressable onPress={requestPermission} style={styles.permissionButton}><Text style={styles.permissionButtonText}>Allow camera</Text></Pressable>}
        </View>}
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topRow}><Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>Close</Text></Pressable><Text style={styles.label}>SCAN A PRODUCT</Text><View style={{ width: 60 }} /></View>
          <View style={styles.frame}><View style={styles.cornerTL} /><View style={styles.cornerTR} /><View style={styles.cornerBL} /><View style={styles.cornerBR} /></View>
          <Text style={styles.hint}>Line up the barcode inside the frame</Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#141811' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F6F5EF' },
  permissionTitle: { color: '#263025', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  permissionCopy: { color: '#73796A', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, maxWidth: 260 },
  permissionButton: { backgroundColor: '#DCE6C4', borderRadius: 22, paddingHorizontal: 20, paddingVertical: 12, marginTop: 18 },
  permissionButtonText: { color: '#263025', fontSize: 11, fontWeight: '800' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 15 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { width: 60, paddingVertical: 9, borderRadius: 18, backgroundColor: 'rgba(20,24,17,0.65)', alignItems: 'center' },
  closeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  label: { color: '#FFFFFF', fontSize: 9, letterSpacing: 1.3, fontWeight: '800' },
  frame: { alignSelf: 'center', width: '88%', height: 200, marginTop: 90, marginBottom: 90 },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 35, height: 35, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#DCE6C4', borderTopLeftRadius: 12 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 35, height: 35, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#DCE6C4', borderTopRightRadius: 12 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 35, height: 35, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#DCE6C4', borderBottomLeftRadius: 12 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 35, height: 35, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#DCE6C4', borderBottomRightRadius: 12 },
  hint: { color: '#FFFFFF', textAlign: 'center', fontSize: 11, fontWeight: '700', marginBottom: 32 },
});
