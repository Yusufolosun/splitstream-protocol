#!/usr/bin/env node

/**
 * SplitStream CLI Tool
 * 
 * A professional command-line interface for managing SplitStream payment splitter contracts.
 * 
 * INSTALLATION:
 * 
 * ```bash
 * # Install dependencies
 * npm install commander chalk inquirer ora cli-table3 csv-writer ethers dotenv
 * 
 * # Make executable (Unix/Mac)
 * chmod +x cli-tool.js
 * 
 * # Create symlink (optional - allows running as 'splitstream' globally)
 * npm link
 * # OR
 * ln -s $(pwd)/cli-tool.js /usr/local/bin/splitstream
 * ```
 * 
 * SETUP:
 * 
 * 1. Create `.splitstream.json` in your home directory or project root:
 * 
 * ```json
 * {
 *   "networks": {
 *     "base": {
 *       "rpc": "https://mainnet.base.org",
 *       "chainId": 8453,
 *       "explorer": "https://basescan.org"
 *     },
 *     "base-sepolia": {
 *       "rpc": "https://sepolia.base.org",
 *       "chainId": 84532,
 *       "explorer": "https://sepolia.basescan.org"
 *     }
 *   },
 *   "contracts": {
 *     "production": "0xYourProductionContractAddress",
 *     "staging": "0xYourStagingContractAddress"
 *   },
 *   "defaultNetwork": "base-sepolia"
 * }
 * ```
 * 
 * 2. Create `.env` file with your private key (for transactions):
 * 
 * ```env
 * PRIVATE_KEY=0xYourPrivateKey
 * ```
 * 
 * USAGE:
 * 
 * ```bash
 * # Show help
 * node cli-tool.js --help
 * 
 * # Deploy new contract
 * node cli-tool.js deploy --network base-sepolia \
 *   --payees "0x123,0x456" --shares "50,50"
 * 
 * # Get contract info
 * node cli-tool.js info 0xContractAddress --network base
 * 
 * # Check balances
 * node cli-tool.js balance 0xContractAddress --network base
 * 
 * # Send payment
 * node cli-tool.js send 0xContractAddress --amount 0.1 --network base
 * 
 * # Release payment
 * node cli-tool.js release 0xContractAddress 0xPayeeAddress --network base
 * 
 * # View history
 * node cli-tool.js history 0xContractAddress --network base --limit 20
 * 
 * # Export data
 * node cli-tool.js export 0xContractAddress --format csv --output payments.csv
 * ```
 * 
 * If you set up package.json with:
 * ```json
 * {
 *   "name": "splitstream-cli",
 *   "version": "1.0.0",
 *   "bin": {
 *     "splitstream": "./cli-tool.js"
 *   }
 * }
 * ```
 * 
 * Then after `npm link`, you can use:
 * ```bash
 * splitstream info 0xContractAddress
 * splitstream balance 0xContractAddress
 * ```
 */

require('dotenv').config();
const { program } = require('commander');
const { ethers } = require('ethers');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Load configuration from .splitstream.json
 */
function loadConfig() {
    const configPaths = [
        path.join(process.cwd(), '.splitstream.json'),
        path.join(require('os').homedir(), '.splitstream.json'),
    ];

    for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                console.log(chalk.dim(`Loaded config from: ${configPath}`));
                return config;
            } catch (error) {
                console.error(chalk.yellow(`Warning: Failed to load ${configPath}`));
            }
        }
    }

    // Default configuration
    return {
        networks: {
            'base': {
                rpc: 'https://mainnet.base.org',
                chainId: 8453,
                explorer: 'https://basescan.org'
            },
            'base-sepolia': {
                rpc: 'https://sepolia.base.org',
                chainId: 84532,
                explorer: 'https://sepolia.basescan.org'
            }
        },
        contracts: {},
        defaultNetwork: 'base-sepolia'
    };
}

const config = loadConfig();

/**
 * Contract ABI (minimal for CLI operations)
 */
