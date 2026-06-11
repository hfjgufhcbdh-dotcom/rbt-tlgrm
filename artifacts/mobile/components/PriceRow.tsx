import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface PriceRowProps {
  label: string;
  value: string;
  flag?: string;
  isLast?: boolean;
}

export function PriceRow({ label, value, flag, isLast }: PriceRowProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.left}>
        {flag ? (
          <Text style={styles.flag}>{flag}</Text>
        ) : null}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flag: {
    fontSize: 18,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  value: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
