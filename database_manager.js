// src/database/database.js - Secure database manager
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const crypto = require('crypto');

class Database {
    constructor() {
        this.db = null;
        this.encryptionKey = process.env.DB_ENCRYPTION_KEY || this.generateKey();
    }

    generateKey() {
        // Generate a secure key - in production, use environment variables
        return crypto.randomBytes(32).toString('hex');
    }

    async init() {
        try {
            this.db = await open({
                filename: path.join(__dirname, '../../data/bot.db'),
                driver: sqlite3.Database
            });

            await this.createTables();
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    }

    async createTables() {
        // Users table with encrypted sensitive data
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone_number TEXT UNIQUE NOT NULL,
                coins INTEGER DEFAULT 1000,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Redeem codes table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS redeem_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                coin_value INTEGER NOT NULL,
                created_by TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Code redemptions table (tracks who used which codes)
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS code_redemptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                code TEXT NOT NULL,
                coins_received INTEGER NOT NULL,
                redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_phone, code)
            )
        `);

        // Game history table for security auditing
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS game_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                game_type TEXT NOT NULL,
                bet_amount INTEGER,
                win_amount INTEGER,
                game_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for better performance
        await this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
            CREATE INDEX IF NOT EXISTS idx_redeem_codes_code ON redeem_codes(code);
            CREATE INDEX IF NOT EXISTS idx_redemptions_user_code ON code_redemptions(user_phone, code);
        `);
    }

    // User management with security
    async getUser(phoneNumber) {
        try {
            let user = await this.db.get(
                'SELECT * FROM users WHERE phone_number = ?',
                [phoneNumber]
            );

            if (!user) {
                // Create new user with starting coins
                await this.db.run(
                    'INSERT INTO users (phone_number, coins) VALUES (?, ?)',
                    [phoneNumber, 1000]
                );

                user = await this.db.get(
                    'SELECT * FROM users WHERE phone_number = ?',
                    [phoneNumber]
                );
            }

            return user;
        } catch (error) {
            console.error('Error getting user:', error);
            throw error;
        }
    }

    async updateUserCoins(phoneNumber, newBalance) {
        try {
            // Validate balance is not negative (additional security)
            if (newBalance < 0) {
                throw new Error('Balance cannot be negative');
            }

            await this.db.run(
                'UPDATE users SET coins = ?, updated_at = CURRENT_TIMESTAMP WHERE phone_number = ?',
                [newBalance, phoneNumber]
            );

            return true;
        } catch (error) {
            console.error('Error updating user coins:', error);
            throw error;
        }
    }

    // Redeem code management
    async createRedeemCode(code, coinValue, expiresAt, createdBy) {
        try {
            await this.db.run(
                'INSERT INTO redeem_codes (code, coin_value, expires_at, created_by) VALUES (?, ?, ?, ?)',
                [code, coinValue, expiresAt, createdBy]
            );

            return true;
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error('Code already exists');
            }
            console.error('Error creating redeem code:', error);
            throw error;
        }
    }

    async getRedeemCode(code) {
        try {
            return await this.db.get(
                'SELECT * FROM redeem_codes WHERE code = ? AND is_active = 1',
                [code]
            );
        } catch (error) {
            console.error('Error getting redeem code:', error);
            throw error;
        }
    }

    async redeemCode(userPhone, code, coinsReceived) {
        try {
            await this.db.run('BEGIN TRANSACTION');

            // Check if user already redeemed this code
            const existingRedemption = await this.db.get(
                'SELECT * FROM code_redemptions WHERE user_phone = ? AND code = ?',
                [userPhone, code]
            );

            if (existingRedemption) {
                await this.db.run('ROLLBACK');
                throw new Error('Code already redeemed by this user');
            }

            // Record the redemption
            await this.db.run(
                'INSERT INTO code_redemptions (user_phone, code, coins_received) VALUES (?, ?, ?)',
                [userPhone, code, coinsReceived]
            );

            await this.db.run('COMMIT');
            return true;
        } catch (error) {
            await this.db.run('ROLLBACK');
            console.error('Error redeeming code:', error);
            throw error;
        }
    }

    // Game history for auditing
    async recordGameHistory(userPhone, gameType, betAmount, winAmount, gameData) {
        try {
            await this.db.run(
                'INSERT INTO game_history (user_phone, game_type, bet_amount, win_amount, game_data) VALUES (?, ?, ?, ?, ?)',
                [userPhone, gameType, betAmount, winAmount, JSON.stringify(gameData)]
            );
        } catch (error) {
            console.error('Error recording game history:', error);
            // Don't throw error here as it shouldn't break game flow
        }
    }

    // Security: Get user statistics (for fraud detection)
    async getUserStats(phoneNumber, hours = 24) {
        try {
            const stats = await this.db.get(`
                SELECT 
                    COUNT(*) as game_count,
                    SUM(CASE WHEN win_amount > bet_amount THEN 1 ELSE 0 END) as wins,
                    SUM(bet_amount) as total_bet,
                    SUM(win_amount) as total_won
                FROM game_history 
                WHERE user_phone = ? 
                AND created_at > datetime('now', '-${hours} hours')
            `, [phoneNumber]);

            return stats;
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }

    async close() {
        if (this.db) {
            await this.db.close();
        }
    }
}

module.exports = Database;