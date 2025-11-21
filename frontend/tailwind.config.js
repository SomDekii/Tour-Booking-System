/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        "lhawang-brown": "#8B2500",
        "lhawang-orange": "#D2691E",
      },
    },
  },
  plugins: [],
};
