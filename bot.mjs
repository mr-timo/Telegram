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
async function sendMessage(chatId, text, options = {}) {
    await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            ...options
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
                    await sendMessage(chatId, `*The current price of ${symbol} on ${exchangeName} is $${price}*`, { parse_mode: 'Markdown' });
                } catch (error) {
                    await sendMessage(chatId, error.message);
                }
                userStates[chatId].stage = 'mainMenu';
                await sendMessage(chatId, 'What would you like to do next?\n1. Get another price\n2. Change exchange\n3. Advanced settings\nType the number of your choice.');
            } else if (userStates[chatId]?.stage === 'mainMenu') {
                if (messageText === '1') {
                    userStates[chatId].stage = 'askSymbol';
                    await sendMessage(chatId, `Please enter the crypto symbol (e.g., BTC/USDT) for ${userStates[chatId].exchange}.`);
                } else if (messageText === '2') {
                    userStates[chatId].stage = 'askExchange';
                    await sendMessage(chatId, 'Please enter the name of the exchange you want to use (e.g., bybit).');
                } else if (messageText === '3') {
                    userStates[chatId].stage = 'advancedSettings';
                    await sendMessage(chatId, 'Advanced settings:\n1. Set default exchange\n2. Set default symbol\n3. Back to main menu\nType the number of your choice.');
                } else {
                    await sendMessage(chatId, 'Invalid choice. Please type the number of your choice.');
                }
            } else if (userStates[chatId]?.stage === 'advancedSettings') {
                if (messageText === '1') {
                    userStates[chatId].stage = 'setDefaultExchange';
                    await sendMessage(chatId, 'Please enter the default exchange you want to set (e.g., bybit).');
                } else if (messageText === '2') {
                    userStates[chatId].stage = 'setDefaultSymbol';
                    await sendMessage(chatId, 'Please enter the default crypto symbol you want to set (e.g., BTC/USDT).');
                } else if (messageText === '3') {
                    userStates[chatId].stage = 'mainMenu';
                    await sendMessage(chatId, 'What would you like to do next?\n1. Get another price\n2. Change exchange\n3. Advanced settings\nType the number of your choice.');
                } else {
                    await sendMessage(chatId, 'Invalid choice. Please type the number of your choice.');
                }
            } else if (userStates[chatId]?.stage === 'setDefaultExchange') {
                userStates[chatId].defaultExchange = messageText.toLowerCase();
                userStates[chatId].stage = 'advancedSettings';
                await sendMessage(chatId, `Default exchange set to ${messageText}.`);
                await sendMessage(chatId, 'Advanced settings:\n1. Set default exchange\n2. Set default symbol\n3. Back to main menu\nType the number of your choice.');
            } else if (userStates[chatId]?.stage === 'setDefaultSymbol') {
                userStates[chatId].defaultSymbol = messageText.toUpperCase();
                userStates[chatId].stage = 'advancedSettings';
                await sendMessage(chatId, `Default symbol set to ${messageText}.`);
                await sendMessage(chatId, 'Advanced settings:\n1. Set default exchange\n2. Set default symbol\n3. Back to main menu\nType the number of your choice.');
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
