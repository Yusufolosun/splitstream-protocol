/**
 * SplitStream Node.js Backend Integration Example
 * 
 * This is a production-ready Node.js backend service demonstrating how to
 * integrate with the SplitStream payment splitter contract for:
 * 
 * - Real-time event monitoring
 * - Automated payment releases
 * - Payment history tracking
 * - Webhook notifications
 * - Analytics and reporting
 * 
 * DEPENDENCIES:
 * ```bash
 * npm install ethers@^6.10.0 dotenv winston node-cron axios
 * npm install --save-dev @types/node
 * ```
 * 
 * SETUP:
 * 
 * 1. Create a `.env` file in your project root:
 * 
 * ```env
 * # Network Configuration
 * BASE_RPC_URL=https://mainnet.base.org
 * CHAIN_ID=8453
 * 
 * # Contract Configuration
 * SPLITSTREAM_CONTRACT_ADDRESS=0xYourContractAddress
 * 
 * # Private Key for Automated Releases (Optional - only if automating releases)
 * PRIVATE_KEY=0xYourPrivateKey
 * 
 * # Webhook Configuration
 * WEBHOOK_URL=https://your-app.com/api/webhooks/payment
 * WEBHOOK_SECRET=your-webhook-secret
 * 
 * # Database Configuration (example - adjust for your DB)
 * DATABASE_URL=postgresql://user:pass@localhost:5432/splitstream
 * 
 * # Monitoring Configuration
 * POLL_INTERVAL_MS=5000
 * AUTO_RELEASE_ENABLED=false
 * AUTO_RELEASE_SCHEDULE=0 0 * * *
 * 
 * # Logging
 * LOG_LEVEL=info
 * LOG_FILE=splitstream-monitor.log
 * ```
 * 
 * 2. Place your `SplitStream.json` ABI file in the same directory
 * 
 * 3. Run the service:
 * ```bash
 * node nodejs-backend.js
 * ```
 * 
 * PRODUCTION DEPLOYMENT:
 * 
 * Use PM2 for process management:
 * ```bash
 * npm install -g pm2
 * pm2 start nodejs-backend.js --name splitstream-monitor
 * pm2 save
 * pm2 startup
 * ```
 */

require('dotenv').config();
const { ethers } = require('ethers');
const winston = require('winston');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Network
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    chainId: parseInt(process.env.CHAIN_ID || '8453'),

    // Contract
    contractAddress: process.env.SPLITSTREAM_CONTRACT_ADDRESS,

    // Keys (optional - only for automated releases)
    privateKey: process.env.PRIVATE_KEY,

    // Webhooks
    webhookUrl: process.env.WEBHOOK_URL,
    webhookSecret: process.env.WEBHOOK_SECRET,

    // Monitoring
    pollInterval: parseInt(process.env.POLL_INTERVAL_MS || '5000'),

    // Auto-release (cron format: minute hour day month weekday)
    autoReleaseEnabled: process.env.AUTO_RELEASE_ENABLED === 'true',
    autoReleaseSchedule: process.env.AUTO_RELEASE_SCHEDULE || '0 0 * * *', // Daily at midnight

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    logFile: process.env.LOG_FILE || 'splitstream-monitor.log',
};

// ============================================================================
// LOGGING SETUP
// ============================================================================

const logger = winston.createLogger({
    level: CONFIG.logLevel,
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'splitstream-monitor' },
    transports: [
        // Write all logs to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(
                    info => `${info.timestamp} ${info.level}: ${info.message}`
                )
            )
        }),
        // Write all logs to file
        new winston.transports.File({
            filename: CONFIG.logFile,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Write errors to separate file
        new winston.transports.File({
            filename: 'error.log',
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
        })
    ]
});

// ============================================================================
// CONTRACT SETUP
// ============================================================================

// Load contract ABI
let contractABI;
try {
    const abiPath = path.join(__dirname, 'SplitStream.json');
    if (fs.existsSync(abiPath)) {
        const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        contractABI = artifact.abi;
    } else {
        // Minimal ABI if file not found
        contractABI = [
            "function totalShares() view returns (uint256)",
            "function totalReleased() view returns (uint256)",
            "function shares(address account) view returns (uint256)",
            "function released(address account) view returns (uint256)",
            "function releasable(address account) view returns (uint256)",
            "function payee(uint256 index) view returns (address)",
            "function payeeCount() view returns (uint256)",
            "function release(address account) nonpayable",
            "event PaymentReceived(address indexed from, uint256 amount)",
            "event PaymentReleased(address indexed to, uint256 amount)"
        ];
        logger.warn('SplitStream.json not found, using minimal ABI');
    }
} catch (error) {
    logger.error('Failed to load contract ABI:', error);
    process.exit(1);
}

