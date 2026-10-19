export type PantryCategory = 'Produce' | 'Protein' | 'Dairy' | 'Pantry' | 'Other';

export type PantryItem = {
  id: string;
  name: string;
  category: PantryCategory;
  quantity?: string;
  expiresAt?: string;
  selected: boolean;
  householdId?: string;
  productDetails?: ProductDetails;
};

export type ProductDetails = {
  barcode: string;
  brand?: string;
  productQuantity?: string;
  caloriesKcalPer100g?: number;
  proteinGramsPer100g?: number;
  carbsGramsPer100g?: number;
  fatGramsPer100g?: number;
  ingredientsText?: string;
  allergens?: string[];
  source: 'Open Food Facts';
};

export type Household = { id: string; name: string; inviteCode: string; memberCount: number };

export type ProfilePreferences = {
  dietaryPreferences: string[];
  allergies: string[];
  defaultServings: number;
  maxCookMinutes: number | null;
  budgetLevel: 'budget' | 'balanced' | 'treat';
  equipment: string[];
  skillLevel: 'beginner' | 'comfortable' | 'advanced';
  cookingDaysPerWeek: number;
  macroTargets: {
    calories: number | null;
    proteinGrams: number | null;
    carbsGrams: number | null;
    fatGrams: number | null;
  };
};

export type GeneratorMode = 'PantryChef' | 'MasterChef' | 'MixologyMaestro' | 'BakeHeist' | 'MacrosChef';

export type PlannedMeal = { id: string; plannedFor: string; recipe: Recipe };
export type ShoppingItem = { id: string; name: string; quantity?: string; checked: boolean; householdId?: string };
export type MealHistoryItem = { id: string; cookedAt: string; recipe: Recipe };
export type RecipeCollection = { id: string; name: string };

export type RecipeIngredient = {
  name: string;
  amount: string;
  inPantry: boolean;
};

export type NutritionEstimate = { calories: number; proteinGrams: number; carbsGrams: number; fatGrams: number };

export type Recipe = {
  id: string;
  title: string;
  summary: string;
  timeMinutes: number;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'A little project';
  matchPercent: number;
  matchedCount: number;
  image: string;
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: string[];
  tip?: string;
  nutritionPerServing?: NutritionEstimate;
  collectionId?: string;
};

export type AppTab = 'home' | 'chat' | 'pantry' | 'plan' | 'saved';
export type PlanSection = 'Plan' | 'Shopping' | 'Cooked';
