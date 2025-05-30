// src/games/gameManager.js - Secure game logic with fair randomness
const SecurityManager = require('../security/securityManager');
const CoinManager = require('../managers/coinManager');

class GameManager {
    constructor(database) {
        this.db = database;
        this.security = new SecurityManager();
        this.coinManager = new CoinManager(database);
    }

    async playRoulette(userPhone, betAmount, choice) {
        try {
            // Security validations
            const rateLimit = this.security.checkRateLimit(userPhone, 'roulette', 20, 5);
            if (!rateLimit.allowed) {
                return { success: false, message: rateLimit.error };
            }

            // Get user balance
            const currentBalance = await this.coinManager.getBalance(userPhone);
            
            // Validate bet amount
            const betValidation = this.security.validateBetAmount(betAmount, currentBalance, 1, 1000);
            if (!betValidation.valid) {
                return { success: false, message: `❌ ${betValidation.error}` };
            }

            // Validate choice
            if (!['red', 'black'].includes(choice.toLowerCase())) {
                return { success: false, message: '❌ Please choose either "red" or "black"' };
            }

            // Generate secure random result
            const result = this.security.generateSecureRouletteResult();
            const won = result === choice.toLowerCase();
            
            // Calculate winnings
            let newBalance;
            let winAmount = 0;
            
            if (won) {
                winAmount = betAmount * 2; // 2x multiplier for winning
                newBalance = currentBalance + betAmount; // Net gain is bet amount (2x - 1x bet)
            } else {
                newBalance = currentBalance - betAmount;
                winAmount = 0;
            }

            // Update balance
            await this.coinManager.updateBalance(userPhone, newBalance);

            // Record game history for auditing
            await this.db.recordGameHistory(userPhone, 'roulette', betAmount, winAmount, {
                choice: choice.toLowerCase(),
                result: result,
                won: won
            });

            // Create response message
            const resultEmoji = result === 'red' ? '🔴' : '⚫';
            const statusEmoji = won ? '🎉' : '💸';
            
            const message = `🎰 *Roulette Result*\n\n` +
                          `Your choice: ${choice.toLowerCase() === 'red' ? '🔴' : '⚫'} ${choice}\n` +
                          `Result: ${resultEmoji} ${result}\n\n` +
                          `${statusEmoji} ${won ? 'You won!' : 'You lost!'}\n` +
                          `${won ? `+${betAmount}` : `-${betAmount}`} coins\n\n` +
                          `💰 New balance: ${newBalance} coins`;

            return { success: true, message, won, newBalance };

        } catch (error) {
            console.error('Roulette game error:', error);
            return { success: false, message: '❌ An error occurred while playing roulette' };
        }
    }

    async playGuessGame(userPhone, guess) {
        try {
            // Security validations
            const rateLimit = this.security.checkRateLimit(userPhone, 'guess', 30, 5);
            if (!rateLimit.allowed) {
                return { success: false, message: rateLimit.error };
            }

            // Validate guess
            const guessValidation = this.security.validateGuessNumber(guess);
            if (!guessValidation.valid) {
                return { success: false, message: `❌ ${guessValidation.error}` };
            }

            // Get user balance
            const currentBalance = await this.coinManager.getBalance(userPhone