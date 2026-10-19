import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { RecipeCard } from '../components/RecipeCard';
import { ResponsiveIonicons as Ionicons, ResponsiveText as Text, ResponsiveTextInput as TextInput } from '../components/ResponsiveUI';
import type { Recipe, RecipeCollection } from '../types';
import { colors, radius } from '../theme';

const builtInCollections = [
  { key: 'all', label: 'All' },
  { key: 'quick', label: 'Quick' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'protein', label: 'High protein' },
] as const;

export function SavedScreen({ recipes, collections, onOpenRecipe, onToggleSaved, onOpenAccount, onCreateCollection, onAssignCollection }: {
  recipes: Recipe[];
  collections: RecipeCollection[];
  onOpenRecipe: (recipe: Recipe) => void;
  onToggleSaved: (recipe: Recipe) => void;
  onOpenAccount: () => void;
  onCreateCollection: (name: string) => Promise<boolean>;
  onAssignCollection: (recipe: Recipe, collectionId: string | null) => Promise<boolean>;
}) {
  const [search, setSearch] = useState('');
  const [collection, setCollection] = useState('all');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [organizingRecipe, setOrganizingRecipe] = useState<Recipe | null>(null);
  const [savingCollection, setSavingCollection] = useState(false);
  const visibleRecipes = useMemo(() => recipes.filter((recipe) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [recipe.title, recipe.summary, ...recipe.tags, ...recipe.ingredients.map((item) => item.name)].some((value) => value.toLowerCase().includes(query));
    if (!matchesSearch) return false;
    if (collection.startsWith('folder:')) return recipe.collectionId === collection.slice('folder:'.length);
    if (collection === 'quick') return recipe.timeMinutes <= 25;
    if (collection === 'vegetarian') return !recipe.ingredients.some((ingredient) => /chicken|beef|pork|fish|salmon|shrimp|prawn|bacon|sausage|turkey/i.test(ingredient.name));
    if (collection === 'protein') return (recipe.nutritionPerServing?.proteinGrams ?? 0) >= 25 || recipe.tags.some((tag) => /protein/i.test(tag));
    return true;
  }), [collection, recipes, search]);

  const createCollection = async () => {
    const name = newCollectionName.trim();
    if (!name || savingCollection) return;
    setSavingCollection(true);
    try {
      if (await onCreateCollection(name)) setNewCollectionName('');
    } finally { setSavingCollection(false); }
  };

  const assignCollection = async (collectionId: string | null) => {
    if (!organizingRecipe) return;
    setSavingCollection(true);
    try {
      if (await onAssignCollection(organizingRecipe, collectionId)) setOrganizingRecipe(null);
    } finally { setSavingCollection(false); }
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.heading}>Your recipe box</Text>
          <Pressable onPress={onOpenAccount} style={styles.avatar}><Ionicons name="person-outline" size={18} color={colors.oliveDeep} /></Pressable>
        </View>
        {recipes.length > 0 && <>
          <View style={styles.searchBox}><Ionicons name="search-outline" size={16} color="#858A7D" /><TextInput value={search} onChangeText={setSearch} placeholder="Search your recipe box" placeholderTextColor="#9B9F94" style={styles.searchInput} /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionRail}>
            {builtInCollections.map((item) => <Pressable key={item.key} onPress={() => setCollection(item.key)} style={[styles.collection, collection === item.key && styles.collectionActive]}><Text style={[styles.collectionText, collection === item.key && styles.collectionTextActive]}>{item.label}</Text></Pressable>)}
            {collections.map((item) => {
              const key = `folder:${item.id}`;
              return <Pressable key={item.id} onPress={() => setCollection(key)} style={[styles.collection, collection === key && styles.collectionActive]}><Text style={[styles.collectionText, collection === key && styles.collectionTextActive]}>{item.name}</Text></Pressable>;
            })}
          </ScrollView>
        </>}
        <View style={styles.createFolderRow}>
          <TextInput value={newCollectionName} onChangeText={setNewCollectionName} placeholder="New recipe folder" placeholderTextColor="#9B9F94" maxLength={40} returnKeyType="done" onSubmitEditing={() => void createCollection()} style={styles.folderInput} />
          <Pressable onPress={() => void createCollection()} disabled={!newCollectionName.trim() || savingCollection} style={[styles.createButton, (!newCollectionName.trim() || savingCollection) && styles.createButtonDisabled]}><Ionicons name="add" size={17} color="#FFFFFF" /><Text style={styles.createButtonText}>Create</Text></Pressable>
        </View>
        {visibleRecipes.length ? <View style={styles.list}>{visibleRecipes.map((recipe, index) => {
          const folderName = collections.find((entry) => entry.id === recipe.collectionId)?.name;
          return <View key={recipe.id} style={styles.recipeWrap}>
            <RecipeCard recipe={recipe} index={index} onPress={() => onOpenRecipe(recipe)} onSave={() => onToggleSaved(recipe)} isSaved />
            <Pressable onPress={() => setOrganizingRecipe(recipe)} style={styles.organizeButton}><Ionicons name="folder-open-outline" size={14} color={colors.oliveDeep} /><Text style={styles.organizeText}>{folderName ?? 'Unsorted'} · Organize</Text><Ionicons name="chevron-forward" size={13} color="#8A907E" /></Pressable>
          </View>;
        })}</View> : recipes.length > 0 ? (
          <View style={styles.empty}><View style={styles.emptyPlate}><Ionicons name="search-outline" size={27} color={colors.oliveDeep} /></View><Text style={styles.emptyTitle}>No recipe matches that</Text><Text style={styles.emptyText}>Try a different search or collection filter.</Text></View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyPlate}><Ionicons name="restaurant-outline" size={31} color={colors.oliveDeep} /></View>
            <Text style={styles.emptyTitle}>Your recipe box is waiting</Text>
            <Text style={styles.emptyText}>Bookmark a meal to save it here.</Text>
          </View>
        )}
        <View style={{ height: 22 }} />
      </ScrollView>

      <Modal visible={Boolean(organizingRecipe)} transparent animationType="fade" onRequestClose={() => setOrganizingRecipe(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose a folder</Text>
            <Text style={styles.modalCopy} numberOfLines={2}>{organizingRecipe?.title}</Text>
            <ScrollView style={styles.folderOptions}>
              <Pressable disabled={savingCollection} onPress={() => void assignCollection(null)} style={styles.folderOption}><View style={styles.folderIcon}><Ionicons name="file-tray-outline" size={17} color={colors.oliveDeep} /></View><Text style={styles.folderOptionText}>Unsorted</Text>{!organizingRecipe?.collectionId && <Ionicons name="checkmark-circle" size={19} color={colors.oliveDeep} />}</Pressable>
              {collections.map((item) => <Pressable key={item.id} disabled={savingCollection} onPress={() => void assignCollection(item.id)} style={styles.folderOption}><View style={styles.folderIcon}><Ionicons name="folder-outline" size={17} color={colors.oliveDeep} /></View><Text style={styles.folderOptionText}>{item.name}</Text>{organizingRecipe?.collectionId === item.id && <Ionicons name="checkmark-circle" size={19} color={colors.oliveDeep} />}</Pressable>)}
              {!collections.length && <Text style={styles.noFolders}>Create a folder in your recipe box first.</Text>}
            </ScrollView>
            <Pressable onPress={() => setOrganizingRecipe(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Done</Text></Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 },
  heading: { color: colors.ink, fontSize: 28, lineHeight: 34, letterSpacing: -1, fontWeight: '800' },
  avatar: { height: 40, width: 40, borderRadius: 20, backgroundColor: '#E8EBDD', alignItems: 'center', justifyContent: 'center' },
  searchBox: { height: 44, borderRadius: 14, paddingHorizontal: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: '#ECEBE4', flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 11 },
  collectionRail: { gap: 7, paddingRight: 20, paddingBottom: 12 },
  collection: { borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FBFBF7', borderWidth: 1, borderColor: '#E5E5DD' },
  collectionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  collectionText: { color: '#777D70', fontSize: 9, fontWeight: '700' },
  collectionTextActive: { color: '#FFFFFF' },
  createFolderRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  folderInput: { flex: 1, height: 40, borderWidth: 1, borderColor: '#E6E5DC', borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: 12, color: colors.ink, fontSize: 11 },
  createButton: { height: 40, borderRadius: 12, paddingHorizontal: 13, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 3 },
  createButtonDisabled: { opacity: 0.45 },
  createButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  list: { gap: 14 },
  recipeWrap: { gap: 6 },
  organizeButton: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28, paddingHorizontal: 5 },
  organizeText: { color: '#687052', fontSize: 9, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 55, paddingHorizontal: 28 },
  emptyPlate: { height: 82, width: 82, borderRadius: 30, backgroundColor: '#E7EBDD', alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.5 },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(23, 27, 18, 0.4)', justifyContent: 'flex-end', padding: 14 },
  modalCard: { backgroundColor: colors.paper, borderRadius: 24, padding: 20, maxHeight: '75%' },
  modalTitle: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  modalCopy: { color: colors.muted, fontSize: 11, marginTop: 5, marginBottom: 12 },
  folderOptions: { maxHeight: 300 },
  folderOption: { minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#E8E7DE', flexDirection: 'row', alignItems: 'center', gap: 10 },
  folderIcon: { height: 30, width: 30, borderRadius: 10, backgroundColor: '#E9EDDC', alignItems: 'center', justifyContent: 'center' },
  folderOptionText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '700' },
  noFolders: { color: colors.muted, fontSize: 11, paddingVertical: 15 },
  cancelButton: { alignItems: 'center', justifyContent: 'center', height: 43, backgroundColor: '#E9EDDC', borderRadius: 14, marginTop: 13 },
  cancelText: { color: colors.oliveDeep, fontSize: 11, fontWeight: '800' },
});
