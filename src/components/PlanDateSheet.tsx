import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResponsiveIonicons as Ionicons, ResponsiveText as Text } from './ResponsiveUI';
import { colors } from '../theme';

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function PlanDateSheet({ visible, recipeTitle, onClose, onChoose }: {
  visible: boolean;
  recipeTitle?: string;
  onClose: () => void;
  onChoose: (date: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); return date; });
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close meal planner" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.topRow}><Text style={styles.title}>Pick a day</Text><Pressable onPress={onClose} style={styles.close}><Ionicons name="close" size={19} color={colors.ink} /></Pressable></View>
          <Text style={styles.subtitle} numberOfLines={2}>{recipeTitle}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {days.map((date, index) => {
              const key = dateKey(date);
              return <Pressable key={key} onPress={() => onChoose(key)} style={styles.dayRow}>
                <View style={styles.dayIcon}><Ionicons name={index === 0 ? 'sunny-outline' : 'calendar-outline'} size={17} color={colors.oliveDeep} /></View>
                <Text style={styles.dayText}>{index === 0 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'long' })}</Text>
                <Text style={styles.dateText}>{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                <Ionicons name="arrow-forward" size={15} color="#8B907F" />
              </Pressable>;
            })}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(23,27,21,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '82%', backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', letterSpacing: -0.8 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EAE2', borderRadius: 18 },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 7, marginBottom: 14 },
  dayRow: { minHeight: 57, paddingHorizontal: 2, borderTopWidth: 1, borderTopColor: '#E9E9E1', flexDirection: 'row', alignItems: 'center', gap: 11 },
  dayIcon: { height: 34, width: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EDDC' },
  dayText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '700' },
  dateText: { color: '#777D70', fontSize: 10, fontWeight: '700', marginRight: 5 },
});
