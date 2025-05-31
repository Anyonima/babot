// config/config.js
module.exports = {
    // Admin phone numbers (without @c.us)
    admins: [
        '6281234567890', // Ganti dengan nomor HP admin (format: 62xxx)
        // Tambah admin lain kalau perlu
    ],
    
    // Game settings
    games: {
        roulette: {
            minBet: 1,
            maxBet: 1000,
            multiplier: 2
        },
        guess: {
            winReward: 50,
            lossPenalty: 10,
            minNumber: 1,
            maxNumber: 10
        }
    },
    
    // Rate limiting
    rateLimits: {
        roulette: { attempts: 20, windowMinutes: 5 },
        guess: { attempts: 30, windowMinutes: 5 },
        redeem: { attempts: 10, windowMinutes: 5 }
    },
    
    // Starting balance for new users
    startingBalance: 1000,
    
    // Database settings
    database: {
        filename: './data/bot.db'
    }
};