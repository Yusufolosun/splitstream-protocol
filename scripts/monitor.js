const hre = require("hardhat");

/**
 * Real-time event monitoring script for SplitStream contract
 * Usage: npx hardhat run scripts/monitor.js --network base
 * 
 * Optional flags:
 *   --events=received   - Only monitor PaymentReceived events
 *   --events=released   - Only monitor PaymentReleased events
 *   --events=all        - Monitor both event types (default)
 * 
 * Set CONTRACT_ADDRESS environment variable or edit the address below
 * Press Ctrl+C to stop monitoring and view summary statistics
 */

// ANSI color codes for colored output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',

    // Foreground colors
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    // Background colors
    bgGreen: '\x1b[42m',
    bgBlue: '\x1b[44m',
};

// Statistics tracking
const stats = {
    paymentsReceivedCount: 0,
    paymentsReleasedCount: 0,
    totalAmountReceived: 0n,
    totalAmountReleased: 0n,
    startTime: null,
    lastEventTime: null,
};

// Track if we're shutting down
let isShuttingDown = false;
let contract = null;
let provider = null;

/**
 * Format timestamp for display
 */
function formatTimestamp(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Format ETH amount for display
 */
function formatEth(wei) {
    return parseFloat(hre.ethers.formatEther(wei)).toFixed(6);
}

/**
 * Format address for display (truncated)
 */
function formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get event filter based on command line arguments
 */
function getEventFilter() {
    const args = process.argv.slice(2);
    const eventsArg = args.find(arg => arg.startsWith('--events='));

    if (!eventsArg) {
        return 'all';
    }

    const filter = eventsArg.split('=')[1].toLowerCase();
    return ['received', 'released', 'all'].includes(filter) ? filter : 'all';
}

/**
 * Display event in real-time with colored output
 */
function displayEvent(eventType, eventData, txHash, blockNumber, timestamp) {
    const now = new Date(timestamp * 1000);
    stats.lastEventTime = now;

    if (eventType === 'PaymentReceived') {
        const { sender, amount } = eventData;

        console.log(
            `${colors.green}${colors.bright}[PAYMENT RECEIVED]${colors.reset} ` +
            `${colors.gray}${formatTimestamp(now)}${colors.reset}`
        );
        console.log(
            `  ${colors.green}↓${colors.reset} ` +
            `From: ${colors.cyan}${formatAddress(sender)}${colors.reset} ` +
            `Amount: ${colors.green}${colors.bright}${formatEth(amount)} ETH${colors.reset}`
        );
        console.log(
            `  Block: ${colors.gray}#${blockNumber}${colors.reset} ` +
            `Tx: ${colors.gray}${formatAddress(txHash)}${colors.reset}`
        );
        console.log();

        stats.paymentsReceivedCount++;
        stats.totalAmountReceived += amount;

    } else if (eventType === 'PaymentReleased') {
        const { payee, amount } = eventData;

        console.log(
            `${colors.blue}${colors.bright}[PAYMENT RELEASED]${colors.reset} ` +
            `${colors.gray}${formatTimestamp(now)}${colors.reset}`
        );
        console.log(
            `  ${colors.blue}↑${colors.reset} ` +
            `To: ${colors.cyan}${formatAddress(payee)}${colors.reset} ` +
            `Amount: ${colors.blue}${colors.bright}${formatEth(amount)} ETH${colors.reset}`
        );
        console.log(
            `  Block: ${colors.gray}#${blockNumber}${colors.reset} ` +
            `Tx: ${colors.gray}${formatAddress(txHash)}${colors.reset}`
        );
        console.log();

        stats.paymentsReleasedCount++;
        stats.totalAmountReleased += amount;
    }
}

/**
 * Display summary statistics
 */
function displaySummary() {
    console.log('\n' + '═'.repeat(80));
    console.log(`${colors.bright}${colors.cyan}📊 MONITORING SUMMARY${colors.reset}`);
    console.log('═'.repeat(80) + '\n');

    const duration = stats.lastEventTime
        ? (stats.lastEventTime - stats.startTime) / 1000
        : (new Date() - stats.startTime) / 1000;

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);

    console.log(`${colors.bright}Monitoring Duration:${colors.reset} ${hours}h ${minutes}m ${seconds}s`);
    console.log(`${colors.bright}Total Events:${colors.reset}        ${stats.paymentsReceivedCount + stats.paymentsReleasedCount}\n`);

    console.log(`${colors.green}${colors.bright}Payments Received:${colors.reset}`);
    console.log(`  Count:  ${colors.green}${stats.paymentsReceivedCount}${colors.reset}`);
    console.log(`  Amount: ${colors.green}${colors.bright}${formatEth(stats.totalAmountReceived)} ETH${colors.reset}\n`);

    console.log(`${colors.blue}${colors.bright}Payments Released:${colors.reset}`);
    console.log(`  Count:  ${colors.blue}${stats.paymentsReleasedCount}${colors.reset}`);
    console.log(`  Amount: ${colors.blue}${colors.bright}${formatEth(stats.totalAmountReleased)} ETH${colors.reset}\n`);

    const netFlow = stats.totalAmountReceived - stats.totalAmountReleased;
    const netFlowColor = netFlow >= 0 ? colors.green : colors.red;

    console.log(`${colors.bright}Net Flow:${colors.reset}            ${netFlowColor}${formatEth(netFlow)} ETH${colors.reset}`);

    console.log('\n' + '═'.repeat(80) + '\n');
}

