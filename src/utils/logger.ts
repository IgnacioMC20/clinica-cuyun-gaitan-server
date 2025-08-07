import { bold, green, yellow, red, blue, cyan, magenta } from 'colorette';

export const logger = {
    success: (message: string) => {
        console.log(green(`✔ ${message}`));
    },

    warning: (message: string) => {
        console.log(bold(yellow(`⚠ ${message}`)));
    },

    error: (message: string) => {
        console.log(red(`✖ ${message}`));
    },

    info: (message: string) => {
        console.log(blue(`ℹ ${message}`));
    },

    server: (message: string) => {
        console.log(cyan(`🌐 ${message}`));
    },

    database: (message: string) => {
        console.log(magenta(`🗄️ ${message}`));
    },

    auth: (message: string) => {
        console.log(blue(`🔐 ${message}`));
    },

    debug: (message: string) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`🐛 ${message}`);
        }
    }
};

export default logger;