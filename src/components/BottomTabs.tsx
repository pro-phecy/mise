import { Pressable, StyleSheet, View } from 'react-native';
import { ResponsiveIonicons as Ionicons, ResponsiveText as Text } from './ResponsiveUI';
import type { AppTab } from '../types';
import { colors, radius } from '../theme';

const tabs: Array<{ id: AppTab; label: string; icon: keyof typeof Ionicons.glyphMap; selected: keyof typeof Ionicons.glyphMap }> = [
  { id: 'home', label: 'Discover', icon: 'compass-outline', selected: 'compass' },
  { id: 'pantry', label: 'My pantry', icon: 'grid-outline', selected: 'grid' },
  { id: 'plan', label: 'Plan', icon: 'calendar-outline', selected: 'calendar' },
  { id: 'saved', label: 'Saved', icon: 'bookmark-outline', selected: 'bookmark' },
];

export function BottomTabs({ activeTab, onChange, bottomInset = 0 }: { activeTab: AppTab; onChange: (tab: AppTab) => void; bottomInset?: number }) {
  return (
    <View style={[styles.wrap, { bottom: Math.max(bottomInset, 12) }]}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => onChange(tab.id)} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: active }}>
              <View style={[styles.iconWrap, active && styles.activeIcon]}>
                <Ionicons name={active ? tab.selected : tab.icon} size={19} color={active ? colors.ink : '#8C9085'} />
              </View>
              <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 17, right: 17, bottom: 12 },
  bar: { height: 73, backgroundColor: '#FCFCF8', borderRadius: radius.pill, borderWidth: 1, borderColor: '#E9E9E1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', shadowColor: '#303427', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 0 },
  iconWrap: { width: 36, height: 31, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  activeIcon: { backgroundColor: colors.olive },
  label: { color: '#93968C', fontSize: 10, fontWeight: '600' },
  activeLabel: { color: colors.ink, fontWeight: '800' },
});
