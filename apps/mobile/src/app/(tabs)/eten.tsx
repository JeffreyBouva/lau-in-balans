import { View, Text, StyleSheet } from 'react-native';

export default function Eten() {
  return (
    <View style={styles.root}>
      <Text>Eten</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
