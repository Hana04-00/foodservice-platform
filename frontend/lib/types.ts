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
  pincode: string;
  address: string;
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
  created_at: string;
  subscriptions: SubscriptionOut[];
  plan_summary: string;
  lunch_qty: number;
  dinner_qty: number;
  status: "active" | "inactive";
  plates_this_month: number;
  amount_due: number;
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
    created_at: string;
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
