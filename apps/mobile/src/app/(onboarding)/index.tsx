import { View, Text, StyleSheet } from 'react-native';

export default function Onboarding() {
  return (
    <View style={styles.root}>
      <Text>Onboarding</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