// Setup provider and contract
const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
const contract = new ethers.Contract(
    CONFIG.contractAddress,
    contractABI,
    provider
);

// Setup signer for write operations (if private key provided)
let signer;
let contractWithSigner;
if (CONFIG.privateKey) {
    signer = new ethers.Wallet(CONFIG.privateKey, provider);
    contractWithSigner = contract.connect(signer);
    logger.info('Signer configured for automated operations');
} else {
    logger.warn('No private key provided - automated releases disabled');
}

// ============================================================================
// DATABASE MOCK (Replace with your actual database)
// ============================================================================

/**
 * Mock Database Storage
 * In production, replace with actual database (PostgreSQL, MongoDB, etc.)
 */
class PaymentDatabase {
    constructor() {
        this.dbFile = 'payment-history.json';
        this.data = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.dbFile)) {
                return JSON.parse(fs.readFileSync(this.dbFile, 'utf8'));
            }
        } catch (error) {
            logger.error('Failed to load database:', error);
        }
        return {
            payments: [],
            releases: [],
            lastProcessedBlock: 0
        };
    }

    save() {
        try {
            fs.writeFileSync(this.dbFile, JSON.stringify(this.data, null, 2));
        } catch (error) {
            logger.error('Failed to save database:', error);
        }
    }

    async addPaymentReceived(event) {
        const payment = {
            id: `${event.transactionHash}-${event.logIndex}`,
            from: event.args.from,
            amount: event.args.amount.toString(),
            amountEth: ethers.formatEther(event.args.amount),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: new Date().toISOString(),
        };

        // Check for duplicates
        const exists = this.data.payments.some(p => p.id === payment.id);
        if (!exists) {
            this.data.payments.push(payment);
            this.save();
            logger.info(`Payment recorded: ${payment.amountEth} ETH from ${payment.from}`);
            return payment;
        }
        return null;
    }

    async addPaymentReleased(event) {
        const release = {
            id: `${event.transactionHash}-${event.logIndex}`,
            to: event.args.to,
            amount: event.args.amount.toString(),
            amountEth: ethers.formatEther(event.args.amount),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: new Date().toISOString(),
        };

        const exists = this.data.releases.some(r => r.id === release.id);
        if (!exists) {
            this.data.releases.push(release);
            this.save();
            logger.info(`Release recorded: ${release.amountEth} ETH to ${release.to}`);
            return release;
        }
        return null;
    }

    updateLastProcessedBlock(blockNumber) {
        if (blockNumber > this.data.lastProcessedBlock) {
            this.data.lastProcessedBlock = blockNumber;
            this.save();
        }
    }

    getStats() {
        const totalReceived = this.data.payments.reduce(
            (sum, p) => sum + parseFloat(p.amountEth),
            0
        );
        const totalReleased = this.data.releases.reduce(
            (sum, r) => sum + parseFloat(r.amountEth),
            0
        );

        return {
            totalPayments: this.data.payments.length,
            totalReleases: this.data.releases.length,
            totalReceived: totalReceived.toFixed(4),
            totalReleased: totalReleased.toFixed(4),
            lastProcessedBlock: this.data.lastProcessedBlock,
        };
    }

    getRecentActivity(limit = 10) {
        const combined = [
            ...this.data.payments.map(p => ({ ...p, type: 'received' })),
            ...this.data.releases.map(r => ({ ...r, type: 'released' }))
        ];

        combined.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        return combined.slice(0, limit);
    }
}

const db = new PaymentDatabase();

// ============================================================================
// WEBHOOK NOTIFICATIONS
// ============================================================================

/**
 * Send webhook notification
 */
async function sendWebhook(eventType, data) {
    if (!CONFIG.webhookUrl) {
        logger.debug('Webhook URL not configured, skipping notification');
        return;
    }

    try {
        const payload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            data,
            signature: generateWebhookSignature(data), // HMAC signature for security
        };

        const response = await axios.post(CONFIG.webhookUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Secret': CONFIG.webhookSecret,
            },
            timeout: 5000,
        });

        logger.info(`Webhook sent: ${eventType}`, { status: response.status });
    } catch (error) {
        logger.error(`Webhook failed: ${eventType}`, {
            error: error.message,
            url: CONFIG.webhookUrl
        });
    }
}

/**
 * Generate HMAC signature for webhook security
 */
function generateWebhookSignature(data) {
    if (!CONFIG.webhookSecret) return null;

    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', CONFIG.webhookSecret);
    hmac.update(JSON.stringify(data));
    return hmac.digest('hex');
}

