const TelegramBot = require('node-telegram-bot-api');

const token = '6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg'; // Replace with your own bot token
const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (messageText === '/start') {
    bot.sendMessage(chatId, 'Welcome to the bot!');
  }
});