/**
 * Graceful shutdown handler
 */
async function shutdown() {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    console.log(`\n${colors.yellow}⏸️  Stopping monitor...${colors.reset}\n`);

    // Remove event listeners
    if (contract && provider) {
        try {
            await contract.removeAllListeners();
            console.log(`${colors.gray}✓ Event listeners removed${colors.reset}`);
        } catch (error) {
            // Ignore errors during shutdown
        }
    }

    // Display summary
    displaySummary();

    console.log(`${colors.green}✅ Monitoring stopped gracefully${colors.reset}\n`);
    process.exit(0);
}

/**
 * Setup event listeners with reconnection logic
 */
async function setupEventListeners(contract, eventFilter) {
    const listenToReceived = eventFilter === 'all' || eventFilter === 'received';
    const listenToReleased = eventFilter === 'all' || eventFilter === 'released';

    if (listenToReceived) {
        contract.on('PaymentReceived', async (sender, amount, event) => {
            try {
                const block = await event.getBlock();
                displayEvent('PaymentReceived', { sender, amount }, event.log.transactionHash, event.log.blockNumber, block.timestamp);
            } catch (error) {
                console.error(`${colors.red}Error processing PaymentReceived event:${colors.reset}`, error.message);
            }
        });
        console.log(`${colors.green}✓ Listening for PaymentReceived events${colors.reset}`);
    }

    if (listenToReleased) {
        contract.on('PaymentReleased', async (payee, amount, event) => {
            try {
                const block = await event.getBlock();
                displayEvent('PaymentReleased', { payee, amount }, event.log.transactionHash, event.log.blockNumber, block.timestamp);
            } catch (error) {
                console.error(`${colors.red}Error processing PaymentReleased event:${colors.reset}`, error.message);
            }
        });
        console.log(`${colors.blue}✓ Listening for PaymentReleased events${colors.reset}`);
    }
}

/**
 * Monitor connection health and reconnect if needed
 */
async function monitorConnection() {
    let missedPings = 0;
    const maxMissedPings = 3;
    const pingInterval = 15000; // 15 seconds

    const healthCheck = setInterval(async () => {
        if (isShuttingDown) {
            clearInterval(healthCheck);
            return;
        }

        try {
            await provider.getBlockNumber();
            missedPings = 0; // Reset counter on successful ping
        } catch (error) {
            missedPings++;
            console.log(`${colors.yellow}⚠️  Connection check failed (${missedPings}/${maxMissedPings})${colors.reset}`);

            if (missedPings >= maxMissedPings) {
                console.log(`${colors.red}❌ Connection lost. Attempting to reconnect...${colors.reset}`);

                try {
                    // Remove old listeners
                    await contract.removeAllListeners();

                    // Get new provider and contract instance
                    provider = hre.ethers.provider;
                    const contractAddress = contract.target || contract.address;
                    const SplitStream = await hre.ethers.getContractFactory("SplitStream");
                    contract = SplitStream.attach(contractAddress);

                    // Setup listeners again
                    const eventFilter = getEventFilter();
                    await setupEventListeners(contract, eventFilter);

                    console.log(`${colors.green}✅ Reconnected successfully${colors.reset}\n`);
                    missedPings = 0;
                } catch (reconnectError) {
                    console.error(`${colors.red}❌ Reconnection failed:${colors.reset}`, reconnectError.message);
                    console.log(`${colors.yellow}Will retry on next health check...${colors.reset}\n`);
                }
            }
        }
    }, pingInterval);
}

