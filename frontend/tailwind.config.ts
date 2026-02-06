import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                yellow: '#FFEB3B',
                pink: '#FF007A',
                green: '#00FF00',
                red: '#FF0000',
            },
            fontFamily: {
                mono: ['Space Mono', 'monospace'],
                sans: ['Inter', 'sans-serif'],
                pixel: ['Press Start 2P', 'cursive'],
            },
        },
    },
    plugins: [],
};

export default config;
