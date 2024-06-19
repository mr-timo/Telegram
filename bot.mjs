import fetch from 'node-fetch';
import ccxt from 'ccxt';
import ht from './In.js'

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
            const chatId = update.message.chat.id;
            const messageText = update.message.text.trim();

            if (messageText.toLowerCase() === '/start') {
                userStates[chatId] = { stage: 'mainMenu' };
                const currentTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
                await sendInlineKeyboard(chatId, `Welcome! The current time is ${currentTime}. What would you like to do?`, [
                    [{ text: 'Add Exchange', callback_data: 'addExchange' }],
                    [{ text: 'Advanced settings', callback_data: 'advancedSettings' }]
                ]);
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
                    [{ text: 'Get another price', callback_data: 'getPrice' }],
                    [{ text: 'Change exchange', callback_data: 'changeExchange' }],
                    [{ text: 'Advanced settings', callback_data: 'advancedSettings' }]
                ]);
            } else if (update.callback_query) {
                const callbackData = update.callback_query.data;
                const callbackChatId = update.callback_query.message.chat.id;

                if (callbackData === 'addExchange') {
                    userStates[callbackChatId].stage = 'askExchange';
                    await sendMessage(callbackChatId, 'Please enter the name of the exchange you want to use (e.g., bybit).');
                } else if (callbackData === 'getPrice') {
                    userStates[callbackChatId].stage = 'askSymbol';
                    await sendMessage(callbackChatId, `Please enter the crypto symbol (e.g., BTC/USDT) for ${userStates[callbackChatId].defaultExchange}.`);
                } else if (callbackData === 'changeExchange') {
                    userStates[callbackChatId].stage = 'askExchange';
                    await sendMessage(callbackChatId, 'Please enter the name of the exchange you want to use (e.g., bybit).');
                } else if (callbackData === 'advancedSettings') {
                    userStates[callbackChatId].stage = 'advancedSettings';
                    await sendInlineKeyboard(callbackChatId, 'Advanced settings:', [
                        [{ text: 'Set default exchange', callback_data: 'setDefaultExchange' }],
                        [{ text: 'Set default symbol', callback_data: 'setDefaultSymbol' }],
                        [{ text: 'Demo trade: ON/OFF', callback_data: 'toggleDemoTrade' }],
                        [{ text: 'Back to main menu', callback_data: 'backToMainMenu' }]
                    ]);
                } else if (callbackData === 'setDefaultExchange') {
                    userStates[callbackChatId].stage = 'setDefaultExchange';
                    await sendMessage(callbackChatId, 'Please enter the default exchange you want to set (e.g., bybit).');
                } else if (callbackData === 'setDefaultSymbol') {
                    userStates[callbackChatId].stage = 'setDefaultSymbol';
                    await sendMessage(callbackChatId, 'Please enter the default crypto symbol you want to set (e.g., BTC/USDT).');
                } else if (callbackData === 'toggleDemoTrade') {
                    userStates[callbackChatId].stage = 'toggleDemoTrade';
                    await sendInlineKeyboard(callbackChatId, 'Do you want to turn demo trade ON or OFF?', [
                        [{ text: 'ON', callback_data: 'demoTradeOn' }],
                        [{ text: 'OFF', callback_data: 'demoTradeOff' }]
                    ]);
                } else if (callbackData === 'backToMainMenu') {
                    userStates[callbackChatId].stage = 'mainMenu';
                    await sendInlineKeyboard(callbackChatId, 'What would you like to do next?', [
                        [{ text: 'Get another price', callback_data: 'getPrice' }],
                        [{ text: 'Change exchange', callback_data: 'changeExchange' }],
                        [{ text: 'Advanced settings', callback_data: 'advancedSettings' }]
                    ]);
                } else if (callbackData === 'demoTradeOn') {
                    userStates[callbackChatId].demoTrade = true;
                    userStates[callbackChatId].stage = 'askTradePair';
                    await sendMessage(callbackChatId, 'Demo trade is ON. Please enter the trading pair (e.g., BTC/USDT).');
                } else if (callbackData === 'demoTradeOff') {
                    userStates[callbackChatId].demoTrade = false;
                    userStates[callbackChatId].stage = 'advancedSettings';
                    await sendMessage(callbackChatId, 'Demo trade is OFF.');
                    await sendInlineKeyboard(callbackChatId, 'Advanced settings:', [
                        [{ text: 'Set default exchange', callback_data: 'setDefaultExchange' }],
                        [{ text: 'Set default symbol', callback_data: 'setDefaultSymbol' }],
                        [{ text: 'Demo trade: ON/OFF', callback_data: 'toggleDemoTrade' }],
                        [{ text: 'Back to main menu', callback_data: 'backToMainMenu' }]
                    ]);
                }
            } else if (userStates[chatId]?.stage === 'setDefaultExchange') {
                userStates[chatId].defaultExchange = messageText.toLowerCase();
                userStates[chatId].stage = 'advancedSettings';
                await sendMessage(chatId, `Default exchange set to ${messageText}.`);
                await sendInlineKeyboard(chatId, 'Advanced settings:', [
                    [{ text: 'Set default exchange', callback_data: 'setDefaultExchange' }],
                    [{ text: 'Set default symbol', callback_data: 'setDefaultSymbol' }],
                    [{ text: 'Demo trade: ON/OFF', callback_data: 'toggleDemoTrade' }],
                    [{ text: 'Back to main menu', callback_data: 'backToMainMenu' }]
                ]);
            } else if (userStates[chatId]?.stage === 'setDefaultSymbol') {
                userStates[chatId].defaultSymbol = messageText.toUpperCase();
                userStates[chatId].stage = 'advancedSettings';
                await sendMessage(chatId, `Default symbol set to ${messageText}.`);
                await sendInlineKeyboard(chatId, 'Advanced settings:', [
                    [{ text: 'Set default exchange', callback_data: 'setDefaultExchange' }],
                    [{ text: 'Set default symbol', callback_data: 'setDefaultSymbol' }],
                    [{ text: 'Demo trade: ON/OFF', callback_data: 'toggleDemoTrade' }],
                    [{ text: 'Back to main menu', callback_data: 'backToMainMenu' }]
                ]);
            } else if (userStates[chatId]?.stage === 'askTradePair') {
                userStates[chatId].tradePair = messageText.toUpperCase();
                userStates[chatId].stage = 'askTradeTime';
                await sendMessage(chatId, 'Please enter the time you want to enter the trade in DD-MM-YY HH:MM:SS format (UTC).');
            } else if (userStates[chatId]?.stage === 'askTradeTime') {
                userStates[chatId].tradeTime = messageText;

                // Parsing the date string into a Date object
                const [datePart, timePart] = messageText.split(' ');
                const [day, month, year] = datePart.split('-').map(part => parseInt(part));
                const [hour, minute, second] = timePart.split(':').map(part => parseInt(part));
                const timestamp = Date.UTC(year + 2000, month - 1, day, hour, minute, second);

                const exchangeName = userStates[chatId].defaultExchange;
                const symbol = userStates[chatId].tradePair;
                try {
                    const historicalData = await getCryptoPriceAtTime(exchangeName, symbol, timestamp);
                    userStates[chatId].entryPrice = historicalData.close;
                    userStates[chatId].stage = 'mainMenu';
                    await sendMessage(chatId, `Trade entered for ${symbol} at ${messageText} with price $${userStates[chatId].entryPrice}`);
                    await sendInlineKeyboard(chatId, 'What would you like to do next?', [
                        [{ text: 'Get PnL', callback_data: 'getPnl' }],
                        [{ text: 'Change exchange', callback_data: 'changeExchange' }],
                        [{ text: 'Advanced settings', callback_data: 'advancedSettings' }]
                    ]);
                } catch (error) {
                    await sendMessage(chatId, `Error fetching historical data: ${error.message}`);
                }
            } else if (update.callback_query?.data === 'getPnl') {
                const exchangeName = userStates[chatId].defaultExchange;
                const symbol = userStates[chatId].tradePair;
                const entryPrice = userStates[chatId].entryPrice;

                try {
                    const currentPrice = await getCryptoPrice(exchangeName, symbol);
                    const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;
                    await sendMessage(chatId, `The current PnL for ${symbol} is ${pnl.toFixed(2)}%`);
                } catch (error) {
                    await sendMessage(chatId, `Error fetching current price: ${error.message}`);
                }
            }
            offset = update.update_id + 1;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second
    }
}

// Start handling updates
handleUpdates().catch(console.error);
