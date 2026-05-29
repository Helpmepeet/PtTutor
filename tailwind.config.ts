import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#4F46E5",
        "brand-hover": "#4338CA",
        "brand-subtle": "#EEF2FF",
        canvas: "#FAFAFA",
        surface: "#FFFFFF",
        "surface-alt": "#F4F4F6",
        "surface-elevated": "#FFFFFF",
        "border-subtle": "#E5E7EB",
        "border-focus": "#4F46E5",
        "text-primary": "#1F2937",
        "text-secondary": "#6B7280",
        "text-muted": "#9CA3AF",
        "text-inverse": "#FFFFFF",
        "marker-grammar": "#DC2626",
        "marker-word-choice": "#D97706",
        "marker-preposition": "#EA580C",
        "marker-tone": "#2563EB",
        "marker-style": "#64748B",
        error: "#DC2626",
        "error-bg": "#FEF2F2",
        success: "#16A34A"
      },
      boxShadow: {
        popover:
          "0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)",
        teacher:
          "0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
        bubble: "0 4px 16px rgba(0,0,0,0.14)"
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        "typing-dot": {
          "0%, 60%, 100%": {
            opacity: "0.3",
            transform: "translateY(0)"
          },
          "30%": { opacity: "1", transform: "translateY(-3px)" }
        }
      },
      animation: {
        "fade-in-up": "fade-in-up 250ms ease-out",
        "scale-in": "scale-in 200ms ease-out",
        "typing-dot": "typing-dot 1.2s infinite"
      },
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