const CONTRACT_ABI = [
    "constructor(address[] memory payees, uint256[] memory shares_)",
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get provider for network
 */
function getProvider(networkName) {
    const network = config.networks[networkName];
    if (!network) {
        throw new Error(
            `Unknown network: ${networkName}. Available: ${Object.keys(config.networks).join(', ')}`
        );
    }
    return new ethers.JsonRpcProvider(network.rpc);
}

/**
 * Get signer (requires private key in env)
 */
function getSigner(networkName) {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error(
            'PRIVATE_KEY not found in environment. Please set it in .env file.'
        );
    }

    const provider = getProvider(networkName);
    return new ethers.Wallet(privateKey, provider);
}

/**
 * Get contract instance
 */
function getContract(address, networkName, needsSigner = false) {
    if (!ethers.isAddress(address)) {
        throw new Error(`Invalid contract address: ${address}`);
    }

    const runnerOrProvider = needsSigner
        ? getSigner(networkName)
        : getProvider(networkName);

    return new ethers.Contract(address, CONTRACT_ABI, runnerOrProvider);
}

/**
 * Format address for display
 */
function formatAddress(address) {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Get explorer URL
 */
function getExplorerUrl(networkName, type, value) {
    const network = config.networks[networkName];
    const explorer = network?.explorer || 'https://basescan.org';

    switch (type) {
        case 'tx':
            return `${explorer}/tx/${value}`;
        case 'address':
            return `${explorer}/address/${value}`;
        default:
            return explorer;
    }
}

/**
 * Confirm action (especially for mainnet)
 */
async function confirmAction(message, network) {
    if (network.includes('mainnet') || network === 'base') {
        console.log(chalk.yellow('\n⚠️  WARNING: This is a MAINNET operation!'));
    }

    const answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message: message,
            default: false,
        }
    ]);

    return answers.confirmed;
}

/**
 * Wait for transaction with spinner
 */
async function waitForTransaction(tx, message = 'Waiting for confirmation') {
    const spinner = ora(message).start();

    try {
        const receipt = await tx.wait();
        spinner.succeed(chalk.green(`Transaction confirmed! Block: ${receipt.blockNumber}`));
        return receipt;
    } catch (error) {
        spinner.fail(chalk.red('Transaction failed'));
        throw error;
    }
}

// ============================================================================
// COMMAND: DEPLOY
// ============================================================================

program
    .command('deploy')
    .description('Deploy a new SplitStream contract')
    .option('-n, --network <network>', 'Network to deploy on', config.defaultNetwork)
    .option('-p, --payees <addresses>', 'Comma-separated list of payee addresses')
    .option('-s, --shares <shares>', 'Comma-separated list of shares (must match payees)')
    .option('--dry-run', 'Simulate deployment without actually deploying')
    .action(async (options) => {
        try {
            console.log(chalk.bold.cyan('\n🚀 SplitStream Contract Deployment\n'));

            // Parse payees and shares
            let payees = options.payees ? options.payees.split(',').map(a => a.trim()) : [];
            let shares = options.shares ? options.shares.split(',').map(s => parseInt(s.trim())) : [];

            // Interactive mode if not provided
            if (payees.length === 0) {
                console.log(chalk.yellow('No payees provided. Entering interactive mode...\n'));

                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'payeeCount',
                        message: 'How many payees?',
                        default: '2',
                        validate: (input) => {
                            const num = parseInt(input);
                            return num > 0 && num <= 10 || 'Please enter a number between 1 and 10';
                        }
                    }
                ]);

                const payeeCount = parseInt(answers.payeeCount);

                for (let i = 0; i < payeeCount; i++) {
                    const payeeAnswers = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'address',
                            message: `Payee ${i + 1} address:`,
                            validate: (input) => ethers.isAddress(input) || 'Invalid Ethereum address'
                        },
                        {
                            type: 'input',
                            name: 'shares',
                            message: `Payee ${i + 1} shares:`,
                            validate: (input) => parseInt(input) > 0 || 'Shares must be greater than 0'
                        }
                    ]);

                    payees.push(payeeAnswers.address);
                    shares.push(parseInt(payeeAnswers.shares));
                }
            }

            // Validate
            if (payees.length !== shares.length) {
                throw new Error('Number of payees must match number of shares');
            }

            if (payees.length === 0) {
                throw new Error('At least one payee is required');
            }

            // Display configuration
            const table = new Table({
                head: ['#', 'Address', 'Shares', '%'],
                style: { head: ['cyan'] }
            });

            const totalShares = shares.reduce((a, b) => a + b, 0);
            payees.forEach((address, i) => {
                const percentage = ((shares[i] / totalShares) * 100).toFixed(2);
                table.push([
                    i + 1,
                    formatAddress(address),
                    shares[i],
                    `${percentage}%`
                ]);
            });

            console.log(chalk.bold('\nPayee Configuration:'));
            console.log(table.toString());
            console.log(chalk.dim(`Total shares: ${totalShares}\n`));

            // Confirm
            const confirmed = await confirmAction(
                `Deploy to ${options.network}?`,
                options.network
            );

            if (!confirmed) {
                console.log(chalk.yellow('Deployment cancelled.'));
                return;
            }

            if (options.dryRun) {
                console.log(chalk.yellow('\n🏃 Dry run mode - skipping actual deployment'));
                return;
            }

            // Deploy
            const spinner = ora('Deploying contract...').start();

            const signer = getSigner(options.network);
            const factory = new ethers.ContractFactory(
                CONTRACT_ABI,
                require('../artifacts/contracts/SplitStream.sol/SplitStream.json').bytecode,
                signer
            );

            const contract = await factory.deploy(payees, shares);
            spinner.text = 'Waiting for deployment confirmation...';

            await contract.waitForDeployment();
            const address = await contract.getAddress();

            spinner.succeed(chalk.green('Contract deployed successfully!'));

            console.log(chalk.bold('\n📋 Deployment Details:\n'));
            console.log(`${chalk.bold('Contract Address:')} ${chalk.cyan(address)}`);
            console.log(`${chalk.bold('Network:')} ${options.network}`);
            console.log(`${chalk.bold('Explorer:')} ${getExplorerUrl(options.network, 'address', address)}`);

            // Save to config
            console.log(chalk.dim('\n💡 Tip: Add this to your .splitstream.json:'));
            console.log(chalk.dim(`"contracts": { "latest": "${address}" }`));

        } catch (error) {
            console.error(chalk.red('\n❌ Deployment failed:'), error.message);
            process.exit(1);
        }
    });

