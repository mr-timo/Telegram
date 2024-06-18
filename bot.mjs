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
            const chatId = update.message?.chat.id || update.callback_query?.message.chat.id;
            const messageText = update.message?.text?.trim();
            const callbackData = update.callback_query?.data;

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
            } else if (callbackData) {
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
                } else if (callbackData === 'checkPNL') {
                    const exchangeName = userStates[chatId].exchange;
                    const symbol = userStates[chatId].tradePair;
                    try {
                        const currentPrice = await getCryptoPrice(exchangeName, symbol);
                        const entryPrice = userStates[chatId].entryPrice;
                        const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;
                        const unrealizedProfit = (currentPrice - entryPrice) * userStates[chatId].quantity;
                        await sendMessage(chatId, `Entry price: $${entryPrice}\nCurrent price: $${currentPrice}\nPNL: ${pnl.toFixed(2)}%\nUnrealized profit: $${unrealizedProfit.toFixed(2)}`);
                    } catch (error) {
                        await sendMessage(chatId, error.message);
                    }
                    await sendInlineKeyboard(chatId, 'What would you like to do next?', [
                        [{ text: 'Get another price', callback_data: 'getPrice' }],
                        [{ text: 'Change exchange', callback_data: 'changeExchange' }],
                        [{ text: 'Advanced settings', callback_data: 'advancedSettings' }],
                        [{ text: 'Check PNL', callback_data: 'checkPNL' }]
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
                await sendMessage(chatId, 'Please enter the time you want to enter the trade (YYYY-MM-DD HH:MM).');
            } else if (userStates[chatId]?.stage === 'askTradeTime') {
                userStates[chatId].tradeTime = messageText;
                const exchangeName = userStates[chatId].exchange;
                const symbol = userStates[chatId].tradePair;
                try {
                    const entryTime = new Date(userStates[chatId].tradeTime).getTime();
                    const currentTime = Date.now();
                    if (entryTime > currentTime) {
                        await sendMessage(chatId, 'The trade entry time cannot be in the future. Please enter a valid past time.');
                    } else {
                        const price = await getCryptoPrice(exchangeName, symbol);
                        userStates[chatId].entryPrice = price;
                        userStates[chatId].quantity = 1; // Assume 1 unit for simplicity
                        await sendMessage(chatId, `Entered trade for ${symbol} at $${price} on ${exchangeName}.`);
                        userStates[chatId].stage = 'mainMenu';
                        await sendInlineKeyboard(chatId, 'What would you like to do next?', [
                            [{ text: 'Get another price', callback_data: 'getPrice' }],
                            [{ text: 'Change exchange', callback_data: 'changeExchange' }],
                            [{ text: 'Advanced settings', callback_data: 'advancedSettings' }],
                            [{ text: 'Check PNL', callback_data: 'checkPNL' }]
                        ]);
                    }
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
