// bot.js - Main entry point
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const Database = require('./src/database/database');
const GameManager = require('./src/games/gameManager');
const CoinManager = require('./src/managers/coinManager');
const RedeemManager = require('./src/managers/redeemManager');
const SecurityManager = require('./src/security/securityManager');
const config = require('./config/config');

class WhatsAppBot {
    constructor() {
        this.db = new Database();
        this.gameManager = new GameManager(this.db);
        this.coinManager = new CoinManager(this.db);
        this.redeemManager = new RedeemManager(this.db);
        this.security = new SecurityManager();
        this.sock = null;
        this.logger = pino({ level: 'info' });
    }

    async start() {
        try {
            await this.db.init();
            const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
            
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: true,
                logger: this.logger,
                browser: ['WhatsApp Bot', 'Chrome', '1.0.0']
            });

            this.sock.ev.on('creds.update', saveCreds);
            this.sock.ev.on('connection.update', this.handleConnection.bind(this));
            this.sock.ev.on('messages.upsert', this.handleMessage.bind(this));

            this.logger.info('Bot started successfully');
        } catch (error) {
            this.logger.error('Failed to start bot:', error);
        }
    }

    handleConnection(update) {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            this.logger.info('Connection closed due to:', lastDisconnect?.error);
            
            if (shouldReconnect) {
                this.start();
            }
        } else if (connection === 'open') {
            this.logger.info('WhatsApp connection opened');
        }
    }

    async handleMessage(m) {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const messageText = msg.message.conversation || 
                               msg.message.extendedTextMessage?.text || '';
            
            const sender = msg.key.remoteJid;
            const senderNumber = sender.split('@')[0];

            // Security check for malicious commands
            if (this.security.containsMaliciousCode(messageText)) {
                await this.sendMessage(sender, '⚠️ Invalid command detected. Please use only allowed bot commands.');
                return;
            }

            if (messageText.startsWith('.')) {
                await this.processCommand(messageText, sender, senderNumber);
            }
        } catch (error) {
            this.logger.error('Error handling message:', error);
        }
    }

    async processCommand(command, sender, senderNumber) {
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();

        try {
            switch (cmd) {
                case '.roulette':
                    await this.handleRouletteCommand(parts, sender, senderNumber);
                    break;
                case '.guess':
                    await this.handleGuessCommand(parts, sender, senderNumber);
                    break;
                case '.balance':
                    await this.handleBalanceCommand(sender, senderNumber);
                    break;
                case '.claim':
                    await this.handleClaimCommand(parts, sender, senderNumber);
                    break;
                case '.createcode':
                    await this.handleCreateCodeCommand(parts, sender, senderNumber);
                    break;
                case '.help':
                    await this.handleHelpCommand(sender);
                    break;
                default:
                    await this.sendMessage(sender, '❓ Unknown command. Type .help for available commands.');
            }
        } catch (error) {
            this.logger.error('Error processing command:', error);
            await this.sendMessage(sender, '❌ An error occurred while processing your command.');
        }
    }

    async handleRouletteCommand(parts, sender, senderNumber) {
        if (parts.length !== 3) {
            await this.sendMessage(sender, '❌ Usage: .roulette <amount> <red/black>');
            return;
        }

        const amount = parseInt(parts[1]);
        const choice = parts[2].toLowerCase();

        if (isNaN(amount) || amount <= 0) {
            await this.sendMessage(sender, '❌ Please enter a valid bet amount.');
            return;
        }

        if (!['red', 'black'].includes(choice)) {
            await this.sendMessage(sender, '❌ Please choose either "red" or "black".');
            return;
        }

        const result = await this.gameManager.playRoulette(senderNumber, amount, choice);
        await this.sendMessage(sender, result.message);
    }

    async handleGuessCommand(parts, sender, senderNumber) {
        if (parts.length !== 2) {
            await this.sendMessage(sender, '❌ Usage: .guess <number 1-10>');
            return;
        }

        const guess = parseInt(parts[1]);
        if (isNaN(guess) || guess < 1 || guess > 10) {
            await this.sendMessage(sender, '❌ Please enter a number between 1 and 10.');
            return;
        }

        const result = await this.gameManager.playGuessGame(senderNumber, guess);
        await this.sendMessage(sender, result.message);
    }

    async handleBalanceCommand(sender, senderNumber) {
        const balance = await this.coinManager.getBalance(senderNumber);
        await this.sendMessage(sender, `💰 Your balance: ${balance} coins`);
    }

    async handleClaimCommand(parts, sender, senderNumber) {
        if (parts.length !== 2) {
            await this.sendMessage(sender, '❌ Usage: .claim <code>');
            return;
        }

        const code = parts[1];
        const result = await this.redeemManager.redeemCode(senderNumber, code);
        await this.sendMessage(sender, result.message);
    }

    async handleCreateCodeCommand(parts, sender, senderNumber) {
        // Check if user is admin
        if (!config.admins.includes(senderNumber)) {
            await this.sendMessage(sender, '❌ You are not authorized to create redeem codes.');
            return;
        }

        if (parts.length !== 4) {
            await this.sendMessage(sender, '❌ Usage: .createcode <code> <coins> <hours>');
            return;
        }

        const [, code, coins, hours] = parts;
        const coinAmount = parseInt(coins);
        const expireHours = parseInt(hours);

        if (isNaN(coinAmount) || coinAmount <= 0) {
            await this.sendMessage(sender, '❌ Please enter a valid coin amount.');
            return;
        }

        if (isNaN(expireHours) || expireHours <= 0) {
            await this.sendMessage(sender, '❌ Please enter valid expiration hours.');
            return;
        }

        const result = await this.redeemManager.createCode(code, coinAmount, expireHours);
        await this.sendMessage(sender, result.message);
    }

    async handleHelpCommand(sender) {
        const helpText = `
🎮 *WhatsApp Bot - Game Commands*

🎰 *.roulette <amount> <red/black>* - Play roulette
🎯 *.guess <number>* - Guess a number (1-10)
💰 *.balance* - Check your coin balance
🎁 *.claim <code>* - Redeem a code for coins
❓ *.help* - Show this help message

*Admin Commands:*
🔧 *.createcode <code> <coins> <hours>* - Create redeem code

*Game Rules:*
• Roulette: Win 2x your bet, lose your bet
• Guess Game: Win 50 coins if correct, lose 10 coins if wrong
• All games require coins to play
        `.trim();

        await this.sendMessage(sender, helpText);
    }

    async sendMessage(jid, text) {
        try {
            await this.sock.sendMessage(jid, { text });
        } catch (error) {
            this.logger.error('Error sending message:', error);
        }
    }
}

// Start the bot
const bot = new WhatsAppBot();
bot.start().catch(console.error);

module.exports = WhatsAppBot;