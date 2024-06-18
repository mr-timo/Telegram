import fetch from 'node-fetch';
import ccxt from 'ccxt';

// Replace with your actual bot token
const BOT_TOKEN = '6384185718:AAH3CbyAq0N8AgB4A_lwWZvE2fYa7RjLybg';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Initialize Bybit exchange
const bybit = new ccxt.bybit();

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

// Function to fetch the price for a specified trading pair from Bybit
async function fetchPrice(symbol) {
    try {
        const ticker = await bybit.fetchTicker(symbol);
        return ticker.last;
    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        return null;
    }
}

// Function to handle incoming updates
async function handleUpdates() {
    let offset = 0;
    const chatStates = {};

    while (true) {
        const updates = await getUpdates(offset);
        for (const update of updates) {
            const chatId = update.message.chat.id;
            const text = update.message.text;

            if (!chatStates[chatId]) {
                // Ask the user for the trading pair symbol
                await sendMessage(chatId, "Please enter the trading pair symbol (e.g., BTC/USDT):");
                chatStates[chatId] = 'awaiting_symbol';
            } else if (chatStates[chatId] === 'awaiting_symbol') {
                // Fetch and display the price for the specified symbol
                const price = await fetchPrice(text);
                if (price !== null) {
                    await sendMessage(chatId, `The current price of ${text} on Bybit is $${price}`);
                } else {
                    await sendMessage(chatId, `Sorry, I couldn't fetch the price for ${text}. Please make sure the symbol is correct.`);
                }
                chatStates[chatId] = null; // Reset the state
            }

            offset = update.update_id + 1;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second
    }
}

// Start handling updates
handleUpdates().catch(console.error);
