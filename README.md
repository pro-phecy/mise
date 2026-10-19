# mise — dinner starts with what you have

An Expo + React Native starter for a pantry-first cooking app. Add what is in your fridge, pick ingredients to use, and get meal ideas ranked by ingredient overlap. Save recipes, manage a pantry, and cook step by step.

## What’s in the MVP

- Native pantry list with ingredient categories, quantity and best-before tracking, quick add, comma-separated paste, fridge/receipt photo scanning, barcode lookup, and soon-to-expire highlighting.
- Recipe discovery ranked by how many ingredients you already have, with quick and vegetarian filters.
- Recipe details with pantry matches, missing items, prep time, servings, chef notes, and a focused cook-along mode.
- Supabase email sign-up/sign-in and password recovery, with per-user cloud sync for pantry items, saved recipes, meal plans, shopping lists, preferences, and cooking history. Users can also delete their account and associated data.
- PantryChef, MasterChef, MixologyMaestro, BakeHeist, and MacrosChef generation modes, plus personalized seven-day meal plans. Groq generation applies dietary preferences, allergies, skill level, appliances, cook time, servings, and optional macro limits.
- A personalized seven-day meal planner that automatically adds missing ingredients from planned meals to a deduplicated, checkable grocery list, plus cooked-meal history.
- Fridge and receipt scanning from camera or photo library, plus packaged-food barcode lookup, with review before items are added.
- Recipe remix requests, adjustable servings with scaled quantities, step timers, estimated nutrition on AI-generated meals, and photo-based meal calorie estimates.
- A searchable recipe book with built-in Quick, Vegetarian, and High protein filters, plus personal folders for organizing saved recipes. Profile settings include Keto and Paleo dietary filters, allergy exclusions, cooking skill, equipment selection, and per-serving macro targets used to filter generated meals by their AI estimates.
- In-app best-before reminders with meal ideas, plus Open Food Facts barcode details for product ingredients, allergens, and per-100 g nutrition when listed.
- Optional household kitchens with invite codes and shared pantry and shopping list entries. Existing personal items stay private until the user chooses to move them into the shared kitchen.
- Product details come from [Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v2/products/get-product-by-code/); coverage depends on the product being listed in its database.
- A warm, editorial visual system with lightweight native entrance transitions, haptics, responsive cards, clear empty states, and reduced friction for adding ingredients.

## Run the app

Use Node.js 22.13 or newer for Expo SDK 57.

```sh
cd outputs/mise
npm install
npx expo install --fix
npx expo start
```

Configure Supabase before launching the app. Users must create an account or sign in before accessing the pantry, meal ideas, or saved recipes; app data is stored in their Supabase account.

## Connect Supabase

1. Create a Supabase project and enable Email in **Authentication → Providers**. Supabase configuration is required for account access.
2. Copy `.env.example` to `.env`, then fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the project’s Connect panel. Use the publishable key, never a secret key, in the mobile app.
3. Allow `mise://reset-password` in **Authentication → URL Configuration → Redirect URLs** for password recovery.
4. Apply all SQL migrations in `supabase/migrations/` using the Supabase SQL Editor or Supabase CLI.
5. Install the Supabase CLI as a project dependency, authenticate, then link and deploy. With an npm-installed CLI, run commands through `npx`:

   ```sh
   npm install --save-dev supabase
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   npx supabase functions deploy generate-meals
   npx supabase functions deploy identify-ingredients
   npx supabase functions deploy delete-account
   npx supabase secrets set GROQ_API_KEY=YOUR_GROQ_KEY SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   ```

6. Restart Expo after editing `.env`:

   ```sh
   npx expo start --clear
   ```

The database migrations enable row-level security and scope profile settings, private pantry items, meal plans, shopping-list entries, saved recipes, and cooking history to the signed-in user. Household pantry and shopping-list rows are visible only to members of the matching household. Each Edge Function validates the current session. Meal generation, recipe remixing, fridge/receipt scanning, and photo calorie estimates require `GROQ_API_KEY` in Supabase Function Secrets. The text and vision functions default to Groq's `qwen/qwen3.8-27b` model; set `GROQ_MODEL` or `GROQ_VISION_MODEL` only when overriding the default. Account deletion additionally requires `SUPABASE_SERVICE_ROLE_KEY`; keep all provider and service-role keys in Supabase function secrets only, never in `.env` or the mobile bundle. Selected photos are sent to Groq and are not stored by this app. Nutrition values from AI, especially photo-based estimates, are approximate; barcode nutrition and ingredient data are reported by Open Food Facts and may be incomplete, so users should verify product packaging and allergen labels.

## Prepare a release

Store artwork, EAS build profiles, and draft public support/privacy/account-deletion pages are included in this project. The pages in `release/` intentionally contain publisher placeholders; do not publish them until every bracketed value has been replaced with verified details.

1. Publish `release/privacy-policy.html`, `release/account-deletion.html`, and `release/support.html` at stable HTTPS URLs. Replace `[PUBLISHER LEGAL NAME]`, `[SUPPORT EMAIL]`, `[PRIVACY POLICY URL]`, and `[ACCOUNT DELETION URL]` first. Confirm the deletion instructions and data disclosures match the live service.
2. Add these Expo public variables to both the local app environment and the EAS production environment: `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_ACCOUNT_DELETION_URL`, and `EXPO_PUBLIC_SUPPORT_EMAIL`. The corresponding links will then appear in the account screen. Rebuild after changing Expo public variables.
3. Create or select the EAS project, authenticate with Expo, and let EAS configure the project link. This project intentionally has no invented EAS owner or project ID:

   ```sh
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

4. Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the EAS production environment. Keep `GROQ_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` only in Supabase Function Secrets.
5. Build internal previews before production binaries:

   ```sh
   npx eas-cli@latest build --profile preview --platform android
   npx eas-cli@latest build --profile preview --platform ios
   npx eas-cli@latest build --profile production --platform all
   ```

6. Test account creation, sign-in, password recovery, account deletion, pantry sync, AI generation and scanning, meal plans, grocery list, household sharing, offline/error states, permissions, and accessibility on physical iOS and Android devices. Then complete the stores' privacy disclosures, screenshots, age rating, support URL, privacy URL, and account-deletion URL before submitting for review.

The links are omitted in the app until their real URLs and support email are configured. Store signing, store account metadata, legal publisher identity, and public hosting must be supplied by the publisher.

## Design references

- [GSAP](https://github.com/greensock/GSAP) — choreographed, well-paced motion.
- [Darkroom Engineering](https://github.com/darkroomengineering) — smooth interaction and polished motion principles.
- [React Bits](https://github.com/DavidHDev/react-bits) — expressive, reusable interaction patterns.

Those projects target web rendering and DOM/CSS patterns, so the mobile app carries their motion and interaction ideas into native views with Reanimated, haptics, and React Native components instead of importing web-only animations.
