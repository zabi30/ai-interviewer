// app/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { themeColors } from "../context/themeColors";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedStatusBar />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

function ThemedStatusBar() {
  const { theme } = useTheme();
  const colors = themeColors[theme];
  return (
    <StatusBar style={theme === "dark" ? "light" : "dark"} backgroundColor={colors.background} />
  );
}
