import { View, Text, StyleSheet } from 'react-native';

export default function Chat() {
  return (
    <View style={styles.root}>
      <Text>Chat</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
