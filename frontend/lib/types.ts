export type MealType = "lunch" | "dinner";
export type SubStatus = "active" | "paused" | "cancelled";
export type PayMethod = "cash" | "upi" | "card" | "netbanking";
export type AdHocStatus = "confirmed" | "preparing" | "delivered" | "cancelled";
export type InvoiceStatus = "pending" | "partial" | "paid" | "overdue";

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserOut {
  id: number;
  name: string;
  phone: string;
  email?: string;
  pincode: string;
  address: string;
  area?: string;
  created_at: string;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
  role: "customer" | "admin";
  user?: UserOut | null;
}

export interface MenuItem {
  id: number;
  meal_type: MealType;
  name: string;
  dishes: string[];
  price: number;
  image_url: string;
  is_active: boolean;
}

export interface ScheduleDay {
  date: string;
  weekday: string;
  served: boolean;
  skipped: boolean;
  locked: boolean;
}

export interface SubscriptionOut {
  id: number;
  meal_type: MealType;
  status: SubStatus;
  weekdays: number[];
  weekday_labels: string[];
  plates_per_day: number;
  menu_item_id: number | null;
  menu_item_name: string;
  image_url: string;
  price: number;
  start_date: string;
  end_date: string | null;
  schedule: ScheduleDay[];
}

export interface SubscriptionListItem extends SubscriptionOut {
  customer_id: number;
  customer_name: string;
  customer_phone: string;
}

export interface InvoiceLine {
  kind: "subscription" | "adhoc";
  meal_type: MealType;
  item_name: string;
  plates: number;
  unit_price: number;
  line_total: number;
}

export interface InvoiceOut {
  id: number;
  user_id: number;
  period_year: number;
  period_month: number;
  period_label: string;
  plates: number;
  amount: number;
  amount_paid: number;
  amount_due: number;
  status: "pending" | "partial" | "paid";
  effective_status: InvoiceStatus;
  is_overdue: boolean;
  due_date: string | null;
  method?: string | null;
  txn_id?: string | null;
  generated_at: string;
  paid_at?: string | null;
  lines: InvoiceLine[];
}

export interface PlateRow {
  user_id: number;
  name: string;
  phone: string;
  type: "subscription" | "order" | "both";
  item_name: string;
  regular: number;
  adjustment: number;
  total: number;
  notes: string;
}

export interface PlateMeal {
  count: number;
  regular_total: number;
  adjustment_total: number;
  prep: { item_name: string; plates: number }[];
  rows: PlateRow[];
}

export interface PlateReport {
  date: string;
  weekday: string;
  lunch: PlateMeal;
  dinner: PlateMeal;
  total: number;
}