// ============================================================================
// EVENT MONITORING
// ============================================================================

/**
 * Monitor PaymentReceived events
 */
function monitorPaymentReceived() {
    contract.on('PaymentReceived', async (from, amount, event) => {
        try {
            logger.info(`🔔 Payment received: ${ethers.formatEther(amount)} ETH from ${from}`);

            // Store in database
            const payment = await db.addPaymentReceived(event);

            if (payment) {
                // Send webhook notification
                await sendWebhook('payment.received', {
                    from,
                    amount: ethers.formatEther(amount),
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                });
            }

            db.updateLastProcessedBlock(event.blockNumber);
        } catch (error) {
            logger.error('Error processing PaymentReceived event:', error);
        }
    });

    logger.info('✅ Monitoring PaymentReceived events');
}

/**
 * Monitor PaymentReleased events
 */
function monitorPaymentReleased() {
    contract.on('PaymentReleased', async (to, amount, event) => {
        try {
            logger.info(`📤 Payment released: ${ethers.formatEther(amount)} ETH to ${to}`);

            // Store in database
            const release = await db.addPaymentReleased(event);

            if (release) {
                // Send webhook notification
                await sendWebhook('payment.released', {
                    to,
                    amount: ethers.formatEther(amount),
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                });
            }

            db.updateLastProcessedBlock(event.blockNumber);
        } catch (error) {
            logger.error('Error processing PaymentReleased event:', error);
        }
    });

    logger.info('✅ Monitoring PaymentReleased events');
}

/**
 * Fetch historical events on startup
 */
async function fetchHistoricalEvents() {
    try {
        logger.info('Fetching historical events...');

        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(
            db.data.lastProcessedBlock + 1,
            currentBlock - 10000 // Last ~10k blocks (adjust as needed)
        );

        logger.info(`Scanning blocks ${fromBlock} to ${currentBlock}`);

        // Fetch PaymentReceived events
        const receivedFilter = contract.filters.PaymentReceived();
        const receivedEvents = await contract.queryFilter(receivedFilter, fromBlock, currentBlock);

        for (const event of receivedEvents) {
            await db.addPaymentReceived(event);
        }

        // Fetch PaymentReleased events
        const releasedFilter = contract.filters.PaymentReleased();
        const releasedEvents = await contract.queryFilter(releasedFilter, fromBlock, currentBlock);

        for (const event of releasedEvents) {
            await db.addPaymentReleased(event);
        }

        db.updateLastProcessedBlock(currentBlock);

        logger.info(`Historical sync complete: ${receivedEvents.length} received, ${releasedEvents.length} released`);
    } catch (error) {
        logger.error('Failed to fetch historical events:', error);
    }
}

// ============================================================================
// AUTOMATED PAYMENT RELEASE
// ============================================================================

/**
 * Automatically release payments for all payees
 */
async function autoReleasePayments() {
    if (!contractWithSigner) {
        logger.error('Cannot auto-release: No signer configured');
        return;
    }

    logger.info('🤖 Starting automated payment release...');

    try {
        const payeeCount = await contract.payeeCount();
        logger.info(`Found ${payeeCount} payees`);

        let releasedCount = 0;
        let totalReleased = 0n;

        for (let i = 0; i < payeeCount; i++) {
            const payeeAddress = await contract.payee(i);
            const releasable = await contract.releasable(payeeAddress);

            if (releasable > 0n) {
                try {
                    logger.info(`Releasing ${ethers.formatEther(releasable)} ETH to ${payeeAddress}...`);

                    const tx = await contractWithSigner.release(payeeAddress, {
                        gasLimit: 200000, // Set appropriate gas limit
                    });

                    logger.info(`Transaction sent: ${tx.hash}`);

                    const receipt = await tx.wait();
                    logger.info(`✅ Released successfully. Gas used: ${receipt.gasUsed}`);

                    releasedCount++;
                    totalReleased += releasable;

                    // Small delay between releases to avoid nonce issues
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    logger.error(`Failed to release for ${payeeAddress}:`, error.message);
                }
            } else {
                logger.debug(`No payment due for ${payeeAddress}`);
            }
        }

        logger.info(`✅ Auto-release complete: ${releasedCount} payments totaling ${ethers.formatEther(totalReleased)} ETH`);

        // Send summary webhook
        if (releasedCount > 0) {
            await sendWebhook('auto.release.complete', {
                releasedCount,
                totalAmount: ethers.formatEther(totalReleased),
                timestamp: new Date().toISOString(),
            });
        }
    } catch (error) {
        logger.error('Auto-release failed:', error);
    }
}

