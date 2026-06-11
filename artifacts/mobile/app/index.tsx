import React, { useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useGetPrices } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { PriceRow } from "@/components/PriceRow";
import { PriceSection } from "@/components/PriceSection";

const REFRESH_INTERVAL = 60_000;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isFetching } = useGetPrices({
    query: { refetchInterval: REFRESH_INTERVAL },
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const topPad =
    Platform.OS === "web" ? 67 : insets.top;
  const bottomPad =
    Platform.OS === "web" ? 34 : insets.bottom + 16;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          قیمت لحظه‌ای
        </Text>
        {data?.updatedAt ? (
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {data.updatedAt}
          </Text>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            در حال دریافت قیمت‌ها...
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[styles.errorIcon, { color: colors.red }]}>⚠️</Text>
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            خطا در دریافت قیمت‌ها{"\n"}برای تلاش مجدد، صفحه را بکشید
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Gold Section */}
          <PriceSection title="طلا" icon="🥇">
            <PriceRow label="طلای ۱۸ عیار" value={data?.gold18 ?? "—"} />
            <PriceRow label="طلای ۲۴ عیار" value={data?.gold24 ?? "—"} />
            <PriceRow
              label="مثقال طلا"
              value={data?.mithqal ?? "—"}
              isLast
            />
          </PriceSection>

          {/* Coin Section */}
          <PriceSection title="سکه" icon="🪙">
            <PriceRow label="سکه امامی" value={data?.emamiCoin ?? "—"} />
            <PriceRow label="بهار آزادی" value={data?.baharCoin ?? "—"} />
            <PriceRow label="نیم سکه" value={data?.halfCoin ?? "—"} />
            <PriceRow
              label="ربع سکه"
              value={data?.quarterCoin ?? "—"}
              isLast
            />
          </PriceSection>

          {/* Currency Section */}
          <PriceSection title="ارز" icon="💵">
            <PriceRow label="دلار آمریکا" value={data?.usd ?? "—"} flag="🇺🇸" />
            <PriceRow label="یورو" value={data?.eur ?? "—"} flag="🇪🇺" />
            <PriceRow label="پوند انگلیس" value={data?.gbp ?? "—"} flag="🇬🇧" />
            <PriceRow label="درهم امارات" value={data?.aed ?? "—"} flag="🇦🇪" />
            <PriceRow
              label="تتر"
              value={data?.usdt ?? "—"}
              flag="₮"
              isLast
            />
          </PriceSection>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  scroll: {
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  errorIcon: {
    fontSize: 40,
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
