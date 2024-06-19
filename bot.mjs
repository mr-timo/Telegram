import TelegramBot from 'node-telegram-bot-api';
import ccxt from 'ccxt';

// Replace with your Telegram bot token
const token = '6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg';
const bot = new TelegramBot(token, { polling: true });

// Handler for the /start command or when the bot is initially started
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome to Crypto Trade Bot! Please select an exchange:', {
    reply_markup: {
      inline_keyboard: [
        [{text: 'Kucoin', callback_data: 'kucoin' }],
        [{ text: 'Coinbase', callback_data: 'coinbase' }],
        [{text: 'Bybit', callback_data: 'bybit' }],
      
      ]
    }
  });
});

// Handle inline keyboard button clicks
bot.on('callback_query', async (callbackQuery) => {
  const exchange = callbackQuery.data;

  // Perform demo trade based on exchange selection
  try {
    const exchangeInstance = new ccxt[exchange]();
    await exchangeInstance.loadMarkets();

    // Example: Buy 1 BTC at market price
    const symbol = 'BTC/USDT';
    const amount = 1; // 1 BTC
    const marketPrice = exchangeInstance.markets[symbol].info.last;

    const order = await exchangeInstance.createMarketBuyOrder(symbol, amount);

    // Send trade confirmation message
    const message = `Trade executed successfully on ${exchange}:\n` +
                    `Bought ${amount} BTC at ${marketPrice} USDT per BTC.`;
    bot.sendMessage(callbackQuery.message.chat.id, message);
  } catch (error) {
    bot.sendMessage(callbackQuery.message.chat.id, `Error executing trade: ${error.message}`);
  }
});

// Start the bot
console.log('Bot is running...');
