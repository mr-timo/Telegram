import fetch from 'node-fetch';
import ccxt from 'ccxt';

// Replace with your actual bot token
const BOT_TOKEN = '6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

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

// Function to get crypto price from Bybit
async function getCryptoPrice(symbol) {
    const exchange = new ccxt.bybit();
    try {
        const ticker = await exchange.fetchTicker(symbol);
        return ticker.last;
    } catch (error) {
        throw new Error(`Could not fetch price for symbol: ${symbol}`);
    }
}

// Function to handle incoming updates
async function handleUpdates() {
    let offset = 0;
    while (true) {
        const updates = await getUpdates(offset);
        for (const update of updates) {
            const chatId = update.message.chat.id;
            const messageText = update.message.text;

            if (messageText.toLowerCase() === '/start') {
                await sendMessage(chatId, 'Hello! Please enter a crypto symbol (e.g., BTC/USDT) to get the current price.');
            } else {
                try {
                    const price = await getCryptoPrice(messageText);
                    await sendMessage(chatId, `The current price of ${messageText} is $${price}`);
                } catch (error) {
                    await sendMessage(chatId, error.message);
                }
            }

            offset = update.update_id + 1;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second
    }
}

// Start handling updates
handleUpdates().catch(console.error);
