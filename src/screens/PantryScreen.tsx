import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ResponsiveIonicons as Ionicons, ResponsiveText as Text, ResponsiveTextInput as TextInput } from '../components/ResponsiveUI';
import type { PantryCategory, PantryItem, ProductDetails } from '../types';
import { colors, radius } from '../theme';

type Props = {
  pantry: PantryItem[];
  onAddIngredients: (value: string, details?: { quantity?: string; expiresAt?: string; productDetails?: ProductDetails }) => void;
  onToggleIngredient: (id: string) => void;
  onRemoveIngredient: (id: string) => void;
  onUpdateIngredient: (id: string, details: { quantity?: string; expiresAt?: string }) => void;
  onScanFridge: () => void;
  onScanReceipt: () => void;
  onScanBarcode: () => void;
  isScanning: boolean;
  onOpenAccount: () => void;
};

const categories: Array<'All' | PantryCategory> = ['All', 'Produce', 'Protein', 'Dairy', 'Pantry', 'Other'];
const categoryIcon: Record<PantryCategory, keyof typeof Ionicons.glyphMap> = {
  Produce: 'leaf-outline', Protein: 'fish-outline', Dairy: 'water-outline', Pantry: 'file-tray-stacked-outline', Other: 'basket-outline',
};
const validDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
const todayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};
const dateKeyAfter = (days: number) => {
  const date = new Date(); date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function PantryScreen({ pantry, onAddIngredients, onToggleIngredient, onRemoveIngredient, onUpdateIngredient, onScanFridge, onScanReceipt, onScanBarcode, isScanning, onOpenAccount }: Props) {
  const [filter, setFilter] = useState<'All' | PantryCategory>('All');
  const [draft, setDraft] = useState('');
  const [quantityDraft, setQuantityDraft] = useState('');
  const [expiryDraft, setExpiryDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const visible = useMemo(() => filter === 'All' ? pantry : pantry.filter((item) => item.category === filter), [filter, pantry]);
  const add = () => {
    if (!draft.trim()) return;
    if (expiryDraft && !validDateOnly(expiryDraft)) { Alert.alert('Check the date', 'Use a real date in YYYY-MM-DD format.'); return; }
    if ((quantityDraft.trim() || expiryDraft.trim()) && draft.split(/[\n,;]+/).filter((name) => name.trim()).length > 1) { Alert.alert('Add one item for these details', 'Add a single ingredient when setting its quantity or best-before date.'); return; }
    onAddIngredients(draft, { quantity: quantityDraft.trim() || undefined, expiresAt: expiryDraft.trim() || undefined });
    setDraft(''); setQuantityDraft(''); setExpiryDraft('');
  };
  const startEdit = (item: PantryItem) => {
    setEditingId(item.id); setEditQuantity(item.quantity ?? ''); setEditExpiry(item.expiresAt ?? '');
  };
  const saveEdit = (id: string) => {
    if (editExpiry && !validDateOnly(editExpiry)) { Alert.alert('Check the date', 'Use a real date in YYYY-MM-DD format.'); return; }
    onUpdateIngredient(id, { quantity: editQuantity.trim() || undefined, expiresAt: editExpiry.trim() || undefined });
    setEditingId(null);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View><Text style={styles.heading}>My pantry</Text></View>
        <Pressable onPress={onOpenAccount} style={styles.avatar}><Ionicons name="person-outline" size={18} color={colors.oliveDeep} /></Pressable>
      </View>

      <View style={styles.addCard}>
        <Text style={styles.addTitle}>Add ingredients</Text>
        <View style={styles.inputRow}>
          <Ionicons name="search-outline" size={17} color="#999C91" />
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={add} placeholder="e.g. salmon, rice, broccoli" placeholderTextColor="#A4A69E" style={styles.input} returnKeyType="done" />
          <Pressable onPress={add} style={styles.addButton} accessibilityLabel="Add to pantry"><Ionicons name="add" size={20} color={colors.card} /></Pressable>
        </View>
        <View style={styles.detailsRow}>
          <TextInput value={quantityDraft} onChangeText={setQuantityDraft} placeholder="Quantity (optional)" placeholderTextColor="#A4A69E" style={styles.detailInput} />
          <TextInput value={expiryDraft} onChangeText={setExpiryDraft} placeholder="Best before YYYY-MM-DD" placeholderTextColor="#A4A69E" style={styles.detailInput} autoCapitalize="none" />
        </View>
        <View style={styles.scanActions}>
          <Pressable onPress={onScanFridge} disabled={isScanning} style={[styles.scanButton, isScanning && styles.scanDisabled]}><Ionicons name={isScanning ? 'hourglass-outline' : 'camera-outline'} size={15} color={colors.oliveDeep} /><Text style={styles.scanText}>{isScanning ? 'Scanning…' : 'Fridge photo'}</Text></Pressable>
          <Pressable onPress={onScanReceipt} disabled={isScanning} style={[styles.scanButton, isScanning && styles.scanDisabled]}><Ionicons name="receipt-outline" size={15} color={colors.oliveDeep} /><Text style={styles.scanText}>Receipt</Text></Pressable>
          <Pressable onPress={onScanBarcode} disabled={isScanning} style={[styles.scanButton, isScanning && styles.scanDisabled]}><Ionicons name="barcode-outline" size={15} color={colors.oliveDeep} /><Text style={styles.scanText}>Barcode</Text></Pressable>
        </View>
        <Text style={styles.scanPrivacy}>Photos go to Groq for recognition and aren’t stored in your account.</Text>
      </View>

      <View style={styles.sectionHeader}><Text style={styles.listTitle}>Ingredients</Text><Text style={styles.count}>{pantry.length} items</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        {categories.map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}
      </ScrollView>

      <View style={styles.items}>
        {visible.map((item, index) => (
          <View key={item.id}>
          <Animated.View entering={FadeInDown.delay(index * 30).springify().damping(22)} style={styles.item}>
            <Pressable onPress={() => onToggleIngredient(item.id)} style={[styles.check, item.selected && styles.checked]} accessibilityRole="checkbox" accessibilityState={{ checked: item.selected }}>
              {item.selected && <Ionicons name="checkmark" size={14} color={colors.ink} />}
            </Pressable>
            <View style={styles.itemIcon}><Ionicons name={categoryIcon[item.category]} size={17} color="#65704E" /></View>
            <View style={{ flex: 1 }}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemMeta}>{[item.quantity, item.category, item.householdId ? 'Shared' : null].filter(Boolean).join(' · ')}</Text></View>
            {item.expiresAt && <View style={[styles.expiry, item.expiresAt <= dateKeyAfter(3) && styles.expiryHot]}><Text style={[styles.expiryText, item.expiresAt <= dateKeyAfter(3) && styles.expiryTextHot]}>{item.expiresAt < todayKey() ? 'PAST DUE' : 'USE BY'} {item.expiresAt.slice(5)}</Text></View>}
            <Pressable onPress={() => editingId === item.id ? setEditingId(null) : startEdit(item)} hitSlop={8} style={styles.remove} accessibilityLabel={`Edit ${item.name}`}><Ionicons name="create-outline" size={16} color="#707668" /></Pressable>
            <Pressable onPress={() => onRemoveIngredient(item.id)} hitSlop={8} style={styles.remove} accessibilityLabel={`Remove ${item.name}`}><Ionicons name="close" size={15} color="#9C9F95" /></Pressable>
          </Animated.View>
          {editingId === item.id && <View style={styles.editCard}>
            <Text style={styles.editTitle}>Update {item.name}</Text>
            <View style={styles.detailsRow}>
              <TextInput value={editQuantity} onChangeText={setEditQuantity} placeholder="Quantity" placeholderTextColor="#A4A69E" style={styles.detailInput} />
              <TextInput value={editExpiry} onChangeText={setEditExpiry} placeholder="Best before YYYY-MM-DD" placeholderTextColor="#A4A69E" style={styles.detailInput} autoCapitalize="none" />
            </View>
            <Pressable onPress={() => saveEdit(item.id)} style={styles.saveEdit}><Text style={styles.saveEditText}>Save details</Text></Pressable>
          </View>}
          {item.productDetails && <ProductFacts details={item.productDetails} />}
          </View>
        ))}
        {!visible.length && <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing in this aisle yet</Text><Text style={styles.emptyText}>Add an ingredient above and it’ll find a home here.</Text></View>}
      </View>

      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

function ProductFacts({ details }: { details: ProductDetails }) {
  const nutrition = [
    details.caloriesKcalPer100g !== undefined ? `${details.caloriesKcalPer100g} kcal` : null,
    details.proteinGramsPer100g !== undefined ? `${details.proteinGramsPer100g} g protein` : null,
    details.carbsGramsPer100g !== undefined ? `${details.carbsGramsPer100g} g carbs` : null,
    details.fatGramsPer100g !== undefined ? `${details.fatGramsPer100g} g fat` : null,
  ].filter(Boolean).join(' · ');
  return <View style={styles.productFacts}>
    <View style={styles.productHeading}><Ionicons name="barcode-outline" size={13} color={colors.oliveDeep} /><Text style={styles.productTitle}>{details.brand ? `${details.brand} · ` : ''}Open Food Facts</Text><Text style={styles.productBasis}>PER 100 G</Text></View>
    <Text style={styles.productNutrition}>{nutrition || 'Nutrition details are not available for this product.'}</Text>
    {details.allergens?.length ? <Text style={styles.productAllergens}>Allergen data: {details.allergens.join(', ')}. Check the product label before eating.</Text> : <Text style={styles.productAllergens}>Allergen data is not available. Check the product label before eating.</Text>}
    {details.ingredientsText ? <Text style={styles.productIngredients} numberOfLines={2}>Ingredients: {details.ingredientsText}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  heading: { color: colors.ink, fontSize: 29, lineHeight: 34, letterSpacing: -1, fontWeight: '800' },
  avatar: { height: 40, width: 40, borderRadius: 20, backgroundColor: '#E8EBDD', alignItems: 'center', justifyContent: 'center' },
  addCard: { backgroundColor: '#FFFFFF', borderRadius: radius.md, padding: 15, borderWidth: 1, borderColor: '#ECEBE4' },
  addTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  inputRow: { height: 45, backgroundColor: '#F3F3EE', borderRadius: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, fontSize: 11, color: colors.ink },
  detailsRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  detailInput: { height: 38, flex: 1, borderRadius: 12, backgroundColor: '#F3F3EE', paddingHorizontal: 10, fontSize: 10, color: colors.ink },
  scanActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  scanButton: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, paddingHorizontal: 9, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: '#F0F2E9' },
  scanText: { color: colors.oliveDeep, fontSize: 9, fontWeight: '800' },
  scanDisabled: { opacity: 0.55 },
  scanPrivacy: { color: '#92968A', fontSize: 8, lineHeight: 12, marginTop: 4 },
  addButton: { height: 31, width: 31, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 25, marginBottom: 11 },
  listTitle: { color: colors.ink, fontWeight: '800', fontSize: 16, letterSpacing: -0.35 },
  count: { color: '#8A907E', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  filterRail: { gap: 7, paddingBottom: 13 },
  filter: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: '#E5E5DD', backgroundColor: '#FBFBF7' },
  filterActive: { borderColor: colors.ink, backgroundColor: colors.ink },
  filterText: { color: '#787D71', fontSize: 10, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  items: { gap: 8 },
  item: { minHeight: 68, borderRadius: 17, paddingHorizontal: 11, paddingVertical: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEBE4', flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { height: 20, width: 20, borderWidth: 1.5, borderColor: '#C9CCBF', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.olive, borderColor: colors.olive },
  itemIcon: { height: 37, width: 37, borderRadius: 13, backgroundColor: '#F0F2E9', alignItems: 'center', justifyContent: 'center' },
  itemName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  itemMeta: { color: '#92958A', fontSize: 9, marginTop: 4 },
  expiry: { backgroundColor: '#F0F1E8', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5 },
  expiryHot: { backgroundColor: '#FBE8DC' },
  expiryText: { color: '#7D8666', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 },
  expiryTextHot: { color: '#B3654D' },
  remove: { width: 24, height: 30, alignItems: 'center', justifyContent: 'center' },
  editCard: { marginTop: -4, padding: 12, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, backgroundColor: '#F8F8F3' },
  editTitle: { color: colors.ink, fontSize: 10, fontWeight: '800', marginBottom: 4 },
  saveEdit: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.olive },
  saveEditText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  productFacts: { marginTop: 6, marginLeft: 30, marginRight: 5, padding: 11, borderRadius: 13, backgroundColor: '#F4F5EE', borderWidth: 1, borderColor: '#E6E9DD' },
  productHeading: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  productTitle: { flex: 1, color: colors.oliveDeep, fontSize: 8, fontWeight: '800' },
  productBasis: { color: '#8A907E', fontSize: 7, fontWeight: '800', letterSpacing: 0.6 },
  productNutrition: { color: colors.ink, fontSize: 9, fontWeight: '700', lineHeight: 14, marginTop: 5 },
  productAllergens: { color: '#9B5E47', fontSize: 8, lineHeight: 12, marginTop: 4 },
  productIngredients: { color: '#777D70', fontSize: 8, lineHeight: 12, marginTop: 4 },
  empty: { alignItems: 'center', padding: 25, backgroundColor: '#FFFFFF', borderRadius: 17 },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 10, marginTop: 5, textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 3 },
  noteText: { color: '#85897E', flex: 1, fontSize: 10, lineHeight: 15 },
});
