import type { User } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown, FadeOut, SlideInDown } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthSheet } from './src/components/AuthSheet';
import { AuthFlow } from './src/components/AuthFlow';
import { ResponsiveIonicons as Ionicons, ResponsiveText as Text } from './src/components/ResponsiveUI';
import { BarcodeScannerSheet } from './src/components/BarcodeScannerSheet';
import { BottomTabs } from './src/components/BottomTabs';
import { HouseholdSheet } from './src/components/HouseholdSheet';
import { PlanDateSheet } from './src/components/PlanDateSheet';
import { RECIPES, categorizeIngredient, rankRecipes } from './src/data/recipes';
import { generateMeals, generateWeeklyPlan, remixMeal } from './src/lib/mealGenerator';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import { HomeScreen } from './src/screens/HomeScreen';
import { PantryScreen } from './src/screens/PantryScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { RecipeDetailScreen } from './src/screens/RecipeDetailScreen';
import { SavedScreen } from './src/screens/SavedScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import type { MiseChatMessage } from './src/screens/ChatScreen';
import type { AppTab, GeneratorMode, Household, MealHistoryItem, PantryItem, PlanSection, PlannedMeal, ProductDetails, ProfilePreferences, Recipe, RecipeCollection, ShoppingItem } from './src/types';
import { colors } from './src/theme';

const DEFAULT_PREFERENCES: ProfilePreferences = { dietaryPreferences: [], allergies: [], defaultServings: 2, maxCookMinutes: null, budgetLevel: 'balanced', equipment: [], skillLevel: 'beginner', cookingDaysPerWeek: 5, macroTargets: { calories: null, proteinGrams: null, carbsGrams: null, fatGrams: null } };

function mapHousehold(data: unknown): Household | null {
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== 'object') return null;
  const row = data[0] as Record<string, unknown>;
  if (typeof row.household_id !== 'string' || typeof row.household_name !== 'string' || typeof row.invite_code !== 'string') return null;
  return { id: row.household_id, name: row.household_name, inviteCode: row.invite_code, memberCount: Number(row.member_count) || 1 };
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function pantryFingerprint(items: PantryItem[]) {
  return JSON.stringify(items.map(({ name, category, quantity, expiresAt, selected, householdId, productDetails }) => ({
    name: name.toLowerCase(), category, quantity: quantity ?? '', expiresAt: expiresAt ?? '', selected, householdId: householdId ?? '', productDetails: productDetails ?? null,
  })).sort((a, b) => `${a.householdId}:${a.name}`.localeCompare(`${b.householdId}:${b.name}`)));
}

function shoppingFingerprint(items: ShoppingItem[]) {
  return JSON.stringify(items.map(({ name, quantity, checked, householdId }) => ({ name: name.toLowerCase(), quantity: quantity ?? '', checked, householdId: householdId ?? '' }))
    .sort((a, b) => `${a.householdId}:${a.name}`.localeCompare(`${b.householdId}:${b.name}`)));
}

