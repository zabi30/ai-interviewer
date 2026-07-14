import React from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import SafeLottie from "../components/SafeLottie";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../context/themeColors";
import { Ionicons } from "@expo/vector-icons"; // ✅ 1. Import icon
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get("window");

// Responsive breakpoints
const breakpoints = {
  sm: 480,    // Small mobile
  md: 768,    // Large mobile/tablet
  lg: 1024,   // Desktop
  xl: 1440,   // Large desktop
};

// Responsive utilities
const getResponsiveValue = (baseValue: number, factor = 1) => {
  if (Platform.OS !== 'web') return baseValue * factor;
  
  if (width >= breakpoints.xl) return baseValue * 1.2;
  if (width >= breakpoints.lg) return baseValue * 1.1;
  if (width >= breakpoints.md) return baseValue * 1.0;
  return baseValue * 0.9;
};

const getFontSize = (base: number) => {
  if (Platform.OS !== 'web') {
    // Mobile responsive font sizes
    if (width <= 360) return base * 0.85; // Very small phones
    if (width <= 400) return base * 0.9;  // Small phones
    return base; // Regular phones
  }
  return getResponsiveValue(base);
};

const getPadding = (base: number) => {
  if (Platform.OS !== 'web') {
    if (width <= 360) return base * 0.7;
    if (width <= 400) return base * 0.8;
    return base;
  }
  return getResponsiveValue(base);
};

