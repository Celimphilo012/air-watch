/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#1565c0", light: "#1976d2", dark: "#0d47a1" },
        surface: { DEFAULT: "#ffffff", dark: "#1e2433" },
        bg: { DEFAULT: "#f5f7fa", dark: "#131720" },
        card: { DEFAULT: "#ffffff", dark: "#1e2433" },
        border: { DEFAULT: "#e2e8f0", dark: "#2d3748" },
      },
    },
  },
  plugins: [],
};
