import TelegramBot from 'node-telegram-bot-api';
import ccxt from 'ccxt';
import createServer from './In.mjs';

const token = '6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg';

export default function startBot() {
  const bot = new TelegramBot(token, { polling: true });

  const demoTrades = {};

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

  bot.on('callback_query', async (callbackQuery) => {
    const exchangeName = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;

    if (exchangeName === 'refresh' || exchangeName === 'close_trade') {
      handleDemoActions(callbackQuery, exchangeName, chatId);
      return;
    }

    if (!demoTrades[chatId]) {
      demoTrades[chatId] = {
        exchange: exchangeName,
        entryPrice: 0,
        currentPrice: 0,
        pnl: 0,
        unrealizedProfit: 0,
      };
    }

    const exchangeInstance = new ccxt[exchangeName]();
    await exchangeInstance.loadMarkets();
    const ticker = await exchangeInstance.fetchTicker('BTC/USDT');
    const currentPrice = ticker.last;

    demoTrades[chatId].entryPrice = currentPrice;
    demoTrades[chatId].currentPrice = currentPrice;

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
      demoTrades[chatId].unrealizedProfit = demoTrades[chatId].pnl * 1;

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

  console.log('Bot is running...');
}

// Start the server from In.js
createServer();

// Start the bot
startBot();
