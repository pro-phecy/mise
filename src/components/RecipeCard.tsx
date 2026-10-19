import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ResponsiveIonicons as Ionicons, ResponsiveText as Text } from './ResponsiveUI';
import type { Recipe } from '../types';
import { colors, radius } from '../theme';

type Props = {
  recipe: Recipe;
  onPress: () => void;
  onSave: () => void;
  isSaved: boolean;
  compact?: boolean;
  index?: number;
};

export function RecipeCard({ recipe, onPress, onSave, isSaved, compact = false, index = 0 }: Props) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 65).springify().damping(20)}>
      <Pressable onPress={onPress} style={[styles.card, compact ? styles.compact : styles.regular]} accessibilityRole="button" accessibilityLabel={`Open ${recipe.title}`}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: recipe.image }} style={styles.image} resizeMode="cover" />
          <LinearGradient colors={['rgba(28,30,25,0.28)', 'transparent', 'rgba(28,30,25,0.45)']} style={StyleSheet.absoluteFill} />
          <View style={styles.matchPill}>
            <View style={styles.matchDot} />
            <Text style={styles.matchText}>{recipe.matchedCount} of {recipe.ingredients.length} in your fridge</Text>
          </View>
          <Pressable onPress={(event) => { event.stopPropagation(); onSave(); }} style={styles.saveButton} accessibilityRole="button" accessibilityLabel={isSaved ? 'Remove saved recipe' : 'Save recipe'}>
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={isSaved ? colors.oliveDeep : colors.ink} />
          </Pressable>
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
            <View style={styles.timePill}><Text style={styles.time}>{recipe.timeMinutes}m</Text></View>
          </View>
          {!compact && <Text style={styles.summary} numberOfLines={2}>{recipe.summary}</Text>}
          <View style={styles.tags}>
            {recipe.tags.slice(0, 2).map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: '#EEEDE6' },
  compact: { width: 254 },
  regular: { width: '100%' },
  imageWrap: { height: 176, position: 'relative', backgroundColor: '#DDE1D1' },
  image: { width: '100%', height: '100%' },
  matchPill: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7 },
  matchDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#83A43C' },
  matchText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  saveButton: { position: 'absolute', right: 12, top: 12, height: 36, width: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.93)' },
  copy: { paddingHorizontal: 14, paddingTop: 13, paddingBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' },
  title: { flex: 1, color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: '700', letterSpacing: -0.35 },
  timePill: { borderRadius: radius.pill, backgroundColor: colors.paper, paddingHorizontal: 9, paddingVertical: 5 },
  time: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  summary: { color: colors.muted, marginTop: 6, fontSize: 12, lineHeight: 17 },
  tags: { flexDirection: 'row', gap: 7, marginTop: 10 },
  tag: { color: '#59614A', backgroundColor: '#F0F2E7', fontSize: 10, fontWeight: '700', overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
});