// ============================================================================
// COMMAND: INFO
// ============================================================================

program
    .command('info <address>')
    .description('Show contract information')
    .option('-n, --network <network>', 'Network name', config.defaultNetwork)
    .action(async (address, options) => {
        try {
            console.log(chalk.bold.cyan('\n📊 Contract Information\n'));

            const spinner = ora('Fetching contract data...').start();

            const provider = getProvider(options.network);
            const contract = getContract(address, options.network);

            // Fetch all data
            const [
                totalShares,
                totalReleased,
                payeeCount,
                balance,
                code
            ] = await Promise.all([
                contract.totalShares(),
                contract.totalReleased(),
                contract.payeeCount(),
                provider.getBalance(address),
                provider.getCode(address)
            ]);

            // Verify it's a contract
            if (code === '0x') {
                throw new Error('No contract found at this address');
            }

            spinner.succeed('Data fetched');

            // Display basic info
            const totalReceived = balance + totalReleased;

            const infoTable = new Table({
                style: { head: ['cyan'] }
            });

            infoTable.push(
                ['Contract Address', address],
                ['Network', options.network],
                ['Current Balance', `${ethers.formatEther(balance)} ETH`],
                ['Total Released', `${ethers.formatEther(totalReleased)} ETH`],
                ['Total Received', `${ethers.formatEther(totalReceived)} ETH`],
                ['Total Shares', totalShares.toString()],
                ['Number of Payees', payeeCount.toString()]
            );

            console.log(infoTable.toString());

            // Fetch and display payees
            console.log(chalk.bold('\n👥 Payees:\n'));

            const payeeTable = new Table({
                head: ['#', 'Address', 'Shares', '%', 'Released', 'Pending'],
                style: { head: ['cyan'] }
            });

            for (let i = 0; i < payeeCount; i++) {
                const payeeAddress = await contract.payee(i);
                const shares = await contract.shares(payeeAddress);
                const released = await contract.released(payeeAddress);
                const releasable = await contract.releasable(payeeAddress);

                const percentage = Number((shares * 100n) / totalShares);

                payeeTable.push([
                    i + 1,
                    formatAddress(payeeAddress),
                    shares.toString(),
                    `${percentage.toFixed(1)}%`,
                    `${ethers.formatEther(released)} ETH`,
                    chalk.green(`${ethers.formatEther(releasable)} ETH`)
                ]);
            }

            console.log(payeeTable.toString());

            console.log(chalk.dim(`\n🔗 Explorer: ${getExplorerUrl(options.network, 'address', address)}\n`));

        } catch (error) {
            console.error(chalk.red('\n❌ Error:'), error.message);
            process.exit(1);
        }
    });

