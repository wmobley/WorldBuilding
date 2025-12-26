import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "hsl(var(--parchment) / <alpha-value>)",
        ink: "hsl(var(--ink) / <alpha-value>)",
        "ink-soft": "hsl(var(--ink-soft) / <alpha-value>)",
        ember: "hsl(var(--ember) / <alpha-value>)",
        charcoal: "hsl(var(--charcoal) / <alpha-value>)",
        brass: "hsl(var(--brass) / <alpha-value>)",
        "page-edge": "hsl(var(--page-edge) / <alpha-value>)",
        "page-shadow": "hsl(var(--page-shadow) / <alpha-value>)",
        "accent-map": "hsl(var(--accent-map) / <alpha-value>)"
      },
      fontFamily: {
        display: ["Cormorant Garamond", "serif"],
        body: ["Cardo", "serif"],
        ui: ["Source Sans 3", "sans-serif"]
      },
      boxShadow: {
        page: "0 14px 30px -20px hsl(var(--page-shadow)), inset 0 0 0 1px hsl(var(--page-edge))"
      },
      backgroundImage: {
        parchment: "radial-gradient(circle at 20% 20%, hsl(var(--parchment-highlight)) 0%, transparent 55%), radial-gradient(circle at 80% 0%, hsl(var(--parchment-glow)) 0%, transparent 50%), linear-gradient(180deg, hsl(var(--parchment)) 0%, hsl(var(--parchment-deep)) 100%)"
      }
    }
  },
  plugins: []
} satisfies Config;
