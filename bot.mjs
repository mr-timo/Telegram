import ccxt from 'ccxt';
import TelegramBot from 'node-telegram-bot-api';
import http from './In.js';

// Replace with your own Telegram bot token
const telegramToken = '6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg';

// Initialize the Telegram bot
const bot = new TelegramBot(telegramToken, { polling: true });

// Variable to store chat ID and entry price
let chatId = null;
let entryPrice = null;

// Function to fetch price and calculate PNL
async function fetchPriceAndSendMessage() {
    if (!chatId || entryPrice === null) {
        console.log('Chat ID or entry price not set.');
        return;
    }

    try {
        // Set the exchange to KuCoin and specify the trading pair
        const exchangeId = 'kucoin';
        const symbol = 'BTC/USDT';

        // Initialize the exchange
        const exchange = new ccxt[exchangeId]();

        // Fetch the current price
        const ticker = await exchange.fetchTicker(symbol);
        const currentPrice = ticker.last;

        // Calculate PNL
        const pnl = currentPrice - entryPrice;
        const percentageIncrease = ((currentPrice - entryPrice) / entryPrice) * 100;

        // Create the message
        const message = `
Exchange: ${exchangeId}
Pair: ${symbol}
Entry Price: ${entryPrice}
Current Price: ${currentPrice}
PNL: ${pnl}
Percentage Increase: ${percentageIncrease.toFixed(2)}%
        `;

        // Send the message to Telegram
        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Refresh', callback_data: 'refresh' }],
                    [{ text: 'Clear History', callback_data: 'clear' }]
                ]
            }
        });
    } catch (error) {
        console.error('Error fetching price or sending message:', error);
    }
}

// Listen for the /start command
bot.onText(/\/start/, (msg) => {
    chatId = msg.chat.id;
    entryPrice = null;  // Reset entry price if bot is restarted
    bot.sendMessage(chatId, 'Welcome! Please enter the entry price:');
});

// Listen for messages to set the entry price
bot.on('message', (msg) => {
    if (chatId && entryPrice === null && msg.text !== '/start') {
        const price = parseFloat(msg.text);
        if (!isNaN(price)) {
            entryPrice = price;
            bot.sendMessage(chatId, `Entry price set to ${entryPrice}.`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Refresh', callback_data: 'refresh' }],
                        [{ text: 'Clear History', callback_data: 'clear' }]
                    ]
                }
            });
            fetchPriceAndSendMessage();
        } else {
            bot.sendMessage(chatId, 'Invalid entry price. Please enter a valid number:');
        }
    }
});

// Listen for callback queries from inline keyboard
bot.on('callback_query', (query) => {
    const { data } = query;
    if (data === 'refresh') {
        fetchPriceAndSendMessage();
    } else if (data === 'clear') {
        chatId = null;
        entryPrice = null;
        bot.sendMessage(query.message.chat.id, 'History cleared. Please start the bot again with /start.');
    }
    bot.answerCallbackQuery(query.id);
});

console.log('Bot is running...');
