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
        timeToEnter: null,
      };
    }

    bot.sendMessage(chatId, 'Please enter the time to enter the trade in HH:MM AM/PM format (e.g., 03:45 PM):');
    bot.once('message', async (msg) => {
      const timeToEnter = msg.text;
      demoTrades[chatId].timeToEnter = timeToEnter;

      const message = `Demo trade setup for ${exchangeName}:\n` +
                      `Entry time: ${demoTrades[chatId].timeToEnter}`;

      await bot.sendMessage(chatId, message);

      checkTimeToEnterTrade(chatId);
    });
  });

  function convertTo24HourFormat(time12h) {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = parseInt(hours, 10) + 12;
    }
    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  async function checkTimeToEnterTrade(chatId) {
    const interval = setInterval(async () => {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      if (demoTrades[chatId] && convertTo24HourFormat(demoTrades[chatId].timeToEnter) === convertTo24HourFormat(currentTime)) {
        clearInterval(interval);

        const exchangeName = demoTrades[chatId].exchange;
        try {
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

          await bot.sendMessage(chatId, message, {
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
      }
    }, 10000); // Check every 10 seconds
  }

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
