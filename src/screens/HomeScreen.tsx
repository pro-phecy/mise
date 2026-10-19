import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ResponsiveIonicons as Ionicons, ResponsiveText as Text, ResponsiveTextInput as TextInput } from '../components/ResponsiveUI';
import { RecipeCard } from '../components/RecipeCard';
import type { GeneratorMode, PantryItem, Recipe } from '../types';
import { colors, radius } from '../theme';

type Props = {
  pantry: PantryItem[];
  expiringItems: PantryItem[];
  recipes: Recipe[];
  generatedRecipes: Recipe[] | null;
  isGenerating: boolean;
  isScanning: boolean;
  savedIds: Set<string>;
  userName?: string;
  onAddIngredients: (value: string) => void;
  onScanFridge: () => void;
  onToggleIngredient: (id: string) => void;
  onGenerate: (mode: GeneratorMode, craving: string, swapOut: string[], swapIn: string[]) => void;
  maxCookMinutes: number | null;
  equipment: string[];
  onOpenRecipe: (recipe: Recipe) => void;
  onToggleSaved: (recipe: Recipe) => void;
  onOpenAccount: () => void;
  onOpenPantry: () => void;
  onUseExpiring: () => void;
};

const studioModes: Array<{ id: GeneratorMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'PantryChef', label: 'PantryChef', icon: 'leaf-outline' },
  { id: 'MasterChef', label: 'MasterChef', icon: 'restaurant-outline' },
  { id: 'MixologyMaestro', label: 'MixologyMaestro', icon: 'wine-outline' },
  { id: 'BakeHeist', label: 'BakeHeist', icon: 'pizza-outline' },
  { id: 'MacrosChef', label: 'MacrosChef', icon: 'fitness-outline' },
];

