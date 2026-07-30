import { View, Text, StyleSheet } from 'react-native';

export default function Login() {
  return (
    <View style={styles.root}>
      <Text>Login</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
