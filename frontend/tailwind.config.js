// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dronedeploy-blue': '#407BFF', // A close approximation of DroneDeploy's primary blue
        'dronedeploy-light-bg': '#F7F8FA', // The very light grey background
      },
    },
  },
  plugins: [
    // This plugin helps in removing the default blue outline on focused inputs
    require('@tailwindcss/forms'), 
  ],
}