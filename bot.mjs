import ccxt from 'ccxt';
import TelegramBot from 'node-telegram-bot-api';

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
let messagesToDelete = [];

// Function to delete messages
async function deleteMessages() {
    if (chatId) {
        for (let messageId of messagesToDelete) {
            try {
                await bot.deleteMessage(chatId, messageId);
            } catch (e) {
                console.log(`Failed to delete message ${messageId}: ${e.message}`);
            }
        }
        messagesToDelete = [];
    }
}

// Function to fetch price and calculate PNL
async function fetchPriceAndSendMessage() {
    if (!chatId) {
        console.log('Chat ID not set.');
        return;
    }

    await deleteMessages(); // Clear old messages

    try {
        // Initialize the exchange
        const exchange = new ccxt[selectedExchange]();

        // Fetch the current price
        const ticker = await exchange.fetchTicker(selectedSymbol);
        const currentPrice = ticker.last;

        // If entry price is not set, use the current price as the entry price
        if (entryPrice === null) {
            entryPrice = currentPrice;
            const entryMessage = await bot.sendMessage(chatId, `Entry price set to ${entryPrice}.`);
            messagesToDelete.push(entryMessage.message_id);
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

        // Send a new message
        const sentMessage = await bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Refresh', callback_data: 'refresh' }],
                    [{ text: 'Back', callback_data: 'back_to_menu' }]
                ]
            }
        });
        lastMessageId = sentMessage.message_id;
        messagesToDelete.push(lastMessageId);
    } catch (error) {
        console.error('Error fetching price or sending message:', error);
    }
}

// Function to display the main menu
async function showMenu() {
    await deleteMessages(); // Clear old messages

    const menuMessage = await bot.sendMessage(chatId, 'Menu:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Buy', callback_data: 'buy' }, { text: 'Position', callback_data: 'position' }],
                [{ text: 'Settings', callback_data: 'settings' }]
            ]
        }
    });
    messagesToDelete.push(menuMessage.message_id);
}

// Function to display the exchange selection menu
async function showExchangeSelection() {
    await deleteMessages(); // Clear old messages

    const exchangeMessage = await bot.sendMessage(chatId, 'Please select an exchange:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'KuCoin', callback_data: 'set_exchange_kucoin' }],
                [{ text: 'Coinbase', callback_data: 'set_exchange_coinbase' }],
                [{ text: 'Back', callback_data: 'back_to_menu' }]
            ]
        }
    });
    messagesToDelete.push(exchangeMessage.message_id);
}

// Function to display the symbol and initial amount input form
async function showSymbolAndAmountInput() {
    await deleteMessages(); // Clear old messages

    const symbolMessage = await bot.sendMessage(chatId, 'Please enter the trading pair symbol (e.g., BTC/USDT):');
    messagesToDelete.push(symbolMessage.message_id);

    bot.once('message', async (msg) => {
        selectedSymbol = msg.text.toUpperCase();
        messagesToDelete.push(msg.message_id); // Track user input message

        const amountMessage = await bot.sendMessage(chatId, 'Please enter the initial amount to invest:');
        messagesToDelete.push(amountMessage.message_id);

        bot.once('message', async (msg) => {
            initialAmount = parseFloat(msg.text);
            messagesToDelete.push(msg.message_id); // Track user input message

            const confirmationMessage = await bot.sendMessage(chatId, 'Settings updated.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
            messagesToDelete.push(confirmationMessage.message_id);
        });
    });
}

// Listen for the /start command
bot.onText(/\/start/, async (msg) => {
    chatId = msg.chat.id;
    entryPrice = null;  // Reset entry price if bot is restarted
    lastMessageId = null;  // Reset last message ID if bot is restarted
    selectedExchange = null;  // Reset selected exchange
    selectedSymbol = null;  // Reset selected symbol
    initialAmount = null;  // Reset initial amount
    await deleteMessages(); // Clear any old messages on /start
    showMenu();
});

// Listen for callback queries from inline keyboard
bot.on('callback_query', async (query) => {
    const { data } = query;

    if (data === 'refresh') {
        await fetchPriceAndSendMessage();
    } else if (data === 'back_to_menu') {
        showMenu();
    } else if (data === 'buy') {
        await deleteMessages(); // Clear old messages
        if (selectedExchange && selectedSymbol && initialAmount) {
            entryPrice = null;  // Enter a new demo trade
            await fetchPriceAndSendMessage();
            const buyMessage = await bot.sendMessage(chatId, 'Entered a new demo trade.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
            messagesToDelete.push(buyMessage.message_id);
        } else {
            const errorMessage = await bot.sendMessage(chatId, 'Please set up your settings first.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
            messagesToDelete.push(errorMessage.message_id);
        }
    } else if (data === 'position') {
        await deleteMessages(); // Clear old messages
        if (entryPrice !== null) {
            await fetchPriceAndSendMessage();
        } else {
            const noPositionMessage = await bot.sendMessage(chatId, 'No active position. Please enter a trade first.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
            messagesToDelete.push(noPositionMessage.message_id);
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