/**
 * Schedule automated releases using cron
 */
function scheduleAutoRelease() {
    if (!CONFIG.autoReleaseEnabled) {
        logger.info('Automated releases disabled in config');
        return;
    }

    if (!contractWithSigner) {
        logger.error('Cannot schedule auto-release: No signer configured');
        return;
    }

    logger.info(`⏰ Scheduling auto-release: ${CONFIG.autoReleaseSchedule}`);

    cron.schedule(CONFIG.autoReleaseSchedule, async () => {
        logger.info('⏰ Cron triggered: Starting scheduled payment release');
        await autoReleasePayments();
    });

    logger.info('✅ Auto-release scheduler active');
}

// ============================================================================
// REPORTING & ANALYTICS
// ============================================================================

/**
 * Generate payment report
 */
async function generateReport() {
    logger.info('📊 Generating payment report...');

    try {
        // Get on-chain data
        const contractBalance = await provider.getBalance(CONFIG.contractAddress);
        const totalShares = await contract.totalShares();
        const totalReleased = await contract.totalReleased();
        const payeeCount = await contract.payeeCount();

        // Get database stats
        const dbStats = db.getStats();

        // Build payee breakdown
        const payees = [];
        for (let i = 0; i < payeeCount; i++) {
            const address = await contract.payee(i);
            const shares = await contract.shares(address);
            const released = await contract.released(address);
            const releasable = await contract.releasable(address);

            payees.push({
                address,
                shares: shares.toString(),
                percentage: Number((shares * 100n) / totalShares),
                released: ethers.formatEther(released),
                releasable: ethers.formatEther(releasable),
            });
        }

        const report = {
            generatedAt: new Date().toISOString(),
            contract: {
                address: CONFIG.contractAddress,
                balance: ethers.formatEther(contractBalance),
                totalShares: totalShares.toString(),
                totalReleased: ethers.formatEther(totalReleased),
                totalReceived: ethers.formatEther(contractBalance + totalReleased),
            },
            database: dbStats,
            payees,
            recentActivity: db.getRecentActivity(20),
        };

        // Save report to file
        const reportFile = `report-${Date.now()}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        logger.info(`✅ Report saved: ${reportFile}`);

        return report;
    } catch (error) {
        logger.error('Failed to generate report:', error);
        throw error;
    }
}

/**
 * Schedule daily reports
 */
function scheduleDailyReport() {
    // Generate report daily at 9 AM
    cron.schedule('0 9 * * *', async () => {
        logger.info('⏰ Generating daily report...');
        try {
            const report = await generateReport();

            // Optionally send report via webhook or email
            await sendWebhook('daily.report', {
                summary: report.contract,
                stats: report.database,
            });
        } catch (error) {
            logger.error('Daily report failed:', error);
        }
    });

    logger.info('✅ Daily report scheduler active (9 AM)');
}

// ============================================================================
// HEALTH MONITORING
// ============================================================================

/**
 * Health check - verify connection to network and contract
 */
async function healthCheck() {
    try {
        const blockNumber = await provider.getBlockNumber();
        const balance = await provider.getBalance(CONFIG.contractAddress);

        logger.info('💚 Health check passed', {
            blockNumber,
            contractBalance: ethers.formatEther(balance),
        });

        return true;
    } catch (error) {
        logger.error('❌ Health check failed:', error);
        return false;
    }
}

/**
 * Periodic health checks
 */
function startHealthMonitoring() {
    // Check every 5 minutes
    setInterval(async () => {
        const healthy = await healthCheck();

        if (!healthy) {
            logger.error('Service unhealthy - consider alerting or restarting');
            // In production: send alert, trigger restart, etc.
        }
    }, 5 * 60 * 1000);

    logger.info('✅ Health monitoring active (5 min intervals)');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get current contract status
 */
async function getContractStatus() {
    const balance = await provider.getBalance(CONFIG.contractAddress);
    const totalShares = await contract.totalShares();
    const totalReleased = await contract.totalReleased();
    const payeeCount = await contract.payeeCount();

    return {
        balance: ethers.formatEther(balance),
        totalShares: totalShares.toString(),
        totalReleased: ethers.formatEther(totalReleased),
        payeeCount: payeeCount.toString(),
        totalReceived: ethers.formatEther(balance + totalReleased),
    };
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        logger.info(`${signal} received, shutting down gracefully...`);

        // Stop listening to events
        contract.removeAllListeners();

        // Save any pending data
        db.save();

        logger.info('✅ Shutdown complete');
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

/**
 * Main service initialization
 */
async function main() {
    logger.info('🚀 Starting SplitStream Monitor Service...');
    logger.info(`Network: ${CONFIG.rpcUrl}`);
    logger.info(`Contract: ${CONFIG.contractAddress}`);

    try {
        // Verify configuration
        if (!CONFIG.contractAddress) {
            throw new Error('SPLITSTREAM_CONTRACT_ADDRESS not configured');
        }

        // Initial health check
        const healthy = await healthCheck();
        if (!healthy) {
            throw new Error('Initial health check failed');
        }

        // Display initial contract status
        const status = await getContractStatus();
        logger.info('📊 Initial Contract Status:', status);

        // Fetch historical events
        await fetchHistoricalEvents();

        // Start event monitoring
        monitorPaymentReceived();
        monitorPaymentReleased();

        // Schedule automated tasks
        scheduleAutoRelease();
        scheduleDailyReport();

        // Start health monitoring
        startHealthMonitoring();

        // Setup graceful shutdown
        setupGracefulShutdown();

        // Display database stats
        const stats = db.getStats();
        logger.info('📊 Database Stats:', stats);

        logger.info('✅ SplitStream Monitor Service running');
        logger.info('Press Ctrl+C to stop');

        // Keep process alive
        process.stdin.resume();
    } catch (error) {
        logger.error('❌ Service initialization failed:', error);
        process.exit(1);
    }
}

// ============================================================================
// COMMAND LINE INTERFACE
// ============================================================================

/**
 * CLI for manual operations
 */
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'start':
            // Start the monitoring service
            main();
            break;

        case 'report':
            // Generate a one-time report
            generateReport()
                .then(report => {
                    console.log(JSON.stringify(report, null, 2));
                    process.exit(0);
                })
                .catch(error => {
                    logger.error('Report failed:', error);
                    process.exit(1);
                });
            break;

        case 'release':
            // Manual release for all payees
            autoReleasePayments()
                .then(() => process.exit(0))
                .catch(error => {
                    logger.error('Release failed:', error);
                    process.exit(1);
                });
            break;

        case 'status':
            // Get current status
            getContractStatus()
                .then(status => {
                    console.log('Contract Status:');
                    console.log(JSON.stringify(status, null, 2));
                    console.log('\nDatabase Stats:');
                    console.log(JSON.stringify(db.getStats(), null, 2));
                    process.exit(0);
                })
                .catch(error => {
                    logger.error('Status check failed:', error);
                    process.exit(1);
                });
            break;

        default:
            // Default: start monitoring service
            console.log('SplitStream Node.js Backend Service\n');
            console.log('Usage:');
            console.log('  node nodejs-backend.js [command]\n');
            console.log('Commands:');
            console.log('  start    - Start monitoring service (default)');
            console.log('  report   - Generate payment report');
            console.log('  release  - Manually release all payments');
            console.log('  status   - Show current contract status');
            console.log('');

            if (!command) {
                main();
            } else {
                process.exit(1);
            }
    }
}

// ============================================================================
// EXPORTS (for use as a module)
// ============================================================================

module.exports = {
    CONFIG,
    logger,
    contract,
    db,
    getContractStatus,
    generateReport,
    autoReleasePayments,
    sendWebhook,
};

/**
 * PRODUCTION DEPLOYMENT CHECKLIST:
 * 
 * ✅ Environment Variables
 *    - Set all required env vars in .env
 *    - Use strong webhook secret
 *    - Secure private key storage (use AWS Secrets Manager, etc.)
 * 
 * ✅ Database
 *    - Replace PaymentDatabase with real database
 *    - Add database connection pooling
 *    - Implement proper error handling and retries
 * 
 * ✅ Monitoring
 *    - Set up application monitoring (DataDog, New Relic, etc.)
 *    - Configure alerts for errors and service downtime
 *    - Monitor RPC rate limits
 * 
 * ✅ Security
 *    - Validate webhook signatures on receiving end
 *    - Use HTTPS for all webhook URLs
 *    - Rotate keys regularly
 *    - Implement rate limiting
 * 
 * ✅ Reliability
 *    - Use PM2 or similar for process management
 *    - Implement circuit breakers for external calls
 *    - Add retry logic with exponential backoff
 *    - Set up log rotation
 * 
 * ✅ Performance
 *    - Optimize database queries
 *    - Cache frequently accessed data
 *    - Use connection pooling for RPC calls
 *    - Consider using WebSocket provider for events
 * 
 * ✅ Testing
 *    - Test on testnet first
 *    - Load test webhook endpoints
 *    - Test graceful shutdown and restart
 *    - Verify cron schedules are correct for your timezone
 */
