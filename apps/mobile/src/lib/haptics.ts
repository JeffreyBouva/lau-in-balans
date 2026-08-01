import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Kleine haptics-helpers. No-op op web (daar bestaat de Taptic Engine niet), zodat je ze
 * overal zonder Platform-check kunt aanroepen.
 * - tik(): lichte selectie-tick (steppers, chips, tab-achtige keuzes).
 * - stoot(): lichte impact (knoppen, openen, versturen).
 */
export function tik() {
  if (Platform.OS !== 'web') Haptics.selectionAsync();
}

export function stoot() {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
