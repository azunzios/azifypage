/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                "primary": "#22c55e",
                "background-light": "#f8fafc",
                "forest": "#1e293b",
                "burnt-orange": "#ea580c",
                "accent": "#3b82f6"
            },
            fontFamily: {
                "sans": ["Inter", "system-ui", "sans-serif"]
            }
        },
    },
    plugins: [],
}