// ============================================================================
// COMMAND: BALANCE
// ============================================================================

program
    .command('balance <address>')
    .description('Check balances and pending payments for all payees')
    .option('-n, --network <network>', 'Network name', config.defaultNetwork)
    .option('-a, --address <payee>', 'Check specific payee address only')
    .action(async (contractAddress, options) => {
        try {
            console.log(chalk.bold.cyan('\n💰 Balance Information\n'));

            const spinner = ora('Fetching balances...').start();

            const provider = getProvider(options.network);
            const contract = getContract(contractAddress, options.network);

            const balance = await provider.getBalance(contractAddress);
            const totalReleased = await contract.totalReleased();

            spinner.succeed('Balances fetched');

            console.log(chalk.bold('Contract Balance:'));
            console.log(`  ${chalk.green(ethers.formatEther(balance))} ETH\n`);

            // If specific address requested
            if (options.address) {
                const payeeAddress = options.address;
                const shares = await contract.shares(payeeAddress);

                if (shares === 0n) {
                    console.log(chalk.yellow(`Address ${payeeAddress} is not a payee.`));
                    return;
                }

                const released = await contract.released(payeeAddress);
                const releasable = await contract.releasable(payeeAddress);
                const totalShares = await contract.totalShares();

                const table = new Table({
                    style: { head: ['cyan'] }
                });

                table.push(
                    ['Address', payeeAddress],
                    ['Shares', `${shares} (${Number(shares * 100n / totalShares).toFixed(2)}%)`],
                    ['Already Released', `${ethers.formatEther(released)} ETH`],
                    ['Currently Releasable', chalk.green(`${ethers.formatEther(releasable)} ETH`)]
                );

                console.log(table.toString());
            } else {
                // Show all payees
                const payeeCount = await contract.payeeCount();
                const totalShares = await contract.totalShares();

                const table = new Table({
                    head: ['Address', 'Shares', '%', 'Released', 'Releasable'],
                    style: { head: ['cyan'] }
                });

                let totalReleasable = 0n;

                for (let i = 0; i < payeeCount; i++) {
                    const address = await contract.payee(i);
                    const shares = await contract.shares(address);
                    const released = await contract.released(address);
                    const releasable = await contract.releasable(address);

                    totalReleasable += releasable;

                    table.push([
                        formatAddress(address),
                        shares.toString(),
                        `${Number(shares * 100n / totalShares).toFixed(1)}%`,
                        ethers.formatEther(released),
                        chalk.green(ethers.formatEther(releasable))
                    ]);
                }

                console.log(table.toString());
                console.log(chalk.dim(`\nTotal pending: ${ethers.formatEther(totalReleasable)} ETH`));
            }

            console.log();

        } catch (error) {
            console.error(chalk.red('\n❌ Error:'), error.message);
            process.exit(1);
        }
    });

// ============================================================================
// COMMAND: SEND
// ============================================================================

