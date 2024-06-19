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

// Function to send a message with inline keyboard
async function sendInlineKeyboard(chatId, text, keyboard) {
    await sendMessage(chatId, text, {
        reply_markup: {
            inline_keyboard: keyboard
        }
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

// Function to get historical price from the specified exchange at a specific time
async function getCryptoPriceAtTime(exchangeName, symbol, timestamp) {
    const exchange = new ccxt[exchangeName]();
    try {
        const ohlcv = await exchange.fetchOHLCV(symbol, '1m', timestamp, 1); // Fetch 1-minute OHLCV data
        if (ohlcv.length === 0) {
            throw new Error('No data available for the specified time.');
        }
        const [time, open, high, low, close] = ohlcv[0];
        return { time, open, high, low, close };
    } catch (error) {
        throw new Error(`Could not fetch historical price for symbol: ${symbol} on exchange: ${exchangeName} at timestamp: ${timestamp}`);
    }
}

// Function to handle incoming updates
async function handleUpdates() {
    let offset = 0;
    while (true) {
        const updates = await getUpdates(offset);
        for (const update of updates) {
            const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
            const messageText = update.message?.text?.trim();
            const callbackData = update.callback_query?.data;

            if (!chatId) continue;

            if (messageText === '/start' || !userStates[chatId]) {
                // Initialize or reset user state
                userStates[chatId] = { stage: 'mainMenu', demoTrade: false };
                const currentTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
                await sendInlineKeyboard(chatId, `Welcome! The current time is ${currentTime}. What would you like to do?`, [
                    [{ text: 'Get Price', callback_data: 'getPrice' }],
                    [{ text: 'Settings', callback_data: 'settings' }],
                    [{ text: 'Demo Trade', callback_data: 'demoTrade' }]
                ]);
            } else if (callbackData) {
                if (callbackData === 'getPrice') {
                    userStates[chatId].stage = 'askSymbol';
                    await sendMessage(chatId, 'Please enter the crypto symbol (e.g., BTC/USDT).');
                } else if (callbackData === 'settings') {
                    userStates[chatId].stage = 'settings';
                    await sendInlineKeyboard(chatId, 'Settings:', [
                        [{ text: 'Set Default Exchange', callback_data: 'setDefaultExchange' }],
                        [{ text: 'Set Default Symbol', callback_data: 'setDefaultSymbol' }],
                        [{ text: 'Back to Main Menu', callback_data: 'backToMainMenu' }]
                    ]);
                } else if (callbackData === 'demoTrade') {
                    userStates[chatId].stage = 'toggleDemoTrade';
                    await sendInlineKeyboard(chatId, 'Do you want to turn demo trade ON or OFF?', [
                        [{ text: 'ON', callback_data: 'demoTradeOn' }],
                        [{ text: 'OFF', callback_data: 'demoTradeOff' }]
                    ]);
                } else if (callbackData === 'backToMainMenu') {
                    userStates[chatId].stage = 'mainMenu';
                    await sendInlineKeyboard(chatId, 'What would you like to do next?', [
                        [{ text: 'Get Price', callback_data: 'getPrice' }],
                        [{ text: 'Settings', callback_data: 'settings' }],
                        [{ text: 'Demo Trade', callback_data: 'demoTrade' }]
                    ]);
                } else if (callbackData === 'setDefaultExchange') {
                    userStates[chatId].stage = 'setDefaultExchange';
                    await sendMessage(chatId, 'Please enter the default exchange you want to set (e.g., bybit).');
                } else if (callbackData === 'setDefaultSymbol') {
                    userStates[chatId].stage = 'setDefaultSymbol';
                    await sendMessage(chatId, 'Please enter the default crypto symbol you want to set (e.g., BTC/USDT).');
                } else if (callbackData === 'demoTradeOn') {
                    userStates[chatId].demoTrade = true;
                    userStates[chatId].stage = 'askTradePair';
                    await sendMessage(chatId, 'Demo trade is ON. Please enter the trading pair (e.g., BTC/USDT).');
                } else if (callbackData === 'demoTradeOff') {
                    userStates[chatId].demoTrade = false;
                    userStates[chatId].stage = 'mainMenu';
                    await sendMessage(chatId, 'Demo trade is OFF.');
                    await sendInlineKeyboard(chatId, 'What would you like to do next?', [
                        [{ text: 'Get Price', callback_data: 'getPrice' }],
                        [{ text: 'Settings', callback_data: 'settings' }],
                        [{ text: 'Demo Trade', callback_data: 'demoTrade' }]
                    ]);
                } else if (callbackData === 'checkDemoPosition') {
                    const { entryTime, entryPrice } = userStates[chatId].demoTradeDetails;
                    const exchangeName = userStates[chatId].defaultExchange;
                    const symbol = userStates[chatId].tradePair;
                    try {
                        const currentPrice = await getCryptoPrice(exchangeName, symbol);
                        const pnl = currentPrice - entryPrice;
                        await sendInlineKeyboard(chatId, `Entry time: ${entryTime}\nEntry price: $${entryPrice}\nCurrent price: $${currentPrice}\nPnL: $${pnl}`, [
                            [{ text: 'Refresh', callback_data: 'checkDemoPosition' }],
                            [{ text: 'End Demo Trade', callback_data: 'endDemoTrade' }],
                            [{ text: 'Back to Main Menu', callback_data: 'backToMainMenu' }]
                        ]);
                    } catch (error) {
                        await sendMessage(chatId, error.message);
                    }
                } else if (callbackData === 'endDemoTrade') {
                    userStates[chatId].demoTrade = false;
                    userStates[chatId].demoTradeDetails = null;
                    userStates[chatId].stage = 'mainMenu';
                    await sendMessage(chatId, 'Demo trade ended.');
                    await sendInlineKeyboard(chatId, 'What would you like to do next?', [
                        [{ text: 'Get Price', callback_data: 'getPrice' }],
                        [{ text: 'Settings', callback_data: 'settings' }],
                        [{ text: 'Demo Trade', callback_data: 'demoTrade' }]
                    ]);
                }
            } else if (userStates[chatId]?.stage === 'askSymbol') {
                const exchangeName = userStates[chatId].defaultExchange;
                const symbol = messageText.toUpperCase();
                try {
                    const price = await getCryptoPrice(exchangeName, symbol);
                    await sendMessage(chatId, `*The current price of ${symbol} on ${exchangeName} is $${price}*`, { parse_mode: 'Markdown' });
                } catch (error) {
                    await sendMessage(chatId, error.message);
                }
                userStates[chatId].stage = 'mainMenu';
                await sendInlineKeyboard(chatId, 'What would you like to do next?', [
                    [{ text: 'Get Price', callback_data: 'getPrice' }],
                    [{ text: 'Settings', callback_data: 'settings' }],
                    [{ text: 'Demo Trade', callback_data: 'demoTrade' }]
                ]);
            } else if (userStates[chatId]?.stage === 'setDefaultExchange') {
                userStates[chatId].defaultExchange = messageText.toLowerCase();
                userStates[chatId].stage = 'settings';
                await sendMessage(chatId, `Default exchange set to ${messageText}.`);
                await sendInlineKeyboard(chatId, 'Settings:', [
                    [{ text: 'Set Default Exchange', callback_data: 'setDefaultExchange' }],
                    [{ text: 'Set Default Symbol', callback_data: 'setDefaultSymbol' }],
                    [{ text: 'Back to Main Menu', callback_data: 'backToMainMenu' }]
                ]);
            } else if (userStates[chatId]?.stage === 'setDefaultSymbol') {
                userStates[chatId].defaultSymbol = messageText.toUpperCase();
                userStates[chatId].stage = 'settings';
                await sendMessage(chatId, `Default symbol set to ${messageText}.`);
                await sendInlineKeyboard(chatId, 'Settings:', [
                    [{ text: 'Set Default Exchange', callback_data: 'setDefaultExchange' }],
                    [{ text: 'Set Default Symbol', callback_data: 'setDefaultSymbol' }],
                    [{ text: 'Back to Main Menu', callback_data: 'backToMainMenu' }]
                ]);
            } else if (userStates[chatId]?.stage === 'askTradePair') {
                userStates[chatId].tradePair = messageText.toUpperCase();
                userStates[chatId].stage = 'askEntryTime';
                await sendMessage(chatId, 'Please enter the entry time for the demo trade (YYYY-MM-DD HH:MM:SS).');
            } else if (userStates[chatId]?.stage === 'askEntryTime') {
                const dateTimeString = messageText;
                const dateTime = new Date(dateTimeString);
                const timestamp = dateTime.getTime();
                const exchangeName = userStates[chatId].defaultExchange;
                const symbol = userStates[chatId].tradePair;
                try {
                    const { open: entryPrice } = await getCryptoPriceAtTime(exchangeName, symbol, timestamp);
                    userStates[chatId].demoTradeDetails = {
                        entryTime: dateTimeString,
                        entryPrice,
                    };
                    userStates[chatId].stage = 'demoTradeActive';
                    await sendMessage(chatId, `Demo trade started for ${symbol} at ${dateTimeString} with entry price $${entryPrice}.`);
                    await sendInlineKeyboard(chatId, 'Demo trade is active. What would you like to do next?', [
                        [{ text: 'Check Demo Position', callback_data: 'checkDemoPosition' }],
                        [{ text: 'End Demo Trade', callback_data: 'endDemoTrade' }],
                        [{ text: 'Back to Main Menu', callback_data: 'backToMainMenu' }]
                    ]);
                } catch (error) {
                    await sendMessage(chatId, error.message);
                    userStates[chatId].stage = 'mainMenu';
                    await sendInlineKeyboard(chatId, 'What would you like to do next?', [
                        [{ text: 'Get Price', callback_data: 'getPrice' }],
                        [{ text: 'Settings', callback_data: 'settings' }],
                        [{ text: 'Demo Trade', callback_data: 'demoTrade' }]
                    ]);
                }
            }
        }
        if (updates.length > 0) {
            offset = updates[updates.length - 1].update_id + 1;
        }
    }
}

handleUpdates().catch(console.error);
