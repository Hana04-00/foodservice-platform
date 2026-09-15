/** Build a direct wa.me link. `number` is digits only, with country code. */
export function waLink(number: string, message?: string) {
  const digits = (number || "").replace(/[^\d]/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const DEFAULT_WA_MESSAGE =
  "Hi Food Dose Tiffin Service! I'd like to know more about your meal subscription plans.";
