import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResponsiveIonicons as Ionicons, ResponsiveText as Text, ResponsiveTextInput as TextInput } from './ResponsiveUI';
import type { Household } from '../types';
import { colors, radius } from '../theme';

export function HouseholdSheet({ visible, household, busy, onClose, onCreate, onJoin, onLeave, onShareCurrentItems }: {
  visible: boolean;
  household: Household | null;
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onJoin: (inviteCode: string) => Promise<void>;
  onLeave: () => Promise<void>;
  onShareCurrentItems: () => Promise<void>;
}) {
  const [name, setName] = useState('Our kitchen');
  const [inviteCode, setInviteCode] = useState('');
  const shareInvite = async () => {
    if (!household) return;
    await Share.share({ message: `Join “${household.name}” on mise with this invite code: ${household.inviteCode}` });
  };
  const confirmLeave = () => Alert.alert('Leave this kitchen?', 'Shared pantry items and shopping list entries will no longer appear for you.', [
    { text: 'Stay', style: 'cancel' },
    { text: household?.memberCount === 1 ? 'Close household' : 'Leave household', style: 'destructive', onPress: () => { void onLeave(); } },
  ]);
  const confirmShareCurrent = () => Alert.alert('Share your current pantry and list?', 'This moves your existing personal pantry and shopping-list entries into the shared household. Everyone in it will be able to see them.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Share items', onPress: () => { void onShareCurrentItems(); } },
  ]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close household settings" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.topRow}><Text style={styles.title}>Household kitchen</Text><Pressable onPress={onClose} style={styles.close}><Ionicons name="close" size={19} color={colors.ink} /></Pressable></View>
            {household ? (
              <>
                <View style={styles.houseCard}>
                  <View style={styles.houseIcon}><Ionicons name="people-outline" size={20} color={colors.oliveDeep} /></View>
                  <Text style={styles.houseName}>{household.name}</Text>
                  <Text style={styles.houseMeta}>{household.memberCount} {household.memberCount === 1 ? 'person' : 'people'} share this kitchen</Text>
                  <Text style={styles.codeLabel}>HOUSEHOLD INVITE CODE</Text>
                  <Text selectable style={styles.inviteCode}>{household.inviteCode}</Text>
                  <Pressable onPress={shareInvite} style={styles.shareButton}><Ionicons name="share-outline" size={16} color={colors.ink} /><Text style={styles.primaryText}>Share invite</Text></Pressable>
                </View>
                <View style={styles.note}><Ionicons name="information-circle-outline" size={17} color={colors.oliveDeep} /><Text style={styles.noteText}>New items are shared. You can share existing items below.</Text></View>
                <Pressable onPress={confirmShareCurrent} disabled={busy} style={styles.shareCurrent}><Ionicons name="people-circle-outline" size={16} color={colors.oliveDeep} /><Text style={styles.shareCurrentText}>{busy ? 'Sharing…' : 'Share my existing pantry and list'}</Text></Pressable>
                <Pressable onPress={confirmLeave} disabled={busy} style={styles.leaveButton}><Text style={styles.leaveText}>{busy ? 'Updating…' : household.memberCount === 1 ? 'Close household' : 'Leave household'}</Text></Pressable>
              </>
            ) : (
              <>
                <Text style={styles.subtitle}>Share pantry and shopping items with people you cook with.</Text>
                <Text style={styles.label}>START A HOUSEHOLD</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Household name" placeholderTextColor="#A4A69E" style={styles.input} maxLength={60} />
                <Pressable disabled={busy || !name.trim()} onPress={() => { void onCreate(name.trim()); }} style={[styles.primaryButton, (busy || !name.trim()) && styles.disabled]}><Ionicons name="add-circle-outline" size={17} color={colors.ink} /><Text style={styles.primaryText}>{busy ? 'Setting up…' : 'Create shared kitchen'}</Text></Pressable>
                <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>OR JOIN ONE</Text><View style={styles.dividerLine} /></View>
                <TextInput value={inviteCode} onChangeText={(value) => setInviteCode(value.toUpperCase().replace(/\s/g, ''))} placeholder="Enter invite code" placeholderTextColor="#A4A69E" style={[styles.input, styles.codeInput]} autoCapitalize="characters" autoCorrect={false} maxLength={32} />
                <Pressable disabled={busy || !inviteCode.trim()} onPress={() => { void onJoin(inviteCode.trim()); }} style={[styles.primaryButton, (busy || !inviteCode.trim()) && styles.disabled]}><Ionicons name="enter-outline" size={17} color={colors.ink} /><Text style={styles.primaryText}>{busy ? 'Joining…' : 'Join household'}</Text></Pressable>
                <Text style={styles.privacy}>Only share your invite code with people you want in your kitchen.</Text>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(23,27,21,0.48)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 9, paddingBottom: 8 },
  grabber: { height: 4, width: 39, borderRadius: 2, backgroundColor: '#D4D6CC', alignSelf: 'center', marginBottom: 19 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.8 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EAE2', borderRadius: 18 },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 17, marginBottom: 18 },
  label: { color: '#8A907E', fontSize: 8, letterSpacing: 1.05, fontWeight: '800', marginBottom: 7 },
  input: { height: 45, backgroundColor: colors.card, borderRadius: 13, paddingHorizontal: 12, fontSize: 11, color: colors.ink, borderWidth: 1, borderColor: '#ECEBE4' },
  codeInput: { letterSpacing: 1.5, fontWeight: '800' },
  primaryButton: { height: 47, borderRadius: radius.pill, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 9 },
  disabled: { opacity: 0.55 },
  primaryText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 19 },
  dividerLine: { height: 1, flex: 1, backgroundColor: '#E4E5DC' },
  dividerText: { color: '#92968A', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  privacy: { textAlign: 'center', color: '#92968A', fontSize: 9, lineHeight: 14, marginTop: 13, marginBottom: 17 },
  houseCard: { alignItems: 'center', borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: '#ECEBE4', padding: 20 },
  houseIcon: { width: 47, height: 47, borderRadius: 17, backgroundColor: '#E9EDDC', alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  houseName: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  houseMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  codeLabel: { color: '#8A907E', fontSize: 8, fontWeight: '800', letterSpacing: 1.1, marginTop: 22 },
  inviteCode: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: 2.5, marginTop: 5 },
  shareButton: { width: '100%', height: 44, borderRadius: radius.pill, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#E9EDDC' },
  noteText: { color: '#68715A', flex: 1, fontSize: 9, lineHeight: 14 },
  shareCurrent: { minHeight: 43, borderRadius: 13, backgroundColor: '#E9EDDC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 9 },
  shareCurrentText: { color: colors.oliveDeep, fontSize: 9, fontWeight: '800' },
  leaveButton: { alignSelf: 'center', padding: 12, marginTop: 7 },
  leaveText: { color: '#B34D3C', fontSize: 10, fontWeight: '800' },
});
