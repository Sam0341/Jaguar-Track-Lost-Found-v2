/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // 🌙 Enable dark mode using a 'dark' class
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 🎓 UB-themed custom colors
        ubBlue: "#003366", // University of Belize dark blue
        ubGold: "#FFD700", // University of Belize gold
        ubGray: "#F3F4F6", // soft gray background

        // Optional extra dark colors for UI depth
        darkBg: "#0D1117",
        darkCard: "#161B22",
        darkText: "#E6EDF3",
      },
      borderRadius: {
        "2xl": "1rem", // consistent round corners for cards/buttons
      },
      transitionProperty: {
        "colors-opacity": "color, background-color, border-color, opacity",
      },
    },
  },
  plugins: [
    // You can add Tailwind plugins like forms/typography later if needed
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/typography'),
  ],
};
