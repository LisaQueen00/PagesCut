import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14161b",
        mist: "#eff2f6",
        line: "#dde3ea",
        panel: "#ffffff",
        muted: "#667085",
        accent: "#1f2937",
      },
      boxShadow: {
        panel: "0 14px 34px rgba(16, 24, 40, 0.06)",
      },
      fontFamily: {
        sans: ["Avenir Next", "PingFang SC", "Noto Sans SC", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
