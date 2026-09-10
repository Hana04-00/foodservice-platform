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
        // Warm, appetizing palette
        masala: {
          50: "#fdf6ef",
          100: "#fbe9d7",
          200: "#f6cfa8",
          300: "#efac72",
          400: "#e78544",
          500: "#df6524",
          600: "#c94d1a",
          700: "#a63a18",
          800: "#85301a",
          900: "#6d2a19",
        },
        curry: {
          50: "#fff9eb",
          100: "#fef0c7",
          200: "#fde08a",
          300: "#fbc94d",
          400: "#f9b024",
          500: "#f38d0b",
          600: "#d76c06",
          700: "#b24d09",
          800: "#903d0f",
          900: "#763310",
        },
        cream: "#fffaf3",
        chai: "#4a3428",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(133, 48, 26, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