export function HomeScreen(props: Props) {
  const [draft, setDraft] = useState('');
  const [craving, setCraving] = useState('');
  const [swapOut, setSwapOut] = useState('');
  const [swapIn, setSwapIn] = useState('');
  const [generationMode, setGenerationMode] = useState<GeneratorMode>('PantryChef');
  const [recipeFilter, setRecipeFilter] = useState<'Best match' | 'Under 20 min' | 'Vegetarian'>('Best match');
  const selected = props.pantry.filter((item) => item.selected);
  const recipeList = props.generatedRecipes ?? props.recipes;
  const visibleRecipes = recipeList.filter((recipe) => {
    if (recipeFilter === 'Under 20 min') return recipe.timeMinutes <= 20;
    if (recipeFilter === 'Vegetarian') return !recipe.ingredients.some((ingredient) => /chicken|beef|pork|fish|salmon|shrimp|prawn|bacon|sausage|turkey/i.test(ingredient.name));
    return true;
  });

  const addDraft = () => {
    if (!draft.trim()) return;
    props.onAddIngredients(draft);
    setDraft('');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.topbar}>
        <View style={styles.brandLockup}>
          <View style={styles.brandMark}><View style={styles.brandDot} /><View style={styles.brandDotSmall} /></View>
          <Text style={styles.brand}>mise</Text>
        </View>
        <Pressable onPress={props.onOpenAccount} style={styles.avatar} accessibilityLabel="Open account" accessibilityRole="button">
          <Text style={styles.avatarText}>{props.userName?.slice(0, 1).toUpperCase() ?? 'M'}</Text>
          <View style={[styles.onlineDot, props.userName && styles.online]} />
        </Pressable>
      </View>

      {props.expiringItems.length > 0 && <Animated.View entering={FadeInDown.springify().damping(20)} style={styles.freshCard}>
        <View style={styles.freshIcon}><Ionicons name="time-outline" size={19} color="#A75F43" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.freshTitle}>{props.expiringItems.length} {props.expiringItems.length === 1 ? 'ingredient' : 'ingredients'} to use soon</Text>
          <Text style={styles.freshCopy} numberOfLines={2}>{props.expiringItems.slice(0, 4).map((item) => item.name).join(' · ')}</Text>
        </View>
        <Pressable onPress={props.onUseExpiring} style={styles.freshAction}><Ionicons name="arrow-forward" size={16} color="#FFFFFF" /></Pressable>
      </Animated.View>}

      <Animated.View entering={FadeInDown.delay(80).springify().damping(20)}>
        <LinearGradient colors={['#31392C', '#4A523C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Dinner{ '\n' }starts here.</Text>
            <Text style={styles.heroSub}>{selected.length} ingredients selected.</Text>
            <Pressable onPress={() => props.onGenerate(generationMode, craving.trim(), splitIngredients(swapOut), splitIngredients(swapIn))} style={({ pressed }) => [styles.heroButton, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Text style={styles.heroButtonText}>{props.isGenerating ? 'Finding meals…' : 'Find meals'}</Text>
              <Ionicons name="arrow-forward" size={17} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.plateHalo}>
            <View style={styles.plateRing}>
              <Image source={{ uri: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=420&q=85' }} style={styles.heroFood} />
            </View>
          </View>
          <View style={styles.heroDecoration} />
        </LinearGradient>
      </Animated.View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRail}>
        {studioModes.map((item) => <Pressable key={item.id} onPress={() => setGenerationMode(item.id)} style={[styles.modeChip, generationMode === item.id && styles.modeChipActive]}>
          <Ionicons name={item.icon} size={14} color={generationMode === item.id ? colors.oliveDeep : '#858A7D'} />
          <Text style={[styles.modeText, generationMode === item.id && styles.modeTextActive]}>{item.label}</Text>
        </Pressable>)}
      </ScrollView>
      {generationMode !== 'PantryChef' && generationMode !== 'MacrosChef' && <View style={styles.cravingWrap}>
        <Ionicons name={generationMode === 'MixologyMaestro' ? 'wine-outline' : generationMode === 'BakeHeist' ? 'pizza-outline' : 'search-outline'} size={16} color={colors.oliveDeep} />
        <TextInput value={craving} onChangeText={setCraving} placeholder={generationMode === 'MixologyMaestro' ? 'Drink style or pairing (optional)' : generationMode === 'BakeHeist' ? 'What would you like to bake? (optional)' : 'What are you craving? e.g. ramen'} placeholderTextColor="#909589" style={styles.cravingInput} returnKeyType="done" />
      </View>}
      {generationMode === 'MasterChef' && <View style={styles.swapRow}>
        <TextInput value={swapOut} onChangeText={setSwapOut} placeholder="Swap out (optional)" placeholderTextColor="#909589" style={styles.swapInput} />
        <Ionicons name="arrow-forward" size={14} color={colors.oliveDeep} />
        <TextInput value={swapIn} onChangeText={setSwapIn} placeholder="Use instead" placeholderTextColor="#909589" style={styles.swapInput} />
      </View>}
      <Pressable onPress={props.onOpenAccount} style={styles.preferenceHint}>
        <Ionicons name="options-outline" size={13} color={colors.oliveDeep} />
        <Text style={styles.preferenceHintText}>Edit kitchen settings · {props.maxCookMinutes ? `${props.maxCookMinutes} min` : 'any time'}{props.equipment.length ? ` · ${props.equipment.join(', ')}` : ''}</Text>
      </Pressable>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Your fridge</Text>
        </View>
        <Pressable onPress={props.onOpenPantry} style={styles.textAction}><Text style={styles.textActionText}>Edit pantry</Text><Ionicons name="arrow-forward" size={14} color={colors.oliveDeep} /></Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
        {props.pantry.map((item) => (
          <Pressable key={item.id} onPress={() => props.onToggleIngredient(item.id)} style={[styles.ingredientChip, item.selected && styles.ingredientChipActive]}>
            <Text style={styles.ingredientEmoji}>{emojiFor(item.name)}</Text>
            <Text style={[styles.ingredientLabel, item.selected && styles.ingredientLabelActive]}>{item.name}</Text>
            <Ionicons name={item.selected ? 'checkmark-circle' : 'add-circle-outline'} size={16} color={item.selected ? colors.oliveDeep : '#AAAFA2'} />
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.addRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="add" size={18} color={colors.muted} />
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={addDraft} placeholder="Add ingredients, commas are fine" placeholderTextColor="#A1A498" style={styles.input} returnKeyType="done" />
        </View>
        <Pressable onPress={addDraft} style={styles.addButton} accessibilityLabel="Add ingredients">
          <Ionicons name="arrow-up" size={18} color={colors.card} />
        </Pressable>
        <Pressable onPress={props.onScanFridge} disabled={props.isScanning} style={[styles.scanButton, props.isScanning && { opacity: 0.55 }]} accessibilityLabel="Scan fridge photo">
          <Ionicons name={props.isScanning ? 'hourglass-outline' : 'camera-outline'} size={18} color={colors.oliveDeep} />
        </Pressable>
      </View>

      <View style={[styles.sectionHeader, { marginTop: 30 }]}>
        <View>
          <Text style={styles.sectionTitle}>{props.generatedRecipes ? 'Your fresh picks' : 'Meal ideas'}</Text>
        </View>
      </View>

      <View style={styles.filterRail}>
        {(['Best match', 'Under 20 min', 'Vegetarian'] as const).map((filter) => (
          <Pressable key={filter} onPress={() => setRecipeFilter(filter)} style={[styles.filterPill, recipeFilter === filter && styles.filterPillActive]}>
            <Text style={[styles.filterPillText, recipeFilter === filter && styles.filterPillTextActive]}>{filter}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipeRail}>
        {visibleRecipes.slice(0, 5).map((recipe, index) => (
          <RecipeCard key={recipe.id} recipe={recipe} compact index={index} onPress={() => props.onOpenRecipe(recipe)} onSave={() => props.onToggleSaved(recipe)} isSaved={props.savedIds.has(recipe.id)} />
        ))}
      </ScrollView>
      {!visibleRecipes.length && <Text style={styles.noMatches}>No quick picks for this ingredient mix yet. Try Best match for more ideas.</Text>}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function emojiFor(name: string) {
  const value = name.toLowerCase();
  if (value.includes('tomato')) return '🍅';
  if (value.includes('spinach') || value.includes('lettuce')) return '🥬';
  if (value.includes('egg')) return '🥚';
  if (value.includes('parmesan') || value.includes('cheese')) return '🧀';
  if (value.includes('chickpea') || value.includes('bean')) return '🫘';
  if (value.includes('lemon')) return '🍋';
  return '🥕';
}

function splitIngredients(value: string) {
  return value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 112 },
  topbar: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 23, height: 23, borderRadius: 8, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  brandDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: colors.ink, marginTop: -4 },
  brandDotSmall: { position: 'absolute', height: 5, width: 5, borderRadius: 3, backgroundColor: colors.tomato, bottom: 3, right: 3 },
  brand: { fontSize: 20, fontWeight: '800', letterSpacing: -0.9, color: colors.ink },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E9EBDD', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatarText: { fontSize: 13, fontWeight: '800', color: colors.oliveDeep },
  onlineDot: { position: 'absolute', height: 8, width: 8, borderRadius: 4, bottom: 0, right: 0, backgroundColor: '#ADB3A2', borderWidth: 1.5, borderColor: colors.paper },
  online: { backgroundColor: '#83A43C' },
  modeRail: { gap: 7, paddingRight: 20, marginTop: 16 },
  modeChip: { minHeight: 36, borderRadius: radius.pill, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FBFBF7', borderWidth: 1, borderColor: '#E6E7DD' },
  modeChipActive: { backgroundColor: '#E9EDDC', borderColor: '#D5DEBD' },
  modeText: { color: '#858A7D', fontSize: 9, fontWeight: '700' },
  modeTextActive: { color: colors.ink, fontWeight: '800' },
  cravingWrap: { minHeight: 42, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E7DD', borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  cravingInput: { flex: 1, color: colors.ink, fontSize: 10 },
  swapRow: { minHeight: 40, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  swapInput: { flex: 1, height: 39, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E7DD', borderRadius: 12, paddingHorizontal: 10, color: colors.ink, fontSize: 9 },
  preferenceHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start' },
  preferenceHintText: { color: '#818779', fontSize: 8, fontWeight: '600', flexShrink: 1 },
  hero: { minHeight: 220, borderRadius: radius.lg, padding: 20, overflow: 'hidden', flexDirection: 'row', position: 'relative' },
  heroCopy: { flex: 1, zIndex: 2, maxWidth: '65%' },
  heroTitle: { color: '#FBF9F1', fontSize: 30, lineHeight: 31, fontWeight: '800', letterSpacing: -1.2 },
  heroSub: { color: '#D2D8C4', fontSize: 11, lineHeight: 16, marginTop: 8, maxWidth: 182 },
  heroButton: { marginTop: 14, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.olive, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroButtonText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  plateHalo: { position: 'absolute', right: -16, top: 27, width: 168, height: 168, borderRadius: 84, borderWidth: 1, borderColor: 'rgba(232,238,207,0.22)', alignItems: 'center', justifyContent: 'center' },
  plateRing: { width: 133, height: 133, borderRadius: 67, backgroundColor: '#F2EDE0', padding: 7, borderWidth: 1, borderColor: '#FFFFFF' },
  heroFood: { width: '100%', height: '100%', borderRadius: 64 },
  heroDecoration: { position: 'absolute', bottom: -40, right: 89, width: 86, height: 86, borderRadius: 43, backgroundColor: 'rgba(219,231,157,0.08)' },
  freshCard: { marginTop: 13, borderRadius: 18, borderWidth: 1, borderColor: '#F0D8CA', backgroundColor: '#FFF5EE', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  freshIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: '#FBE4D8', alignItems: 'center', justifyContent: 'center' },
  freshTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  freshCopy: { color: '#8B786B', fontSize: 8, lineHeight: 12, marginTop: 3 },
  freshAction: { width: 32, height: 32, borderRadius: 12, backgroundColor: '#A75F43', alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 27, marginBottom: 13 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.55 },
  textAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  textActionText: { color: colors.oliveDeep, fontSize: 11, fontWeight: '800' },
  chipRail: { gap: 8, paddingRight: 20 },
  ingredientChip: { height: 42, backgroundColor: '#FBFBF7', borderWidth: 1, borderColor: '#E6E7DD', borderRadius: radius.pill, paddingLeft: 10, paddingRight: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ingredientChipActive: { backgroundColor: '#EEF2DF', borderColor: '#D7E2B6' },
  ingredientEmoji: { fontSize: 13 },
  ingredientLabel: { color: '#898D82', fontSize: 10, fontWeight: '700' },
  ingredientLabelActive: { color: colors.ink },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  inputWrap: { height: 43, borderRadius: 15, flex: 1, backgroundColor: '#ECECE5', alignItems: 'center', flexDirection: 'row', paddingHorizontal: 12, gap: 8 },
  input: { flex: 1, fontSize: 11, color: colors.ink, paddingVertical: 0 },
  addButton: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.ink },
  scanButton: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#E9EDDC' },
  filterRail: { flexDirection: 'row', gap: 7, marginBottom: 11 },
  filterPill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: '#FBFBF7', borderWidth: 1, borderColor: '#E5E5DD' },
  filterPillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterPillText: { color: '#777D70', fontSize: 9, fontWeight: '700' },
  filterPillTextActive: { color: '#FFFFFF' },
  noMatches: { color: colors.muted, fontSize: 11, lineHeight: 16, paddingVertical: 16 },
  recipeRail: { gap: 12, paddingRight: 20, paddingBottom: 3 },
});
