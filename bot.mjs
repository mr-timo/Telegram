import TelegramBot from 'node-telegram-bot-api';
import ccxt from 'ccxt';
import http from './In.js';

const token = process.env.TELEGRAM_BOT_TOKEN || 'your_token_here';

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
      await handleDemoActions(callbackQuery, exchangeName, chatId);
      return;
    }

    if (!demoTrades[chatId]) {
      demoTrades[chatId] = {
        exchange: exchangeName,
        entryPrice: 0,
        currentPrice: 0,
        pnl: 0,
        unrealizedProfit: 0,
        entryTime: ''
      };
    }

    await bot.sendMessage(chatId, 'Please enter the time you wish to enter the trade in the format: DD-MM-YYYY HH:MM am/pm');
    bot.once('message', async (msg) => {
      demoTrades[chatId].entryTime = msg.text;
      
      try {
        const exchangeInstance = new ccxt[exchangeName]();
        await exchangeInstance.loadMarkets();
        const ticker = await exchangeInstance.fetchTicker('BTC/USDT');
        const currentPrice = ticker.last;

        demoTrades[chatId].entryPrice = currentPrice;
        demoTrades[chatId].currentPrice = currentPrice;

        const message = `Demo trade started on ${exchangeName}:\n` +
                        `Entry time: ${demoTrades[chatId].entryTime}\n` +
                        `Entry price: ${demoTrades[chatId].entryPrice} USDT\n` +
                        `Current price: ${demoTrades[chatId].currentPrice} USDT\n` +
                        `PNL: ${demoTrades[chatId].pnl}\n` +
                        `Unrealized Profit: ${demoTrades[chatId].unrealizedProfit}`;

        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Refresh', callback_data: 'refresh' }],
              [{ text: 'Close Demo Trade', callback_data: 'close_trade' }],
            ]
          }
        });
      } catch (error) {
        await bot.sendMessage(chatId, `Error: ${error.message}`);
      }
    });
  });

  async function handleDemoActions(callbackQuery, action, chatId) {
    if (action === 'refresh' && demoTrades[chatId]) {
      try {
        const exchangeName = demoTrades[chatId].exchange;
        const exchangeInstance = new ccxt[exchangeName]();
        await exchangeInstance.loadMarkets();
        const ticker = await exchangeInstance.fetchTicker('BTC/USDT');
        const currentPrice = ticker.last;

        demoTrades[chatId].currentPrice = currentPrice;
        demoTrades[chatId].pnl = currentPrice - demoTrades[chatId].entryPrice;
        demoTrades[chatId].unrealizedProfit = demoTrades[chatId].pnl * 1; // Assuming 1 BTC for simplicity

        const message = `Demo trade on ${exchangeName} updated:\n` +
                        `Entry time: ${demoTrades[chatId].entryTime}\n` +
                        `Entry price: ${demoTrades[chatId].entryPrice} USDT\n` +
                        `Current price: ${demoTrades[chatId].currentPrice} USDT\n` +
                        `PNL: ${demoTrades[chatId].pnl} USDT\n` +
                        `Unrealized Profit: ${demoTrades[chatId].unrealizedProfit} USDT`;

        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Refresh', callback_data: 'refresh' }],
              [{ text: 'Close Demo Trade', callback_data: 'close_trade' }],
            ]
          }
        });
      } catch (error) {
        await bot.sendMessage(chatId, `Error: ${error.message}`);
      }
    } else if (action === 'close_trade' && demoTrades[chatId]) {
      delete demoTrades[chatId];
      await bot.editMessageText('Demo trade closed.', {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id
      });
    }
  }

  console.log('Bot is running...');
}

startBot();
