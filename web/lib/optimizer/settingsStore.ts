import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS } from "./settings.ts";
import type { OptimizerSettings } from "./types.ts";

type SettingsRow = {
  cost_per_km: number;
  cost_per_hour: number;
  max_multi_store_count: number;
  compromise_store_count: number;
  tolerance_eur: number;
  threshold_eur: number;
  rewe_service_fee_cent: number;
};

export function settingsFromRow(row: SettingsRow): OptimizerSettings {
  return {
    costPerKm: row.cost_per_km,
    costPerHour: row.cost_per_hour,
    maxMultiStoreCount: row.max_multi_store_count,
    compromiseStoreCount: row.compromise_store_count,
    toleranceEur: row.tolerance_eur,
    thresholdEur: row.threshold_eur,
    reweServiceFeeCent: row.rewe_service_fee_cent,
  };
}

export function settingsToRow(settings: OptimizerSettings): SettingsRow {
  return {
    cost_per_km: settings.costPerKm,
    cost_per_hour: settings.costPerHour,
    max_multi_store_count: settings.maxMultiStoreCount,
    compromise_store_count: settings.compromiseStoreCount,
    tolerance_eur: settings.toleranceEur,
    threshold_eur: settings.thresholdEur,
    rewe_service_fee_cent: settings.reweServiceFeeCent,
  };
}

export async function loadSettings(supabase: SupabaseClient): Promise<OptimizerSettings> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return DEFAULT_SETTINGS;
  const { data } = await supabase.from("user_settings").select("*").eq("user_id", userData.user.id).maybeSingle();
  return data ? settingsFromRow(data as SettingsRow) : DEFAULT_SETTINGS;
}

export async function saveSettings(supabase: SupabaseClient, settings: OptimizerSettings): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase
    .from("user_settings")
    .upsert({ user_id: userData.user.id, ...settingsToRow(settings), updated_at: new Date().toISOString() });
}
