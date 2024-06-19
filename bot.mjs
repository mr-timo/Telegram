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
let lastPromptMessageId = null;

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
         //   bot.sendMessage(chatId, `Entry price set to ${entryPrice}.`);
        }

        // Calculate the percentage increase
        const percentageIncrease = ((currentPrice - entryPrice) / entryPrice) * 100;

        // Calculate the profit based on the initial investment amount
        const profit = (percentageIncrease / 100) * initialAmount;
        const totalAmount = initialAmount + profit;

        // Create the message
        const message = `
Exchange: ${selectedExchange}
Pair: ${selectedSymbol}
Entry Price: ${entryPrice}
Current Price: ${currentPrice}
Initial Investment: ${initialAmount}
Profit: ${profit.toFixed(2)}
Total Amount: ${totalAmount.toFixed(2)}
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
                        [{ text: 'Back', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        } else {
            const sentMessage = await bot.sendMessage(chatId, message, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Refresh', callback_data: 'refresh' }],
                        [{ text: 'Back', callback_data: 'back_to_menu' }]
                    ]
                }
            });
            lastMessageId = sentMessage.message_id;
        }
    } catch (error) {
        console.error('Error fetching price or sending message:', error);
    }
}

// Function to display the main menu
function showMenu() {
    clearLastPrompt();
    bot.sendMessage(chatId, 'Menu:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Buy', callback_data: 'buy' }, { text: 'Position', callback_data: 'position' }],
                [{ text: 'Settings', callback_data: 'settings' }]
            ]
        }
    }).then(message => {
        lastPromptMessageId = message.message_id;
    });
}

// Function to clear the last prompt message
function clearLastPrompt() {
    if (lastPromptMessageId) {
        bot.deleteMessage(chatId, lastPromptMessageId).catch(() => {});
        lastPromptMessageId = null;
    }
}

// Function to display the exchange selection menu
function showExchangeSelection() {
    clearLastPrompt();
    bot.sendMessage(chatId, 'Please select an exchange:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'KuCoin', callback_data: 'set_exchange_kucoin' }],
                [{ text: 'Coinbase', callback_data: 'set_exchange_coinbase' }],
                [{ text: 'Back', callback_data: 'back_to_menu' }]
            ]
        }
    }).then(message => {
        lastPromptMessageId = message.message_id;
    });
}

// Function to display the symbol and initial amount input form
function showSymbolAndAmountInput() {
    clearLastPrompt();
    bot.sendMessage(chatId, 'Please enter the trading pair symbol (e.g., BTC/USDT):')
        .then(message => {
            lastPromptMessageId = message.message_id;
            bot.once('message', (msg) => {
                selectedSymbol = msg.text.toUpperCase();
                bot.deleteMessage(chatId, message.message_id).catch(() => {});
                bot.sendMessage(chatId, `Trading pair symbol set to ${selectedSymbol}.`)
                    .then(() => {
                        bot.sendMessage(chatId, 'Please enter the initial amount to invest:')
                            .then(message => {
                                lastPromptMessageId = message.message_id;
                                bot.once('message', (msg) => {
                                    initialAmount = parseFloat(msg.text);
                                    bot.deleteMessage(chatId, message.message_id).catch(() => {});
                                    bot.sendMessage(chatId, `Initial amount set to ${initialAmount}.`)
                                        
                                        .then(() => {
                                       
                                          showMenu();
                                        });
                                });
                            });
                    });
            });
        });
}

// Listen for the /start command
bot.onText(/\/start/, (msg) => {
    chatId = msg.chat.id;
  //  entryPrice = null;  // Reset entry price if bot is restarted
//    lastMessageId = null;  // Reset last message ID if bot is restarted
//    selectedExchange = null;  // Reset selected exchange
//    selectedSymbol = null;  // Reset selected symbol
//    initialAmount = null;  // Reset initial amount
    showMenu();
});

// Listen for callback queries from inline keyboard
bot.on('callback_query', async (query) => {
    const { data } = query;
    if (data === 'refresh') {
        clearLastPrompt();
        await fetchPriceAndSendMessage();
    } else if (data === 'back_to_menu') {
        showMenu();
    } else if (data === 'buy') {
        clearLastPrompt();
        if (selectedExchange && selectedSymbol && initialAmount) {
            entryPrice = null;  // Enter a new demo trade
            await fetchPriceAndSendMessage();
            bot.sendMessage(chatId, 'Entered a new demo trade.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });

        } else {
            clearLastPrompt();
            bot.sendMessage(chatId, 'Please set up your settings first.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        }
        
    } else if (data === 'position') {
        clearLastPrompt();
        if (entryPrice !== null) {
            await fetchPriceAndSendMessage();
        } else {
            clearLastPrompt();
            bot.sendMessage(chatId, 'No active position. Please enter a trade first.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        }
    
    } else if (data === 'settings') {
        showExchangeSelection();
    } else if (data === 'set_exchange_kucoin') {
        selectedExchange = 'kucoin';
        showSymbolAndAmountInput();
    } else if (data === 'set_exchange_coinbase') {
        selectedExchange = 'coinbase';
        showSymbolAndAmountInput();
    }
    bot.answerCallbackQuery(query.id);
});

console.log('Bot is running...');
