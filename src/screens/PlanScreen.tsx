import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ResponsiveIonicons as Ionicons, ResponsiveText as Text, ResponsiveTextInput as TextInput } from '../components/ResponsiveUI';
import type { MealHistoryItem, PlanSection, PlannedMeal, ShoppingItem } from '../types';
import { colors } from '../theme';

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayLabel = (key: string) => {
  const date = new Date(`${key}T12:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

export function PlanScreen({
  plannedMeals, shoppingItems, mealHistory, onOpenRecipe, onRemovePlannedMeal,
  onAddShoppingItems, onToggleShoppingItem, onRemoveShoppingItem, onOpenAccount, section, onSectionChange,
  onGenerateWeek, isGeneratingWeek, onBuildShoppingList, onTrackMealPhoto, isTrackingMeal,
}: {
  plannedMeals: PlannedMeal[];
  shoppingItems: ShoppingItem[];
  mealHistory: MealHistoryItem[];
  onOpenRecipe: (recipe: PlannedMeal['recipe']) => void;
  onRemovePlannedMeal: (id: string) => void;
  onAddShoppingItems: (input: string) => void;
  onToggleShoppingItem: (id: string) => void;
  onRemoveShoppingItem: (id: string) => void;
  onOpenAccount: () => void;
  section: PlanSection;
  onSectionChange: (section: PlanSection) => void;
  onGenerateWeek: () => void;
  isGeneratingWeek: boolean;
  onBuildShoppingList: () => void;
  onTrackMealPhoto: () => void;
  isTrackingMeal: boolean;
}) {
  const [selectedDay, setSelectedDay] = useState(dateKey(new Date()));
  const [draft, setDraft] = useState('');
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() + index); return dateKey(date);
  }), []);
  const dayMeals = plannedMeals.filter((meal) => meal.plannedFor === selectedDay);
  const pendingCount = shoppingItems.filter((item) => !item.checked).length;

  const add = () => { if (!draft.trim()) return; onAddShoppingItems(draft); setDraft(''); };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View><Text style={styles.heading}>Your kitchen plan</Text></View>
        <Pressable onPress={onOpenAccount} style={styles.avatar}><Ionicons name="person-outline" size={18} color={colors.oliveDeep} /></Pressable>
      </View>

      <View style={styles.segment}>
        {(['Plan', 'Shopping', 'Cooked'] as const).map((item) => <Pressable key={item} onPress={() => onSectionChange(item)} style={[styles.segmentItem, section === item && styles.segmentActive]}><Text style={[styles.segmentText, section === item && styles.segmentTextActive]}>{item === 'Shopping' ? `Shop${pendingCount ? ` · ${pendingCount}` : ''}` : item === 'Cooked' ? 'Cooked' : 'Meal plan'}</Text></Pressable>)}
      </View>

      {section === 'Plan' ? (
        <>
          <Pressable onPress={onGenerateWeek} disabled={isGeneratingWeek} style={[styles.studioAction, isGeneratingWeek && { opacity: 0.6 }]}><Ionicons name="sparkles-outline" size={17} color={colors.ink} /><Text style={styles.studioActionText}>{isGeneratingWeek ? 'Planning your week…' : 'Plan my week'}</Text><Ionicons name="arrow-forward" size={16} color={colors.ink} /></Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRail}>
            {days.map((day, index) => <Pressable key={day} onPress={() => setSelectedDay(day)} style={[styles.dayCard, selectedDay === day && styles.daySelected]}><Text style={[styles.dayName, selectedDay === day && styles.daySelectedText]}>{index === 0 ? 'Today' : new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</Text><Text style={[styles.dayNumber, selectedDay === day && styles.daySelectedText]}>{new Date(`${day}T12:00:00`).getDate()}</Text></Pressable>)}
          </ScrollView>
          <Text style={styles.sectionTitle}>{dayLabel(selectedDay)}</Text>
          {dayMeals.length ? <View style={styles.list}>{dayMeals.map((meal, index) => <Animated.View key={meal.id} entering={FadeInDown.delay(index * 40).springify().damping(21)} style={styles.mealCard}>
            <Pressable onPress={() => onOpenRecipe(meal.recipe)} style={styles.mealMain}><View style={styles.mealIcon}><Ionicons name="restaurant-outline" size={17} color={colors.oliveDeep} /></View><View style={{ flex: 1 }}><Text style={styles.mealTitle}>{meal.recipe.title}</Text><Text style={styles.mealMeta}>{meal.recipe.timeMinutes} min · {meal.recipe.servings} servings</Text></View><Ionicons name="chevron-forward" size={16} color="#8B907F" /></Pressable>
            <Pressable onPress={() => onRemovePlannedMeal(meal.id)} style={styles.removeMeal}><Ionicons name="close-circle-outline" size={15} color="#8B907F" /><Text style={styles.removeMealText}>Remove from plan</Text></Pressable>
          </Animated.View>)}</View> : <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="sunny-outline" size={24} color={colors.oliveDeep} /></View><Text style={styles.emptyTitle}>Nothing planned for this day</Text><Text style={styles.emptyCopy}>Open a meal you like and add it to your plan.</Text></View>}
        </>
      ) : section === 'Shopping' ? (
        <>
          <Pressable onPress={onBuildShoppingList} style={styles.secondaryAction}><Ionicons name="list-outline" size={16} color={colors.oliveDeep} /><Text style={styles.secondaryActionText}>Add ingredients from planned meals</Text><Ionicons name="arrow-forward" size={14} color={colors.oliveDeep} /></Pressable>
          <View style={styles.inputRow}><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={add} placeholder="Add items, separated by commas" placeholderTextColor="#A1A498" style={styles.input} returnKeyType="done" /><Pressable onPress={add} style={styles.addButton} accessibilityLabel="Add shopping items"><Ionicons name="add" size={20} color={colors.card} /></Pressable></View>
          {shoppingItems.length ? <View style={styles.list}>{shoppingItems.map((item, index) => <Animated.View key={item.id} entering={FadeInDown.delay(index * 20).springify().damping(22)} style={styles.shoppingRow}>
            <Pressable onPress={() => onToggleShoppingItem(item.id)} style={[styles.check, item.checked && styles.checked]} accessibilityRole="checkbox" accessibilityState={{ checked: item.checked }}>{item.checked && <Ionicons name="checkmark" size={13} color={colors.ink} />}</Pressable>
            <View style={{ flex: 1 }}><Text style={[styles.shoppingName, item.checked && styles.crossed]}>{item.name}</Text>{item.quantity && <Text style={styles.mealMeta}>{item.quantity}</Text>}</View>
            <Pressable onPress={() => onRemoveShoppingItem(item.id)} hitSlop={8} style={styles.delete}><Ionicons name="close" size={17} color="#9C9F95" /></Pressable>
          </Animated.View>)}</View> : <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="checkmark-done-outline" size={24} color={colors.oliveDeep} /></View><Text style={styles.emptyTitle}>Your shopping list is clear</Text><Text style={styles.emptyCopy}>Use “Add missing to list” on any recipe to start your list.</Text></View>}
        </>
      ) : (
        <>
          <Pressable onPress={onTrackMealPhoto} disabled={isTrackingMeal} style={[styles.studioAction, isTrackingMeal && { opacity: 0.6 }]}><Ionicons name="camera-outline" size={17} color={colors.ink} /><Text style={styles.studioActionText}>{isTrackingMeal ? 'Estimating your plate…' : 'Track a meal photo'}</Text><Ionicons name="arrow-forward" size={16} color={colors.ink} /></Pressable>
          {mealHistory.length ? <View style={styles.list}>{mealHistory.map((entry, index) => <Animated.View key={entry.id} entering={FadeInDown.delay(index * 25).springify().damping(22)} style={styles.mealCard}>
            <Pressable onPress={() => { if (!entry.recipe.id.startsWith('meal-photo-')) onOpenRecipe(entry.recipe); }} style={styles.mealMain}><View style={styles.mealIcon}><Ionicons name={entry.recipe.id.startsWith('meal-photo-') ? 'analytics-outline' : 'checkmark-circle-outline'} size={18} color={colors.oliveDeep} /></View><View style={{ flex: 1 }}><Text style={styles.mealTitle}>{entry.recipe.title}</Text><Text style={styles.mealMeta}>{new Date(entry.cookedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{entry.recipe.id.startsWith('meal-photo-') ? ' · visual estimate' : ''}</Text>{entry.recipe.nutritionPerServing && <Text style={styles.nutritionMeta}>{entry.recipe.nutritionPerServing.calories} kcal · P {entry.recipe.nutritionPerServing.proteinGrams}g · C {entry.recipe.nutritionPerServing.carbsGrams}g · F {entry.recipe.nutritionPerServing.fatGrams}g</Text>}</View>{!entry.recipe.id.startsWith('meal-photo-') && <Ionicons name="chevron-forward" size={16} color="#8B907F" />}</Pressable>
          </Animated.View>)}</View> : <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="restaurant-outline" size={24} color={colors.oliveDeep} /></View><Text style={styles.emptyTitle}>Your first cook is waiting</Text><Text style={styles.emptyCopy}>Finish a cook-along and it’ll be saved here.</Text></View>}
        </>
      )}
      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 },
  heading: { color: colors.ink, fontSize: 27, lineHeight: 34, letterSpacing: -1, fontWeight: '800' },
  avatar: { height: 40, width: 40, borderRadius: 20, backgroundColor: '#E8EBDD', alignItems: 'center', justifyContent: 'center' },
  segment: { height: 45, borderRadius: 15, padding: 4, backgroundColor: '#E9EAE2', flexDirection: 'row', marginBottom: 16 },
  segmentItem: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  segmentText: { color: '#898D81', fontSize: 10, fontWeight: '700' },
  segmentTextActive: { color: colors.ink, fontWeight: '800' },
  studioAction: { minHeight: 48, borderRadius: 16, backgroundColor: colors.olive, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 17 },
  studioActionText: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: '800' },
  secondaryAction: { minHeight: 40, borderRadius: 14, backgroundColor: '#F0F2E9', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: -5, marginBottom: 13 },
  secondaryActionText: { flex: 1, color: colors.oliveDeep, fontSize: 9, fontWeight: '800' },
  dayRail: { gap: 8, paddingBottom: 19 },
  dayCard: { width: 56, height: 67, borderRadius: 16, borderWidth: 1, borderColor: '#E5E5DD', backgroundColor: '#FBFBF7', alignItems: 'center', justifyContent: 'center', gap: 4 },
  daySelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayName: { color: '#777D70', fontSize: 9, fontWeight: '700' },
  dayNumber: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  daySelectedText: { color: '#FFFFFF' },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 11 },
  list: { gap: 9 },
  mealCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEBE4', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 9 },
  mealMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealIcon: { height: 38, width: 38, borderRadius: 13, backgroundColor: '#F0F2E9', alignItems: 'center', justifyContent: 'center' },
  mealTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  mealMeta: { color: '#92958A', fontSize: 9, marginTop: 4 },
  nutritionMeta: { color: colors.oliveDeep, fontSize: 9, fontWeight: '700', marginTop: 5 },
  removeMeal: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingVertical: 3 },
  removeMealText: { color: '#8B907F', fontSize: 9, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 45, paddingHorizontal: 28 },
  emptyIcon: { height: 66, width: 66, borderRadius: 24, backgroundColor: '#E7EBDD', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  emptyCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  inputRow: { height: 46, backgroundColor: '#ECECE5', borderRadius: 15, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 },
  input: { flex: 1, fontSize: 11, color: colors.ink },
  addButton: { height: 32, width: 32, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  shoppingRow: { minHeight: 60, borderRadius: 16, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEBE4', flexDirection: 'row', alignItems: 'center', gap: 11 },
  check: { height: 21, width: 21, borderWidth: 1.5, borderColor: '#C9CCBF', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.olive, borderColor: colors.olive },
  shoppingName: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  crossed: { color: '#92958A', textDecorationLine: 'line-through' },
  delete: { width: 27, height: 32, alignItems: 'center', justifyContent: 'center' },
});
