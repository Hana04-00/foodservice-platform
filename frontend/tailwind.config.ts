import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark green — sidebar, headings, primary buttons, active nav state
        brand: {
          50: "#f1f7f3",
          100: "#dcebe1",
          200: "#bcd8c6",
          300: "#93bda3",
          400: "#5f9a77",
          500: "#3d7d57",
          600: "#2c6343",
          700: "#234f37",
          800: "#1c3f2d",
          900: "#152f22",
        },
        // Warm off-white / cream backgrounds
        cream: {
          DEFAULT: "#f8f5ee",
          50: "#fdfcf8",
          100: "#f8f5ee",
          200: "#efe9db",
        },
        ink: {
          DEFAULT: "#2c2a24",
          soft: "#5b574d",
          faint: "#8b8578",
        },
        // Destructive / warnings only
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(21, 47, 34, 0.04), 0 10px 30px -14px rgba(21, 47, 34, 0.18)",
        soft: "0 1px 3px rgba(21, 47, 34, 0.06)",
        sidebar: "2px 0 24px -12px rgba(21, 47, 34, 0.35)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.15rem",
      },
    },
  },
  plugins: [],
};

export default config;
