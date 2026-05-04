import { invokeCommand } from "../lib/tauri";

export interface DashboardStats {
  total_cards: number;
  cards_due_today: number;
  cards_learned: number;
  reviews_today: number;
  study_streak: number;
  retention_rate: number;
  average_difficulty: number;
  total_documents: number;
  total_extracts: number;
  due_documents: number;
  cards_reviewed_today: number;
  daily_goal: number;
}

export interface ActivityDay {
  date: string;
  reviews_count: number;
  cards_learned: number;
  time_spent_minutes: number;
  retention_rate: number;
}

export interface MemoryStats {
  average_stability: number;
  average_difficulty: number;
  mature_cards: number;
  young_cards: number;
  new_cards: number;
}

export interface CategoryStats {
  category: string;
  card_count: number;
  reviews_count: number;
  retention_rate: number;
}

export interface LeechItem {
  id: string;
  question: string;
  lapses: number;
  review_count: number;
  suggested_actions: string[];
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  return await invokeCommand<DashboardStats>("get_dashboard_stats");
}

/**
 * Get memory statistics
 */
export async function getMemoryStats(): Promise<MemoryStats> {
  return await invokeCommand<MemoryStats>("get_memory_stats");
}

/**
 * Get activity data for the last N days
 */
export async function getActivityData(days: number = 30): Promise<ActivityDay[]> {
  const result = await invokeCommand<ActivityDay[] | null>("get_activity_data", { days });
  if (!Array.isArray(result)) {
    console.warn("[analytics] get_activity_data returned non-array result", result);
  }
  return Array.isArray(result) ? result : [];
}

/**
 * Get category statistics
 */
export async function getCategoryStats(): Promise<CategoryStats[]> {
  const result = await invokeCommand<CategoryStats[] | null>("get_category_stats");
  if (!Array.isArray(result)) {
    console.warn("[analytics] get_category_stats returned non-array result", result);
  }
  return Array.isArray(result) ? result : [];
}

export async function getLeechDashboard(threshold: number = 8): Promise<LeechItem[]> {
  const result = await invokeCommand<LeechItem[] | null>("get_leech_dashboard", { threshold });
  if (!Array.isArray(result)) {
    console.warn("[analytics] get_leech_dashboard returned non-array result", result);
  }
  return Array.isArray(result) ? result : [];
}

export interface WorkloadDay {
  date: string;
  due_count: number;
  reviewed_count: number;
  new_count: number;
}

export interface WorkloadDayDetail {
  item_id: string;
  question: string;
  answer: string | null;
  document_title: string;
  item_type: string;
  state: string;
  review_rating: number | null;
}

export interface ForecastPoint {
  date: string;
  due_learning_items: number;
  due_documents: number;
  due_total: number;
}

export interface ForecastSummary {
  horizon_days: number;
  due_total: number;
}

export interface WorkloadForecast {
  points: ForecastPoint[];
  summaries: ForecastSummary[];
}

/**
 * Get daily workload data for a date range
 */
export async function getWorkloadData(startDate: string, endDate: string): Promise<WorkloadDay[]> {
  const result = await invokeCommand<WorkloadDay[] | null>("get_workload_data", { start_date: startDate, end_date: endDate });
  if (!Array.isArray(result)) {
    console.warn("[analytics] get_workload_data returned non-array result", result);
  }
  return Array.isArray(result) ? result : [];
}

/**
 * Get item-level details for a specific day
 */
export async function getWorkloadDayDetails(date: string): Promise<WorkloadDayDetail[]> {
  const result = await invokeCommand<WorkloadDayDetail[] | null>("get_workload_day_details", { date });
  if (!Array.isArray(result)) {
    console.warn("[analytics] get_workload_day_details returned non-array result", result);
  }
  return Array.isArray(result) ? result : [];
}

/**
 * Get workload forecast for the next N days
 */
export async function getWorkloadForecast(days: number = 90): Promise<WorkloadForecast> {
  const result = await invokeCommand<WorkloadForecast | null>("get_due_workload_forecast", { days });
  if (!result || !Array.isArray(result.points)) {
    console.warn("[analytics] get_due_workload_forecast returned unexpected result", result);
    return { points: [], summaries: [] };
  }
  return result;
}
