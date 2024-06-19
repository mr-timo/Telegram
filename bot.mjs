import TelegramBot from 'node-telegram-bot-api';
import ccxt from 'ccxt';
import http from './In.js'

export default function startBot() {
  // Replace with your Telegram bot token
  const token = '6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg';
  const bot = new TelegramBot(token, { polling: true });

  // Placeholder for demo trades
  const demoTrades = {};

  // Start command handler
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Welcome to Crypto Trade Bot! Please select an exchange:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Kucoin', callback_data: 'kucoin' }],
          [{ text: 'Coinbase', callback_data: 'coinbase' }],
          [{ text: 'Bybit', callback_data: 'bybit' }],
        ]
      }
    });
  });

  // Handle inline keyboard button clicks
  bot.on('callback_query', async (callbackQuery) => {
    const exchangeName = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;

    if (exchangeName === 'refresh' || exchangeName === 'close_trade') {
      handleDemoActions(callbackQuery, exchangeName, chatId);
      return;
    }

    // Start demo trading
    if (!demoTrades[chatId]) {
      demoTrades[chatId] = {
        exchange: exchangeName,
        entryPrice: 0,
        currentPrice: 0,
        pnl: 0,
        unrealizedProfit: 0,
      };
    }

    // Fetch current price for demo trade
    const exchangeInstance = new ccxt[exchangeName]();
    await exchangeInstance.loadMarkets();
    const ticker = await exchangeInstance.fetchTicker('BTC/USDT');
    const currentPrice = ticker.last;

    // Simulate entering a trade at the current price
    demoTrades[chatId].entryPrice = currentPrice;
    demoTrades[chatId].currentPrice = currentPrice;

    // Show initial trade information
    const message = `Demo trade started on ${exchangeName}:\n` +
                    `Entry price: ${demoTrades[chatId].entryPrice} USDT\n` +
                    `Current price: ${demoTrades[chatId].currentPrice} USDT\n` +
                    `PNL: ${demoTrades[chatId].pnl}\n` +
                    `Unrealized Profit: ${demoTrades[chatId].unrealizedProfit}`;

    bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Refresh', callback_data: 'refresh' }],
          [{ text: 'Close Demo Trade', callback_data: 'close_trade' }],
        ]
      }
    });
  });

  async function handleDemoActions(callbackQuery, action, chatId) {
    if (action === 'refresh' && demoTrades[chatId]) {
      const exchangeName = demoTrades[chatId].exchange;
      const exchangeInstance = new ccxt[exchangeName]();
      await exchangeInstance.loadMarkets();
      const ticker = await exchangeInstance.fetchTicker('BTC/USDT');
      const currentPrice = ticker.last;

      demoTrades[chatId].currentPrice = currentPrice;
      demoTrades[chatId].pnl = currentPrice - demoTrades[chatId].entryPrice;
      demoTrades[chatId].unrealizedProfit = demoTrades[chatId].pnl * 1; // Assuming 1 BTC for simplicity

      const message = `Demo trade on ${exchangeName} updated:\n` +
                      `Entry price: ${demoTrades[chatId].entryPrice} USDT\n` +
                      `Current price: ${demoTrades[chatId].currentPrice} USDT\n` +
                      `PNL: ${demoTrades[chatId].pnl} USDT\n` +
                      `Unrealized Profit: ${demoTrades[chatId].unrealizedProfit} USDT`;

      bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Refresh', callback_data: 'refresh' }],
            [{ text: 'Close Demo Trade', callback_data: 'close_trade' }],
          ]
        }
      });
    } else if (action === 'close_trade' && demoTrades[chatId]) {
      delete demoTrades[chatId];
      bot.sendMessage(chatId, 'Demo trade closed.');
    }
  }

  // Start the bot
  console.log('Bot is running...');
}