program
    .command('send <address>')
    .description('Send ETH payment to the contract')
    .requiredOption('-a, --amount <eth>', 'Amount in ETH to send')
    .option('-n, --network <network>', 'Network name', config.defaultNetwork)
    .action(async (address, options) => {
        try {
            console.log(chalk.bold.cyan('\n💸 Send Payment\n'));

            const amount = ethers.parseEther(options.amount);

            console.log(`${chalk.bold('Contract:')} ${address}`);
            console.log(`${chalk.bold('Amount:')} ${chalk.green(options.amount)} ETH`);
            console.log(`${chalk.bold('Network:')} ${options.network}\n`);

            // Confirm
            const confirmed = await confirmAction(
                `Send ${options.amount} ETH to contract?`,
                options.network
            );

            if (!confirmed) {
                console.log(chalk.yellow('Transaction cancelled.'));
                return;
            }

            const signer = getSigner(options.network);

            // Check sender balance
            const signerBalance = await signer.provider.getBalance(signer.address);
            if (signerBalance < amount) {
                throw new Error(
                    `Insufficient balance. Have: ${ethers.formatEther(signerBalance)} ETH, Need: ${options.amount} ETH`
                );
            }

            console.log(chalk.dim(`Sending from: ${signer.address}\n`));

            const tx = await signer.sendTransaction({
                to: address,
                value: amount
            });

            console.log(`${chalk.bold('Transaction Hash:')} ${tx.hash}`);
            console.log(`${chalk.bold('Explorer:')} ${getExplorerUrl(options.network, 'tx', tx.hash)}\n`);

            const receipt = await waitForTransaction(tx, 'Confirming transaction');

            console.log(chalk.bold.green('\n✅ Payment sent successfully!\n'));
            console.log(`${chalk.bold('Gas Used:')} ${receipt.gasUsed.toString()}`);
            console.log(`${chalk.bold('Block:')} ${receipt.blockNumber}\n`);

        } catch (error) {
            console.error(chalk.red('\n❌ Transaction failed:'), error.message);
            process.exit(1);
        }
    });

// ============================================================================
// COMMAND: RELEASE
// ============================================================================

program
    .command('release <contract> [payee]')
    .description('Release payment to a payee (or all payees if no address specified)')
    .option('-n, --network <network>', 'Network name', config.defaultNetwork)
    .option('--all', 'Release for all payees with pending payments')
    .action(async (contractAddress, payeeAddress, options) => {
        try {
            console.log(chalk.bold.cyan('\n📤 Release Payment\n'));

            const contract = getContract(contractAddress, options.network, true);

            // Release for all payees
            if (options.all || !payeeAddress) {
                const payeeCount = await contract.payeeCount();

                console.log(chalk.bold(`Checking ${payeeCount} payees...\n`));

                let releasedCount = 0;
                let totalReleased = 0n;

                for (let i = 0; i < payeeCount; i++) {
                    const address = await contract.payee(i);
                    const releasable = await contract.releasable(address);

                    if (releasable > 0n) {
                        console.log(chalk.yellow(`→ ${formatAddress(address)}: ${ethers.formatEther(releasable)} ETH`));
                    }
                }

                const confirmed = await confirmAction(
                    'Release all pending payments?',
                    options.network
                );

                if (!confirmed) {
                    console.log(chalk.yellow('Operation cancelled.'));
                    return;
                }

                console.log();

                for (let i = 0; i < payeeCount; i++) {
                    const address = await contract.payee(i);
                    const releasable = await contract.releasable(address);

                    if (releasable > 0n) {
                        const spinner = ora(`Releasing to ${formatAddress(address)}...`).start();

                        try {
                            const tx = await contract.release(address);
                            await tx.wait();

                            spinner.succeed(`Released ${ethers.formatEther(releasable)} ETH to ${formatAddress(address)}`);

                            releasedCount++;
                            totalReleased += releasable;

                            // Small delay to avoid nonce issues
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        } catch (error) {
                            spinner.fail(`Failed: ${error.message}`);
                        }
                    }
                }

                console.log(chalk.bold.green(`\n✅ Released ${releasedCount} payments totaling ${ethers.formatEther(totalReleased)} ETH\n`));

            } else {
                // Release for specific payee
                const releasable = await contract.releasable(payeeAddress);

                if (releasable === 0n) {
                    console.log(chalk.yellow('No payment due for this address.'));
                    return;
                }

                console.log(`${chalk.bold('Payee:')} ${payeeAddress}`);
                console.log(`${chalk.bold('Amount:')} ${chalk.green(ethers.formatEther(releasable))} ETH\n`);

                const confirmed = await confirmAction(
                    'Release payment?',
                    options.network
                );

                if (!confirmed) {
                    console.log(chalk.yellow('Transaction cancelled.'));
                    return;
                }

                const tx = await contract.release(payeeAddress);

                console.log(`\n${chalk.bold('Transaction Hash:')} ${tx.hash}`);
                console.log(`${chalk.bold('Explorer:')} ${getExplorerUrl(options.network, 'tx', tx.hash)}\n`);

                await waitForTransaction(tx, 'Confirming release');

                console.log(chalk.bold.green('\n✅ Payment released successfully!\n'));
            }

        } catch (error) {
            console.error(chalk.red('\n❌ Release failed:'), error.message);
            process.exit(1);
        }
    });

