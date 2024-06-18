const { Telegraf } = require('telegraf');

// Replace 'YOUR_BOT_TOKEN' with your actual bot token from BotFather
const bot = new Telegraf('6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg');

// Respond to any text message with "Hello, user!"
bot.on('text', (ctx) => {
    ctx.reply(`Hello, ${ctx.from.first_name || 'user'}!`);
});

// Start the bot
bot.launch().then(() => {
    console.log('Bot started');
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