export interface AdHocOrderItem {
  menu_item_id: number | null;
  item_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface AdHocOrder {
  id: number;
  user_id: number;
  customer_name: string;
  customer_phone: string;
  date: string;
  meal_type: MealType;
  status: AdHocStatus;
  notes: string;
  amount: number;
  total_qty: number;
  items: AdHocOrderItem[];
  summary: string;
}

export interface AdminCustomerRow {
  id: number;
  name: string;
  phone: string;
  email: string;
  pincode: string;
  address: string;
  area: string;
  created_at: string;
  subscriptions: SubscriptionOut[];
  plan_summary: string;
  lunch_qty: number;
  dinner_qty: number;
  status: "active" | "inactive";
  plates_this_month: number;
  amount_due: number;
  credit_balance: number;
}

export interface UpcomingChange {
  date: string;
  meal_type: string;
  kind: "skip" | "order" | "subscription_end";
  label: string;
}

export interface CustomerMealRow {
  date: string;
  weekday: string;
  meal_type: MealType;
  item_name: string;
  regular: number;
  adjustment: number;
  total: number;
  status: string;
  notes: string;
}

export interface CustomerProfile {
  customer: {
    id: number;
    name: string;
    phone: string;
    email: string;
    address: string;
    pincode: string;
    area: string;
    created_at: string;
    credit_balance: number;
  };
  subscriptions: SubscriptionOut[];
  skips: { date: string; meal_type: string; by: string }[];
  invoices: InvoiceOut[];
  orders: AdHocOrder[];
  meals: CustomerMealRow[];
  upcoming_changes: { items: UpcomingChange[]; total: number };
}

export interface AdminBilling {
  period_year: number;
  period_month: number;
  period_label: string;
  collected_total: number;
  outstanding_total: number;
  overdue_total: number;
  per_customer: {
    user_id: number;
    name: string;
    phone: string;
    invoice_id: number | null;
    plates: number;
    amount: number;
    amount_paid: number;
    amount_due: number;
    status: InvoiceStatus | "none";
  }[];
}

export interface AdminDashboard {
  as_of: string;
  date: string;
  weekday: string;
  total_customers: number;
  active_subscriptions: number;
  lunch_plates: number;
  dinner_plates: number;
  plates_today: number;
  orders_today: number;
  extra_plates_today: number;
  cancelled_today: number;
  collected_period: number;
  pending_period: number;
  outstanding_total: number;
  todays_meals: {
    customer_name: string;
    type: string;
    meal: string;
    qty: number;
    status: string;
  }[];
}

export interface Meta {
  payments: string;
  sms_otp: string;
  timezone: string;
  cutoffs: { lunch: string; dinner: string };
  server_now: string;
  today: string;
  tomorrow: string;
}

// ------------------------------------------------------------------ platform

export interface Plan {
  id: number;
  name: string;
  badge: string;
  meals_per_month: number;
  price: number;
  price_per_meal: number;
  meal_type: "lunch" | "dinner" | "both";
  description: string;
}

export interface ServiceArea {
  id: number;
  name: string;
  pincode: string;
}

export interface SiteSettings {
  business_name: string;
  tagline: string;
  whatsapp_number: string;
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  service_hours: string;
  cancellation_notice_hours: string;
}

export interface AdminSettings extends SiteSettings {
  lunch_capacity: string;
  dinner_capacity: string;
}

export interface CreditEntry {
  id: number;
  issued_on: string | null;
  meal_date: string;
  meal_type: MealType;
  amount: number;
  reason: string;
  status: "available" | "consumed";
  note: string;
  issued_by: string;
}

export interface CreditsResponse {
  balance: number;
  total_earned: number;
  count: number;
  items: CreditEntry[];
}

export interface UpcomingMeal {
  date: string;
  weekday: string;
  meal_type: MealType;
  dish: string;
  status: "scheduled" | "cancelled";
  locked: boolean;
}

export interface ActivityItem {
  when: string;
  date: string;
  type: "cancelled" | "consumed" | "renewed";
  meal_type: string;
  detail: string;
  credit_impact: number;
}

export interface PanelDashboard {
  name: string;
  greeting: string;
  today: string;
  month_label: string;
  has_subscription: boolean;
  stats: {
    total_meals: number;
    meals_consumed: number;
    meals_remaining: number;
    carry_forward_credit: number;
  };
  upcoming_meals: UpcomingMeal[];
  recent_activity: ActivityItem[];
}

export interface MealHistoryRow {
  date: string;
  weekday: string;
  meal_type: MealType;
  dish: string;
  status: "consumed" | "cancelled" | "upcoming";
  amount: number;
  plates: number;
  order_date: string;
  start_date: string;
  credit: number;
  cancelled_at: string | null;
}

export interface MealHistoryResponse {
  filter: string;
  counts: { all: number; consumed: number; cancelled: number; credits: number };
  items: MealHistoryRow[];
}

export interface CalendarMeal {
  dish: string;
  scheduled: boolean;
  cancelled: boolean;
  credit: boolean;
  locked: boolean;
  subscription_id: number;
  amount: number;
}

export interface CalendarDay {
  date: string;
  weekday: string;
  is_today: boolean;
  meals: Partial<Record<MealType, CalendarMeal>>;
}

export interface CalendarResponse {
  year: number;
  month: number;
  month_label: string;
  first_weekday: number;
  today: string;
  cancellation_notice_hours: string;
  prev: { year: number; month: number };
  next: { year: number; month: number };
  days: CalendarDay[];
}

export interface CancellationRow {
  id: number;
  meal_date: string;
  weekday: string;
  cancelled_at: string | null;
  cancelled_by: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  area: string;
  meal_type: MealType;
  dish: string;
  plates: number;
  credit: number;
}

export interface CancellationsResponse {
  date_from: string;
  date_to: string;
  total: number;
  total_credit: number;
  items: CancellationRow[];
}

export interface MealDemandMeal {
  meal_type: MealType;
  required: number;
  confirmed: number;
  gap: number;
  capacity: number;
  prep: { item_name: string; plates: number }[];
}

export interface MealDemandResponse {
  date: string;
  weekday: string;
  meals: MealDemandMeal[];
  net_to_prepare: number;
}

export interface TotalMealsDay {
  date: string;
  weekday: string;
  lunch: number;
  dinner: number;
  total: number;
  cancelled: number;
}

export interface TotalMealsResponse {
  date_from: string;
  date_to: string;
  total_lunch: number;
  total_dinner: number;
  total_meals: number;
  total_cancelled: number;
  days: TotalMealsDay[];
}

export interface AreaRow {
  name: string;
  pincode: string;
  customers: number;
  capacity: number;
  pct: number;
}

export interface AreaReportResponse {
  total_customers: number;
  areas: AreaRow[];
}

export interface MealRequirementRow {
  meal_type: MealType;
  required: number;
  confirmed: number;
  gap: number;
  capacity: number;
}

export interface AdminDashboardV2 {
  as_of: string;
  date: string;
  weekday: string;
  total_customers: number;
  active_subscriptions: number;
  lunch_confirmed: number;
  dinner_confirmed: number;
  lunch_capacity: number;
  dinner_capacity: number;
  net_to_prepare: number;
  orders_today: number;
  cancelled_today: number;
  meal_requirement: MealRequirementRow[];
  area_customers: AreaRow[];
  cancellations_today: CancellationRow[];
  todays_meals: {
    customer_name: string;
    type: string;
    meal: string;
    qty: number;
    status: string;
  }[];
}
