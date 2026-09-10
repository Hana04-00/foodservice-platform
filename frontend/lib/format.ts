export const rupees = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export const rupeesExact = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (iso: string) =>
  new Date((iso.length === 10 ? iso + "T00:00:00" : iso)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const fmtDay = (iso: string) =>
  new Date((iso.length === 10 ? iso + "T00:00:00" : iso)).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const monthName = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export const todayISO = () => new Date().toISOString().slice(0, 10);
