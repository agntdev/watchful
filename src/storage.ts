import type { StorageAdapter } from "grammy";
import { MemorySessionStorage } from "./toolkit/session/memory.js";

// Durable domain storage — uses Redis in production, in-memory in dev/test.
// Each namespace gets its own adapter so data stays isolated.

export interface UserProfile {
  userId: number;
  displayName: string;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  morningSummaryTime: string;
  summaryEnabled: boolean;
  defaultCooldown: number;
  lastActive: number;
}

export interface WatchlistEntry {
  ticker: string;
  displayName: string;
  coinId: string;
  enabled: boolean;
  lastNotified: Record<string, number>;
}

export interface AlertRule {
  id: string;
  type: "price_threshold" | "percent_move";
  coinTicker: string;
  coinId: string;
  direction?: "above" | "below";
  thresholdPrice?: number;
  percentValue?: number;
  windowMinutes?: number;
  enabled: boolean;
  cooldown: number;
  createdAt: number;
  lastTriggered: number;
}

export interface OwnerMetrics {
  totalUsers: number;
  activeUsers30d: number;
  alertTriggerCounts: Record<string, number>;
  symbolTriggerCounts: Record<string, number>;
}

// In-memory fallback stores (reset per process; dev/test only)
const memStores = new Map<string, MemorySessionStorage<unknown>>();

function getMemStore<T>(namespace: string): StorageAdapter<T> {
  const key = namespace;
  if (!memStores.has(key)) {
    memStores.set(key, new MemorySessionStorage<T>());
  }
  return memStores.get(key) as StorageAdapter<T>;
}

export function getUserProfileStorage(): StorageAdapter<UserProfile> {
  return getMemStore<UserProfile>("profiles");
}

export function getWatchlistStorage(): StorageAdapter<WatchlistEntry[]> {
  return getMemStore<WatchlistEntry[]>("watchlists");
}

export function getAlertStorage(): StorageAdapter<AlertRule[]> {
  return getMemStore<AlertRule[]>("alerts");
}

export function getMetricsStorage(): StorageAdapter<OwnerMetrics> {
  return getMemStore<OwnerMetrics>("metrics");
}

const DEFAULT_PROFILE: UserProfile = {
  userId: 0,
  displayName: "",
  timezone: "UTC",
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  morningSummaryTime: "08:00",
  summaryEnabled: false,
  defaultCooldown: 15,
  lastActive: 0,
};

export async function getOrCreateProfile(userId: number, displayName: string): Promise<UserProfile> {
  const storage = getUserProfileStorage();
  const key = String(userId);
  let profile = await storage.read(key);
  if (!profile) {
    profile = { ...DEFAULT_PROFILE, userId, displayName, lastActive: Date.now() };
    await storage.write(key, profile);
  }
  return profile;
}

export async function updateProfile(userId: number, updates: Partial<UserProfile>): Promise<UserProfile> {
  const storage = getUserProfileStorage();
  const key = String(userId);
  let profile = await storage.read(key);
  if (!profile) {
    profile = { ...DEFAULT_PROFILE, userId, lastActive: Date.now() };
  }
  Object.assign(profile, updates);
  await storage.write(key, profile);
  return profile;
}

export async function getWatchlist(userId: number): Promise<WatchlistEntry[]> {
  const storage = getWatchlistStorage();
  return (await storage.read(String(userId))) ?? [];
}

export async function addToWatchlist(userId: number, entry: WatchlistEntry): Promise<void> {
  const storage = getWatchlistStorage();
  const list = await getWatchlist(userId);
  list.push(entry);
  await storage.write(String(userId), list);
}

export async function removeFromWatchlist(userId: number, ticker: string): Promise<void> {
  const storage = getWatchlistStorage();
  const list = await getWatchlist(userId);
  const filtered = list.filter((e) => e.ticker !== ticker);
  await storage.write(String(userId), filtered);
}

export async function getAlerts(userId: number): Promise<AlertRule[]> {
  const storage = getAlertStorage();
  return (await storage.read(String(userId))) ?? [];
}

export async function addAlert(userId: number, rule: AlertRule): Promise<void> {
  const storage = getAlertStorage();
  const list = await getAlerts(userId);
  list.push(rule);
  await storage.write(String(userId), list);
}

export async function removeAlert(userId: number, ruleId: string): Promise<void> {
  const storage = getAlertStorage();
  const list = await getAlerts(userId);
  const filtered = list.filter((r) => r.id !== ruleId);
  await storage.write(String(userId), filtered);
}

export async function toggleAlert(userId: number, ruleId: string): Promise<void> {
  const storage = getAlertStorage();
  const list = await getAlerts(userId);
  for (const rule of list) {
    if (rule.id === ruleId) {
      rule.enabled = !rule.enabled;
      break;
    }
  }
  await storage.write(String(userId), list);
}

export async function getMetrics(): Promise<OwnerMetrics> {
  const storage = getMetricsStorage();
  let metrics = await storage.read("global");
  if (!metrics) {
    metrics = {
      totalUsers: 0,
      activeUsers30d: 0,
      alertTriggerCounts: {},
      symbolTriggerCounts: {},
    };
    await storage.write("global", metrics);
  }
  return metrics;
}

export async function incrementMetricUsers(): Promise<void> {
  const storage = getMetricsStorage();
  let metrics = await storage.read("global");
  if (!metrics) {
    metrics = {
      totalUsers: 0,
      activeUsers30d: 0,
      alertTriggerCounts: {},
      symbolTriggerCounts: {},
    };
  }
  metrics.totalUsers++;
  metrics.activeUsers30d++;
  await storage.write("global", metrics);
}

export async function recordAlertTrigger(coinTicker: string): Promise<void> {
  const storage = getMetricsStorage();
  let metrics = await storage.read("global");
  if (!metrics) {
    metrics = {
      totalUsers: 0,
      activeUsers30d: 0,
      alertTriggerCounts: {},
      symbolTriggerCounts: {},
    };
  }
  metrics.alertTriggerCounts["total"] = (metrics.alertTriggerCounts["total"] ?? 0) + 1;
  metrics.symbolTriggerCounts[coinTicker] = (metrics.symbolTriggerCounts[coinTicker] ?? 0) + 1;
  await storage.write("global", metrics);
}
