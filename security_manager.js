// src/security/securityManager.js - Security and anti-exploitation measures
const crypto = require('crypto');

class SecurityManager {
    constructor() {
        this.maliciousPatterns = [
            // JavaScript execution patterns
            /eval\s*\(/gi,
            /function\s*\(/gi,
            /=>\s*{/gi,
            /new\s+Function/gi,
            /setTimeout\s*\(/gi,
            /setInterval\s*\(/gi,
            
            // Code injection patterns
            /require\s*\(/gi,
            /import\s+/gi,
            /process\./gi,
            /global\./gi,
            /__dirname/gi,
            /__filename/gi,
            
            // Database injection attempts
            /DROP\s+TABLE/gi,
            /DELETE\s+FROM/gi,
            /UPDATE\s+.*SET/gi,
            /INSERT\s+INTO/gi,
            /ALTER\s+TABLE/gi,
            
            // System command injection
            /exec\s*\(/gi,
            /spawn\s*\(/gi,
            /child_process/gi,
            /fs\./gi,
            /path\./gi,
            
            // Script tags and HTML injection
            /<script/gi,
            /<iframe/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            
            // Common exploitation attempts
            /\.\.\//g,
            /\/etc\/passwd/gi,
            /\/proc\/version/gi,
            /cmd\.exe/gi,
            /powershell/gi,
            
            // Prototype pollution
            /__proto__/gi,
            /constructor/gi,
            /prototype/gi
        ];

        this.rateLimitMap = new Map();
        this.suspiciousActivityMap = new Map();
    }

    containsMaliciousCode(input) {
        if (!input || typeof input !== 'string') {
            return false;
        }

        // Check against malicious patterns
        for (const pattern of this.maliciousPatterns) {
            if (pattern.test(input)) {
                console.warn(`Malicious pattern detected: ${pattern} in input: ${input}`);
                return true;
            }
        }

        // Check for excessive special characters (potential obfuscation)
        const specialCharCount = (input.match(/[^\w\s.]/g) || []).length;
        const specialCharRatio = specialCharCount / input.length;
        if (specialCharRatio > 0.3) {
            console.warn(`High special character ratio detected: ${specialCharRatio}`);
            return true;
        }

        // Check for extremely long commands (potential buffer overflow)
        if (input.length > 1000) {
            console.warn(`Extremely long input detected: ${input.length} characters`);
            return true;
        }

        return false;
    }

    validateBetAmount(amount, userBalance, minBet = 1, maxBet = 1000) {
        // Validate amount is a positive integer
        if (!Number.isInteger(amount) || amount <= 0) {
            return { valid: false, error: 'Bet amount must be a positive integer' };
        }

        // Check minimum bet
        if (amount < minBet) {
            return { valid: false, error: `Minimum bet is ${minBet} coins` };
        }

        // Check maximum bet
        if (amount > maxBet) {
            return { valid: false, error: `Maximum bet is ${maxBet} coins` };
        }

        // Check if user has sufficient balance
        if (amount > userBalance) {
            return { valid: false, error: 'Insufficient balance' };
        }

        return { valid: true };
    }

    validateGuessNumber(guess) {
        if (!Number.isInteger(guess) || guess < 1 || guess > 10) {
            return { valid: false, error: 'Guess must be a number between 1 and 10' };
        }
        return { valid: true };
    }

    validateRedeemCode(code) {
        if (!code || typeof code !== 'string') {
            return { valid: false, error: 'Invalid code format' };
        }

        // Check code length (prevent extremely long codes)
        if (code.length > 50) {
            return { valid: false, error: 'Code too long' };
        }

        // Check for malicious patterns in code
        if (this.containsMaliciousCode(code)) {
            return { valid: false, error: 'Invalid code format' };
        }

        // Allow only alphanumeric characters and common symbols
        if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
            return { valid: false, error: 'Code contains invalid characters' };
        }

        return { valid: true };
    }

    // Rate limiting to prevent spam and abuse
    checkRateLimit(userPhone, action, maxAttempts = 10, windowMinutes = 5) {
        const key = `${userPhone}:${action}`;
        const now = Date.now();
        const windowMs = windowMinutes * 60 * 1000;

        if (!this.rateLimitMap.has(key)) {
            this.rateLimitMap.set(key, []);
        }

        const attempts = this.rateLimitMap.get(key);
        
        // Remove old attempts outside the window
        const validAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
        this.rateLimitMap.set(key, validAttempts);

        // Check if user exceeded rate limit
        if (validAttempts.length >= maxAttempts) {
            return { 
                allowed: false, 
                error: `Too many ${action} attempts. Please wait ${windowMinutes} minutes.` 
            };
        }

        // Add current attempt
        validAttempts.push(now);
        this.rateLimitMap.set(key, validAttempts);

        return { allowed: true };
    }

    // Track suspicious activity
    trackSuspiciousActivity(userPhone, activity) {
        const key = userPhone;
        
        if (!this.suspiciousActivityMap.has(key)) {
            this.suspiciousActivityMap.set(key, []);
        }

        const activities = this.suspiciousActivityMap.get(key);
        activities.push({
            activity,
            timestamp: Date.now()
        });

        // Keep only recent activities (last 24 hours)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentActivities = activities.filter(a => a.timestamp > oneDayAgo);
        this.suspiciousActivityMap.set(key, recentActivities);

        // Check if user has too many suspicious activities
        if (recentActivities.length > 5) {
            console.warn(`User ${userPhone} has ${recentActivities.length} suspicious activities in 24h`);
            return true;
        }

        return false;
    }

    // Generate secure random numbers for games
    generateSecureRandom(min, max) {
        const range = max - min + 1;
        const randomBytes = crypto.randomBytes(4);
        const randomValue = randomBytes.readUInt32BE(0);
        return min + (randomValue % range);
    }

    // Generate secure random for roulette (true/false for red/black)
    generateSecureRouletteResult() {
        const randomByte = crypto.randomBytes(1)[0];
        return randomByte % 2 === 0 ? 'red' : 'black';
    }

    // Sanitize input strings
    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return '';
        }

        return input
            .trim()
            .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
            .substring(0, 100); // Limit length
    }

    // Validate phone number format
    validatePhoneNumber(phoneNumber) {
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            return false;
        }

        // Basic phone number validation (adjust regex as needed)
        const phoneRegex = /^\d{10,15}$/;
        return phoneRegex.test(phoneNumber);
    }

    // Check if timestamp is recent (for code expiration)
    isRecentTimestamp(timestamp, maxAgeHours = 24) {
        const now = new Date();
        const timestampDate = new Date(timestamp);
        const diffHours = (now - timestampDate) / (1000 * 60 * 60);
        
        return diffHours <= maxAgeHours;
    }

    // Clean up old rate limit data
    cleanupRateLimits() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);

        for (const [key, attempts] of this.rateLimitMap.entries()) {
            const validAttempts = attempts.filter(timestamp => timestamp > oneHourAgo);
            
            if (validAttempts.length === 0) {
                this.rateLimitMap.delete(key);
            } else {
                this.rateLimitMap.set(key, validAttempts);
            }
        }
    }
}

module.exports = SecurityManager;