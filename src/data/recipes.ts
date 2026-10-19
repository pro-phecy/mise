import type { PantryCategory, Recipe } from '../types';

const photo = (id: string, width = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;

const makeRecipe = (
  id: string,
  title: string,
  summary: string,
  timeMinutes: number,
  difficulty: Recipe['difficulty'],
  image: string,
  names: Array<[string, string]>,
  steps: string[],
  tags: string[],
  tip?: string,
): Recipe => ({
  id,
  title,
  summary,
  timeMinutes,
  servings: 2,
  difficulty,
  matchPercent: 0,
  matchedCount: 0,
  image: photo(image),
  ingredients: names.map(([name, amount]) => ({ name, amount, inPantry: false })),
  steps,
  tags,
  tip,
});

export const RECIPES: Recipe[] = [
  makeRecipe(
    'tomato-orzo',
    'Jammy tomato & spinach orzo',
    'A one-pan, silky little hug with crispy parmesan edges.',
    25,
    'Easy',
    'photo-1473093295043-cdd812d0e601',
    [['Orzo', '180 g'], ['Cherry tomatoes', '250 g'], ['Baby spinach', '2 handfuls'], ['Parmesan', '35 g'], ['Garlic', '2 cloves'], ['Vegetable stock', '450 ml']],
    ['Warm a slick of olive oil in a deep pan. Add the tomatoes and let them blister until their skins split.', 'Stir in crushed garlic and orzo. Toast for a minute, then pour in the stock and simmer, stirring often, until the pasta is tender.', 'Fold in spinach until just wilted. Finish with lemon zest, black pepper and a generous snowfall of parmesan.'],
    ['One pan', 'Vegetarian'],
    'A spoon of cream or crème fraîche makes this extra plush.',
  ),
  makeRecipe(
    'crispy-chickpea-bowl',
    'Crispy chickpea sunshine bowl',
    'Crunchy spiced chickpeas, bright greens and a lemony yogurt swoosh.',
    20,
    'Easy',
    'photo-1512621776951-a57141f2eefd',
    [['Chickpeas', '1 can'], ['Baby spinach', '2 handfuls'], ['Lemon', '1'], ['Greek yogurt', '120 g'], ['Cumin', '1 tsp'], ['Olive oil', '1 tbsp']],
    ['Drain and dry the chickpeas well. Toss with olive oil, cumin, salt and pepper.', 'Pan-fry until golden and audibly crisp, about 8 minutes, shaking the pan now and then.', 'Stir lemon zest and juice into the yogurt. Spoon over greens, add warm chickpeas and finish with more lemon.'],
    ['High protein', 'Vegetarian'],
    'Patting the chickpeas dry is the secret to a proper crunch.',
  ),
  makeRecipe(
    'green-shakshuka',
    'Green shakshuka for two',
    'Soft eggs nestled into garlicky greens with parmesan on top.',
    22,
    'Easy',
    'photo-1525351484163-7529414344d8',
    [['Eggs', '4'], ['Baby spinach', '3 handfuls'], ['Cherry tomatoes', '100 g'], ['Parmesan', '25 g'], ['Garlic', '2 cloves'], ['Bread', '2 slices']],
    ['Soften garlic in olive oil, then add spinach in handfuls and let it collapse.', 'Make four little wells in the greens. Crack in the eggs, cover the pan and cook gently until the whites are set.', 'Scatter over parmesan, cracked pepper and a few halved tomatoes. Bring the pan to the table with toast.'],
    ['One pan', 'Vegetarian'],
    'Pull the pan from the heat while the yolks still wobble; they keep cooking.',
  ),
  makeRecipe(
    'tomato-egg-toast',
    'Tomato, egg & parmesan toast',
    'A crisp, savory toast situation for a very good lunch.',
    12,
    'Easy',
    'photo-1525351484163-7529414344d8',
    [['Eggs', '2'], ['Cherry tomatoes', '150 g'], ['Parmesan', '20 g'], ['Bread', '2 slices'], ['Olive oil', '1 tsp']],
    ['Toast the bread until deeply golden.', 'Burst the tomatoes in a warm pan with olive oil and a pinch of salt.', 'Fry the eggs how you like them. Pile everything onto the toast and finish with parmesan.'],
    ['Quick', 'Vegetarian'],
  ),
  makeRecipe(
    'lemony-greens',
    'Lemony greens & chickpeas',
    'A bright, brothy bowl that makes odds and ends feel intentional.',
    18,
    'Easy',
    'photo-1547592180-85f173990554',
    [['Chickpeas', '1 can'], ['Baby spinach', '2 handfuls'], ['Lemon', '1'], ['Garlic', '2 cloves'], ['Vegetable stock', '300 ml'], ['Parmesan', '15 g']],
    ['Soften the garlic in olive oil in a saucepan.', 'Add chickpeas and stock. Simmer for 10 minutes, lightly crushing a few chickpeas to thicken the broth.', 'Add spinach to wilt. Finish with lemon juice and parmesan, then taste for salt.'],
    ['One pot', 'Vegetarian'],
  ),
  makeRecipe(
    'spinach-omelette',
    'Parmesan spinach omelette',
    'The quick, golden-edged classic with a little extra green.',
    10,
    'Easy',
    'photo-1525351484163-7529414344d8',
    [['Eggs', '3'], ['Baby spinach', '1 handful'], ['Parmesan', '20 g'], ['Butter', '1 tsp']],
    ['Whisk the eggs with a pinch of salt and pepper.', 'Melt butter in a nonstick pan. Add spinach and let it wilt, then pour in the eggs.', 'Tilt the pan as the eggs set. Add parmesan, fold and slide onto a warm plate.'],
    ['Quick', 'Vegetarian'],
  ),
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

export function categorizeIngredient(name: string): PantryCategory {
  const value = normalize(name);
  if (/egg|chicken|beef|pork|fish|salmon|tofu|tuna|shrimp|prawn|lentil|chickpea|bean/.test(value)) return 'Protein';
  if (/milk|cheese|yogurt|yoghurt|cream|butter|parmesan|feta/.test(value)) return 'Dairy';
  if (/tomato|spinach|lemon|lime|onion|garlic|pepper|carrot|apple|avocado|herb|potato|broccoli|mushroom|lettuce/.test(value)) return 'Produce';
  if (/rice|pasta|orzo|flour|oat|oil|stock|broth|spice|bread|noodle|quinoa|couscous/.test(value)) return 'Pantry';
  return 'Other';
}

function ingredientMatches(pantryName: string, recipeName: string) {
  const pantry = normalize(pantryName);
  const recipe = normalize(recipeName);
  if (pantry === recipe || pantry.includes(recipe) || recipe.includes(pantry)) return true;
  const aliases: Record<string, string[]> = {
    tomato: ['tomatoes', 'cherry tomato', 'cherry tomatoes'],
    spinach: ['baby spinach', 'spinach'],
    parmesan: ['parmesan', 'parmigiano'],
    chickpea: ['chickpea', 'chickpeas', 'garbanzo bean', 'garbanzo beans'],
    egg: ['egg', 'eggs'],
    lemon: ['lemon', 'lemons'],
  };
  return Object.values(aliases).some((group) => group.some((word) => pantry.includes(word)) && group.some((word) => recipe.includes(word)));
}

export function rankRecipes(recipes: Recipe[], ingredients: string[]): Recipe[] {
  const available = ingredients.map(normalize).filter(Boolean);
  return recipes
    .map((recipe) => {
      const matchedIngredients = recipe.ingredients.filter((ingredient) => available.some((item) => ingredientMatches(item, ingredient.name)));
      return {
        ...recipe,
        matchedCount: matchedIngredients.length,
        matchPercent: recipe.ingredients.length ? Math.round((matchedIngredients.length / recipe.ingredients.length) * 100) : 0,
        ingredients: recipe.ingredients.map((ingredient) => ({
          ...ingredient,
          inPantry: available.some((item) => ingredientMatches(item, ingredient.name)),
        })),
      };
    })
    .sort((a, b) => b.matchedCount - a.matchedCount || a.timeMinutes - b.timeMinutes);
}

export function recipesFromAI(value: unknown, availableIngredients: string[]): Recipe[] {
  if (!Array.isArray(value)) return [];
  const knownImages = RECIPES.map((recipe) => recipe.image);
  return (value as Array<Record<string, unknown>>).slice(0, 10).map((raw, index) => {
    const ingredients = Array.isArray(raw.ingredients) ? (raw.ingredients as Array<Record<string, unknown>>).slice(0, 18) : [];
    const steps = Array.isArray(raw.steps) ? raw.steps.filter((step): step is string => typeof step === 'string').slice(0, 8) : [];
    const recipe: Recipe = {
      id: typeof raw.id === 'string' ? raw.id.slice(0, 80) : `ai-${Date.now()}-${index}`,
      title: typeof raw.title === 'string' ? raw.title.slice(0, 90) : 'A fridge-friendly idea',
      summary: typeof raw.summary === 'string' ? raw.summary.slice(0, 260) : 'A flexible recipe shaped around what you have.',
      timeMinutes: Math.min(Math.max(Number(raw.timeMinutes) || 25, 1), 180),
      servings: Math.min(Math.max(Number(raw.servings) || 2, 1), 12),
      difficulty: raw.difficulty === 'Medium' || raw.difficulty === 'A little project' ? raw.difficulty : 'Easy',
      matchPercent: 0,
      matchedCount: 0,
      image: knownImages[index % knownImages.length],
      ingredients: ingredients.map((ingredient) => ({
        name: typeof ingredient.name === 'string' ? ingredient.name.slice(0, 80) : 'Ingredient',
        amount: typeof ingredient.amount === 'string' ? ingredient.amount.slice(0, 50) : 'to taste',
        inPantry: false,
      })),
      steps: steps.map((step) => step.slice(0, 700)),
      tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 3).map((tag) => tag.slice(0, 40)) : ['Made for your fridge'],
      tip: typeof raw.tip === 'string' ? raw.tip.slice(0, 260) : undefined,
      nutritionPerServing: (() => {
        const rawNutrition = raw.nutritionPerServing as Record<string, unknown> | undefined;
        if (!rawNutrition) return undefined;
        const values = ['calories', 'proteinGrams', 'carbsGrams', 'fatGrams'].map((key) => Number(rawNutrition[key]));
        if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1500)) return undefined;
        return { calories: Math.round(values[0]), proteinGrams: Math.round(values[1]), carbsGrams: Math.round(values[2]), fatGrams: Math.round(values[3]) };
      })(),
    };
    return rankRecipes([recipe], availableIngredients)[0];
  }).filter((recipe) => recipe.steps.length > 0 && recipe.ingredients.length > 0);
}