export default function HomeScreen() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme(); // ✅ 2. Get toggle function
  const colors = themeColors[theme];
  const isDark = theme === "dark";

  // Responsive logo sizing
  const lottieSize = Platform.OS === 'web'
    ? Math.min(width * (width >= breakpoints.lg ? 0.25 : 0.35), width >= breakpoints.xl ? 200 : 160)
    : Math.min(width * (width <= 360 ? 0.45 : width <= 400 ? 0.48 : 0.5), width <= 360 ? 280 : 320);
  
  const isWeb = Platform.OS === 'web';
  const isWideWeb = isWeb && width > breakpoints.lg; // Updated breakpoint

  const fullViewHeight = isWeb && typeof window !== 'undefined' ? window.innerHeight : height;

  const wideContent = (
    <View style={styles.wideRow}>
      <View style={[styles.sideImageContainer, { height: fullViewHeight }]}> 
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.sideImage}
          resizeMode="cover"
        />
      </View>
      <View style={styles.wideContent}> 
        <View style={styles.heroText}> 
          <Text style={[styles.title, { color: colors.text }]}>AI Interviewer</Text>
          <Text style={[styles.subtitle, isWideWeb && styles.subtitleWideWeb, { color: colors.subtitle }]}>Practice interviews with AI guidance{"\n"}Improve your confidence & land your dream job</Text>
        </View>
        <View style={styles.rolesContainerWide}> 
          <TouchableOpacity
            style={styles.roleCard}
            activeOpacity={0.85}
            onPress={() => router.push("/admin")}
          >
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.roleGradient}>
              <Image
                source={{ uri: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" }}
                style={styles.roleIcon}
              />
              <Text style={styles.roleText}>Admin</Text>
              <Text style={styles.roleSubText}>Manage interviews & candidates</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.roleCard}
            activeOpacity={0.85}
            onPress={() => router.push("/interview")}
          >
            <LinearGradient colors={[colors.accent, colors.secondary]} style={styles.roleGradient}>
              <Image
                source={{ uri: "https://cdn-icons-png.flaticon.com/512/1053/1053210.png" }}
                style={styles.roleIcon}
              />
              <Text style={styles.roleText}>Candidate</Text>
              <Text style={styles.roleSubText}>Start your practice interview</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const content = isWideWeb ? wideContent : (
    <View style={styles.inner}>
      {!isWideWeb && (
        <TouchableOpacity
          style={styles.themeToggle}
          onPress={toggleTheme}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={28}
            color={colors.text}
          />
        </TouchableOpacity>
      )}
      <View style={styles.hero}>
        <Image
          source={require('../assets/images/logo.png')}
          style={[styles.lottie, { width: lottieSize, height: lottieSize }]}
          resizeMode="contain"
        />
        <Text style={[styles.title, isWeb && styles.webLift, { color: colors.text }]}>AI Interview</Text>
        <Text style={[styles.subtitle, isWeb && styles.webLift, { color: colors.subtitle }]}>Practice interviews with AI guidance{"\n"}Improve your confidence & land your dream job</Text>
      </View>
      <View style={styles.rolesContainer}>
        <TouchableOpacity
          style={styles.roleCard}
          activeOpacity={0.85}
          onPress={() => router.push("/admin")}
        >
          <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.roleGradient}>
            <Image
              source={{ uri: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" }}
              style={styles.roleIcon}
            />
            <Text style={styles.roleText}>Admin</Text>
            <Text style={styles.roleSubText}>Manage interviews & candidates</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.roleCard}
          activeOpacity={0.85}
          onPress={() => router.push("/interview")}
        >
          <LinearGradient colors={[colors.accent, colors.secondary]} style={styles.roleGradient}>
            <Image
              source={{ uri: "https://cdn-icons-png.flaticon.com/512/1053/1053210.png" }}
              style={styles.roleIcon}
            />
            <Text style={styles.roleText}>Candidate</Text>
            <Text style={styles.roleSubText}>Start your practice interview</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        isWideWeb && styles.containerWideCenter,
        isWideWeb && styles.containerWideLeft,
        { backgroundColor: colors.background },
      ]}
    >
      {isWideWeb && (
        <TouchableOpacity
          style={[styles.themeToggle, styles.themeToggleGlobal]}
          onPress={toggleTheme}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={30}
            color={colors.text}
          />
        </TouchableOpacity>
      )}
      {content}
      
      {/* Footer for both mobile and web */}
      <View style={[styles.footer, isWideWeb && styles.footerWide]}>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          Powered by Zabi Techs
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 0,
    width: '100%',
    // Try both vh and numeric fallback for web full height
    minHeight: Platform.OS === 'web' ? (typeof window !== 'undefined' ? Math.max(window.innerHeight, 600) : 700) : undefined,
  },
  containerWideCenter: {
    justifyContent: 'center',
  },
  containerWideLeft: {
    alignItems: 'flex-start',
  },
  inner: {
    width: '100%',
    alignItems: 'center',
    paddingTop: getPadding(Platform.OS === 'web' ? 32 : 40),
    paddingBottom: getPadding(Platform.OS === 'web' ? 40 : 60),
    paddingHorizontal: getPadding(Platform.OS === 'web' ? 0 : 20),
    gap: Platform.OS === 'web' ? getResponsiveValue(30) : (width <= 360 ? 30 : 40),
    minHeight: Platform.OS === 'web' ? undefined : height * (width <= 360 ? 0.75 : 0.8),
  },
  wideRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    
  },
  sideImageContainer: {
    width: '40%',
    minWidth: 360,
    backgroundColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  sideImage: {
    width: '120%',
    height: '120%',
  },
  wideContent: {
    flex: 1,
    paddingVertical: 50,
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    position: 'relative', 
    right : 230,
    gap: 70
    

  },
  heroText: {
    maxWidth:1200,
    width: '100%',
    gap: 20,
    alignItems: 'flex-start',

    flex: 1
  },
  rolesContainerWide: {
    width: '100%',
    maxWidth: 1200,  // Changed from 900 to 1200
    gap: 24,
    marginTop: 24,
    alignItems: 'stretch',
    flex: 1,
    position: 'relative',
    left : 150
  },
  // Horizontal layout for wide web (legacy retained if needed elsewhere)
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 1300,
    width: '100%',
    gap: 60,
    paddingHorizontal: 60,
    paddingTop: 8,
  },
  
  hero: {
    alignItems: "center",
    paddingTop: Platform.OS === 'web' ? 0 : 0,
    justifyContent: 'flex-start',
    width: '100%',
    paddingHorizontal: Platform.OS === 'web' ? 0 : 20, // Add padding on mobile
  },
  heroWeb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    marginBottom: 10,
    alignSelf: Platform.OS === 'web' ? 'center' : 'center',
    marginLeft: Platform.OS === 'web' ? 0 : 120, // Slight right shift on mobile
  },
  webLift: {
    marginTop: -10,
  },
  // Title styling
  title: {
    fontSize: Platform.OS === 'web' ? getFontSize(60) : getFontSize(32),
    fontWeight: "800",
    marginBottom: getPadding(13),
    textAlign: "center",
    letterSpacing: Platform.OS === 'web' ? getResponsiveValue(2.2) : (width <= 360 ? 1.2 : 1.5),
    textTransform: "uppercase",
    color: "#4ecdc4", // Modern teal
    textShadowRadius: 12,
    fontFamily: 'sans-serif-medium',
    marginRight: Platform.OS === 'web' ? getResponsiveValue(800) : 0,
  },
  titleWeb: {
    width: '100%',
    fontSize: 200,
  },
  subtitle: {
    fontSize: Platform.OS === 'web' ? getFontSize(20) : getFontSize(16),
    textAlign: "center",
    lineHeight: Platform.OS === 'web' ? getResponsiveValue(22) : (width <= 360 ? 18 : 20),
    paddingHorizontal: Platform.OS === 'web' ? getPadding(20) : getPadding(16),
  },
 
  subtitleWideWeb: {
 minWidth: 400,
    marginLeft: 70,
  
    textAlign: 'center',  // Changed from marginLeft to textAlign
  },
  rolesContainer: {
    width: '100%',
    alignItems: 'center',
    gap: Platform.OS === 'web' ? getResponsiveValue(20) : (width <= 360 ? 20 : 24),
    paddingHorizontal: Platform.OS === 'web' ? getPadding(32) : getPadding(16),
    marginBottom: 0,
    justifyContent: 'flex-start',
  },
  rolesWeb: {
    flex: 1,
    maxWidth: 820,
    alignItems: 'stretch',
    paddingHorizontal: 0,
  },
  roleCard: {
    // Responsive width: use percentage on web, calc based on screen size on native
    width: Platform.OS === 'web' ? '100%' : width * (width <= 360 ? 0.9 : 0.85),
    maxWidth: Platform.OS === 'web' ? getResponsiveValue(1100) : (width <= 360 ? 320 : undefined),
    paddingVertical: 0,
    borderRadius: getResponsiveValue(18),
    alignItems: "stretch",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === 'web' ? 0.04 : 0.08,
    shadowOffset: { width: 0, height: Platform.OS === 'web' ? 2 : 4 },
    shadowRadius: Platform.OS === 'web' ? 3 : 6,
    elevation: Platform.OS === 'web' ? 0 : 4,
  },
  roleGradient: {
    borderRadius: getResponsiveValue(18),
    paddingVertical: getPadding(20),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  roleIcon: {
    width: getResponsiveValue(60),
    height: getResponsiveValue(60),
    marginBottom: getPadding(10),
  },
  roleText: {
    fontSize: getFontSize(20),
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: getPadding(4),
  },
  roleSubText: {
    fontSize: getFontSize(14),
    color: "#f0fdfa",
    textAlign: "center",
  },
  bottomWave: {
    width: width,
    height: height * 0.15,
  },
  themeToggle: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  themeToggleGlobal: {
    top: 20,
    left: 16,
    right: undefined,
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? getPadding(10) : getPadding(20),
    width: '100%',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? getPadding(8) : getPadding(12),
    paddingHorizontal: getPadding(20),
  },
  footerWide: {
    bottom: getPadding(20),
    right: getPadding(20),
    width: 'auto',
    position: 'absolute',
  },
  footerText: {
    fontSize: Platform.OS === 'web' ? getFontSize(12) : getFontSize(11),
    fontWeight: '500',
    opacity: 0.7,
    textAlign: 'center',
  },
});
