import fetch from 'node-fetch';
import ccxt from 'ccxt';

// Replace with your actual bot token
const BOT_TOKEN = '6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// User state to keep track of the conversation flow
const userStates = {};

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
                userStates[chatId] = { stage: 'askExchange' };
                await sendMessage(chatId, 'Welcome! Please enter the name of the exchange you want to use (e.g., bybit).');
            } else if (userStates[chatId]?.stage === 'askExchange') {
                userStates[chatId].exchange = messageText.toLowerCase();
                userStates[chatId].stage = 'askSymbol';
                await sendMessage(chatId, `Got it! Now, please enter the crypto symbol (e.g., BTC/USDT) for ${messageText}.`);
            } else if (userStates[chatId]?.stage === 'askSymbol') {
                const exchangeName = userStates[chatId].exchange;
                const symbol = messageText.toUpperCase();
                try {
                    const price = await getCryptoPrice(exchangeName, symbol);
                    await sendMessage(chatId, `The current price of ${symbol} on ${exchangeName} is $${price}`);
                } catch (error) {
                    await sendMessage(chatId, error.message);
                }
                delete userStates[chatId];  // Clear the user state after providing the price
            } else {
                await sendMessage(chatId, 'Please start the conversation with /start.');
            }

            offset = update.update_id + 1;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second
    }
}

// Start handling updates
handleUpdates().catch(console.error);
