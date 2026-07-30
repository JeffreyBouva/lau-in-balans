import { View, Text, StyleSheet } from 'react-native';

export default function Vandaag() {
  return (
    <View style={styles.root}>
      <Text>Vandaag</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
