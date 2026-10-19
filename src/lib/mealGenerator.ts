import { RECIPES, rankRecipes, recipesFromAI } from '../data/recipes';
import type { GeneratorMode, ProfilePreferences, Recipe } from '../types';
import { supabase } from './supabase';

type GenerationOptions = { mode?: GeneratorMode; craving?: string; count?: number; swapOut?: string[]; swapIn?: string[] };

function preferencePayload(preferences: ProfilePreferences) {
  return {
    servings: preferences.defaultServings,
    preferences: preferences.dietaryPreferences,
    allergies: preferences.allergies,
    maxCookMinutes: preferences.maxCookMinutes,
    budgetLevel: preferences.budgetLevel,
    equipment: preferences.equipment,
    skillLevel: preferences.skillLevel,
    cookingDaysPerWeek: preferences.cookingDaysPerWeek,
    macroTargets: preferences.macroTargets,
  };
}

export async function generateMeals(ingredients: string[], preferences: ProfilePreferences, options: GenerationOptions = {}): Promise<{ recipes: Recipe[]; generatedByAI: boolean }> {
  const mode = options.mode ?? 'PantryChef';
  if (supabase) {
    const { data, error } = await supabase.functions.invoke('generate-meals', {
      body: {
        ingredients,
        ...preferencePayload(preferences),
        mode,
        craving: options.craving?.slice(0, 120),
        swapOut: options.swapOut?.slice(0, 8),
        swapIn: options.swapIn?.slice(0, 8),
        count: options.count ?? 3,
      },
    });
    if (!error && Array.isArray(data?.recipes)) {
      const aiRecipes = recipesFromAI(data.recipes, ingredients);
      if (aiRecipes.length) return { recipes: aiRecipes, generatedByAI: true };
    }
    if (mode !== 'PantryChef') throw new Error(data?.error ?? error?.message ?? 'Could not generate those recipes.');
    if (error) throw new Error(data?.error ?? error.message ?? 'Could not reach the recipe kitchen.');
  }

  if (mode !== 'PantryChef') throw new Error('Connect your signed-in Supabase project to use this recipe studio.');

  return {
    recipes: rankRecipes(RECIPES, ingredients).slice(0, 4),
    generatedByAI: false,
  };
}

export async function generateWeeklyPlan(ingredients: string[], preferences: ProfilePreferences): Promise<Recipe[]> {
  if (!supabase) throw new Error('Connect your signed-in Supabase project to build a meal plan.');
  const { data, error } = await supabase.functions.invoke('generate-meals', {
    body: { ingredients, ...preferencePayload(preferences), mode: 'WeeklyPlan', count: preferences.cookingDaysPerWeek },
  });
  if (error || !Array.isArray(data?.recipes)) throw new Error(data?.error ?? error?.message ?? 'Could not build this week’s plan.');
  const recipes = recipesFromAI(data.recipes, ingredients);
  if (recipes.length < preferences.cookingDaysPerWeek) throw new Error('The meal planner returned an incomplete week. Try again.');
  return recipes.slice(0, preferences.cookingDaysPerWeek);
}

export async function remixMeal(source: Recipe, instruction: string, pantryIngredients: string[], preferences: ProfilePreferences): Promise<Recipe> {
  if (!supabase) throw new Error('Connect your Supabase project to remix a recipe.');
  const availableIngredients = Array.from(new Set([...source.ingredients.map((item) => item.name), ...pantryIngredients])).slice(0, 20);
  const { data, error } = await supabase.functions.invoke('generate-meals', {
    body: {
      ingredients: availableIngredients,
      servings: source.servings || preferences.defaultServings,
      preferences: preferences.dietaryPreferences,
      allergies: preferences.allergies,
      maxCookMinutes: preferences.maxCookMinutes,
      budgetLevel: preferences.budgetLevel,
      equipment: preferences.equipment,
      skillLevel: preferences.skillLevel,
      macroTargets: preferences.macroTargets,
      remix: {
        instruction: instruction.slice(0, 500),
        sourceRecipe: {
          title: source.title,
          summary: source.summary,
          timeMinutes: source.timeMinutes,
          servings: source.servings,
          ingredients: source.ingredients.map(({ name, amount }) => ({ name, amount })),
          steps: source.steps,
        },
      },
    },
  });
  if (error) throw new Error(data?.error ?? error.message ?? 'Could not remix that recipe.');
  const recipe = recipesFromAI(data?.recipes, availableIngredients)[0];
  if (!recipe) throw new Error('The recipe kitchen could not remix this one. Try a shorter request.');
  return { ...recipe, id: `remix-${source.id}-${Date.now()}`, image: source.image };
}
