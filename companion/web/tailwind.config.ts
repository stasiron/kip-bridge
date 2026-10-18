import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07141f",
        coral: {
          400: "#fda4af",
          500: "#fb7185",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-body)", "IBM Plex Sans", "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
