import ccxt from 'ccxt';
import TelegramBot from 'node-telegram-bot-api';
import http from './In.js';

// Replace with your Telegram bot token
const telegramToken = '6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg';

// Initialize the Telegram bot
const bot = new TelegramBot(telegramToken, { polling: true });

// Variables to store chat ID, entry price, and current settings
let chatId = null;
let entryPrice = null;
let lastMessageId = null;
let selectedExchange = null;
let selectedSymbol = null;
let initialAmount = null;

// Function to fetch price and calculate PNL
async function fetchPriceAndSendMessage() {
    if (!chatId) {
        console.log('Chat ID not set.');
        return;
    }

    try {
        // Initialize the exchange
        const exchange = new ccxt[selectedExchange]();

        // Fetch the current price
        const ticker = await exchange.fetchTicker(selectedSymbol);
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
Exchange: ${selectedExchange}
Pair: ${selectedSymbol}
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

// Function to display the exchange selection menu
function showExchangeSelection() {
    bot.sendMessage(chatId, 'Please select an exchange:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'KuCoin', callback_data: 'select_exchange_kucoin' }],
                [{ text: 'Coinbase', callback_data: 'select_exchange_coinbase' }]
            ]
        }
    });
}

// Function to display the symbol and initial amount input form
function showSymbolAndAmountInput() {
    bot.sendMessage(chatId, 'Please enter the trading pair symbol (e.g., BTC/USDT):');
    bot.once('message', (msg) => {
        selectedSymbol = msg.text.toUpperCase();
        bot.sendMessage(chatId, 'Please enter the initial amount to invest:');
        bot.once('message', (msg) => {
            initialAmount = parseFloat(msg.text);
            fetchPriceAndSendMessage();
        });
    });
}

// Listen for the /start command
bot.onText(/\/start/, (msg) => {
    chatId = msg.chat.id;
    entryPrice = null;  // Reset entry price if bot is restarted
    lastMessageId = null;  // Reset last message ID if bot is restarted
    selectedExchange = null;  // Reset selected exchange
    selectedSymbol = null;  // Reset selected symbol
    initialAmount = null;  // Reset initial amount
    showExchangeSelection();
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
        selectedExchange = null;
        selectedSymbol = null;
        initialAmount = null;
        bot.sendMessage(query.message.chat.id, 'History cleared. Please start the bot again with /start.');
    } else if (data === 'select_exchange_kucoin') {
        selectedExchange = 'kucoin';
        showSymbolAndAmountInput();
    } else if (data === 'select_exchange_coinbase') {
        selectedExchange = 'coinbase';
        showSymbolAndAmountInput();
    }
    bot.answerCallbackQuery(query.id);
});

console.log('Bot is running...');
