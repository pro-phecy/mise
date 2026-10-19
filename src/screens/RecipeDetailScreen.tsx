import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ResponsiveIonicons as Ionicons, ResponsiveText as Text, ResponsiveTextInput as TextInput } from '../components/ResponsiveUI';
import type { Recipe } from '../types';
import { colors, radius } from '../theme';

type Props = { recipe: Recipe; isSaved: boolean; isRemixing: boolean; onBack: () => void; onSave: () => void; onCooked: (recipe: Recipe) => void; onPlan: (recipe: Recipe) => void; onAddMissing: (recipe: Recipe) => void; onRemix: (recipe: Recipe, instruction: string) => Promise<Recipe | null> };

const parseAmount = (amount: string) => {
  const match = amount.match(/^\s*(\d+\s*\/\s*\d+|\d+(?:\.\d+)?)(.*)$/);
  if (!match) return amount;
  const numeric = match[1].includes('/')
    ? Number(match[1].split('/')[0].trim()) / Number(match[1].split('/')[1].trim())
    : Number(match[1]);
  if (!Number.isFinite(numeric)) return amount;
  return { amount: numeric, unit: match[2] };
};

const scaleAmount = (amount: string, originalServings: number, servings: number) => {
  if (/^\s*\d+(?:\.\d+)?\s*-\s*\d/.test(amount)) return amount;
  const parsed = parseAmount(amount);
  if (typeof parsed === 'string' || !originalServings) return amount;
  const scaled = Math.round(parsed.amount * servings / originalServings * 100) / 100;
  return `${Number.isInteger(scaled) ? scaled : scaled.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}${parsed.unit}`;
};

const getStepTimer = (step: string) => {
  const match = step.match(/(?:about\s+)?(\d{1,3})\s*(?:minutes?|mins?|min)\b/i);
  const minutes = match ? Number(match[1]) : 0;
  return minutes >= 1 && minutes <= 180 ? minutes : 0;
};