// ============================================================================
// COMMAND: HISTORY
// ============================================================================

program
    .command('history <address>')
    .description('Show payment history (events)')
    .option('-n, --network <network>', 'Network name', config.defaultNetwork)
    .option('-l, --limit <number>', 'Limit number of results', '50')
    .option('--from-block <number>', 'Start block', '0')
    .action(async (address, options) => {
        try {
            console.log(chalk.bold.cyan('\n📜 Payment History\n'));

            const spinner = ora('Fetching events...').start();

            const provider = getProvider(options.network);
            const contract = getContract(address, options.network);

            const currentBlock = await provider.getBlockNumber();
            const fromBlock = parseInt(options.fromBlock) || Math.max(0, currentBlock - 10000);

            // Fetch events
            const [receivedEvents, releasedEvents] = await Promise.all([
                contract.queryFilter(contract.filters.PaymentReceived(), fromBlock, 'latest'),
                contract.queryFilter(contract.filters.PaymentReleased(), fromBlock, 'latest')
            ]);

            spinner.succeed(`Found ${receivedEvents.length + releasedEvents.length} events`);

            // Combine and sort
            const allEvents = [
                ...receivedEvents.map(e => ({
                    type: 'received',
                    address: e.args.from,
                    amount: e.args.amount,
                    block: e.blockNumber,
                    tx: e.transactionHash
                })),
                ...releasedEvents.map(e => ({
                    type: 'released',
                    address: e.args.to,
                    amount: e.args.amount,
                    block: e.blockNumber,
                    tx: e.transactionHash
                }))
            ];

            allEvents.sort((a, b) => b.block - a.block);

            const limit = parseInt(options.limit);
            const displayEvents = allEvents.slice(0, limit);

            if (displayEvents.length === 0) {
                console.log(chalk.yellow('No events found.'));
                return;
            }

            const table = new Table({
                head: ['Block', 'Type', 'Address', 'Amount', 'Tx'],
                style: { head: ['cyan'] }
            });

            for (const event of displayEvents) {
                const typeColor = event.type === 'received' ? chalk.green : chalk.blue;

                table.push([
                    event.block,
                    typeColor(event.type),
                    formatAddress(event.address),
                    `${ethers.formatEther(event.amount)} ETH`,
                    event.tx.substring(0, 10) + '...'
                ]);
            }

            console.log(table.toString());

            // Summary
            const totalReceived = receivedEvents.reduce((sum, e) => sum + e.args.amount, 0n);
            const totalReleased = releasedEvents.reduce((sum, e) => sum + e.args.amount, 0n);

            console.log(chalk.dim(`\nTotal Received: ${ethers.formatEther(totalReceived)} ETH`));
            console.log(chalk.dim(`Total Released: ${ethers.formatEther(totalReleased)} ETH`));
            console.log(chalk.dim(`Showing ${displayEvents.length} of ${allEvents.length} events\n`));

        } catch (error) {
            console.error(chalk.red('\n❌ Error:'), error.message);
            process.exit(1);
        }
    });

// ============================================================================
// COMMAND: EXPORT
// ============================================================================

