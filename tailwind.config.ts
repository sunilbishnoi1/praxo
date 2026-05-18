import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          raised: "hsl(var(--surface-raised))",
          overlay: "hsl(var(--surface-overlay))",
        },
        accent: {
          50: "#E6FBFF",
          100: "#CFF6FF",
          200: "#9DEBFF",
          300: "#63DBFF",
          400: "#2EC6F7",
          500: "#08A6D1",
          600: "#0B84A8",
          700: "#0F6B88",
          800: "#0F566E",
          900: "#0C4255",
        },
        brand: {
          50: "#FFF4ED",
          100: "#FFE6D5",
          200: "#FFCDAA",
          300: "#FFB07A",
          400: "#FF8A4C",
          500: "#F26A2E",
          600: "#D95822",
          700: "#B8451A",
          800: "#933514",
          900: "#6F2910",
          950: "#3F1608",
        },
        score: {
          excellent: "#22C55E",
          good: "#84CC16",
          average: "#EAB308",
          poor: "#F97316",
          bad: "#EF4444",
        },
        fluency: {
          ideal: "#22C55E",
          fast: "#EAB308",
          slow: "#F97316",
          filler: "#EF4444",
          pause: "#F97316",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      fontSize: {
        display: ["2.5rem", { lineHeight: "2.75rem", fontWeight: "700" }],
        heading: ["1.75rem", { lineHeight: "2.25rem", fontWeight: "600" }],
        subheading: ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        body: ["0.95rem", { lineHeight: "1.45rem", fontWeight: "400" }],
        caption: ["0.8rem", { lineHeight: "1.1rem", fontWeight: "400" }],
        "score-large": ["3.5rem", { lineHeight: "1", fontWeight: "700" }],
      },
      spacing: {
        "page-x": "2rem",
        "page-y": "1.5rem",
        section: "2rem",
        card: "1.5rem",
        element: "0.75rem",
      },
      borderRadius: {
        card: "0.75rem",
        button: "0.5rem",
        badge: "9999px",
        avatar: "9999px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
