// src/managers/redeemManager.js
const SecurityManager = require('../security/securityManager');

class RedeemManager {
    constructor(database) {
        this.db = database;
        this.security = new SecurityManager();
    }

    async createCode(code, coinValue, expiresInHours) {
        try {
            // Validate code format
            const validation = this.security.validateRedeemCode(code);
            if (!validation.valid) {
                return { success: false, message: `❌ ${validation.error}` };
            }

            // Calculate expiration date
            const expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000));

            await this.db.createRedeemCode(code, coinValue, expiresAt, 'admin');

            return {
                success: true,
                message: `✅ Redeem code created successfully!\n\n` +
                        `Code: ${code}\n` +
                        `Value: ${coinValue} coins\n` +
                        `Expires: ${expiresAt.toLocaleString()}`
            };
        } catch (error) {
            if (error.message.includes('Code already exists')) {
                return { success: false, message: '❌ Code already exists! Please use a different code.' };
            }
            console.error('Error creating redeem code:', error);
            return { success: false, message: '❌ Failed to create redeem code' };
        }
    }

    async redeemCode(userPhone, code) {
        try {
            // Validate code format
            const validation = this.security.validateRedeemCode(code);
            if (!validation.valid) {
                return { success: false, message: `❌ ${validation.error}` };
            }

            // Get redeem code from database
            const redeemCode = await this.db.getRedeemCode(code);
            if (!redeemCode) {
                return { success: false, message: '❌ Invalid or expired code' };
            }

            // Check if code is expired
            const now = new Date();
            const expiresAt = new Date(redeemCode.expires_at);
            if (now > expiresAt) {
                return { success: false, message: '❌ Code has expired' };
            }

            // Check if user already redeemed this code
            const existingRedemption = await this.db.db.get(
                'SELECT * FROM code_redemptions WHERE user_phone = ? AND code = ?',
                [userPhone, code]
            );

            if (existingRedemption) {
                return { success: false, message: '❌ You have already redeemed this code' };
            }

            // Redeem the code
            await this.db.redeemCode(userPhone, code, redeemCode.coin_value);

            // Add coins to user balance
            const user = await this.db.getUser(userPhone);
            const newBalance = user.coins + redeemCode.coin_value;
            await this.db.updateUserCoins(userPhone, newBalance);

            return {
                success: true,
                message: `🎉 Code redeemed successfully!\n\n` +
                        `+${redeemCode.coin_value} coins\n` +
                        `💰 New balance: ${newBalance} coins`
            };

        } catch (error) {
            console.error('Error redeeming code:', error);
            return { success: false, message: '❌ Failed to redeem code' };
        }
    }
}

module.exports = RedeemManager;