program
    .command('export <address>')
    .description('Export payment data to CSV or JSON')
    .option('-n, --network <network>', 'Network name', config.defaultNetwork)
    .option('-f, --format <format>', 'Export format (csv|json)', 'csv')
    .option('-o, --output <file>', 'Output filename')
    .option('--from-block <number>', 'Start block', '0')
    .action(async (address, options) => {
        try {
            console.log(chalk.bold.cyan('\n📁 Export Payment Data\n'));

            const spinner = ora('Fetching data...').start();

            const provider = getProvider(options.network);
            const contract = getContract(address, options.network);

            const currentBlock = await provider.getBlockNumber();
            const fromBlock = parseInt(options.fromBlock) || Math.max(0, currentBlock - 50000);

            // Fetch events
            const [receivedEvents, releasedEvents] = await Promise.all([
                contract.queryFilter(contract.filters.PaymentReceived(), fromBlock, 'latest'),
                contract.queryFilter(contract.filters.PaymentReleased(), fromBlock, 'latest')
            ]);

            spinner.text = 'Processing events...';

            // Get timestamps for each event
            const data = [];

            for (const event of receivedEvents) {
                const block = await provider.getBlock(event.blockNumber);
                data.push({
                    type: 'received',
                    address: event.args.from,
                    amount: ethers.formatEther(event.args.amount),
                    amountWei: event.args.amount.toString(),
                    blockNumber: event.blockNumber,
                    timestamp: new Date(block.timestamp * 1000).toISOString(),
                    transactionHash: event.transactionHash
                });
            }

            for (const event of releasedEvents) {
                const block = await provider.getBlock(event.blockNumber);
                data.push({
                    type: 'released',
                    address: event.args.to,
                    amount: ethers.formatEther(event.args.amount),
                    amountWei: event.args.amount.toString(),
                    blockNumber: event.blockNumber,
                    timestamp: new Date(block.timestamp * 1000).toISOString(),
                    transactionHash: event.transactionHash
                });
            }

            // Sort by block
            data.sort((a, b) => a.blockNumber - b.blockNumber);

            spinner.succeed(`Processed ${data.length} events`);

            // Determine output filename
            const outputFile = options.output ||
                `splitstream-${address.substring(0, 8)}-${Date.now()}.${options.format}`;

            // Export
            if (options.format === 'csv') {
                const csvWriter = createObjectCsvWriter({
                    path: outputFile,
                    header: [
                        { id: 'timestamp', title: 'Timestamp' },
                        { id: 'type', title: 'Type' },
                        { id: 'address', title: 'Address' },
                        { id: 'amount', title: 'Amount (ETH)' },
                        { id: 'amountWei', title: 'Amount (Wei)' },
                        { id: 'blockNumber', title: 'Block' },
                        { id: 'transactionHash', title: 'Transaction Hash' }
                    ]
                });

                await csvWriter.writeRecords(data);
            } else if (options.format === 'json') {
                fs.writeFileSync(
                    outputFile,
                    JSON.stringify({
                        contract: address,
                        network: options.network,
                        exportedAt: new Date().toISOString(),
                        events: data
                    }, null, 2)
                );
            } else {
                throw new Error(`Unsupported format: ${options.format}`);
            }

            console.log(chalk.green(`\n✅ Exported ${data.length} events to ${outputFile}\n`));

        } catch (error) {
            console.error(chalk.red('\n❌ Export failed:'), error.message);
            process.exit(1);
        }
    });

// ============================================================================
// GLOBAL OPTIONS & PARSE
// ============================================================================

program
    .name('splitstream')
    .description('SplitStream CLI - Manage payment splitter contracts')
    .version('1.0.0')
    .option('-v, --verbose', 'Verbose output');

// Show help by default
if (process.argv.length === 2) {
    program.help();
}

program.parse(process.argv);

/**
 * PACKAGE.JSON SETUP FOR GLOBAL INSTALLATION:
 * 
 * ```json
 * {
 *   "name": "splitstream-cli",
 *   "version": "1.0.0",
 *   "description": "CLI tool for managing SplitStream payment splitter contracts",
 *   "main": "cli-tool.js",
 *   "bin": {
 *     "splitstream": "./cli-tool.js"
 *   },
 *   "scripts": {
 *     "link": "npm link"
 *   },
 *   "keywords": ["ethereum", "payment", "splitter", "base", "cli"],
 *   "author": "Your Name",
 *   "license": "MIT",
 *   "dependencies": {
 *     "commander": "^11.1.0",
 *     "chalk": "^4.1.2",
 *     "inquirer": "^8.2.5",
 *     "ora": "^5.4.1",
 *     "cli-table3": "^0.6.3",
 *     "csv-writer": "^1.6.0",
 *     "ethers": "^6.10.0",
 *     "dotenv": "^16.0.3"
 *   }
 * }
 * ```
 * 
 * Then run:
 * ```bash
 * npm install
 * npm link
 * ```
 * 
 * Now you can use globally:
 * ```bash
 * splitstream --help
 * splitstream info 0xYourContract
 * ```
 */
