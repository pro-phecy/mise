import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeOut, LinearTransition, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';

type AuthMode = 'sign-in' | 'sign-up';
type Page = 'onboarding' | AuthMode | 'reset-password';

type Props = {
  configured: boolean;
  onSubmit: (mode: AuthMode, email: string, password: string, name?: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
};

const slides = [
  {
    eyebrow: 'COOK WITH WHAT YOU HAVE',
    title: 'A good meal is\nalready in your fridge.',
    copy: 'Tell mise what’s on hand. Get personal recipe ideas that make the most of every ingredient.',
    icon: 'leaf-outline' as const,
    badge: '3 ingredients · 20 min',
  },
  {
    eyebrow: 'MADE FOR YOUR KITCHEN',
    title: 'Your taste. Your tools.\nYour kind of cooking.',
    copy: 'Set your dietary needs, allergies, portions and appliances. Your suggestions adapt around you.',
    icon: 'options-outline' as const,
    badge: 'Just the way you like it',
  },
  {
    eyebrow: 'FROM IDEA TO TABLE',
    title: 'Plan less. Eat\nwell all week.',
    copy: 'Save recipes, map out meals and build a shopping list that brings everything together.',
    icon: 'calendar-clear-outline' as const,
    badge: 'A calmer kind of cooking',
  },
];

function getInitialPage(): Page {
  try {
    return localStorage.getItem('mise.onboardingComplete') === 'true' ? 'sign-in' : 'onboarding';
  } catch {
    return 'onboarding';
  }
}

export function AuthFlow({ configured, onSubmit, onResetPassword }: Props) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>(getInitialPage);
  const [slide, setSlide] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const finishOnboarding = (nextPage: Page = 'sign-up') => {
    try { localStorage.setItem('mise.onboardingComplete', 'true'); } catch { /* onboarding can still continue without local storage */ }
    setPage(nextPage);
  };

  const moveSlide = (direction: 1 | -1) => {
    const nextSlide = slide + direction;
    if (nextSlide < 0 || nextSlide >= slides.length) return;
    setSlideDirection(direction);
    setSlide(nextSlide);
  };

  const endCardSwipe = (pageX: number, pageY: number) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const deltaX = pageX - start.x;
    const deltaY = pageY - start.y;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    moveSlide(deltaX < 0 ? 1 : -1);
  };

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert('Check your email', 'Enter a valid email address to continue.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Choose a stronger password', 'Use at least 8 characters.');
      return;
    }
    if (page === 'sign-up' && password !== confirmPassword) {
      Alert.alert('Passwords don’t match', 'Check both password fields and try again.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(page === 'sign-up' ? 'sign-up' : 'sign-in', cleanEmail, password, name.trim());
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert('Add your email', 'Enter the email address for your account first.');
      return;
    }
    setLoading(true);
    try { await onResetPassword(cleanEmail); } finally { setLoading(false); }
  };

  const currentSlide = slides[slide];
  const usableHeight = Math.max(0, height - insets.top - insets.bottom);
  const compact = usableHeight < 710 || fontScale > 1.3;
  const widthScale = Math.min(1.2, Math.max(0.9, Math.pow(width / 390, 0.32)));
  const horizontalPadding = Math.min(34, Math.max(20, width * 0.06));
  const heroHeight = Math.min(compact ? 278 : 348, Math.max(compact ? 220 : 270, usableHeight * 0.39));
  const plateSize = Math.min(214, Math.max(164, heroHeight * 0.64));
  const plateInset = plateSize * 0.835;
  const foodDotSize = plateInset * 0.13;
  const prominentTitleSize = Math.round(32 * widthScale);
  const supportingTextSize = Math.round(15 * widthScale);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {page === 'onboarding' ? (
          <ScrollView contentContainerStyle={[styles.onboardingContent, { paddingHorizontal: horizontalPadding, paddingTop: Math.max(7, insets.top * 0.025) }]} showsVerticalScrollIndicator={false}>
            <View style={styles.brandRow}>
              <View style={styles.onboardingBrand}><View style={[styles.brandMark, { width: 38 * widthScale, height: 38 * widthScale, borderRadius: 14 * widthScale }]}><Ionicons name="restaurant-outline" size={21 * widthScale} color={colors.oliveDeep} /></View><Text style={[styles.brand, { fontSize: 25 * widthScale }]}>mise</Text></View>
              <Pressable onPress={() => finishOnboarding('sign-in')} hitSlop={10} accessibilityRole="button" style={styles.topSignIn}>
                <Text style={[styles.topSignInText, { fontSize: 13 * widthScale }]}>Sign in</Text>
              </Pressable>
            </View>

            <Animated.View
              key={`onboarding-slide-${slide}`}
              entering={slideDirection > 0 ? SlideInRight.springify().damping(22).stiffness(175) : SlideInLeft.springify().damping(22).stiffness(175)}
              exiting={FadeOut.duration(150)}
              layout={LinearTransition.springify().damping(22)}
              onTouchStart={(event) => { touchStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }; }}
              onTouchEnd={(event) => endCardSwipe(event.nativeEvent.pageX, event.nativeEvent.pageY)}
            >
            <View style={[styles.heroCard, { height: heroHeight, borderRadius: 30 * widthScale }]}>
              <LinearGradient colors={['#293D30', '#3F5840', '#64704B']} style={StyleSheet.absoluteFill} />
              <View style={styles.heroGlow} />
              <View style={styles.heroTopline}>
                <Text style={[styles.heroEyebrow, { fontSize: 10 * widthScale }]}>{currentSlide.eyebrow}</Text>
                <View style={[styles.heroSparkle, { width: 34 * widthScale, height: 34 * widthScale, borderRadius: 13 * widthScale }]}><Ionicons name="sparkles" size={18 * widthScale} color="#E7EFBC" /></View>
              </View>
              <View style={[styles.plateOuter, { width: plateSize, height: plateSize, borderRadius: plateSize / 2 }]}>
                <View style={[styles.plateInner, { width: plateInset, height: plateInset, borderRadius: plateInset / 2, borderWidth: 5 * widthScale }]}>
                  <View style={[styles.foodDot, { width: foodDotSize, height: foodDotSize, borderRadius: foodDotSize * 0.4, top: plateInset * 0.17, left: plateInset * 0.3 }]} />
                  <View style={[styles.foodDot, { width: foodDotSize * 0.8, height: foodDotSize * 1.2, borderRadius: foodDotSize * 0.35, top: plateInset * 0.3, right: plateInset * 0.16, backgroundColor: '#D4A74F', transform: [{ rotate: '-32deg' }] }]} />
                  <View style={[styles.foodDot, { width: foodDotSize * 1.25, height: foodDotSize * 0.75, borderRadius: foodDotSize * 0.35, bottom: plateInset * 0.16, left: plateInset * 0.3, backgroundColor: '#729365', transform: [{ rotate: '-20deg' }] }]} />
                  <View style={[styles.foodDot, { width: foodDotSize * 0.85, height: foodDotSize * 0.85, borderRadius: foodDotSize * 0.3, bottom: plateInset * 0.25, right: plateInset * 0.17, backgroundColor: '#E88C63', transform: [{ rotate: '18deg' }] }]} />
                  <View style={[styles.plateCenter, { width: plateInset * 0.47, height: plateInset * 0.47, borderRadius: plateInset * 0.24 }]}><Ionicons name={currentSlide.icon} size={plateInset * 0.25} color={colors.oliveDeep} /></View>
                </View>
              </View>
              <View style={[styles.floatingIngredient, { top: heroHeight * 0.29, right: 14 * widthScale, paddingVertical: 9 * widthScale, paddingHorizontal: 11 * widthScale }]}><Text style={[styles.ingredientEmoji, { fontSize: 19 * widthScale }]}>🥑</Text><Text style={[styles.ingredientLabel, { fontSize: 10 * widthScale }]}>fresh ideas</Text></View>
              <View style={[styles.floatingNote, { bottom: heroHeight * 0.18, left: 12 * widthScale, minHeight: 40 * widthScale, paddingHorizontal: 11 * widthScale }]}><Ionicons name="checkmark-circle" size={18 * widthScale} color={colors.oliveDeep} /><Text style={[styles.floatingNoteText, { fontSize: 9 * widthScale }]}>{currentSlide.badge}</Text></View>
              <View style={styles.heroFooter}><View style={[styles.heroFooterIcon, { width: 26 * widthScale, height: 26 * widthScale, borderRadius: 9 * widthScale }]}><Ionicons name="heart" size={15 * widthScale} color="#E78B68" /></View><Text style={[styles.heroFooterText, { fontSize: 10 * widthScale }]}>A little help for your everyday kitchen</Text></View>
            </View>

            <View style={styles.slideMeta}>
              <View style={styles.dots}>{slides.map((item, index) => <Animated.View key={item.eyebrow} layout={LinearTransition.springify().damping(20)} style={[styles.dot, { height: 6 * widthScale, width: index === slide ? 24 * widthScale : 6 * widthScale }, index === slide && styles.dotActive]} />)}</View>
              <Text style={[styles.slideCount, { fontSize: 11 * widthScale }]}>0{slide + 1} <Text style={styles.slideCountMuted}>/ 03</Text></Text>
            </View>
            <Text style={[styles.onboardingTitle, { fontSize: prominentTitleSize, lineHeight: prominentTitleSize * 1.16 }]}>{currentSlide.title}</Text>
            <Text style={[styles.onboardingCopy, { fontSize: supportingTextSize, lineHeight: supportingTextSize * 1.5 }]}>{currentSlide.copy}</Text>
            </Animated.View>

            {!configured && <View style={styles.setupNotice}><Ionicons name="cloud-offline-outline" size={20 * widthScale} color="#8D7040" /><Text style={[styles.setupNoticeText, { fontSize: 12 * widthScale, lineHeight: 18 * widthScale }]}>Account access is required. Connect your Supabase project to create an account or sign in.</Text></View>}

            <Pressable
              onPress={() => slide < slides.length - 1 ? moveSlide(1) : finishOnboarding('sign-up')}
              style={[styles.primaryButton, { minHeight: 62 * widthScale, marginTop: compact ? 14 : 21, paddingHorizontal: 22 * widthScale }]}
              accessibilityRole="button"
            >
              <Text style={[styles.primaryButtonText, { fontSize: 15 * widthScale }]}>{slide === slides.length - 1 ? 'Create your account' : 'Continue'}</Text>
              <Ionicons name="arrow-forward" size={21 * widthScale} color={colors.ink} />
            </Pressable>
            {slide > 0 ? (
              <Pressable onPress={() => moveSlide(-1)} style={styles.secondaryAction}><Text style={[styles.secondaryActionText, { fontSize: 12 * widthScale }]}>Go back</Text></Pressable>
            ) : (
              <Text style={[styles.accountHint, { fontSize: 12 * widthScale }]}>Already have an account? <Text onPress={() => finishOnboarding('sign-in')} style={styles.inlineLink}>Sign in</Text></Text>
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={[styles.formContent, { paddingHorizontal: horizontalPadding, paddingTop: Math.max(7, insets.top * 0.025, compact ? 5 : 12) }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.brandRow}>
              <Pressable onPress={() => setPage('onboarding')} style={[styles.backButton, { width: 44 * widthScale, height: 44 * widthScale, borderRadius: 16 * widthScale }]} accessibilityRole="button" accessibilityLabel="Back to welcome">
                <Ionicons name="arrow-back" size={22 * widthScale} color={colors.ink} />
              </Pressable>
              <View style={styles.formBrand}><View style={[styles.brandMark, { width: 36 * widthScale, height: 36 * widthScale, borderRadius: 13 * widthScale }]}><Ionicons name="restaurant-outline" size={20 * widthScale} color={colors.oliveDeep} /></View><Text style={[styles.brand, { fontSize: 24 * widthScale }]}>mise</Text></View>
              <View style={[styles.brandRightSpacer, { width: 44 * widthScale }]} />
            </View>

            <View style={[styles.formIntro, { marginTop: compact ? 16 : 30, marginBottom: compact ? 17 : 27 }]}>
              <View style={[styles.formIcon, { width: 58 * widthScale, height: 58 * widthScale, borderRadius: 20 * widthScale, marginBottom: 17 }]}><Ionicons name={page === 'reset-password' ? 'key-outline' : page === 'sign-up' ? 'leaf-outline' : 'hand-left-outline'} size={26 * widthScale} color={colors.oliveDeep} /></View>
              <Text style={[styles.formEyebrow, { fontSize: 10 * widthScale }]}>{page === 'reset-password' ? 'ACCOUNT RECOVERY' : page === 'sign-up' ? 'LET’S GET COOKING' : 'WELCOME BACK'}</Text>
              <Text style={[styles.formTitle, { fontSize: prominentTitleSize, lineHeight: prominentTitleSize * 1.18 }]}>{page === 'reset-password' ? 'Reset your password' : page === 'sign-up' ? 'Make yourself at home.' : 'Your kitchen is waiting.'}</Text>
              <Text style={[styles.formCopy, { fontSize: supportingTextSize, lineHeight: supportingTextSize * 1.5 }]}>{page === 'reset-password'
                ? 'Enter your account email and we’ll send you a link to choose a new password.'
                : page === 'sign-up'
                  ? 'Create an account to keep your pantry, plans and favorite recipes in sync.'
                  : 'Sign in to pick up where you left off and get something good on the table.'}</Text>
            </View>

            {!configured && <View style={styles.setupNotice}><Ionicons name="cloud-offline-outline" size={20 * widthScale} color="#8D7040" /><Text style={[styles.setupNoticeText, { fontSize: 12 * widthScale, lineHeight: 18 * widthScale }]}>Connect your Supabase project URL and publishable key to enable account access.</Text></View>}

            {page !== 'reset-password' && (
              <View style={[styles.modeSwitch, { height: 54 * widthScale, marginBottom: 24 * widthScale }]}>
                <Pressable onPress={() => setPage('sign-in')} style={[styles.modeOption, page === 'sign-in' && styles.modeOptionActive]}><Text style={[styles.modeOptionText, { fontSize: 13 * widthScale }, page === 'sign-in' && styles.modeOptionTextActive]}>Sign in</Text></Pressable>
                <Pressable onPress={() => setPage('sign-up')} style={[styles.modeOption, page === 'sign-up' && styles.modeOptionActive]}><Text style={[styles.modeOptionText, { fontSize: 13 * widthScale }, page === 'sign-up' && styles.modeOptionTextActive]}>Create account</Text></Pressable>
              </View>
            )}

            {page === 'sign-up' && <>
              <Text style={[styles.fieldLabel, { fontSize: 10 * widthScale }]}>YOUR NAME</Text>
              <View style={[styles.field, { height: 59 * widthScale, borderRadius: 17 * widthScale, paddingHorizontal: 16 * widthScale }]}><Ionicons name="person-outline" size={21 * widthScale} color="#909589" /><TextInput value={name} onChangeText={setName} placeholder="What should we call you?" placeholderTextColor="#A6A99F" autoCapitalize="words" autoComplete="name" returnKeyType="next" style={[styles.input, { fontSize: 16 * widthScale }]} /></View>
            </>}
            <Text style={[styles.fieldLabel, { fontSize: 10 * widthScale }]}>EMAIL ADDRESS</Text>
            <View style={[styles.field, { height: 59 * widthScale, borderRadius: 17 * widthScale, paddingHorizontal: 16 * widthScale }]}><Ionicons name="mail-outline" size={21 * widthScale} color="#909589" /><TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#A6A99F" autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" style={[styles.input, { fontSize: 16 * widthScale }]} /></View>

            {page !== 'reset-password' && <>
              <Text style={[styles.fieldLabel, { fontSize: 10 * widthScale }]}>PASSWORD</Text>
              <View style={[styles.field, { height: 59 * widthScale, borderRadius: 17 * widthScale, paddingHorizontal: 16 * widthScale }]}><Ionicons name="lock-closed-outline" size={21 * widthScale} color="#909589" /><TextInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#A6A99F" secureTextEntry={!showPassword} autoComplete={page === 'sign-up' ? 'new-password' : 'current-password'} textContentType={page === 'sign-up' ? 'newPassword' : 'password'} returnKeyType={page === 'sign-up' ? 'next' : 'go'} onSubmitEditing={page === 'sign-in' ? submit : undefined} style={[styles.input, { fontSize: 16 * widthScale }]} /><Pressable onPress={() => setShowPassword((visible) => !visible)} hitSlop={10} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21 * widthScale} color="#909589" /></Pressable></View>
            </>}

            {page === 'sign-up' && <>
              <Text style={[styles.fieldLabel, { fontSize: 10 * widthScale }]}>CONFIRM PASSWORD</Text>
              <View style={[styles.field, { height: 59 * widthScale, borderRadius: 17 * widthScale, paddingHorizontal: 16 * widthScale }]}><Ionicons name="lock-closed-outline" size={21 * widthScale} color="#909589" /><TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Enter it again" placeholderTextColor="#A6A99F" secureTextEntry={!showPassword} autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={submit} style={[styles.input, { fontSize: 16 * widthScale }]} /></View>
            </>}

            {page === 'sign-in' && <Pressable onPress={() => setPage('reset-password')} style={styles.forgotButton} accessibilityRole="button"><Text style={[styles.forgotText, { fontSize: 12 * widthScale }]}>Forgot password?</Text></Pressable>}

            <Pressable
              onPress={page === 'reset-password' ? sendReset : submit}
              disabled={!configured || loading}
              style={[styles.primaryButton, styles.formSubmit, { minHeight: 62 * widthScale, paddingHorizontal: 22 * widthScale, marginTop: compact ? 8 : 14 }, (!configured || loading) && styles.buttonDisabled]}
              accessibilityRole="button"
            >
              <Text style={[styles.primaryButtonText, { fontSize: 15 * widthScale }]}>{loading ? 'Just a moment…' : page === 'reset-password' ? 'Send reset link' : page === 'sign-up' ? 'Create my account' : 'Sign in to mise'}</Text>
              <Ionicons name={page === 'reset-password' ? 'mail-outline' : 'arrow-forward'} size={21 * widthScale} color={colors.ink} />
            </Pressable>

            <Text style={[styles.privacyCopy, { fontSize: 11 * widthScale, lineHeight: 17 * widthScale }]}>{page === 'sign-up' ? 'By creating an account, your pantry and recipes stay private unless you choose to share items in a household kitchen.' : 'Your kitchen data is private and synced securely to your account.'}</Text>
            <View style={[styles.formBottomLink, { marginTop: compact ? 16 : 28 }]}>
              {page === 'reset-password' ? <Text style={[styles.bottomHint, { fontSize: 12 * widthScale }]}>Remembered it? <Text onPress={() => setPage('sign-in')} style={styles.inlineLink}>Back to sign in</Text></Text>
                : page === 'sign-up' ? <Text style={[styles.bottomHint, { fontSize: 12 * widthScale }]}>Already at the table? <Text onPress={() => setPage('sign-in')} style={styles.inlineLink}>Sign in</Text></Text>
                  : <Text style={[styles.bottomHint, { fontSize: 12 * widthScale }]}>New to mise? <Text onPress={() => setPage('sign-up')} style={styles.inlineLink}>Create an account</Text></Text>}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  keyboard: { flex: 1 },
  onboardingContent: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 23, paddingTop: 7, paddingBottom: 24 },
  brandRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 },
  onboardingBrand: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4EAD2' },
  brand: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -1.1, marginLeft: 9 },
  topSignIn: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 17, borderRadius: radius.pill, backgroundColor: '#E9EAE2' },
  topSignInText: { color: colors.oliveDeep, fontSize: 13, fontWeight: '800' },
  heroCard: { height: 300, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 18 },
  heroGlow: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(217,235,120,0.10)', top: 42, left: -77 },
  heroTopline: { position: 'absolute', top: 20, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow: { color: '#DCE3C7', fontSize: 10, fontWeight: '800', letterSpacing: 1.15 },
  heroSparkle: { width: 29, height: 29, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.11)', alignItems: 'center', justifyContent: 'center' },
  plateOuter: { width: 186, height: 186, borderRadius: 93, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginTop: 8 },
  plateInner: { width: 155, height: 155, borderRadius: 78, backgroundColor: '#FAF8EF', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#E9E6D8' },
  plateCenter: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E7F0DE', alignItems: 'center', justifyContent: 'center' },
  foodDot: { position: 'absolute', width: 20, height: 20, borderRadius: 8, backgroundColor: colors.tomato },
  floatingIngredient: { position: 'absolute', top: 88, right: 18, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFCF4', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  ingredientEmoji: { fontSize: 16 },
  ingredientLabel: { color: colors.ink, fontSize: 8, fontWeight: '800' },
  floatingNote: { position: 'absolute', bottom: 53, left: 15, minHeight: 35, paddingHorizontal: 10, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFCF4', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  floatingNoteText: { color: colors.ink, fontSize: 8, fontWeight: '800' },
  heroFooter: { position: 'absolute', left: 19, right: 19, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroFooterIcon: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  heroFooterText: { color: '#DCE3D1', fontSize: 10, fontWeight: '600' },
  slideMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 14 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { height: 5, width: 5, borderRadius: 5, backgroundColor: '#D7D9CE' },
  dotActive: { width: 20, backgroundColor: colors.oliveDeep },
  slideCount: { color: colors.oliveDeep, fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  slideCountMuted: { color: '#A2A696', fontWeight: '600' },
  onboardingTitle: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.1 },
  onboardingCopy: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 10, maxWidth: 500 },
  setupNotice: { backgroundColor: '#F6ECCB', borderRadius: 17, padding: 14, flexDirection: 'row', gap: 11, alignItems: 'center', marginTop: 16 },
  setupNoticeText: { color: '#766A4F', flex: 1, fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 62, borderRadius: radius.pill, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 13, paddingHorizontal: 22, marginTop: 21 },
  primaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  accountHint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 16 },
  inlineLink: { color: colors.oliveDeep, fontWeight: '800' },
  secondaryAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryActionText: { color: colors.oliveDeep, fontSize: 12, fontWeight: '800' },
  formContent: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 7, paddingBottom: 30 },
  backButton: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EAE2' },
  formBrand: { flexDirection: 'row', alignItems: 'center' },
  brandRightSpacer: { width: 37 },
  formIntro: { marginTop: 26, marginBottom: 24 },
  formIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#E6EBD8', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  formEyebrow: { color: '#8A907E', fontSize: 10, letterSpacing: 1.2, fontWeight: '800', marginBottom: 8 },
  formTitle: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1 },
  formCopy: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 9, maxWidth: 500 },
  modeSwitch: { height: 54, borderRadius: 17, padding: 4, backgroundColor: '#E9EAE2', flexDirection: 'row', marginBottom: 24 },
  modeOption: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  modeOptionActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  modeOptionText: { color: '#898D81', fontSize: 13, fontWeight: '700' },
  modeOptionTextActive: { color: colors.ink, fontWeight: '800' },
  fieldLabel: { color: '#858B7B', fontSize: 10, letterSpacing: 1.05, fontWeight: '800', marginBottom: 8, marginTop: 5 },
  field: { height: 59, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 17, paddingHorizontal: 16, borderWidth: 1, borderColor: '#ECEBE4', marginBottom: 17 },
  input: { flex: 1, color: colors.ink, fontSize: 16, minWidth: 0 },
  forgotButton: { alignSelf: 'flex-end', paddingVertical: 5, marginTop: -5, marginBottom: 13 },
  forgotText: { color: colors.oliveDeep, fontSize: 12, fontWeight: '800' },
  formSubmit: { marginTop: 10 },
  buttonDisabled: { opacity: 0.48 },
  privacyCopy: { color: '#92968A', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 16, maxWidth: 420, alignSelf: 'center' },
  formBottomLink: { alignItems: 'center', marginTop: 28 },
  bottomHint: { color: colors.muted, fontSize: 12 },
});
