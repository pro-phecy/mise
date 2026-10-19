import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResponsiveIonicons as Ionicons, ResponsiveText as Text, ResponsiveTextInput as TextInput } from './ResponsiveUI';
import { colors, radius } from '../theme';
import type { ProfilePreferences } from '../types';

type Props = {
  visible: boolean;
  required?: boolean;
  configured: boolean;
  userEmail?: string;
  preferences: ProfilePreferences;
  passwordRecovery: boolean;
  onClose: () => void;
  onSubmit: (mode: 'sign-in' | 'sign-up', email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onSetNewPassword: (password: string) => Promise<void>;
  onSavePreferences: (preferences: ProfilePreferences) => Promise<void>;
  onDeleteAccount: () => void;
  onSignOut: () => Promise<void>;
  onOpenHousehold: () => void;
};

const dietOptions = ['Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free', 'Keto', 'Paleo'];
const timeOptions: Array<number | null> = [null, 20, 30, 45, 60];
const equipmentOptions = ['Stovetop', 'Oven', 'Microwave', 'Blender', 'Air fryer', 'Instant Pot', 'Slow cooker', 'Rice cooker'];
const macroFields = [
  { key: 'calories', label: 'KCAL MAX', placeholder: 'e.g. 650' },
  { key: 'proteinGrams', label: 'PROTEIN MIN (G)', placeholder: 'e.g. 30' },
  { key: 'carbsGrams', label: 'CARBS MAX (G)', placeholder: 'e.g. 60' },
  { key: 'fatGrams', label: 'FAT MAX (G)', placeholder: 'e.g. 25' },
] as const;

const privacyPolicyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim();
const accountDeletionUrl = process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL?.trim();
const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim();

function LegalLinks() {
  const links = [
    privacyPolicyUrl ? { label: 'Privacy policy', url: privacyPolicyUrl } : null,
    accountDeletionUrl ? { label: 'Account deletion', url: accountDeletionUrl } : null,
    supportEmail ? { label: 'Contact support', url: `mailto:${supportEmail}` } : null,
  ].filter((link): link is { label: string; url: string } => Boolean(link));

  if (!links.length) return null;
  return (
    <View style={styles.legalLinks}>
      {links.map((link) => <Pressable key={link.label} accessibilityRole="link" onPress={() => {
        void Linking.openURL(link.url).catch(() => Alert.alert('Could not open link', 'Check the link or contact support from your browser.'));
      }}><Text style={styles.legalLink}>{link.label}</Text></Pressable>)}
    </View>
  );
}

export function AuthSheet({ visible, required = false, configured, userEmail, preferences, passwordRecovery, onClose, onSubmit, onResetPassword, onSetNewPassword, onSavePreferences, onDeleteAccount, onSignOut, onOpenHousehold }: Props) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileDraft, setProfileDraft] = useState(preferences);
  const [allergyDraft, setAllergyDraft] = useState(preferences.allergies.join(', '));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const signedIn = Boolean(userEmail);

  useEffect(() => { setProfileDraft(preferences); setAllergyDraft(preferences.allergies.join(', ')); }, [preferences]);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert('A quick check', 'Add your email and a password with at least 6 characters.');
      return;
    }
    setLoading(true);
    try { await onSubmit(mode, email.trim(), password); } finally { setLoading(false); }
  };

  const signOut = async () => { setLoading(true); try { await onSignOut(); } finally { setLoading(false); } };
  const resetPassword = async () => {
    if (!email.trim()) { Alert.alert('Add your email', 'Enter the email address for your account first.'); return; }
    setLoading(true); try { await onResetPassword(email.trim()); } finally { setLoading(false); }
  };
  const savePreferences = async () => {
    const allergies = allergyDraft.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
    setLoading(true);
    try { await onSavePreferences({ ...profileDraft, allergies }); } finally { setLoading(false); }
  };
  const submitNewPassword = async () => {
    if (newPassword.length < 8) { Alert.alert('Choose a stronger password', 'Use at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Passwords don’t match', 'Check both password fields and try again.'); return; }
    setLoading(true); try { await onSetNewPassword(newPassword); } finally { setLoading(false); }
  };
  const toggleDiet = (item: string) => setProfileDraft((current) => ({
    ...current,
    dietaryPreferences: current.dietaryPreferences.includes(item)
      ? current.dietaryPreferences.filter((entry) => entry !== item)
      : [...current.dietaryPreferences, item],
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={required ? () => {} : onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {!required && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close account sheet" />}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            {!required && <View style={styles.grabber} />}
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.topRow}>
                <View><Text style={styles.title}>{signedIn ? 'Your account' : required ? 'Welcome to mise' : 'Your account'}</Text></View>
                {!required && <Pressable onPress={onClose} style={styles.close}><Ionicons name="close" size={19} color={colors.ink} /></Pressable>}
              </View>

              {signedIn && passwordRecovery ? (
                <View style={styles.recoveryForm}>
                  <Text style={styles.subtitle}>Choose a new password for your mise account.</Text>
                  <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
                  <View style={styles.field}><Ionicons name="lock-closed-outline" size={17} color="#909589" /><TextInput value={newPassword} onChangeText={setNewPassword} placeholder="At least 8 characters" placeholderTextColor="#A6A99F" secureTextEntry autoComplete="new-password" style={styles.input} /></View>
                  <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                  <View style={styles.field}><Ionicons name="lock-closed-outline" size={17} color="#909589" /><TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Enter it again" placeholderTextColor="#A6A99F" secureTextEntry autoComplete="new-password" style={styles.input} /></View>
                  <Pressable onPress={submitNewPassword} disabled={loading} style={[styles.submit, loading && styles.submitDisabled]}><Text style={styles.submitText}>{loading ? 'Updating…' : 'Update password'}</Text><Ionicons name="arrow-forward" size={18} color={colors.ink} /></Pressable>
                </View>
              ) : signedIn ? (
                <View style={styles.signedInCard}>
                  <View style={styles.avatar}><Ionicons name="person" size={22} color={colors.oliveDeep} /></View>
                  <Text style={styles.signedEmail}>{userEmail}</Text>
                  <Text style={styles.signedCopy}>Pantry and recipes sync across your devices.</Text>
                  <Pressable onPress={onOpenHousehold} style={styles.householdButton}><Ionicons name="people-outline" size={16} color={colors.oliveDeep} /><Text style={styles.householdButtonText}>Manage household kitchen</Text><Ionicons name="chevron-forward" size={14} color={colors.oliveDeep} /></Pressable>
                  <View style={styles.preferencePanel}>
                    <Text style={styles.preferenceHeading}>How you like to cook</Text>
                    <Text style={styles.preferenceLabel}>DIETARY STYLE</Text>
                    <View style={styles.chipWrap}>{dietOptions.map((item) => {
                      const active = profileDraft.dietaryPreferences.includes(item);
                      return <Pressable key={item} onPress={() => toggleDiet(item)} style={[styles.preferenceChip, active && styles.preferenceChipActive]}><Text style={[styles.preferenceChipText, active && styles.preferenceChipTextActive]}>{item}</Text></Pressable>;
                    })}</View>
                    <Text style={styles.preferenceLabel}>ALLERGIES TO AVOID</Text>
                    <TextInput value={allergyDraft} onChangeText={setAllergyDraft} placeholder="e.g. peanuts, sesame" placeholderTextColor="#A6A99F" style={styles.preferenceInput} />
                    <Text style={styles.preferenceHelp}>Separate items with commas. Suggestions can miss hidden allergens, so check labels and ingredients before cooking.</Text>
                    <Text style={styles.preferenceLabel}>DEFAULT SERVINGS</Text>
                    <View style={styles.stepper}><Pressable onPress={() => setProfileDraft((current) => ({ ...current, defaultServings: Math.max(1, current.defaultServings - 1) }))} style={styles.stepButton}><Ionicons name="remove" size={16} color={colors.ink} /></Pressable><Text style={styles.stepValue}>{profileDraft.defaultServings}</Text><Pressable onPress={() => setProfileDraft((current) => ({ ...current, defaultServings: Math.min(8, current.defaultServings + 1) }))} style={styles.stepButton}><Ionicons name="add" size={16} color={colors.ink} /></Pressable></View>
                    <Text style={styles.preferenceLabel}>COOKING TIME</Text>
                    <View style={styles.chipWrap}>{timeOptions.map((minutes) => {
                      const active = profileDraft.maxCookMinutes === minutes;
                      return <Pressable key={minutes ?? 'any'} onPress={() => setProfileDraft((current) => ({ ...current, maxCookMinutes: minutes }))} style={[styles.preferenceChip, active && styles.preferenceChipActive]}><Text style={[styles.preferenceChipText, active && styles.preferenceChipTextActive]}>{minutes ? `${minutes} min` : 'Any'}</Text></Pressable>;
                    })}</View>
                    <Text style={styles.preferenceLabel}>INSTRUCTION DETAIL</Text>
                    <View style={styles.chipWrap}>{(['beginner', 'comfortable', 'advanced'] as const).map((level) => <Pressable key={level} onPress={() => setProfileDraft((current) => ({ ...current, skillLevel: level }))} style={[styles.preferenceChip, profileDraft.skillLevel === level && styles.preferenceChipActive]}><Text style={[styles.preferenceChipText, profileDraft.skillLevel === level && styles.preferenceChipTextActive]}>{level === 'comfortable' ? 'Comfortable' : level[0].toUpperCase() + level.slice(1)}</Text></Pressable>)}</View>
                    <Text style={styles.preferenceLabel}>HOW OFTEN DO YOU WANT TO COOK?</Text>
                    <View style={styles.stepper}><Pressable onPress={() => setProfileDraft((current) => ({ ...current, cookingDaysPerWeek: Math.max(1, current.cookingDaysPerWeek - 1) }))} style={styles.stepButton}><Ionicons name="remove" size={16} color={colors.ink} /></Pressable><Text style={[styles.stepValue, { minWidth: 86 }]}>{profileDraft.cookingDaysPerWeek} days / week</Text><Pressable onPress={() => setProfileDraft((current) => ({ ...current, cookingDaysPerWeek: Math.min(7, current.cookingDaysPerWeek + 1) }))} style={styles.stepButton}><Ionicons name="add" size={16} color={colors.ink} /></Pressable></View>
                    <Text style={styles.preferenceLabel}>PER-SERVING NUTRITION LIMITS</Text>
                    <Text style={styles.preferenceHelp}>AI nutrition is approximate. Calories and carbs/fat are maximums; protein is a minimum.</Text>
                    <View style={styles.macroGrid}>{macroFields.map((field) => <View key={field.key} style={styles.macroCell}>
                      <Text style={styles.macroLabel}>{field.label}</Text>
                      <TextInput value={profileDraft.macroTargets[field.key] === null ? '' : String(profileDraft.macroTargets[field.key])} onChangeText={(value) => setProfileDraft((current) => ({ ...current, macroTargets: { ...current.macroTargets, [field.key]: value.trim() ? Math.max(1, Math.min(field.key === 'calories' ? 10000 : 1000, Number(value.replace(/[^0-9]/g, '')) || 1)) : null } }))} placeholder={field.placeholder} placeholderTextColor="#A6A99F" keyboardType="number-pad" style={styles.macroInput} />
                    </View>)}</View>
                    <Text style={styles.preferenceLabel}>BUDGET</Text>
                    <View style={styles.chipWrap}>{(['budget', 'balanced', 'treat'] as const).map((level) => <Pressable key={level} onPress={() => setProfileDraft((current) => ({ ...current, budgetLevel: level }))} style={[styles.preferenceChip, profileDraft.budgetLevel === level && styles.preferenceChipActive]}><Text style={[styles.preferenceChipText, profileDraft.budgetLevel === level && styles.preferenceChipTextActive]}>{level === 'treat' ? 'Special occasion' : level === 'budget' ? 'Keep it low' : 'Balanced'}</Text></Pressable>)}</View>
                    <Text style={styles.preferenceLabel}>EQUIPMENT YOU HAVE</Text>
                    <View style={styles.chipWrap}>{equipmentOptions.map((item) => {
                      const active = profileDraft.equipment.includes(item);
                      return <Pressable key={item} onPress={() => setProfileDraft((current) => ({ ...current, equipment: active ? current.equipment.filter((entry) => entry !== item) : [...current.equipment, item] }))} style={[styles.preferenceChip, active && styles.preferenceChipActive]}><Text style={[styles.preferenceChipText, active && styles.preferenceChipTextActive]}>{item}</Text></Pressable>;
                    })}</View>
                    <Pressable onPress={savePreferences} disabled={loading} style={[styles.savePreferences, loading && styles.submitDisabled]}><Text style={styles.savePreferencesText}>{loading ? 'Saving…' : 'Save cooking preferences'}</Text></Pressable>
                  </View>
                  <Pressable onPress={signOut} style={styles.signOut}><Text style={styles.signOutText}>{loading ? 'Signing out…' : 'Sign out'}</Text></Pressable>
                  <Pressable onPress={onDeleteAccount} style={styles.deleteAccount}><Text style={styles.deleteAccountText}>Delete account and data</Text></Pressable>
                  <LegalLinks />
                </View>
              ) : (
                <>
                  <Text style={styles.subtitle}>{required ? 'Sign in or create an account to save your pantry and recipes.' : 'Sign in to keep your kitchen in sync.'}</Text>
                  {!configured && <View style={styles.setupNote}><Ionicons name="cloud-offline-outline" size={18} color="#8D7040" /><Text style={styles.setupCopy}>Account access is required. Add your Supabase project URL and publishable key to the app environment, then restart Expo to create an account or sign in.</Text></View>}
                  <View style={styles.modeSwitch}>
                    <Pressable onPress={() => setMode('sign-up')} style={[styles.mode, mode === 'sign-up' && styles.modeActive]}><Text style={[styles.modeText, mode === 'sign-up' && styles.modeTextActive]}>Create account</Text></Pressable>
                    <Pressable onPress={() => setMode('sign-in')} style={[styles.mode, mode === 'sign-in' && styles.modeActive]}><Text style={[styles.modeText, mode === 'sign-in' && styles.modeTextActive]}>Sign in</Text></Pressable>
                  </View>
                  <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                  <View style={styles.field}><Ionicons name="mail-outline" size={17} color="#909589" /><TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#A6A99F" autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={styles.input} /></View>
                  <Text style={styles.fieldLabel}>PASSWORD</Text>
                  <View style={styles.field}><Ionicons name="lock-closed-outline" size={17} color="#909589" /><TextInput value={password} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor="#A6A99F" secureTextEntry autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} style={styles.input} /></View>
                  {mode === 'sign-in' && <Pressable onPress={resetPassword} disabled={!configured || loading} style={styles.resetLink}><Text style={styles.resetLinkText}>Forgot your password?</Text></Pressable>}
                  <Pressable onPress={submit} disabled={!configured || loading} style={[styles.submit, (!configured || loading) && styles.submitDisabled]}>
                    <Text style={styles.submitText}>{loading ? 'Just a moment…' : mode === 'sign-up' ? 'Create my account' : 'Welcome back'}</Text><Ionicons name="arrow-forward" size={18} color={colors.ink} />
                  </Pressable>
                  <Text style={styles.privacy}>Your pantry and recipes are private unless you choose to share items in a household kitchen.</Text>
                  <LegalLinks />
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(23,27,21,0.45)', justifyContent: 'flex-end' },
  keyboard: { maxHeight: '93%' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 29, borderTopRightRadius: 29, paddingHorizontal: 22, paddingTop: 10, overflow: 'hidden' },
  grabber: { height: 4, width: 39, borderRadius: 2, backgroundColor: '#D4D6CC', alignSelf: 'center', marginBottom: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.9 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EAE2', borderRadius: 18 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 10, marginBottom: 17, maxWidth: 290 },
  setupNote: { backgroundColor: '#F6ECCB', borderRadius: 14, padding: 11, flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 14 },
  setupCopy: { color: '#766A4F', fontSize: 10, lineHeight: 15, flex: 1 },
  modeSwitch: { height: 43, borderRadius: 14, padding: 3, backgroundColor: '#E9EAE2', flexDirection: 'row', marginBottom: 18 },
  mode: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  modeActive: { backgroundColor: colors.card, shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  modeText: { fontSize: 10, color: '#898D81', fontWeight: '700' },
  modeTextActive: { color: colors.ink, fontWeight: '800' },
  fieldLabel: { color: '#8A907E', fontSize: 8, letterSpacing: 1.05, fontWeight: '800', marginBottom: 7, marginTop: 3 },
  field: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 13, borderWidth: 1, borderColor: '#ECEBE4', marginBottom: 13 },
  input: { flex: 1, color: colors.ink, fontSize: 12 },
  submit: { height: 53, borderRadius: radius.pill, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12, marginTop: 7 },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  privacy: { color: '#92968A', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 12, marginBottom: 18 },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 15, marginTop: 8, marginBottom: 18 },
  legalLink: { color: colors.oliveDeep, fontSize: 10, fontWeight: '700', textDecorationLine: 'underline' },
  signedInCard: { alignItems: 'center', paddingTop: 25, paddingBottom: 15 },
  recoveryForm: { paddingTop: 8, paddingBottom: 20 },
  avatar: { height: 66, width: 66, borderRadius: 24, backgroundColor: '#E5EAD8', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  signedEmail: { color: colors.oliveDeep, fontSize: 11, fontWeight: '700', marginTop: 5 },
  signedCopy: { color: colors.muted, maxWidth: 260, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 12 },
  householdButton: { alignSelf: 'stretch', minHeight: 43, borderRadius: 13, backgroundColor: '#E9EDDC', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  householdButtonText: { flex: 1, color: colors.oliveDeep, fontSize: 10, fontWeight: '800' },
  signOut: { marginTop: 22, paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: '#E9EAE2' },
  signOutText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  preferencePanel: { width: '100%', marginTop: 20, paddingTop: 17, borderTopWidth: 1, borderTopColor: '#E6E7DD' },
  preferenceHeading: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 15 },
  preferenceLabel: { color: '#8A907E', fontSize: 8, letterSpacing: 1.05, fontWeight: '800', marginTop: 10, marginBottom: 8, alignSelf: 'flex-start' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignSelf: 'stretch' },
  preferenceChip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F0F1E9', borderWidth: 1, borderColor: '#E6E7DD' },
  preferenceChipActive: { backgroundColor: '#DCE6C4', borderColor: '#D0DDB1' },
  preferenceChipText: { color: '#73796A', fontSize: 9, fontWeight: '700' },
  preferenceChipTextActive: { color: colors.ink, fontWeight: '800' },
  preferenceInput: { width: '100%', minHeight: 42, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 11, fontSize: 10, color: colors.ink, borderWidth: 1, borderColor: '#ECEBE4' },
  preferenceHelp: { color: '#92968A', fontSize: 9, lineHeight: 13, marginTop: 5, alignSelf: 'flex-start' },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignSelf: 'stretch' },
  macroCell: { width: '48%', gap: 5 },
  macroLabel: { color: '#8A907E', fontSize: 7, letterSpacing: 0.8, fontWeight: '800' },
  macroInput: { height: 40, borderRadius: 11, backgroundColor: '#FFFFFF', paddingHorizontal: 10, fontSize: 10, color: colors.ink, borderWidth: 1, borderColor: '#ECEBE4' },
  stepper: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 13 },
  stepButton: { width: 31, height: 31, borderRadius: 11, backgroundColor: '#E9EDDC', alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: colors.ink, fontSize: 13, fontWeight: '800', minWidth: 15, textAlign: 'center' },
  savePreferences: { minHeight: 42, marginTop: 15, borderRadius: radius.pill, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center' },
  savePreferencesText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  deleteAccount: { marginTop: 13, padding: 10 },
  deleteAccountText: { color: '#B34D3C', fontSize: 10, fontWeight: '800' },
  resetLink: { alignSelf: 'flex-end', paddingVertical: 4, marginTop: -8, marginBottom: 6 },
  resetLinkText: { color: colors.oliveDeep, fontSize: 10, fontWeight: '800' },
});
