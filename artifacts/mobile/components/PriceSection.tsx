import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface PriceSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}

export function PriceSection({ title, icon, children }: PriceSectionProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.title, { color: colors.sectionHeader }]}>{title}</Text>
      </View>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  icon: {
    fontSize: 18,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
});
