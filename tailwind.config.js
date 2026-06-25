/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Event palette — tweak freely for your project
        sand: {
          50: "#faf8f3",
          100: "#f1ecdf",
        },
        night: {
          800: "#13151c",
          900: "#0b0d12",
        },
      },
    },
  },
  plugins: [],
};