function matchesPreferences(recipe: Recipe, preferences: ProfilePreferences) {
  const names = recipe.ingredients.map((item) => item.name.toLowerCase());
  const contains = (pattern: RegExp) => names.some((name) => pattern.test(name));
  const allergyGroups: Array<{ labels: RegExp; ingredients: string[] }> = [
    { labels: /\b(?:tree\s+nuts?|nuts?)\b/, ingredients: ['almond', 'hazelnut', 'walnut', 'cashew', 'pistachio', 'pecan', 'macadamia', 'nut'] },
    { labels: /\b(?:peanuts?|groundnuts?)\b/, ingredients: ['peanut', 'groundnut'] },
    { labels: /\b(?:dairy|milk)\b/, ingredients: ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'whey', 'casein'] },
    { labels: /\bshellfish\b/, ingredients: ['shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'shellfish'] },
    { labels: /\bfish\b/, ingredients: ['fish', 'salmon', 'tuna', 'cod', 'anchovy', 'sardine'] },
    { labels: /\b(?:wheat|gluten)\b/, ingredients: ['wheat', 'bread', 'flour', 'pasta', 'orzo', 'barley', 'rye', 'couscous', 'seitan'] },
    { labels: /\b(?:soy|soya)\b/, ingredients: ['soy', 'soya', 'tofu', 'edamame', 'miso'] },
    { labels: /\beggs?\b/, ingredients: ['egg'] },
    { labels: /\bsesame\b/, ingredients: ['sesame', 'tahini'] },
  ];
  const blockedAllergen = preferences.allergies.some((allergy) => {
    const value = allergy.trim();
    if (!value) return false;
    const group = allergyGroups.find((candidate) => candidate.labels.test(value));
    const terms = group?.ingredients ?? [value];
    return terms.some((term) => contains(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')));
  });
  if (preferences.maxCookMinutes && recipe.timeMinutes > preferences.maxCookMinutes) return false;
  if (blockedAllergen) return false;
  if (preferences.dietaryPreferences.includes('Vegetarian') && contains(/chicken|beef|pork|fish|salmon|shrimp|prawn|bacon|sausage|turkey|anchovy/)) return false;
  if (preferences.dietaryPreferences.includes('Vegan') && contains(/chicken|beef|pork|fish|salmon|shrimp|prawn|bacon|sausage|turkey|egg|milk|cheese|yogurt|cream|butter|honey|gelatin/)) return false;
  if (preferences.dietaryPreferences.includes('Pescatarian') && contains(/chicken|beef|pork|bacon|sausage|turkey/)) return false;
  if (preferences.dietaryPreferences.includes('Gluten-free') && contains(/wheat|bread|pasta|orzo|flour|noodle|couscous|soy sauce/)) return false;
  if (preferences.dietaryPreferences.includes('Dairy-free') && contains(/milk|cheese|yogurt|yoghurt|cream|butter|parmesan|feta/)) return false;
  if (preferences.dietaryPreferences.includes('Keto') && contains(/rice|pasta|bread|flour|potato|corn|sugar|honey|oat|quinoa|couscous|noodle|banana/)) return false;
  if (preferences.dietaryPreferences.includes('Paleo') && contains(/rice|pasta|bread|flour|oat|quinoa|couscous|bean|lentil|chickpea|peanut|soy|tofu|milk|cheese|yogurt|butter|sugar/)) return false;
  return true;
}

function matchesMacroTargets(recipe: Recipe, preferences: ProfilePreferences) {
  const target = preferences.macroTargets;
  if (!Object.values(target).some((value) => value !== null)) return true;
  const nutrition = recipe.nutritionPerServing;
  if (!nutrition) return false;
  return (target.calories === null || nutrition.calories <= target.calories)
    && (target.proteinGrams === null || nutrition.proteinGrams >= target.proteinGrams)
    && (target.carbsGrams === null || nutrition.carbsGrams <= target.carbsGrams)
    && (target.fatGrams === null || nutrition.fatGrams <= target.fatGrams);
}

function RootApp() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [planSection, setPlanSection] = useState<PlanSection>('Plan');
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const pantryRef = useRef<PantryItem[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [recipeCollections, setRecipeCollections] = useState<RecipeCollection[]>([]);
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const shoppingRef = useRef<ShoppingItem[]>([]);
  const lastPantryFingerprint = useRef('');
  const lastShoppingFingerprint = useRef('');
  const [mealHistory, setMealHistory] = useState<MealHistoryItem[]>([]);
  const [preferences, setPreferences] = useState<ProfilePreferences>(DEFAULT_PREFERENCES);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdOpen, setHouseholdOpen] = useState(false);
  const [householdBusy, setHouseholdBusy] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [pantrySynced, setPantrySynced] = useState(false);
  const [shoppingSynced, setShoppingSynced] = useState(false);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<MiseChatMessage[]>([]);
  const [chatOwnerId, setChatOwnerId] = useState<string | null>(null);
  const chatClearInProgress = useRef(false);
  const [generatedRecipes, setGeneratedRecipes] = useState<Recipe[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingWeek, setIsGeneratingWeek] = useState(false);
  const [isTrackingMeal, setIsTrackingMeal] = useState(false);
  const [isRemixing, setIsRemixing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [planRecipe, setPlanRecipe] = useState<Recipe | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userName = user?.user_metadata?.name || user?.email?.split('@')[0];
  pantryRef.current = pantry;
  shoppingRef.current = shoppingItems;

  useEffect(() => {
    if (!supabase) { setAuthChecked(true); return; }
    const client = supabase;
    client.auth.getSession()
      .then(({ data }) => { setUser(data.session?.user ?? null); setAuthChecked(true); })
      .catch(() => setAuthChecked(true));
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setAuthChecked(true);
      if (!nextUser) {
        setHousehold(null);
        setPantry([]);
        setSavedRecipes([]);
        setRecipeCollections([]);
        setPlannedMeals([]);
        setShoppingItems([]);
        setMealHistory([]);
        setPreferences(DEFAULT_PREFERENCES);
        setGeneratedRecipes(null);
        setActiveRecipe(null);
        setActiveTab('home');
        setToast('');
        setChatMessages([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setChatMessages([]);
      setChatOwnerId(null);
      return;
    }
    setChatOwnerId(null);
    try {
      const raw = localStorage.getItem(`mise.chat.${user.id}`);
      const decoded: unknown = raw ? JSON.parse(raw) : [];
      const restored = Array.isArray(decoded)
        ? decoded.filter((item): item is MiseChatMessage => Boolean(item) && typeof item === 'object'
          && typeof item.id === 'string' && (item.role === 'user' || item.role === 'assistant')
          && typeof item.content === 'string' && typeof item.createdAt === 'string').slice(-40)
        : [];
      setChatMessages(restored);
    } catch {
      setChatMessages([]);
    }
    setChatOwnerId(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user || chatOwnerId !== user.id) return;
    try {
      const key = `mise.chat.${user.id}`;
      if (chatMessages.length) localStorage.setItem(key, JSON.stringify(chatMessages.slice(-40)));
      else localStorage.removeItem(key);
    } catch { /* conversation remains available in memory for the current session */ }
  }, [chatMessages, chatOwnerId, user?.id]);

  useEffect(() => {
    if (!supabase || !user || chatOwnerId !== user.id || !chatMessages.length || chatClearInProgress.current) return;
    const client = supabase;
    const userId = user.id;
    const records = chatMessages.slice(-40).map((message) => ({
      user_id: userId,
      id: message.id,
      role: message.role,
      content: message.content,
      created_at: message.createdAt,
    }));
    const timer = setTimeout(() => {
      void client.from('mise_chat_messages').upsert(records, { onConflict: 'user_id,id', ignoreDuplicates: true })
        .then(({ error }) => { if (error) console.warn('Chat sync upload failed:', error.message); });
    }, 850);
    return () => clearTimeout(timer);
  }, [chatMessages, chatOwnerId, user?.id]);

  useEffect(() => {
    if (!supabase || !user) { setHousehold(null); return; }
    const client = supabase;
    let alive = true;
    Promise.resolve(client.rpc('my_household')).then(({ data, error }) => {
      if (!alive) return;
      const row = !error && Array.isArray(data) ? data[0] : null;
      setHousehold(row ? { id: row.household_id, name: row.household_name, inviteCode: row.invite_code, memberCount: row.member_count } : null);
    }).catch(() => { if (alive) setHousehold(null); });
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const handleUrl = async (url: string) => {
      const query = url.split('?')[1]?.split('#')[0] ?? '';
      const fragment = url.split('#')[1] ?? '';
      const params = new URLSearchParams(`${query}&${fragment}`);
      if (params.get('type') !== 'recovery') return;
      const code = params.get('code');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const result = code
        ? await client.auth.exchangeCodeForSession(url)
        : accessToken && refreshToken
          ? await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          : null;
      if (!result || result.error) { Alert.alert('Recovery link expired', 'Request another password reset email and open the newest link.'); return; }
      setPasswordRecovery(true);
      setAccountOpen(true);
    };
    Linking.getInitialURL().then((url) => { if (url) void handleUrl(url); });
    const subscription = Linking.addEventListener('url', ({ url }) => { void handleUrl(url); });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!supabase || !user) {
      setPantry([]);
      setSavedRecipes([]);
      setRecipeCollections([]);
      setPlannedMeals([]);
      setShoppingItems([]);
      setMealHistory([]);
      setPreferences(DEFAULT_PREFERENCES);
      setPantrySynced(false);
      setShoppingSynced(false);
      return;
    }
    const client = supabase;
    let alive = true;
    setPantrySynced(false);
    setPantry([]);
    setSavedRecipes([]);
    setRecipeCollections([]);
    setShoppingSynced(false);
    setShoppingItems([]);
    setPlannedMeals([]);
    setMealHistory([]);
    const sharedPantryQuery = household
      ? client.from('household_pantry_items').select('id,name,category,quantity,expires_at,is_selected,product_details,household_id').eq('household_id', household.id).order('created_at')
      : Promise.resolve({ data: [], error: null });
    const sharedShoppingQuery = household
      ? client.from('household_shopping_list_items').select('id,name,quantity,is_checked,household_id').eq('household_id', household.id).order('created_at')
      : Promise.resolve({ data: [], error: null });
    Promise.all([
      client.from('pantry_items').select('id,name,category,quantity,expires_at,is_selected,product_details').order('created_at'),
      client.from('saved_recipes').select('recipe_id,recipe,collection_id').order('created_at', { ascending: false }),
      client.from('recipe_collections').select('id,name').order('name'),
      client.from('profiles').select('dietary_preferences,allergies,default_servings,max_cook_minutes,budget_level,equipment,skill_level,cooking_days_per_week,target_calories,target_protein_grams,target_carbs_grams,target_fat_grams').eq('id', user.id).maybeSingle(),
      client.from('meal_plans').select('id,planned_for,recipe').gte('planned_for', new Date().toISOString().slice(0, 10)).order('planned_for'),
      client.from('shopping_list_items').select('id,name,quantity,is_checked').order('created_at'),
      client.from('meal_history').select('id,cooked_at,recipe').order('cooked_at', { ascending: false }).limit(30),
      sharedPantryQuery,
      sharedShoppingQuery,
    ]).then(([pantryResult, savedResult, collectionsResult, profileResult, planResult, shoppingResult, historyResult, sharedPantryResult, sharedShoppingResult]) => {
      if (!alive) return;
      const personalPantry: PantryItem[] = !pantryResult.error ? pantryResult.data.map((row) => ({
          id: row.id,
          name: row.name,
          category: row.category as PantryItem['category'],
          quantity: row.quantity ?? undefined,
          expiresAt: row.expires_at ?? undefined,
          selected: row.is_selected,
          productDetails: (row.product_details as ProductDetails | null) ?? undefined,
        })) : [];
      const sharedPantry: PantryItem[] = !sharedPantryResult.error ? sharedPantryResult.data.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category as PantryItem['category'],
        quantity: row.quantity ?? undefined,
        expiresAt: row.expires_at ?? undefined,
        selected: row.is_selected,
        householdId: row.household_id,
        productDetails: (row.product_details as ProductDetails | null) ?? undefined,
      })) : [];
      const allPantry = [...personalPantry, ...sharedPantry];
      lastPantryFingerprint.current = pantryFingerprint(allPantry);
      setPantry(allPantry);
      if (!savedResult.error) {
        setSavedRecipes(savedResult.data.map((row) => ({ ...(row.recipe as Recipe), collectionId: row.collection_id ?? undefined })));
      }
      if (!collectionsResult.error) setRecipeCollections(collectionsResult.data.map((row) => ({ id: row.id, name: row.name })));
      if (!profileResult.error && profileResult.data) {
        setPreferences({
          dietaryPreferences: profileResult.data.dietary_preferences ?? [],
          allergies: profileResult.data.allergies ?? [],
          defaultServings: profileResult.data.default_servings ?? 2,
          maxCookMinutes: profileResult.data.max_cook_minutes ?? null,
          budgetLevel: profileResult.data.budget_level ?? 'balanced',
          equipment: profileResult.data.equipment ?? [],
          skillLevel: profileResult.data.skill_level ?? 'beginner',
          cookingDaysPerWeek: profileResult.data.cooking_days_per_week ?? 5,
          macroTargets: {
            calories: profileResult.data.target_calories ?? null,
            proteinGrams: profileResult.data.target_protein_grams ?? null,
            carbsGrams: profileResult.data.target_carbs_grams ?? null,
            fatGrams: profileResult.data.target_fat_grams ?? null,
          },
        });
      }
      if (!planResult.error) setPlannedMeals(planResult.data.map((row) => ({ id: row.id, plannedFor: row.planned_for, recipe: row.recipe as Recipe })));
      const personalShopping: ShoppingItem[] = !shoppingResult.error ? shoppingResult.data.map((row) => ({ id: row.id, name: row.name, quantity: row.quantity ?? undefined, checked: row.is_checked })) : [];
      const sharedShopping: ShoppingItem[] = !sharedShoppingResult.error ? sharedShoppingResult.data.map((row) => ({ id: row.id, name: row.name, quantity: row.quantity ?? undefined, checked: row.is_checked, householdId: row.household_id })) : [];
      const allShopping = [...personalShopping, ...sharedShopping];
      lastShoppingFingerprint.current = shoppingFingerprint(allShopping);
      setShoppingItems(allShopping);
      if (!historyResult.error) setMealHistory(historyResult.data.map((row) => ({ id: row.id, cookedAt: row.cooked_at, recipe: row.recipe as Recipe })));
      setPantrySynced(true);
      setShoppingSynced(true);
    }).catch(() => { if (alive) { setPantrySynced(true); setShoppingSynced(true); } });
    return () => { alive = false; };
  }, [user?.id, household?.id]);

  useEffect(() => {
    if (!supabase || !user || !household) return;
    const client = supabase;
    let alive = true;
    const refreshSharedPantry = async () => {
      const { data, error } = await client.from('household_pantry_items')
        .select('id,name,category,quantity,expires_at,is_selected,product_details,household_id')
        .eq('household_id', household.id).order('created_at');
      if (!alive || error) return;
      const shared = data.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category as PantryItem['category'],
        quantity: row.quantity ?? undefined,
        expiresAt: row.expires_at ?? undefined,
        selected: row.is_selected,
        householdId: row.household_id,
        productDetails: (row.product_details as ProductDetails | null) ?? undefined,
      }));
      const next = [...pantryRef.current.filter((item) => item.householdId !== household.id), ...shared];
      lastPantryFingerprint.current = pantryFingerprint(next);
      pantryRef.current = next;
      setPantry(next);
    };
    const refreshSharedShopping = async () => {
      const { data, error } = await client.from('household_shopping_list_items')
        .select('id,name,quantity,is_checked,household_id').eq('household_id', household.id).order('created_at');
      if (!alive || error) return;
      const shared = data.map((row) => ({ id: row.id, name: row.name, quantity: row.quantity ?? undefined, checked: row.is_checked, householdId: row.household_id }));
      const next = [...shoppingRef.current.filter((item) => item.householdId !== household.id), ...shared];
      lastShoppingFingerprint.current = shoppingFingerprint(next);
      shoppingRef.current = next;
      setShoppingItems(next);
    };
    void Promise.all([refreshSharedPantry(), refreshSharedShopping()]);
    const channel = client.channel(`household-${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_pantry_items', filter: `household_id=eq.${household.id}` }, () => { void refreshSharedPantry(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_shopping_list_items', filter: `household_id=eq.${household.id}` }, () => { void refreshSharedShopping(); })
      .subscribe();
    return () => { alive = false; void client.removeChannel(channel); };
  }, [user?.id, household?.id]);

  useEffect(() => {
    if (!supabase || !user || !pantrySynced || !pantry.length) return;
    const fingerprint = pantryFingerprint(pantry);
    if (fingerprint === lastPantryFingerprint.current) return;
    lastPantryFingerprint.current = fingerprint;
    const client = supabase;
    const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const records = pantry.filter((item) => !item.householdId).map((item) => ({
      user_id: user.id,
      name: item.name,
      normalized_name: normalize(item.name),
      category: item.category,
      quantity: item.quantity ?? null,
      expires_at: item.expiresAt ?? null,
      is_selected: item.selected,
      product_details: item.productDetails ?? null,
    }));
    if (records.length) client.from('pantry_items').upsert(records, { onConflict: 'user_id,normalized_name' });
    const sharedRecords = household ? pantry.filter((item) => item.householdId === household.id).map((item) => ({
      household_id: household.id,
      created_by: user.id,
      name: item.name,
      normalized_name: normalize(item.name),
      category: item.category,
      quantity: item.quantity ?? null,
      expires_at: item.expiresAt ?? null,
      is_selected: item.selected,
      product_details: item.productDetails ?? null,
    })) : [];
    if (sharedRecords.length) client.from('household_pantry_items').upsert(sharedRecords, { onConflict: 'household_id,normalized_name' });
  }, [pantry, pantrySynced, user?.id, household?.id]);

  useEffect(() => {
    if (!supabase || !user || !shoppingSynced || !shoppingItems.length) return;
    const fingerprint = shoppingFingerprint(shoppingItems);
    if (fingerprint === lastShoppingFingerprint.current) return;
    lastShoppingFingerprint.current = fingerprint;
    const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const records = shoppingItems.filter((item) => !item.householdId).map((item) => ({
      user_id: user.id,
      name: item.name,
      normalized_name: normalize(item.name),
      quantity: item.quantity ?? null,
      is_checked: item.checked,
    }));
    if (records.length) supabase.from('shopping_list_items').upsert(records, { onConflict: 'user_id,normalized_name' });
    const sharedRecords = household ? shoppingItems.filter((item) => item.householdId === household.id).map((item) => ({
      household_id: household.id,
      created_by: user.id,
      name: item.name,
      normalized_name: normalize(item.name),
      quantity: item.quantity ?? null,
      is_checked: item.checked,
    })) : [];
    if (sharedRecords.length) supabase.from('household_shopping_list_items').upsert(sharedRecords, { onConflict: 'household_id,normalized_name' });
  }, [shoppingItems, shoppingSynced, user?.id, household?.id]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const selectedIngredients = useMemo(() => pantry.filter((item) => item.selected).map((item) => item.name), [pantry]);
  const expiringItems = useMemo(() => {
    const today = localDateKey(new Date());
    const cutoffDate = new Date(); cutoffDate.setDate(cutoffDate.getDate() + 3);
    const cutoff = localDateKey(cutoffDate);
    return pantry.filter((item) => item.expiresAt && item.expiresAt >= today && item.expiresAt <= cutoff).sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''));
  }, [pantry]);
  const recommendedRecipes = useMemo(() => rankRecipes(RECIPES.filter((recipe) => matchesPreferences(recipe, preferences) && matchesMacroTargets(recipe, preferences)), selectedIngredients).slice(0, 5), [selectedIngredients, preferences]);
  const savedIds = useMemo(() => new Set(savedRecipes.map((recipe) => recipe.id)), [savedRecipes]);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };

  const addIngredients = (input: string, details?: { quantity?: string; expiresAt?: string; productDetails?: ProductDetails }) => {
    const names = input.split(/[\n,;]+/).map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    const itemDetails = names.length === 1 ? details : undefined;
    setPantry((current) => {
      const next = [...current];
      for (const name of names) {
        const existing = next.find((item) => item.name.toLowerCase() === name.toLowerCase() && (household ? item.householdId === household.id : !item.householdId));
        if (existing) {
          existing.selected = true;
          if (itemDetails) { existing.quantity = itemDetails.quantity; existing.expiresAt = itemDetails.expiresAt; existing.productDetails = itemDetails.productDetails; }
          continue;
        }
        next.push({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, category: categorizeIngredient(name), selected: true, householdId: household?.id, ...itemDetails });
      }
      return next;
    });
    setGeneratedRecipes(null);
    Haptics.selectionAsync();
    showToast(names.length > 1 ? `${names.length} ingredients added to your pantry` : `${names[0]} added to your pantry`);
  };

  const updateIngredient = (id: string, details: { quantity?: string; expiresAt?: string }) => {
    setPantry((current) => current.map((item) => item.id === id ? { ...item, ...details } : item));
    showToast('Pantry details updated');
  };

  const toggleIngredient = (id: string) => {
    setPantry((current) => current.map((item) => item.id === id ? { ...item, selected: !item.selected } : item));
    setGeneratedRecipes(null);
    Haptics.selectionAsync();
  };

  const removeIngredient = async (id: string) => {
    const item = pantry.find((entry) => entry.id === id);
    setPantry((current) => current.filter((entry) => entry.id !== id));
    if (supabase && user && item) {
      const normalized = item.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (item.householdId) await supabase.from('household_pantry_items').delete().eq('household_id', item.householdId).eq('normalized_name', normalized);
      else await supabase.from('pantry_items').delete().eq('user_id', user.id).eq('normalized_name', normalized);
    }
    showToast('Ingredient removed');
  };

  const addShoppingItems = (input: string) => {
    const names = input.split(/[\n,;]+/).map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    setShoppingItems((current) => {
      const next = [...current];
      for (const name of names) {
        const existing = next.find((item) => item.name.toLowerCase() === name.toLowerCase() && (household ? item.householdId === household.id : !item.householdId));
        if (existing) existing.checked = false;
        else next.push({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, checked: false, householdId: household?.id });
      }
      return next;
    });
    showToast(names.length === 1 ? `${names[0]} added to your list` : `${names.length} items added to your list`);
  };

  const addMissingToShoppingList = (recipe: Recipe) => {
    const matched = rankRecipes([recipe], pantry.map((item) => item.name))[0];
    const missing = matched.ingredients.filter((item) => !item.inPantry);
    if (!missing.length) { showToast('You already have everything for this meal'); return; }
    setShoppingItems((current) => {
      const next = [...current];
      for (const ingredient of missing) {
        const existing = next.find((item) => item.name.toLowerCase() === ingredient.name.toLowerCase() && (household ? item.householdId === household.id : !item.householdId));
        if (existing) { existing.checked = false; existing.quantity = ingredient.amount; }
        else next.push({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: ingredient.name, quantity: ingredient.amount, checked: false, householdId: household?.id });
      }
      return next;
    });
    showToast(`${missing.length} missing ${missing.length === 1 ? 'ingredient added' : 'ingredients added'} to your list`);
    setPlanSection('Shopping');
    setActiveRecipe(null);
    setActiveTab('plan');
  };

  const toggleShoppingItem = (id: string) => setShoppingItems((current) => current.map((item) => item.id === id ? { ...item, checked: !item.checked } : item));

  const removeShoppingItem = async (id: string) => {
    const item = shoppingItems.find((entry) => entry.id === id);
    setShoppingItems((current) => current.filter((entry) => entry.id !== id));
    if (supabase && user && item) {
      const normalized = item.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (item.householdId) await supabase.from('household_shopping_list_items').delete().eq('household_id', item.householdId).eq('normalized_name', normalized);
      else await supabase.from('shopping_list_items').delete().eq('user_id', user.id).eq('normalized_name', normalized);
    }
  };

  const removePlannedMeal = async (id: string) => {
    setPlannedMeals((current) => current.filter((entry) => entry.id !== id));
    if (supabase && user) await supabase.from('meal_plans').delete().eq('user_id', user.id).eq('id', id);
  };

  const choosePlanDate = async (date: string) => {
    const recipe = planRecipe;
    setPlanRecipe(null);
    if (!supabase || !user || !recipe) return;
    const { data, error } = await supabase.from('meal_plans').upsert({
      user_id: user.id, planned_for: date, recipe_id: recipe.id, recipe,
    }, { onConflict: 'user_id,planned_for,recipe_id' }).select('id,planned_for,recipe').single();
    if (error || !data) { Alert.alert('Couldn’t add this meal', error?.message ?? 'Please try again.'); return; }
    setPlannedMeals((current) => current.some((meal) => meal.id === data.id) ? current : [...current, { id: data.id, plannedFor: data.planned_for, recipe: data.recipe as Recipe }]);
    setPlanSection('Plan');
    setActiveRecipe(null);
    setActiveTab('plan');
    const groceryCount = addRecipesToShoppingList([recipe]);
    showToast(groceryCount
      ? `Planned for ${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })} · ${groceryCount} groceries added`
      : `Planned for ${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}`);
  };

  const generateWeek = async () => {
    if (!supabase || !user) { Alert.alert('Sign in to plan your week', 'Your meal plan is saved to your account.'); return; }
    setIsGeneratingWeek(true);
    try {
      const recipes = await generateWeeklyPlan(pantry.filter((item) => item.selected).map((item) => item.name), preferences);
      const safeRecipes = recipes.filter((recipe) => matchesPreferences(recipe, preferences) && matchesMacroTargets(recipe, preferences));
      if (safeRecipes.length < preferences.cookingDaysPerWeek) throw new Error('Not enough suggestions met your saved diet, allergy, and estimated macro targets. Try generating again or loosen a target.');
      const dayIndices = Array.from({ length: preferences.cookingDaysPerWeek }, (_, index) => preferences.cookingDaysPerWeek === 1 ? 3 : Math.round(index * 6 / (preferences.cookingDaysPerWeek - 1)));
      const records = safeRecipes.slice(0, preferences.cookingDaysPerWeek).map((recipe, index) => {
        const date = new Date();
        date.setDate(date.getDate() + dayIndices[index]);
        return { user_id: user.id, planned_for: localDateKey(date), recipe_id: recipe.id, recipe };
      });
      const { data, error } = await supabase.from('meal_plans').upsert(records, { onConflict: 'user_id,planned_for,recipe_id' }).select('id,planned_for,recipe');
      if (error || !data) throw new Error(error?.message ?? 'Could not save the weekly plan.');
      const saved = data.map((row) => ({ id: row.id, plannedFor: row.planned_for, recipe: row.recipe as Recipe }));
      setPlannedMeals((current) => [...current.filter((meal) => !saved.some((entry) => entry.id === meal.id)), ...saved].sort((a, b) => a.plannedFor.localeCompare(b.plannedFor)));
      const groceryCount = addRecipesToShoppingList(safeRecipes.slice(0, preferences.cookingDaysPerWeek));
      setPlanSection('Plan');
      setActiveTab('plan');
      showToast(groceryCount ? `Your week is planned · ${groceryCount} groceries added` : 'Your week is planned · pantry covers the recipes');
    } catch (error) {
      Alert.alert('Couldn’t plan your week', error instanceof Error ? error.message : 'Please try again shortly.');
    } finally { setIsGeneratingWeek(false); }
  };

  const addRecipesToShoppingList = (recipes: Recipe[]) => {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const pantryNames = pantry.map((item) => normalize(item.name));
    const needed = new Map<string, { name: string; amounts: string[] }>();
    recipes.forEach((recipe) => recipe.ingredients.forEach((ingredient) => {
      const key = normalize(ingredient.name);
      if (!key || pantryNames.some((item) => item === key || item.includes(key) || key.includes(item))) return;
      const current = needed.get(key) ?? { name: ingredient.name, amounts: [] };
      if (ingredient.amount && !current.amounts.includes(ingredient.amount)) current.amounts.push(ingredient.amount);
      needed.set(key, current);
    }));
    if (!needed.size) return 0;
    const additions = [...needed.entries()].filter(([key]) => !shoppingItems.some((item) => normalize(item.name) === key && (household ? item.householdId === household.id : !item.householdId)));
    if (!additions.length) return 0;
    setShoppingItems((current) => {
      const next = [...current];
      additions.forEach(([, { name, amounts }]) => {
        const existing = next.find((item) => normalize(item.name) === normalize(name) && (household ? item.householdId === household.id : !item.householdId));
        const quantity = amounts.length ? amounts.join(' + ') : undefined;
        if (!existing) next.push({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, quantity, checked: false, householdId: household?.id });
      });
      return next;
    });
    return additions.length;
  };

  const buildShoppingListFromPlan = () => {
    const count = addRecipesToShoppingList(plannedMeals.map(({ recipe }) => recipe));
    if (!count) { showToast(plannedMeals.length ? 'Your pantry covers the planned recipes' : 'Add meals to your week first'); return; }
    setPlanSection('Shopping');
    showToast(`${count} planned ingredients added to your list`);
  };

  useEffect(() => {
    if (!user || !pantrySynced || !shoppingSynced || !plannedMeals.length) return;
    addRecipesToShoppingList(plannedMeals.map(({ recipe }) => recipe));
  }, [plannedMeals, pantrySynced, shoppingSynced, user?.id, household?.id]);

  const scanPhoto = async (source: 'camera' | 'library', mode: 'fridge' | 'receipt' | 'meal') => {
    if (!supabase || !user) { Alert.alert('Sign in first', 'Photo scanning is available in your account kitchen.'); return; }
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { Alert.alert('Camera permission needed', 'Allow camera access to scan ingredients in your fridge.'); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.55, base64: true });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.55, base64: true });
      }
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) { Alert.alert('Couldn’t read that photo', 'Try another image or enter the ingredients by hand.'); return; }
      setIsScanning(true);
      if (mode === 'meal') setIsTrackingMeal(true);
      const { data, error } = await supabase.functions.invoke('identify-ingredients', { body: { imageBase64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg', mode } });
      if (mode === 'meal') {
        if (error || !data?.nutrition) { Alert.alert('Couldn’t estimate that plate', data?.error ?? error?.message ?? 'Try a clear photo of one plated meal.'); return; }
        const nutrition = data.nutrition;
        const description = typeof data.mealDescription === 'string' ? data.mealDescription : 'Meal photo estimate';
        const confidence = ['low', 'medium', 'high'].includes(data.confidence) ? data.confidence : 'low';
        const recipe: Recipe = {
          id: `meal-photo-${Date.now()}`, title: description, summary: `Visual estimate · ${confidence} confidence. Portion size and hidden ingredients can change these values.`,
          timeMinutes: 1, servings: 1, difficulty: 'Easy', matchPercent: 0, matchedCount: 0,
          image: RECIPES[0].image, ingredients: [], steps: [], tags: ['Photo estimate'],
          nutritionPerServing: {
            calories: Math.round(Number(nutrition.calories) || 0), proteinGrams: Math.round(Number(nutrition.proteinGrams) || 0),
            carbsGrams: Math.round(Number(nutrition.carbsGrams) || 0), fatGrams: Math.round(Number(nutrition.fatGrams) || 0),
          },
        };
        const { data: savedLog, error: saveError } = await supabase.from('meal_history').insert({ user_id: user.id, recipe_id: recipe.id, recipe }).select('id,cooked_at').single();
        if (!saveError && savedLog) setMealHistory((current) => [{ id: savedLog.id, cookedAt: savedLog.cooked_at, recipe }, ...current]);
        const nutritionCopy = `${recipe.nutritionPerServing?.calories} kcal · ${recipe.nutritionPerServing?.proteinGrams} g protein · ${recipe.nutritionPerServing?.carbsGrams} g carbs · ${recipe.nutritionPerServing?.fatGrams} g fat`;
        Alert.alert(saveError ? 'Plate estimate' : 'Added to your meal log', `${description}\n\n${nutritionCopy}\n\n${saveError ? 'This estimate could not be saved.' : `Confidence: ${confidence}.`} Visual estimates can be inaccurate; use package labels or measured portions when precision matters.`);
        return;
      }
      if (error || !Array.isArray(data?.ingredients)) { Alert.alert('Scan didn’t work', data?.error ?? error?.message ?? 'Try again with a clearer fridge photo.'); return; }
      const names = data.ingredients.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 30);
      if (!names.length) { Alert.alert('No ingredients found', 'Try a brighter photo or add the ingredients by hand.'); return; }
      Alert.alert('Here’s what I spotted', names.join(', '), [
        { text: 'Review later', style: 'cancel' },
        { text: 'Add to pantry', onPress: () => addIngredients(names.join(', ')) },
      ]);
    } catch (error) {
      Alert.alert('Scan didn’t work', error instanceof Error ? error.message : 'Try again with a clearer photo.');
    } finally { setIsScanning(false); if (mode === 'meal') setIsTrackingMeal(false); }
  };

  const choosePhotoSource = (mode: 'fridge' | 'receipt' | 'meal') => Alert.alert(mode === 'receipt' ? 'Scan a receipt' : mode === 'meal' ? 'Estimate a plate' : 'Scan your fridge', 'Choose a photo source.', [
    { text: 'Take a photo', onPress: () => { void scanPhoto('camera', mode); } },
    { text: 'Choose a photo', onPress: () => { void scanPhoto('library', mode); } },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const scanFridge = () => choosePhotoSource('fridge');
  const scanReceipt = () => choosePhotoSource('receipt');
  const trackMealPhoto = () => choosePhotoSource('meal');
  const scanBarcode = () => setBarcodeScannerOpen(true);

  const lookupBarcode = async (barcode: string) => {
    setBarcodeScannerOpen(false);
    if (!/^\d{8,14}$/.test(barcode)) { Alert.alert('Couldn’t read that barcode', 'Scan a UPC or EAN barcode on a packaged food.'); return; }
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_en,brands,quantity,nutriments,ingredients_text,allergens_tags`);
      if (!response.ok) throw new Error('The product lookup is temporarily unavailable.');
      const result = await response.json();
      const product = result?.product;
      const name = typeof product?.product_name === 'string' && product.product_name.trim()
        ? product.product_name.trim()
        : typeof product?.product_name_en === 'string' ? product.product_name_en.trim() : '';
      if (result?.status !== 1 || !name) { Alert.alert('Product not found', 'This barcode is not in the food database. You can still add the item by name.'); return; }
      const quantity = typeof product.quantity === 'string' ? product.quantity : undefined;
      const brandName = typeof product.brands === 'string' && product.brands.trim() ? product.brands.trim() : undefined;
      const nutriments = product.nutriments && typeof product.nutriments === 'object' ? product.nutriments : {};
      const numericValue = (key: string) => { const value = Number(nutriments[key]); return Number.isFinite(value) && value >= 0 ? value : undefined; };
      const allergenTags = Array.isArray(product.allergens_tags) ? product.allergens_tags.filter((value: unknown): value is string => typeof value === 'string').slice(0, 8) : [];
      const productDetails: ProductDetails = {
        barcode,
        brand: brandName,
        productQuantity: quantity,
        caloriesKcalPer100g: numericValue('energy-kcal_100g'),
        proteinGramsPer100g: numericValue('proteins_100g'),
        carbsGramsPer100g: numericValue('carbohydrates_100g'),
        fatGramsPer100g: numericValue('fat_100g'),
        ingredientsText: typeof product.ingredients_text === 'string' ? product.ingredients_text.slice(0, 1200) : undefined,
        allergens: allergenTags.map((value: string) => value.replace(/^[a-z]{2,3}:/i, '').replace(/-/g, ' ')),
        source: 'Open Food Facts',
      };
      const nutrition = [
        productDetails.caloriesKcalPer100g !== undefined ? `${productDetails.caloriesKcalPer100g} kcal` : null,
        productDetails.proteinGramsPer100g !== undefined ? `${productDetails.proteinGramsPer100g}g protein` : null,
        productDetails.carbsGramsPer100g !== undefined ? `${productDetails.carbsGramsPer100g}g carbs` : null,
        productDetails.fatGramsPer100g !== undefined ? `${productDetails.fatGramsPer100g}g fat` : null,
      ].filter(Boolean).join(' · ');
      const brand = brandName ? `${brandName} · ` : '';
      const detailsText = `${brand}${name}${quantity ? ` (${quantity})` : ''}${nutrition ? `\nPer 100 g: ${nutrition}` : '\nNutrition data is not available for this product.'}${productDetails.allergens?.length ? `\nAllergens: ${productDetails.allergens.join(', ')}` : ''}`;
      Alert.alert('Add this to your pantry?', detailsText, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add item', onPress: () => addIngredients(name, { quantity, productDetails }) },
      ]);
    } catch (error) {
      Alert.alert('Product lookup failed', error instanceof Error ? error.message : 'Try again or add the item by name.');
    }
  };

  const findMeals = async (mode: GeneratorMode = 'PantryChef', craving = '', swapOut: string[] = [], swapIn: string[] = []) => {
    const ingredients = pantry.filter((item) => item.selected).map((item) => item.name);
    if (mode === 'PantryChef' && !ingredients.length) {
      Alert.alert('Start with an ingredient', 'Add something from your fridge or tap an item in your pantry to include it.');
      return;
    }
    if (mode === 'MasterChef' && !craving.trim()) {
      Alert.alert('What are you craving?', 'Enter a meal name or cuisine above, then Mise will shape it around your pantry and kitchen preferences.');
      return;
    }
    if (mode === 'MacrosChef' && !Object.values(preferences.macroTargets).some((value) => value !== null)) {
      Alert.alert('Set a nutrition target first', 'Add at least one per-serving macro target in Account → How you like to cook, then ask MacrosChef for a meal.');
      return;
    }
    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await generateMeals(ingredients, preferences, { mode, craving, swapOut, swapIn });
      const matching = result.recipes.filter((recipe) => matchesPreferences(recipe, preferences) && matchesMacroTargets(recipe, preferences));
      setGeneratedRecipes(matching);
      if (!matching.length) Alert.alert('No matches this time', 'No recipe met your saved diet, allergy, and estimated macro targets. Try again or loosen a target.');
      else showToast(result.generatedByAI ? `Fresh ${mode === 'PantryChef' ? 'ideas' : mode.toLowerCase()} made for you` : 'Your best pantry matches are ready');
    } catch (error) {
      if (mode === 'PantryChef') {
        setGeneratedRecipes(rankRecipes(RECIPES.filter((recipe) => matchesPreferences(recipe, preferences) && matchesMacroTargets(recipe, preferences)), ingredients).slice(0, 4));
        showToast('Here are your best kitchen-library matches');
      } else {
        Alert.alert('Recipe studio unavailable', error instanceof Error ? error.message : 'Please try again shortly.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const sendChatMessage = async (messages: Array<Pick<MiseChatMessage, 'role' | 'content'>>): Promise<string> => {
    if (!supabase || !user) throw new Error('Sign in to chat with Mise.');
    const { data, error } = await supabase.functions.invoke('mise-chat', {
      body: {
        messages,
        pantry: pantry.filter((item) => item.selected).map(({ name, quantity }) => ({ name, quantity })),
        preferences: {
          dietaryPreferences: preferences.dietaryPreferences,
          allergies: preferences.allergies,
          defaultServings: preferences.defaultServings,
          maxCookMinutes: preferences.maxCookMinutes,
          equipment: preferences.equipment,
          skillLevel: preferences.skillLevel,
          macroTargets: preferences.macroTargets,
        },
      },
    });
    if (error || typeof data?.reply !== 'string') throw new Error(data?.error ?? error?.message ?? 'Mise could not reply right now. Please try again.');
    return data.reply;
  };

  const syncChatMessages = async (): Promise<number> => {
    if (!supabase || !user) throw new Error('Sign in to sync your chat.');
    const { data, error } = await supabase.from('mise_chat_messages')
      .select('id,role,content,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(`Could not load your saved chat: ${error.message}`);

    const merged = new Map<string, MiseChatMessage>();
    for (const row of (data ?? []) as Array<{ id: string; role: string; content: string; created_at: string }>) {
      if (!row.id || (row.role !== 'user' && row.role !== 'assistant') || typeof row.content !== 'string' || typeof row.created_at !== 'string') continue;
      merged.set(row.id, { id: row.id, role: row.role, content: row.content, createdAt: row.created_at });
    }
    if (chatOwnerId === user.id) {
      for (const message of chatMessages) merged.set(message.id, message);
    }
    const messages = Array.from(merged.values())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .slice(-200);
    if (messages.length) {
      const { error: uploadError } = await supabase.from('mise_chat_messages').upsert(messages.map((message) => ({
        user_id: user.id,
        id: message.id,
        role: message.role,
        content: message.content,
        created_at: message.createdAt,
      })), { onConflict: 'user_id,id', ignoreDuplicates: true });
      if (uploadError) throw new Error(`Could not save this device’s chat: ${uploadError.message}`);
    }
    setChatMessages(messages.slice(-40));
    return messages.length;
  };

  const clearChatConversation = async (): Promise<void> => {
    if (!supabase || !user) throw new Error('Sign in to clear your synced chat.');
    chatClearInProgress.current = true;
    try {
      const { error } = await supabase.from('mise_chat_messages').delete().eq('user_id', user.id);
      if (error) throw new Error(`Could not clear your synced chat: ${error.message}`);
      setChatMessages([]);
    } finally {
      chatClearInProgress.current = false;
    }
  };

  const findMealsForExpiringItems = async () => {
    const ingredients = expiringItems.map((item) => item.name);
    if (!ingredients.length) return;
    setPantry((current) => current.map((item) => expiringItems.some((soon) => soon.id === item.id) ? { ...item, selected: true } : item));
    setActiveTab('home');
    setIsGenerating(true);
    try {
      const result = await generateMeals(ingredients, preferences);
      const matching = result.recipes.filter((recipe) => matchesPreferences(recipe, preferences) && matchesMacroTargets(recipe, preferences));
      setGeneratedRecipes(matching);
      if (!matching.length) Alert.alert('No matches this time', 'Try adjusting your cooking preferences or recipe request.');
      else showToast('Ideas for your best-before-soon ingredients are ready');
    } catch {
      setGeneratedRecipes(rankRecipes(RECIPES.filter((recipe) => matchesPreferences(recipe, preferences) && matchesMacroTargets(recipe, preferences)), ingredients).slice(0, 4));
      showToast('Here are ideas for those ingredients');
    } finally { setIsGenerating(false); }
  };

  const remixActiveRecipe = async (recipe: Recipe, instruction: string): Promise<Recipe | null> => {
    setIsRemixing(true);
    try {
      const remixed = await remixMeal(recipe, instruction, selectedIngredients, preferences);
      if (!matchesPreferences(remixed, preferences) || !matchesMacroTargets(remixed, preferences)) {
        Alert.alert('That remix needs another pass', 'It may conflict with one of your saved cooking preferences or estimated macro targets. Try a more specific request.');
        return null;
      }
      setActiveRecipe(remixed);
      showToast('Your recipe remix is ready');
      return remixed;
    } catch (error) {
      Alert.alert('Couldn’t remix that recipe', error instanceof Error ? error.message : 'Try again with a shorter request.');
      return null;
    } finally { setIsRemixing(false); }
  };

  const toggleSaved = async (recipe: Recipe) => {
    const isSaved = savedIds.has(recipe.id);
    setSavedRecipes((current) => isSaved ? current.filter((entry) => entry.id !== recipe.id) : [recipe, ...current]);
    Haptics.selectionAsync();
    if (supabase && user) {
      if (isSaved) await supabase.from('saved_recipes').delete().eq('user_id', user.id).eq('recipe_id', recipe.id);
      else await supabase.from('saved_recipes').upsert({ user_id: user.id, recipe_id: recipe.id, recipe, collection_id: recipe.collectionId ?? null }, { onConflict: 'user_id,recipe_id' });
    }
    showToast(isSaved ? 'Removed from your recipe box' : 'Saved for another day');
  };

  const createRecipeCollection = async (rawName: string): Promise<boolean> => {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (!name || name.length > 40) { Alert.alert('Choose a folder name', 'Folder names can be 1 to 40 characters.'); return false; }
    if (!supabase || !user) { Alert.alert('Sign in required', 'Sign in to save recipe folders to your account.'); return false; }
    const normalized = name.toLowerCase();
    if (recipeCollections.some((collection) => collection.name.toLowerCase() === normalized)) {
      Alert.alert('Folder already exists', 'Choose a different name for this recipe folder.');
      return false;
    }
    const { data, error } = await supabase.from('recipe_collections').insert({ user_id: user.id, name }).select('id,name').single();
    if (error || !data) {
      Alert.alert('Couldn’t create folder', error?.code === '23505' ? 'A folder with that name already exists.' : error?.message ?? 'Please try again.');
      return false;
    }
    setRecipeCollections((current) => [...current, { id: data.id, name: data.name }].sort((a, b) => a.name.localeCompare(b.name)));
    showToast(`Created “${data.name}” folder`);
    return true;
  };

  const assignRecipeCollection = async (recipe: Recipe, collectionId: string | null): Promise<boolean> => {
    if (!supabase || !user) { Alert.alert('Sign in required', 'Sign in to organize saved recipes.'); return false; }
    if (collectionId && !recipeCollections.some((collection) => collection.id === collectionId)) return false;
    const { error } = await supabase.from('saved_recipes').update({ collection_id: collectionId }).eq('user_id', user.id).eq('recipe_id', recipe.id);
    if (error) { Alert.alert('Couldn’t move recipe', error.message); return false; }
    setSavedRecipes((current) => current.map((entry) => entry.id === recipe.id ? { ...entry, collectionId: collectionId ?? undefined } : entry));
    showToast(collectionId ? 'Recipe moved to folder' : 'Recipe moved to unsorted');
    return true;
  };

  const submitAuth = async (mode: 'sign-in' | 'sign-up', email: string, password: string, name?: string) => {
    if (!supabase) { Alert.alert('Connect Supabase first', 'Copy .env.example to .env, add your project URL and publishable key, then restart Expo.'); return; }
    const result = mode === 'sign-up'
      ? await supabase.auth.signUp({ email, password, options: { data: { name: name?.trim() || email.split('@')[0] } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) { Alert.alert(mode === 'sign-up' ? 'Couldn’t create your account' : 'Couldn’t sign in', result.error.message); return; }
    if (mode === 'sign-up' && !result.data.session) Alert.alert('Check your inbox', 'Use the confirmation link in your email to finish creating your account.');
    else { setAccountOpen(false); showToast('You’re all set'); }
  };

  const resetPassword = async (email: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'mise://reset-password' });
    if (error) Alert.alert('Couldn’t send reset link', error.message);
    else Alert.alert('Check your inbox', 'We sent a password reset link. Open it on this device to choose a new password.');
  };

  const setNewPassword = async (password: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { Alert.alert('Couldn’t update password', error.message); return; }
    setPasswordRecovery(false);
    setAccountOpen(false);
    showToast('Your password has been updated');
  };

  const savePreferences = async (next: ProfilePreferences) => {
    if (!supabase || !user) return;
    const { error } = await supabase.from('profiles').update({
      dietary_preferences: next.dietaryPreferences,
      allergies: next.allergies,
      default_servings: next.defaultServings,
      max_cook_minutes: next.maxCookMinutes,
      budget_level: next.budgetLevel,
      equipment: next.equipment,
      skill_level: next.skillLevel,
      cooking_days_per_week: next.cookingDaysPerWeek,
      target_calories: next.macroTargets.calories,
      target_protein_grams: next.macroTargets.proteinGrams,
      target_carbs_grams: next.macroTargets.carbsGrams,
      target_fat_grams: next.macroTargets.fatGrams,
    }).eq('id', user.id);
    if (error) { Alert.alert('Couldn’t save preferences', error.message); return; }
    setPreferences(next);
    showToast('Cooking preferences saved');
  };

  const createHousehold = async (name: string) => {
    if (!supabase) return;
    setHouseholdBusy(true);
    try {
      const { data, error } = await supabase.rpc('create_household', { p_name: name });
      const nextHousehold = mapHousehold(data);
      if (error || !nextHousehold) Alert.alert('Couldn’t create the household', error?.message ?? 'Please try again.');
      else { setHousehold(nextHousehold); setHouseholdOpen(false); showToast('Your shared kitchen is ready'); }
    } catch (error) { Alert.alert('Couldn’t create the household', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setHouseholdBusy(false); }
  };

  const joinHousehold = async (inviteCode: string) => {
    if (!supabase) return;
    setHouseholdBusy(true);
    try {
      const { data, error } = await supabase.rpc('join_household', { p_invite_code: inviteCode });
      const nextHousehold = mapHousehold(data);
      if (error || !nextHousehold) Alert.alert('Couldn’t join the household', error?.message ?? 'Check the invite code and try again.');
      else { setHousehold(nextHousehold); setHouseholdOpen(false); showToast(`Joined ${nextHousehold.name}`); }
    } catch (error) { Alert.alert('Couldn’t join the household', error instanceof Error ? error.message : 'Check the invite code and try again.'); }
    finally { setHouseholdBusy(false); }
  };

  const leaveHousehold = async () => {
    if (!supabase) return;
    setHouseholdBusy(true);
    try {
      const { error } = await supabase.rpc('leave_household');
      if (error) Alert.alert('Couldn’t leave household', error.message);
      else { setHousehold(null); setHouseholdOpen(false); showToast('Household sharing turned off'); }
    } catch (error) { Alert.alert('Couldn’t leave household', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setHouseholdBusy(false); }
  };

  const shareCurrentItems = async () => {
    if (!supabase || !user || !household) return;
    setHouseholdBusy(true);
    const personalPantry = pantry.filter((item) => !item.householdId);
    const personalShopping = shoppingItems.filter((item) => !item.householdId);
    const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    try {
      if (personalPantry.length) {
        const { error } = await supabase.from('household_pantry_items').upsert(personalPantry.map((item) => ({
          household_id: household.id, created_by: user.id, name: item.name, normalized_name: normalize(item.name),
          category: item.category, quantity: item.quantity ?? null, expires_at: item.expiresAt ?? null,
          is_selected: item.selected, product_details: item.productDetails ?? null,
        })), { onConflict: 'household_id,normalized_name' });
        if (error) throw error;
      }
      if (personalShopping.length) {
        const { error } = await supabase.from('household_shopping_list_items').upsert(personalShopping.map((item) => ({
          household_id: household.id, created_by: user.id, name: item.name, normalized_name: normalize(item.name),
          quantity: item.quantity ?? null, is_checked: item.checked,
        })), { onConflict: 'household_id,normalized_name' });
        if (error) throw error;
      }
      const [{ error: pantryDeleteError }, { error: shoppingDeleteError }] = await Promise.all([
        supabase.from('pantry_items').delete().eq('user_id', user.id),
        supabase.from('shopping_list_items').delete().eq('user_id', user.id),
      ]);
      if (pantryDeleteError || shoppingDeleteError) throw pantryDeleteError ?? shoppingDeleteError;
      setPantry((current) => {
        const next = current.filter((item) => item.householdId === household.id);
        for (const item of personalPantry) {
          const existingIndex = next.findIndex((shared) => normalize(shared.name) === normalize(item.name));
          const moved = { ...item, id: `shared-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, householdId: household.id };
          if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], ...moved, id: next[existingIndex].id };
          else next.push(moved);
        }
        return next;
      });
      setShoppingItems((current) => {
        const next = current.filter((item) => item.householdId === household.id);
        for (const item of personalShopping) {
          const existingIndex = next.findIndex((shared) => normalize(shared.name) === normalize(item.name));
          const moved = { ...item, id: `shared-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, householdId: household.id };
          if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], ...moved, id: next[existingIndex].id };
          else next.push(moved);
        }
        return next;
      });
      setHouseholdOpen(false);
      showToast('Your current pantry and list are shared now');
    } catch (error) {
      Alert.alert('Couldn’t share your kitchen items', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally { setHouseholdBusy(false); }
  };

  const openHousehold = () => {
    setAccountOpen(false);
    setHouseholdOpen(true);
    if (supabase) Promise.resolve(supabase.rpc('my_household')).then(({ data, error }) => { if (!error) setHousehold(mapHousehold(data)); }).catch(() => {});
  };

  const deleteAccount = () => Alert.alert(
    'Delete your account?',
    'This permanently deletes your account and personal data. Shared pantry and shopping-list items stay with the household for its other members. If you own a household kitchen, ownership moves to another member; a household with no other members is closed.',
    [
      { text: 'Keep account', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: () => { void (async () => {
        if (!supabase) return;
        const { error } = await supabase.functions.invoke('delete-account', { body: {} });
        if (error) { Alert.alert('Couldn’t delete account', error.message); return; }
        if (user) { try { localStorage.removeItem(`mise.chat.${user.id}`); } catch { /* auth session cleanup still continues */ } }
        await supabase.auth.signOut({ scope: 'local' });
        setPasswordRecovery(false);
        Alert.alert('Account deleted', 'Your account and personal data have been removed. Shared household items remain for other members.');
      })(); } },
    ],
  );

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setAccountOpen(false);
    setPantry([]);
    setSavedRecipes([]);
    setGeneratedRecipes(null);
    setActiveRecipe(null);
    setActiveTab('home');
    setToast('');
    setPasswordRecovery(false);
  };

  const finishRecipe = async (recipe: Recipe) => {
    if (supabase && user) {
      const { data } = await supabase.from('meal_history').insert({ user_id: user.id, recipe_id: recipe.id, recipe }).select('id,cooked_at').single();
      if (data) setMealHistory((current) => [{ id: data.id, cookedAt: data.cooked_at, recipe }, ...current]);
    }
    showToast('Dinner, done. Nice work.');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <StatusBar style={activeRecipe ? 'light' : 'dark'} />
      <View style={styles.body}>
        {!authChecked ? (
          <View style={styles.authStatus}><Text style={styles.authTitle}>Opening your kitchen</Text><Text style={styles.authCopy}>Checking your account…</Text></View>
        ) : !user ? (
          <AuthFlow configured={isSupabaseConfigured} onSubmit={submitAuth} onResetPassword={resetPassword} />
        ) : activeRecipe ? (
          <>
            <RecipeDetailScreen recipe={activeRecipe} isSaved={savedIds.has(activeRecipe.id)} isRemixing={isRemixing} onBack={() => setActiveRecipe(null)} onSave={() => toggleSaved(activeRecipe)} onCooked={finishRecipe} onPlan={setPlanRecipe} onAddMissing={addMissingToShoppingList} onRemix={remixActiveRecipe} />
          </>
        ) : activeTab === 'home' ? (
          <HomeScreen pantry={pantry} expiringItems={expiringItems} recipes={recommendedRecipes} generatedRecipes={generatedRecipes} isGenerating={isGenerating} isScanning={isScanning} savedIds={savedIds} userName={userName} maxCookMinutes={preferences.maxCookMinutes} equipment={preferences.equipment} onAddIngredients={addIngredients} onScanFridge={scanFridge} onToggleIngredient={toggleIngredient} onGenerate={findMeals} onOpenRecipe={setActiveRecipe} onToggleSaved={toggleSaved} onOpenAccount={() => setAccountOpen(true)} onOpenPantry={() => setActiveTab('pantry')} onUseExpiring={findMealsForExpiringItems} />
        ) : activeTab === 'pantry' ? (
          <PantryScreen pantry={pantry} onAddIngredients={addIngredients} onToggleIngredient={toggleIngredient} onRemoveIngredient={removeIngredient} onUpdateIngredient={updateIngredient} onScanFridge={scanFridge} onScanReceipt={scanReceipt} onScanBarcode={scanBarcode} isScanning={isScanning} onOpenAccount={() => setAccountOpen(true)} />
        ) : activeTab === 'plan' ? (
          <PlanScreen plannedMeals={plannedMeals} shoppingItems={shoppingItems} mealHistory={mealHistory} onOpenRecipe={setActiveRecipe} onRemovePlannedMeal={removePlannedMeal} onAddShoppingItems={addShoppingItems} onToggleShoppingItem={toggleShoppingItem} onRemoveShoppingItem={removeShoppingItem} onOpenAccount={() => setAccountOpen(true)} section={planSection} onSectionChange={setPlanSection} onGenerateWeek={generateWeek} isGeneratingWeek={isGeneratingWeek} onBuildShoppingList={buildShoppingListFromPlan} onTrackMealPhoto={trackMealPhoto} isTrackingMeal={isTrackingMeal} />
        ) : activeTab === 'chat' ? (
          <ChatScreen messages={chatMessages} onBack={() => setActiveTab('home')} onMessagesChange={setChatMessages} onSendMessage={sendChatMessage} onSyncMessages={syncChatMessages} onClearConversation={clearChatConversation} onOpenAccount={() => setAccountOpen(true)} />
        ) : (
          <SavedScreen recipes={savedRecipes} collections={recipeCollections} onOpenRecipe={setActiveRecipe} onToggleSaved={toggleSaved} onOpenAccount={() => setAccountOpen(true)} onCreateCollection={createRecipeCollection} onAssignCollection={assignRecipeCollection} />
        )}
      </View>
      {user && !activeRecipe && activeTab !== 'chat' && <>
        <BottomTabs activeTab={activeTab} onChange={(tab) => { setActiveTab(tab); Haptics.selectionAsync(); }} bottomInset={insets.bottom} />
        <Animated.View entering={FadeInDown.springify().damping(18)} style={[styles.chatFabWrap, { right: 26, bottom: Math.max(insets.bottom, 12) + 85 }]}>
          <Pressable onPress={() => { setActiveTab('chat'); Haptics.selectionAsync(); }} style={({ pressed }) => [styles.chatFab, pressed && styles.chatFabPressed]} accessibilityRole="button" accessibilityLabel="Open Mise AI chat">
            <Ionicons name="chatbubble-ellipses" size={25} color={colors.ink} />
          </Pressable>
        </Animated.View>
      </>}
      {user && toast ? <Animated.View entering={SlideInDown.springify().damping(19)} exiting={FadeOut.duration(180)} style={[styles.toast, { bottom: Math.max(insets.bottom, 12) + (activeRecipe ? 12 : 88) }]}><View style={styles.toastIcon}><Ionicons name="checkmark" size={13} color={colors.ink} /></View><Text style={styles.toastText}>{toast}</Text></Animated.View> : null}
      <AuthSheet visible={Boolean(authChecked && user && accountOpen)} configured={isSupabaseConfigured} userEmail={user?.email} preferences={preferences} passwordRecovery={passwordRecovery} onClose={() => setAccountOpen(false)} onSubmit={submitAuth} onResetPassword={resetPassword} onSetNewPassword={setNewPassword} onSavePreferences={savePreferences} onDeleteAccount={deleteAccount} onSignOut={signOut} onOpenHousehold={openHousehold} />
      {user && <HouseholdSheet visible={householdOpen} household={household} busy={householdBusy} onClose={() => setHouseholdOpen(false)} onCreate={createHousehold} onJoin={joinHousehold} onLeave={leaveHousehold} onShareCurrentItems={shareCurrentItems} />}
      <PlanDateSheet visible={Boolean(planRecipe)} recipeTitle={planRecipe?.title} onClose={() => setPlanRecipe(null)} onChoose={choosePlanDate} />
      <BarcodeScannerSheet visible={barcodeScannerOpen} onClose={() => setBarcodeScannerOpen(false)} onScanned={lookupBarcode} />
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><RootApp /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  body: { flex: 1 },
  authStatus: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 38, paddingBottom: 90 },
  authMark: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  authTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  authCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, maxWidth: 270 },
  chatFabWrap: { position: 'absolute', zIndex: 9 },
  chatFab: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.olive, borderWidth: 2, borderColor: '#FCFCF8', shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 9 },
  chatFabPressed: { transform: [{ scale: 0.93 }], backgroundColor: '#C9DE61' },
  toast: { position: 'absolute', zIndex: 20, alignSelf: 'center', maxWidth: '90%', minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, backgroundColor: '#263025', flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  toastIcon: { height: 22, width: 22, borderRadius: 8, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center' },
  toastText: { color: '#F8F8F2', fontSize: 10, fontWeight: '700' },
});
