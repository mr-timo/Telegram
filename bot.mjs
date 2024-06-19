import ccxt from 'ccxt';
import TelegramBot from 'node-telegram-bot-api';
import http from './In.js';

// Replace with your Telegram bot token
const telegramToken = '6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg';  // Replace with your actual bot token

// Initialize the Telegram bot
const bot = new TelegramBot(telegramToken, { polling: true });

// Variable to store chat ID, entry price, and last message ID
let chatId = null;
let entryPrice = null;
let lastMessageId = null;

// Function to fetch price and calculate PNL
async function fetchPriceAndSendMessage() {
    if (!chatId) {
        console.log('Chat ID not set.');
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

        // If entry price is not set, use the current price as the entry price
        if (entryPrice === null) {
            entryPrice = currentPrice;
            bot.sendMessage(chatId, `Entry price set to ${entryPrice}.`);
        }

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

        // Edit the last message if it exists, otherwise send a new message
        if (lastMessageId) {
            bot.editMessageText(message, {
                chat_id: chatId,
                message_id: lastMessageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Refresh', callback_data: 'refresh' }],
                        [{ text: 'Clear History', callback_data: 'clear' }]
                    ]
                }
            });
        } else {
            const sentMessage = await bot.sendMessage(chatId, message, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Refresh', callback_data: 'refresh' }],
                        [{ text: 'Clear History', callback_data: 'clear' }]
                    ]
                }
            });
            lastMessageId = sentMessage.message_id;
        }
    } catch (error) {
        console.error('Error fetching price or sending message:', error);
    }
}

// Listen for the /start command
bot.onText(/\/start/, (msg) => {
    chatId = msg.chat.id;
    entryPrice = null;  // Reset entry price if bot is restarted
    lastMessageId = null;  // Reset last message ID if bot is restarted
    bot.sendMessage(chatId, 'Welcome! Press "Refresh" to get the current trade information.', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Refresh', callback_data: 'refresh' }],
                [{ text: 'Clear History', callback_data: 'clear' }]
            ]
        }
    });
});

// Listen for callback queries from inline keyboard
bot.on('callback_query', async (query) => {
    const { data } = query;
    if (data === 'refresh') {
        await fetchPriceAndSendMessage();
    } else if (data === 'clear') {
        chatId = null;
        entryPrice = null;
        lastMessageId = null;
        bot.sendMessage(query.message.chat.id, 'History cleared. Please start the bot again with /start.');
    }
    bot.answerCallbackQuery(query.id);
});

console.log('Bot is running...');
