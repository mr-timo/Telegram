import fetch from 'node-fetch';
import ccxt from 'ccxt';

// Replace with your actual bot token
const BOT_TOKEN = '6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// User state and preferences
const userStates = {};
const userPreferences = {};

// List of supported exchanges
const supportedExchanges = ['binance', 'bybit', 'coinbase', 'kraken', 'bitfinex'];

// Function to get updates from Telegram
async function getUpdates(offset) {
    const response = await fetch(`${TELEGRAM_API_URL}/getUpdates?offset=${offset}`);
    const data = await response.json();
    return data.result;
}

// Function to send a message to a user
async function sendMessage(chatId, text) {
    await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: text
        })
    });
}

// Function to get crypto price from the specified exchange
async function getCryptoPrice(exchangeName, symbol) {
    const exchange = new ccxt[exchangeName]();
    try {
        const ticker = await exchange.fetchTicker(symbol);
        return ticker.last;
    } catch (error) {
        throw new Error(`Could not fetch price for symbol: ${symbol} on exchange: ${exchangeName}`);
    }
}

// Function to handle incoming updates
async function handleUpdates() {
    let offset = 0;
    while (true) {
        const updates = await getUpdates(offset);
        for (const update of updates) {
            const chatId = update.message.chat.id;
            const messageText = update.message.text.trim();

            if (messageText.toLowerCase() === '/start') {
                userStates[chatId] = { stage: 'initial' };
                await sendMessage(chatId, 'Welcome! Use /settings to configure your exchange or /pair to check a crypto price.');
            } else if (messageText.toLowerCase() === '/settings') {
                userStates[chatId] = { stage: 'askExchange' };
                const exchangeOptions = supportedExchanges.join(', ');
                await sendMessage(chatId, `Please enter the name of the exchange you want to use (${exchangeOptions}). To remove the saved exchange, type 'remove'.`);
            } else if (userStates[chatId]?.stage === 'askExchange') {
                if (messageText.toLowerCase() === 'remove') {
                    delete userPreferences[chatId];
                    await sendMessage(chatId, 'Your saved exchange has been removed.');
                } else if (supportedExchanges.includes(messageText.toLowerCase())) {
                    userPreferences[chatId] = { exchange: messageText.toLowerCase() };
                    await sendMessage(chatId, `Your preferred exchange is set to ${messageText.toLowerCase()}.`);
                } else {
                    const exchangeOptions = supportedExchanges.join(', ');
                    await sendMessage(chatId, `Invalid exchange. Please enter a valid exchange name (${exchangeOptions}).`);
                }
                delete userStates[chatId];  // Clear the user state after setting/removing the exchange
            } else if (messageText.toLowerCase() === '/pair') {
                if (userPreferences[chatId]?.exchange) {
                    userStates[chatId] = { stage: 'askSymbol' };
                    await sendMessage(chatId, 'Please enter the crypto symbol (e.g., BTC/USDT).');
                } else {
                    await sendMessage(chatId, 'Please set your preferred exchange first using /settings.');
                }
            } else if (userStates[chatId]?.stage === 'askSymbol') {
                const exchangeName = userPreferences[chatId]?.exchange;
                const symbol = messageText.toUpperCase();
                try {
                    const price = await getCryptoPrice(exchangeName, symbol);
                    await sendMessage(chatId, `The current price of ${symbol} on ${exchangeName} is $${price}`);
                } catch (error) {
                    await sendMessage(chatId, error.message);
                }
                delete userStates[chatId];  // Clear the user state after providing the price
            } else {
                await sendMessage(chatId, 'Invalid command. Use /start to begin, /settings to set your exchange, or /pair to check a crypto price.');
            }

            offset = update.update_id + 1;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second
    }
}

// Start handling updates
handleUpdates().catch(console.error);