/**
 * Main monitoring function
 */
async function main() {
    try {
        console.log(`${colors.bright}${colors.magenta}🔔 SplitStream Event Monitor${colors.reset}\n`);
        console.log('═'.repeat(80) + '\n');

        // Get contract address
        const contractAddress = process.env.CONTRACT_ADDRESS;

        if (!contractAddress) {
            console.error(`${colors.red}❌ Error: CONTRACT_ADDRESS not set${colors.reset}`);
            console.log(`\n${colors.yellow}💡 Usage:${colors.reset}`);
            console.log('   Set CONTRACT_ADDRESS in .env file, or run:');
            console.log('   CONTRACT_ADDRESS=0x... npx hardhat run scripts/monitor.js --network base\n');
            process.exit(1);
        }

        // Validate contract address
        if (!hre.ethers.isAddress(contractAddress)) {
            console.error(`${colors.red}❌ Error: Invalid contract address format: ${contractAddress}${colors.reset}\n`);
            process.exit(1);
        }

        // Get event filter
        const eventFilter = getEventFilter();

        // Get network information
        const network = await hre.ethers.provider.getNetwork();
        provider = hre.ethers.provider;

        // Display configuration
        console.log(`${colors.bright}Configuration:${colors.reset}`);
        console.log(`  Contract:      ${colors.cyan}${contractAddress}${colors.reset}`);
        console.log(`  Network:       ${colors.cyan}${hre.network.name}${colors.reset}`);
        console.log(`  Chain ID:      ${colors.cyan}${network.chainId}${colors.reset}`);
        console.log(`  Event Filter:  ${colors.cyan}${eventFilter}${colors.reset}\n`);

        // Connect to contract
        console.log(`${colors.gray}⏳ Connecting to contract...${colors.reset}`);
        const SplitStream = await hre.ethers.getContractFactory("SplitStream");
        contract = SplitStream.attach(contractAddress);

        // Verify contract exists
        const code = await provider.getCode(contractAddress);
        if (code === "0x") {
            console.error(`${colors.red}❌ Error: No contract found at address ${contractAddress}${colors.reset}`);
            console.log('   This address may not be deployed on this network.\n');
            process.exit(1);
        }

        console.log(`${colors.green}✅ Contract connected successfully${colors.reset}\n`);

        // Setup event listeners
        await setupEventListeners(contract, eventFilter);

        console.log('\n' + '═'.repeat(80));
        console.log(`${colors.bright}${colors.green}🟢 Monitoring active${colors.reset} - Press ${colors.bright}Ctrl+C${colors.reset} to stop`);
        console.log('═'.repeat(80) + '\n');

        // Initialize stats
        stats.startTime = new Date();

        // Setup graceful shutdown handlers
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        // Monitor connection health
        monitorConnection();

        // Keep the script running
        await new Promise(() => { }); // Run indefinitely

    } catch (error) {
        console.error(`\n${colors.red}❌ Monitoring failed!${colors.reset}`);
        console.log('═'.repeat(80) + '\n');

        if (error.code === "NETWORK_ERROR") {
            console.error(`${colors.red}Network Error: Unable to connect to the network${colors.reset}`);
            console.log('Please check:');
            console.log('  - Your internet connection');
            console.log('  - RPC URL in hardhat.config.js');
            console.log('  - Network is accessible and running\n');
        } else if (error.code === "CALL_EXCEPTION") {
            console.error(`${colors.red}Contract Call Error: Unable to read from contract${colors.reset}`);
            console.log('This may indicate:');
            console.log('  - Contract is not deployed at this address');
            console.log('  - Contract interface mismatch');
            console.log('  - Network connection issues\n');
        } else {
            console.error(`${colors.red}Error:${colors.reset}`, error.message);
            if (error.stack && process.env.DEBUG) {
                console.log('\nStack trace:');
                console.error(error.stack);
            }
        }

        process.exit(1);
    }
}

// Execute the script
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