export function RecipeDetailScreen({ recipe, isSaved, isRemixing, onBack, onSave, onCooked, onPlan, onAddMissing, onRemix }: Props) {
  const [cooking, setCooking] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [servings, setServings] = useState(recipe.servings || 2);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerDuration, setTimerDuration] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [remixOpen, setRemixOpen] = useState(false);
  const [remixRequest, setRemixRequest] = useState('');
  const servingRecipe: Recipe = {
    ...recipe,
    servings,
    ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient, amount: scaleAmount(ingredient.amount, recipe.servings || 2, servings) })),
  };
  const stepMinutes = getStepTimer(recipe.steps[stepIndex] ?? '');

  useEffect(() => { setServings(recipe.servings || 2); setCooking(false); setStepIndex(0); setTimerRunning(false); setTimerRemaining(0); setTimerDuration(0); }, [recipe.id, recipe.servings]);
  useEffect(() => {
    if (!timerRunning) return;
    if (timerRemaining <= 0) {
      setTimerRunning(false);
      Alert.alert('Timer finished', 'Your step timer is up. Check the food before moving on.');
      return;
    }
    const timeout = setTimeout(() => setTimerRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timeout);
  }, [timerRemaining, timerRunning]);

  const moveToStep = (nextIndex: number) => {
    const next = Math.min(Math.max(0, nextIndex), recipe.steps.length - 1);
    setStepIndex(next);
    setTimerRunning(false);
    const seconds = getStepTimer(recipe.steps[next] ?? '') * 60;
    setTimerDuration(seconds);
    setTimerRemaining(seconds);
  };

  const submitRemix = async () => {
    if (!remixRequest.trim()) { Alert.alert('Tell the kitchen what to change', 'Try “make it vegan” or “use fewer ingredients”.'); return; }
    const result = await onRemix(servingRecipe, remixRequest.trim());
    if (result) { setRemixOpen(false); setRemixRequest(''); }
  };

  if (cooking) {
    const isLast = stepIndex === recipe.steps.length - 1;
    const timerOptions = Array.from(new Set([stepMinutes, 1, 5, 10].filter((value) => value > 0)));
    return (
      <View style={styles.cookScreen}>
        <View style={styles.cookTop}>
          <Pressable onPress={() => { setCooking(false); setTimerRunning(false); }} style={styles.cookClose}><Ionicons name="close" size={20} color="#F7F7F0" /></Pressable>
          <Text style={styles.cookModeLabel}>COOK ALONG</Text>
          <View style={{ width: 42 }} />
        </View>
        <View style={styles.cookProgress}>{recipe.steps.map((_, index) => <View key={index} style={[styles.progressBit, index <= stepIndex && styles.progressActive]} />)}</View>
        <Animated.View key={stepIndex} entering={FadeInDown.springify().damping(20)} style={styles.stepCopy}>
          <Text style={styles.stepEyebrow}>STEP {String(stepIndex + 1).padStart(2, '0')} <Text style={{ color: '#8B927E' }}>/ {String(recipe.steps.length).padStart(2, '0')}</Text></Text>
          <Text style={styles.stepTitle}>{recipe.steps[stepIndex]}</Text>
          <Text style={styles.stepHint}>Take your time. This is your kitchen.</Text>
        </Animated.View>
        <View style={styles.timerCard}>
          <View style={styles.timerHeading}><Ionicons name="timer-outline" size={17} color={colors.olive} /><Text style={styles.timerLabel}>{timerRemaining > 0 ? `${Math.floor(timerRemaining / 60)}:${String(timerRemaining % 60).padStart(2, '0')}` : 'STEP TIMER'}</Text></View>
          {timerRemaining > 0 ? (
            <View style={styles.timerActions}><Pressable onPress={() => setTimerRunning((value) => !value)} style={styles.timerAction}><Text style={styles.timerActionText}>{timerRunning ? 'Pause' : 'Resume'}</Text></Pressable><Pressable onPress={() => { setTimerRunning(false); setTimerRemaining(timerDuration); }} style={styles.timerAction}><Text style={styles.timerActionText}>Reset</Text></Pressable></View>
          ) : (
            <View style={styles.timerOptions}>{timerOptions.map((minutes) => <Pressable key={minutes} onPress={() => { setTimerDuration(minutes * 60); setTimerRemaining(minutes * 60); setTimerRunning(true); }} style={styles.timerOption}><Text style={styles.timerOptionText}>{minutes === stepMinutes && stepMinutes ? `Start ${minutes} min` : `${minutes} min`}</Text></Pressable>)}</View>
          )}
        </View>
        <View style={styles.stepControls}>
          {stepIndex > 0 && <Pressable onPress={() => moveToStep(stepIndex - 1)} style={styles.previousButton}><Ionicons name="arrow-back" size={18} color="#E6EADB" /><Text style={styles.previousText}>Previous</Text></Pressable>}
          <Pressable onPress={() => { if (isLast) { setCooking(false); setStepIndex(0); setTimerRunning(false); onCooked(servingRecipe); } else moveToStep(stepIndex + 1); }} style={styles.nextButton}>
            <Text style={styles.nextText}>{isLast ? 'All done' : 'Next step'}</Text><Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={18} color={colors.ink} />
          </Pressable>
        </View>
          <Text style={styles.cookFooter}>{servings} SERVINGS · {recipe.title.toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
        <View style={styles.cover}>
          <Image source={{ uri: recipe.image }} style={styles.coverImage} resizeMode="cover" />
          <LinearGradient colors={['rgba(25, 30, 22, 0.12)', 'transparent', 'rgba(25, 30, 22, 0.2)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Pressable onPress={onBack} style={[styles.coverButton, { left: 18 }]} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable>
          <Pressable onPress={onSave} style={[styles.coverButton, { right: 18 }]} accessibilityLabel={isSaved ? 'Remove saved recipe' : 'Save recipe'}><Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={19} color={isSaved ? colors.oliveDeep : colors.ink} /></Pressable>
          <View style={styles.coverCaption}><View style={styles.coverTag}><Ionicons name="sparkles" size={12} color={colors.ink} /><Text style={styles.coverTagText}>{recipe.matchedCount} INGREDIENTS FOUND</Text></View></View>
        </View>

        <View style={styles.body}>
          <Animated.View entering={FadeInDown.springify().damping(20)}>
            <Text style={styles.title}>{recipe.title}</Text>
            <Text style={styles.summary}>{recipe.summary}</Text>
            <View style={styles.metaRow}>
              <View style={styles.meta}><View style={styles.metaIcon}><Ionicons name="time-outline" size={16} color={colors.oliveDeep} /></View><Text style={styles.metaValue}>{recipe.timeMinutes} min</Text></View>
              <View style={styles.meta}><View style={styles.metaIcon}><Ionicons name="people-outline" size={16} color={colors.oliveDeep} /></View><Pressable onPress={() => setServings((value) => Math.max(1, value - 1))} style={styles.servingButton}><Ionicons name="remove" size={13} color={colors.oliveDeep} /></Pressable><Text style={styles.metaValue}>{servings} servings</Text><Pressable onPress={() => setServings((value) => Math.min(12, value + 1))} style={styles.servingButton}><Ionicons name="add" size={13} color={colors.oliveDeep} /></Pressable></View>
              <View style={styles.meta}><View style={styles.metaIcon}><Ionicons name="flame-outline" size={16} color={colors.oliveDeep} /></View><Text style={styles.metaValue}>{recipe.difficulty}</Text></View>
            </View>
          </Animated.View>

          <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>Ingredients</Text></View>
          <View style={styles.ingredientList}>
            {recipe.ingredients.map((ingredient, index) => (
              <Animated.View key={`${ingredient.name}-${index}`} entering={FadeInDown.delay(index * 25).springify().damping(20)} style={styles.ingredientRow}>
                <View style={[styles.ingredientCheck, ingredient.inPantry && styles.ingredientFound]}>{ingredient.inPantry ? <Ionicons name="checkmark" size={12} color={colors.oliveDeep} /> : <View style={styles.ingredientEmpty} />}</View>
                <Text style={[styles.ingredientName, ingredient.inPantry && styles.ingredientNameFound]}>{ingredient.name}</Text>
                <Text style={styles.ingredientAmount}>{scaleAmount(ingredient.amount, recipe.servings || 2, servings)}</Text>
              </Animated.View>
            ))}
          </View>

          <View style={styles.quickActions}>
            <Pressable onPress={() => onAddMissing(servingRecipe)} style={styles.quickAction}><Ionicons name="basket-outline" size={15} color={colors.oliveDeep} /><Text style={styles.quickActionText}>Add missing to list</Text></Pressable>
            <Pressable onPress={() => onPlan(servingRecipe)} style={styles.quickAction}><Ionicons name="calendar-outline" size={15} color={colors.oliveDeep} /><Text style={styles.quickActionText}>Plan this meal</Text></Pressable>
          </View>
          <Pressable onPress={() => setRemixOpen(true)} style={styles.remixButton} disabled={isRemixing}><Ionicons name="sparkles-outline" size={16} color={colors.card} /><Text style={styles.remixButtonText}>{isRemixing ? 'Remixing this recipe…' : 'Remix this recipe'}</Text><Ionicons name="arrow-forward" size={15} color={colors.card} /></Pressable>

          <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>Nutrition per serving</Text>{recipe.nutritionPerServing && <Text style={styles.smallCount}>Estimated</Text>}</View>
          {recipe.nutritionPerServing ? <View style={styles.nutritionCard}>
            {[['Calories', `${recipe.nutritionPerServing.calories} kcal`], ['Protein', `${recipe.nutritionPerServing.proteinGrams} g`], ['Carbs', `${recipe.nutritionPerServing.carbsGrams} g`], ['Fat', `${recipe.nutritionPerServing.fatGrams} g`]].map(([label, value]) => <View key={label} style={styles.nutritionStat}><Text style={styles.nutritionValue}>{value}</Text><Text style={styles.nutritionLabel}>{label}</Text></View>)}
            <Text style={styles.nutritionDisclaimer}>AI estimate, not lab-tested. Actual nutrition varies by ingredient and portion.</Text>
          </View> : <Text style={styles.nutritionUnavailable}>No nutrition estimate is available for this recipe.</Text>}

          {recipe.tip && <View style={styles.chefNote}><View style={styles.noteIcon}><Ionicons name="bulb-outline" size={17} color="#977236" /></View><View style={{ flex: 1 }}><Text style={styles.noteTitle}>Chef’s tip</Text><Text style={styles.noteText}>{recipe.tip}</Text></View></View>}

          <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>Instructions</Text></View>
          <View style={styles.stepsPreview}>{recipe.steps.map((step, index) => <View key={index} style={styles.stepPreviewRow}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{String(index + 1).padStart(2, '0')}</Text></View><Text style={styles.stepPreviewText}>{step}</Text></View>)}</View>
          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
      <View style={styles.bottomAction}>
        <Pressable onPress={() => { const seconds = getStepTimer(recipe.steps[0] ?? '') * 60; setStepIndex(0); setTimerRunning(false); setTimerDuration(seconds); setTimerRemaining(seconds); setCooking(true); }} style={({ pressed }) => [styles.cookButton, pressed && { opacity: 0.92 }]}><Ionicons name="play" size={17} color={colors.ink} /><Text style={styles.cookButtonText}>Cook along</Text><Ionicons name="arrow-forward" size={17} color={colors.ink} style={{ marginLeft: 'auto' }} /></Pressable>
      </View>
      <Modal visible={remixOpen} transparent animationType="slide" onRequestClose={() => setRemixOpen(false)} statusBarTranslucent>
        <View style={styles.remixBackdrop}><Pressable onPress={() => setRemixOpen(false)} style={StyleSheet.absoluteFill} /><View style={styles.remixSheet}>
          <View style={styles.remixTop}><Text style={styles.remixTitle}>Remix this meal</Text><Pressable onPress={() => setRemixOpen(false)} style={styles.remixClose}><Ionicons name="close" size={18} color={colors.ink} /></Pressable></View>
          <Text style={styles.remixCopy}>Your saved preferences are included. Check ingredient labels for allergens.</Text>
          <View style={styles.remixSuggestions}>{['Make it vegan', 'Use fewer dishes', 'Make it spicier', 'Use only what I have'].map((suggestion) => <Pressable key={suggestion} onPress={() => setRemixRequest(suggestion)} style={styles.remixChip}><Text style={styles.remixChipText}>{suggestion}</Text></Pressable>)}</View>
          <TextInput value={remixRequest} onChangeText={setRemixRequest} placeholder="What should change? e.g. swap parmesan for a dairy-free option" placeholderTextColor="#A4A69E" style={styles.remixInput} multiline maxLength={500} />
          <Pressable onPress={() => { void submitRemix(); }} disabled={isRemixing || !remixRequest.trim()} style={[styles.remixSubmit, (isRemixing || !remixRequest.trim()) && { opacity: 0.55 }]}><Ionicons name="sparkles" size={16} color={colors.ink} /><Text style={styles.remixSubmitText}>{isRemixing ? 'Cooking up a new version…' : 'Make my remix'}</Text></Pressable>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  detailContent: { paddingBottom: 100 },
  cover: { height: 295, position: 'relative', backgroundColor: '#D4D8CA' },
  coverImage: { width: '100%', height: '100%' },
  coverButton: { position: 'absolute', top: 54, height: 40, width: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
  coverCaption: { position: 'absolute', left: 20, bottom: 19 },
  coverTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, backgroundColor: colors.olive, paddingHorizontal: 10, paddingVertical: 7 },
  coverTagText: { color: colors.ink, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  body: { paddingHorizontal: 21, paddingTop: 20 },
  title: { color: colors.ink, fontSize: 27, lineHeight: 31, fontWeight: '800', letterSpacing: -0.9, marginTop: 7 },
  summary: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 17, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E5DD' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EDDC' },
  metaValue: { color: '#5F6557', fontSize: 9, fontWeight: '700' },
  servingButton: { width: 21, height: 21, borderRadius: 8, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 25, marginBottom: 13 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.55 },
  smallCount: { color: '#8A907E', fontSize: 8, fontWeight: '800', letterSpacing: 0.7, marginBottom: 2 },
  ingredientList: { borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: '#ECEBE4', paddingHorizontal: 14 },
  ingredientRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F0EA', gap: 10 },
  ingredientCheck: { height: 19, width: 19, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1.3, borderColor: '#D7D9CF' },
  ingredientFound: { backgroundColor: '#E8EED9', borderColor: '#D6E2B8' },
  ingredientEmpty: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#D7D9CF' },
  ingredientName: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: '600' },
  ingredientNameFound: { color: '#707865' },
  ingredientAmount: { color: '#96998F', fontSize: 10, fontWeight: '600' },
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 11 },
  quickAction: { minHeight: 39, flex: 1, borderRadius: 13, backgroundColor: '#E9EDDC', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  quickActionText: { color: colors.oliveDeep, fontSize: 9, fontWeight: '800' },
  remixButton: { height: 45, borderRadius: 14, marginTop: 9, paddingHorizontal: 14, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  remixButtonText: { color: colors.card, fontSize: 10, fontWeight: '800', flex: 1 },
  nutritionCard: { borderRadius: 17, backgroundColor: colors.card, borderWidth: 1, borderColor: '#ECEBE4', padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  nutritionStat: { flexGrow: 1, minWidth: '21%', borderRadius: 12, backgroundColor: '#F5F6F0', padding: 9 },
  nutritionValue: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  nutritionLabel: { color: '#818678', fontSize: 8, marginTop: 3 },
  nutritionDisclaimer: { color: '#92968A', fontSize: 8, lineHeight: 12, width: '100%', marginTop: 2 },
  nutritionUnavailable: { color: '#85897E', fontSize: 10, lineHeight: 15 },
  chefNote: { marginTop: 13, padding: 13, backgroundColor: '#F6ECCB', borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteIcon: { width: 33, height: 33, borderRadius: 12, backgroundColor: '#F2E1AB', alignItems: 'center', justifyContent: 'center' },
  noteTitle: { color: '#574A2C', fontSize: 10, fontWeight: '800', marginBottom: 3 },
  noteText: { color: '#766A4F', fontSize: 10, lineHeight: 15 },
  stepsPreview: { gap: 11 },
  stepPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  stepNumber: { height: 29, width: 29, borderRadius: 11, backgroundColor: '#E9EDDC', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: colors.oliveDeep, fontSize: 9, fontWeight: '800' },
  stepPreviewText: { color: '#676C61', flex: 1, fontSize: 11, lineHeight: 17, paddingTop: 5 },
  bottomAction: { position: 'absolute', left: 17, right: 17, bottom: 14 },
  cookButton: { height: 57, backgroundColor: colors.olive, borderRadius: radius.pill, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  cookButtonText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  cookScreen: { flex: 1, backgroundColor: '#263025', paddingHorizontal: 25, paddingTop: 60, paddingBottom: 35 },
  cookTop: { height: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cookClose: { height: 42, width: 42, borderRadius: 21, backgroundColor: '#384333', alignItems: 'center', justifyContent: 'center' },
  cookModeLabel: { color: '#D7E2B7', fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  cookProgress: { flexDirection: 'row', gap: 6, marginTop: 28 },
  progressBit: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#4A5544' },
  progressActive: { backgroundColor: colors.olive },
  stepCopy: { flex: 1, justifyContent: 'center', paddingBottom: 30 },
  stepEyebrow: { color: colors.olive, fontSize: 10, fontWeight: '800', letterSpacing: 1.7, marginBottom: 16 },
  stepTitle: { color: '#F6F6EF', fontSize: 28, lineHeight: 36, letterSpacing: -0.8, fontWeight: '700' },
  stepHint: { color: '#AAB39F', fontSize: 12, marginTop: 15 },
  timerCard: { borderRadius: 17, padding: 13, backgroundColor: '#354033', marginBottom: 14 },
  timerHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timerLabel: { color: '#F5F5EF', fontSize: 15, fontWeight: '800', letterSpacing: 1.2 },
  timerOptions: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginTop: 11 },
  timerOption: { borderRadius: radius.pill, backgroundColor: '#485443', paddingHorizontal: 11, paddingVertical: 8 },
  timerOptionText: { color: '#E6EADB', fontSize: 9, fontWeight: '700' },
  timerActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  timerAction: { borderRadius: radius.pill, backgroundColor: '#485443', paddingHorizontal: 12, paddingVertical: 7 },
  timerActionText: { color: '#E6EADB', fontSize: 9, fontWeight: '700' },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  previousButton: { height: 52, borderRadius: radius.pill, paddingHorizontal: 15, flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: '#354033' },
  previousText: { color: '#E4E8DD', fontSize: 11, fontWeight: '700' },
  nextButton: { flex: 1, height: 56, borderRadius: radius.pill, paddingHorizontal: 20, backgroundColor: colors.olive, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  nextText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  cookFooter: { color: '#79836F', textAlign: 'center', fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  remixBackdrop: { flex: 1, backgroundColor: 'rgba(23,27,21,0.55)', justifyContent: 'flex-end' },
  remixSheet: { backgroundColor: colors.paper, borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingHorizontal: 21, paddingTop: 23, paddingBottom: 30 },
  remixTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remixTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.7 },
  remixClose: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#E9EAE2', alignItems: 'center', justifyContent: 'center' },
  remixCopy: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 9 },
  remixSuggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14, marginBottom: 11 },
  remixChip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#E9EDDC' },
  remixChipText: { color: colors.oliveDeep, fontSize: 9, fontWeight: '700' },
  remixInput: { minHeight: 82, maxHeight: 130, borderRadius: 14, padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEBE4', color: colors.ink, fontSize: 11, textAlignVertical: 'top' },
  remixSubmit: { height: 49, borderRadius: radius.pill, backgroundColor: colors.olive, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  remixSubmitText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
});
