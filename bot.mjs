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

// Function to handle incoming updates
async function handleUpdates() {
    let offset = 0;
    while (true) {
        const updates = await getUpdates(offset);
        for (const update of updates) {
            const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
            const messageText = update.message?.text?.trim();

            if (messageText && messageText.toLowerCase() === '/start') {
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
                await sendInlineKeyboard(chatId, 'What would you like to do next?', [
                    [{ text: 'Get another price', callback_data: 'getPrice' }],
                    [{ text: 'Change exchange', callback_data: 'changeExchange' }],
                    [{ text: 'Advanced settings', callback_data: 'advancedSettings' }]
                ]);
            } else if (update.callback_query) {
                const callbackData = update.callback_query.data;

                if (callbackData === 'getPrice') {
                    userStates[chatId].stage = 'askSymbol';
                    await sendMessage(chatId, `Please enter the crypto symbol (e.g., BTC/USDT) for ${userStates[chatId].exchange}.`);
                } else if (callbackData === 'changeExchange') {
                    userStates[chatId].stage = 'askExchange';
                    await sendMessage(chatId, 'Please enter the name of the exchange you want to use (e.g., bybit).');
                } else if (callbackData === 'advancedSettings') {
                    userStates[chatId].stage = 'advancedSettings';
                    await sendInlineKeyboard(chatId, 'Advanced settings:', [
                        [{ text: 'Set default exchange', callback_data: 'setDefaultExchange' }],
                        [{ text: 'Set default symbol', callback_data: 'setDefaultSymbol' }],
                        [{ text: 'Demo trade: ON/OFF', callback_data: 'toggleDemoTrade' }],
                        [{ text: 'Back to main menu', callback_data: 'backToMainMenu' }]
                    ]);
                } else if (callbackData === 'setDefaultExchange') {
                    userStates[chatId].stage = 'setDefaultExchange';
                    await sendMessage(chatId, 'Please enter the default exchange you want to set (e.g., bybit).');
                } else if (callbackData === 'setDefaultSymbol') {
                    userStates[chatId].stage = 'setDefaultSymbol';
                    await sendMessage(chatId, 'Please enter the default crypto symbol you want to set (e.g., BTC/USDT).');
                } else if (callbackData === 'toggleDemoTrade') {
                    userStates[chatId].stage = 'toggleDemoTrade';
                    await sendInlineKeyboard(chatId, 'Do you want to turn demo trade ON or OFF?', [
                        [{ text: 'ON', callback_data: 'demoTradeOn' }],
                        [{ text: 'OFF', callback_data: 'demoTradeOff' }]
                    ]);
                } else if (callbackData === 'backToMainMenu') {
                    userStates[chatId].stage = 'mainMenu';
                    await sendInlineKeyboard(chatId, 'What would you like to do next?', [
                        [{ text: 'Get another price', callback_data: 'getPrice' }],
                        [{ text: 'Change exchange', callback_data: 'changeExchange' }],
                        [{ text: 'Advanced settings', callback_data: 'advancedSettings' }]
                    ]);
                } else if (callbackData === 'demoTradeOn') {
                    userStates[chatId].demoTrade = true;
                    userStates[chatId].stage = 'askTradePair';
                    await sendMessage(chatId, 'Demo trade is ON. Please enter the trading pair (e.g., BTC/USDT).');
                } else if (callbackData === 'demoTradeOff') {
                    userStates[chatId].demoTrade = false;
                    userStates[chatId].stage = 'advancedSettings';
                    await sendMessage(chatId, 'Demo trade is OFF.');
                    await sendInlineKeyboard(chatId, 'Advanced settings:', [
                        [{ text: 'Set default exchange', callback_data: 'setDefaultExchange' }],
                        [{ text: 'Set default symbol', callback_data: 'setDefaultSymbol' }],
                        [{ text: 'Demo trade: ON/OFF', callback_data: 'toggleDemoTrade' }],
                        [{ text: 'Back to main menu', callback_data: 'backToMainMenu' }]
                    ]);
                } else if (callbackData === 'getPnl') {
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
                userStates[chatId].stage = 'askTradeDelay';
                const currentTime = new Date().toISOString().replace('T', ' ').substr(0, 19);
                await sendMessage(chatId, `Current time is ${currentTime}. Please enter the delay in minutes or hours (e.g., 2m for 2 minutes, 1h for 1 hour).`);
            } else if (userStates[chatId]?.stage === 'askTradeDelay') {
                const delay = messageText.toLowerCase();
                const now = new Date();
                let tradeTime;

                if (delay.endsWith('m')) {
                    const minutes = parseInt(delay.slice(0, -1), 10);
                    tradeTime = new Date(now.getTime() + minutes * 60000);
                } else if (delay.endsWith('h')) {
                    const hours = parseInt(delay.slice(0, -1), 10);
                    tradeTime = new Date(now.getTime() + hours * 3600000);
                } else {
                    await sendMessage(chatId, 'Invalid format. Please enter the delay in minutes (e.g., 2m) or hours (e.g., 1h).');
                    continue;
                }

                userStates[chatId].tradeTime = tradeTime.toISOString().replace('T', ' ').substr(0, 19);
                const exchangeName = userStates[chatId].defaultExchange;
                const symbol = userStates[chatId].tradePair;
                const time = userStates[chatId].tradeTime;

                try {
                    const timestamp = new Date(time).getTime();
                    setTimeout(async () => {
                        try {
                            const historicalData = await getCryptoPriceAtTime(exchangeName, symbol, timestamp);
                            userStates[chatId].entryPrice = historicalData.close;
                            await sendMessage(chatId, `Trade entered for ${symbol} at ${time} with price $${userStates[chatId].entryPrice}`);
                            await sendInlineKeyboard(chatId, 'What would you like to do next?', [
                                [{ text: 'Get PnL', callback_data: 'getPnl' }],
                                [{ text: 'Change exchange', callback_data: 'changeExchange' }],
                                [{ text: 'Advanced settings', callback_data: 'advancedSettings' }]
                            ]);
                        } catch (error) {
                            await sendMessage(chatId, `Error fetching historical data: ${error.message}`);
                        }
                    }, timestamp - Date.now());
                } catch (error) {
                    await sendMessage(chatId, `Error calculating trade time: ${error.message}`);
                }
            }
            offset = update.update_id + 1;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second
    }
}

// Function to get historical price from the specified exchange at a specific time
async function getCryptoPriceAtTime(exchangeName, symbol, timestamp) {
    const exchange = new ccxt[exchangeName]();
    try {
        const historicalData = await exchange.fetchOHLCV(symbol, '1m', timestamp, 1);
        return {
            close: historicalData[0][4] // Closing price
        };
    } catch (error) {
        throw new Error(`Could not fetch historical price for symbol: ${symbol} on exchange: ${exchangeName} at timestamp: ${timestamp}`);
    }
}

// Start handling updates
handleUpdates().catch(console.error);
