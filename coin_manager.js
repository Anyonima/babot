// src/managers/coinManager.js
class CoinManager {
    constructor(database) {
        this.db = database;
    }

    async getBalance(phoneNumber) {
        try {
            const user = await this.db.getUser(phoneNumber);
            return user.coins;
        } catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }

    async updateBalance(phoneNumber, newBalance) {
        try {
            await this.db.updateUserCoins(phoneNumber, newBalance);
            return true;
        } catch (error) {
            console.error('Error updating balance:', error);
            return false;
        }
    }

    async addCoins(phoneNumber, amount) {
        try {
            const currentBalance = await this.getBalance(phoneNumber);
            const newBalance = currentBalance + amount;
            await this.updateBalance(phoneNumber, newBalance);
            return newBalance;
        } catch (error) {
            console.error('Error adding coins:', error);
            return false;
        }
    }

    async subtractCoins(phoneNumber, amount) {
        try {
            const currentBalance = await this.getBalance(phoneNumber);
            if (currentBalance < amount) {
                throw new Error('Insufficient balance');
            }
            const newBalance = currentBalance - amount;
            await this.updateBalance(phoneNumber, newBalance);
            return newBalance;
        } catch (error) {
            console.error('Error subtracting coins:', error);
            return false;
        }
    }
}

module.exports = CoinManager;