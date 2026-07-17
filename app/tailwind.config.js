/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f7f8",
          100: "#eeeef1",
          200: "#d6d7de",
          300: "#b1b4c0",
          400: "#858998",
          500: "#666a7a",
          600: "#4f5361",
          700: "#40434f",
          800: "#2d2f3a",
          900: "#1a1c25",
          950: "#0f1017",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,17,23,0.04), 0 4px 12px rgba(15,17,23,0.06)",
      },
    },
  },
  plugins: [],
};
