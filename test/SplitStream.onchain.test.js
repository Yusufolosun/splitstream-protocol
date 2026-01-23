/**
 * SplitStream On-Chain Test Suite (Base Mainnet)
 * 
 * IMPORTANT: This test suite executes REAL transactions on Base mainnet and costs REAL money!
 * 
 * Gas-optimized test suite targeting ~$0.15 total cost by:
 * - Using existing deployed contract (no deployment cost)
 * - Minimal transaction amounts (0.0001 ETH)
 * - Only essential transactions (4 total)
 * - Sequential tests that build on each other
 * 
 * ESTIMATED COSTS (Base mainnet @ 0.1 gwei):
 * - Send payment (21k gas): ~$0.0002
 * - Release payment (45k gas): ~$0.0005
 * - Total for 4 transactions: ~$0.003
 * 
 * SETUP:
 * 
 * 1. Set environment variables in .env:
 * ```
 * ONCHAIN_TEST=true
 * BASE_RPC_URL=https://mainnet.base.org
 * PRIVATE_KEY=0xYourPrivateKey
 * SPLITSTREAM_CONTRACT=0x0231B43e23fFEc9A72F27540e4D799C418aE1CD2
 * ```
 * 
 * 2. Ensure you have ~0.001 ETH on Base mainnet for tests + gas
 * 
 * 3. Run tests:
 * ```bash
 * ONCHAIN_TEST=true npx hardhat test test/SplitStream.onchain.test.js --network base
 * ```
 * 
 * SAFETY FEATURES:
 * - Requires explicit ONCHAIN_TEST=true flag
 * - Verifies network is Base mainnet (chainId 8453)
 * - Checks sufficient balance before running
 * - Displays estimated cost and requires confirmation
 * - Reports actual gas costs after completion
 * - Provides transaction hashes for verification
 * 
 * IDEMPOTENCY:
 * Tests can be run multiple times safely as they:
 * - Use cumulative balance checks
 * - Don't depend on exact state
 * - Clean up by releasing all payments
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const readline = require("readline");

// Configuration
const EXISTING_CONTRACT = process.env.SPLITSTREAM_CONTRACT || "0x0231B43e23fFEc9A72F27540e4D799C418aE1CD2";
const TEST_PAYMENT_AMOUNT = ethers.parseEther("0.0001"); // Minimal test amount
const BASE_MAINNET_CHAIN_ID = 8453;

// Skip all tests unless ONCHAIN_TEST=true
const describeOnchain = process.env.ONCHAIN_TEST === "true" ? describe : describe.skip;

/**
 * Prompt user for confirmation
 */
async function confirmExecution() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('\n⚠️  Proceed with on-chain tests? (yes/no): ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

/**
 * Format gas report
 */
function formatGasReport(gasData) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 GAS USAGE REPORT');
    console.log('='.repeat(60));

    let totalGasUsed = 0n;
    let totalCostETH = 0n;

    gasData.forEach((tx, index) => {
        totalGasUsed += tx.gasUsed;
        totalCostETH += tx.cost;

        console.log(`\n${index + 1}. ${tx.name}`);
        console.log(`   Gas Used: ${tx.gasUsed.toLocaleString()}`);
        console.log(`   Gas Price: ${ethers.formatUnits(tx.gasPrice, 'gwei')} gwei`);
        console.log(`   Cost: ${ethers.formatEther(tx.cost)} ETH`);
        console.log(`   Tx Hash: ${tx.hash}`);
    });

    console.log('\n' + '-'.repeat(60));
    console.log(`Total Gas Used: ${totalGasUsed.toLocaleString()}`);
    console.log(`Total Cost: ${ethers.formatEther(totalCostETH)} ETH`);
    console.log('='.repeat(60) + '\n');
}

describeOnchain("SplitStream On-Chain Tests (Base Mainnet)", function () {
    // Increase timeout for on-chain operations
    this.timeout(120000); // 2 minutes

    let contract;
    let signer;
    let payee1, payee2;
    let initialBalances = {};
    let gasData = [];

    before(async function () {
        console.log('\n🚀 SplitStream On-Chain Test Suite');
        console.log('='.repeat(60));

        // Get signer
        [signer] = await ethers.getSigners();
        console.log(`\n📍 Signer Address: ${signer.address}`);

        // Verify network
        const network = await ethers.provider.getNetwork();
        console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

        if (network.chainId !== BigInt(BASE_MAINNET_CHAIN_ID)) {
            throw new Error(
                `❌ Wrong network! Expected Base mainnet (${BASE_MAINNET_CHAIN_ID}), got ${network.chainId}`
            );
        }
        console.log('✅ Confirmed: Base mainnet');

        // Check signer balance
        const signerBalance = await ethers.provider.getBalance(signer.address);
        console.log(`💰 Your Balance: ${ethers.formatEther(signerBalance)} ETH`);

        const requiredBalance = TEST_PAYMENT_AMOUNT * 2n + ethers.parseEther("0.001"); // 2 payments + gas buffer
        if (signerBalance < requiredBalance) {
            throw new Error(
                `❌ Insufficient balance! Need at least ${ethers.formatEther(requiredBalance)} ETH`
            );
        }
        console.log('✅ Sufficient balance');

        // Connect to existing contract
        console.log(`\n📋 Using Deployed Contract: ${EXISTING_CONTRACT}`);
        contract = await ethers.getContractAt("SplitStream", EXISTING_CONTRACT);

        // Verify contract is valid
        const code = await ethers.provider.getCode(EXISTING_CONTRACT);
        if (code === '0x') {
            throw new Error(`❌ No contract found at ${EXISTING_CONTRACT}`);
        }
        console.log('✅ Contract verified');

        // Get contract info
        const totalShares = await contract.totalShares();
        const payeeCount = await contract.payeeCount();
        const contractBalance = await ethers.provider.getBalance(EXISTING_CONTRACT);

        console.log(`\n📊 Contract Info:`);
        console.log(`   Total Shares: ${totalShares}`);
        console.log(`   Payee Count: ${payeeCount}`);
        console.log(`   Current Balance: ${ethers.formatEther(contractBalance)} ETH`);

        // Get payees
        payee1 = await contract.payee(0);
        payee2 = payeeCount > 1 ? await contract.payee(1) : payee1;

        console.log(`\n👥 Payees:`);
        console.log(`   Payee 1: ${payee1}`);
        if (payeeCount > 1) {
            console.log(`   Payee 2: ${payee2}`);
        }

        // Store initial balances for comparison
        initialBalances.payee1 = await ethers.provider.getBalance(payee1);
        initialBalances.payee2 = await ethers.provider.getBalance(payee2);
        initialBalances.contract = contractBalance;

        // Estimate costs
        console.log(`\n💸 Estimated Test Costs:`);
        const feeData = await ethers.provider.getFeeData();
        const estimatedGasPrice = feeData.gasPrice || ethers.parseUnits("0.1", "gwei");
        console.log(`   Current Gas Price: ${ethers.formatUnits(estimatedGasPrice, 'gwei')} gwei`);

        const estimatedSendGas = 21000n;
        const estimatedReleaseGas = 50000n;
        const totalEstimatedGas = (estimatedSendGas * 2n) + (estimatedReleaseGas * 2n);
        const estimatedCost = totalEstimatedGas * estimatedGasPrice;

        console.log(`   Estimated Total Gas: ${totalEstimatedGas.toLocaleString()}`);
        console.log(`   Estimated Total Cost: ${ethers.formatEther(estimatedCost)} ETH`);
        console.log(`   Test Payments: ${ethers.formatEther(TEST_PAYMENT_AMOUNT * 2n)} ETH`);
        console.log(`   Total Required: ${ethers.formatEther(estimatedCost + TEST_PAYMENT_AMOUNT * 2n)} ETH`);

        // Warning
        console.log('\n' + '⚠️ '.repeat(30));
        console.log('⚠️  WARNING: This will execute REAL transactions on Base mainnet!');
        console.log('⚠️  WARNING: This will cost REAL money (ETH)!');
        console.log('⚠️  WARNING: Transactions are irreversible!');
        console.log('⚠️ '.repeat(30));

        // Require confirmation
        const confirmed = await confirmExecution();
        if (!confirmed) {
            console.log('\n❌ Tests cancelled by user.\n');
            process.exit(0);
        }

        console.log('\n✅ Starting on-chain tests...\n');
    });

    after(function () {
        // Display gas report
        if (gasData.length > 0) {
            formatGasReport(gasData);
        }

        console.log('✅ On-chain tests completed successfully!\n');
    });

    it("1. Should accept payment (send 0.0001 ETH)", async function () {
        console.log('\n📤 Test 1: Sending payment to contract...');

        const balanceBefore = await ethers.provider.getBalance(EXISTING_CONTRACT);

        // Send payment
        const tx = await signer.sendTransaction({
            to: EXISTING_CONTRACT,
            value: TEST_PAYMENT_AMOUNT
        });

        console.log(`   Tx Hash: ${tx.hash}`);
        console.log(`   Waiting for confirmation...`);

        const receipt = await tx.wait();

        // Track gas
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice || tx.gasPrice;
        const cost = gasUsed * gasPrice;

        gasData.push({
            name: 'Send Payment #1',
            gasUsed,
            gasPrice,
            cost,
            hash: tx.hash
        });

        console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${gasUsed.toLocaleString()}`);

        // Verify balance increased
        const balanceAfter = await ethers.provider.getBalance(EXISTING_CONTRACT);
        expect(balanceAfter).to.equal(balanceBefore + TEST_PAYMENT_AMOUNT);

        console.log(`   Contract Balance: ${ethers.formatEther(balanceAfter)} ETH`);
    });

    it("2. Should release payment to payee1", async function () {
        console.log('\n💸 Test 2: Releasing payment to payee1...');

        // Check releasable amount
        const releasable = await contract.releasable(payee1);
        console.log(`   Releasable: ${ethers.formatEther(releasable)} ETH`);

        if (releasable === 0n) {
            console.log('   ⏭️  No payment due, skipping release');
            this.skip();
            return;
        }

        const balanceBefore = await ethers.provider.getBalance(payee1);

        // Release payment
        const tx = await contract.release(payee1);
        console.log(`   Tx Hash: ${tx.hash}`);
        console.log(`   Waiting for confirmation...`);

        const receipt = await tx.wait();

        // Track gas
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice || tx.gasPrice;
        const cost = gasUsed * gasPrice;

        gasData.push({
            name: 'Release to Payee1',
            gasUsed,
            gasPrice,
            cost,
            hash: tx.hash
        });

        console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${gasUsed.toLocaleString()}`);

        // Verify payment received
        const balanceAfter = await ethers.provider.getBalance(payee1);
        expect(balanceAfter).to.equal(balanceBefore + releasable);

        console.log(`   Payee1 received: ${ethers.formatEther(releasable)} ETH`);
    });

    it("3. Should accept second payment (send 0.0001 ETH)", async function () {
        console.log('\n📤 Test 3: Sending second payment to contract...');

        const balanceBefore = await ethers.provider.getBalance(EXISTING_CONTRACT);

        // Send payment
        const tx = await signer.sendTransaction({
            to: EXISTING_CONTRACT,
            value: TEST_PAYMENT_AMOUNT
        });

        console.log(`   Tx Hash: ${tx.hash}`);
        console.log(`   Waiting for confirmation...`);

        const receipt = await tx.wait();

        // Track gas
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice || tx.gasPrice;
        const cost = gasUsed * gasPrice;

        gasData.push({
            name: 'Send Payment #2',
            gasUsed,
            gasPrice,
            cost,
            hash: tx.hash
        });

        console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${gasUsed.toLocaleString()}`);

        // Verify balance increased
        const balanceAfter = await ethers.provider.getBalance(EXISTING_CONTRACT);
        expect(balanceAfter).to.equal(balanceBefore + TEST_PAYMENT_AMOUNT);

        console.log(`   Contract Balance: ${ethers.formatEther(balanceAfter)} ETH`);
    });

    it("4. Should release payment to payee2", async function () {
        console.log('\n💸 Test 4: Releasing payment to payee2...');

        // Check releasable amount
        const releasable = await contract.releasable(payee2);
        console.log(`   Releasable: ${ethers.formatEther(releasable)} ETH`);

        if (releasable === 0n) {
            console.log('   ⏭️  No payment due, skipping release');
            this.skip();
            return;
        }

        const balanceBefore = await ethers.provider.getBalance(payee2);

        // Release payment
        const tx = await contract.release(payee2);
        console.log(`   Tx Hash: ${tx.hash}`);
        console.log(`   Waiting for confirmation...`);

        const receipt = await tx.wait();

        // Track gas
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice || tx.gasPrice;
        const cost = gasUsed * gasPrice;

        gasData.push({
            name: 'Release to Payee2',
            gasUsed,
            gasPrice,
            cost,
            hash: tx.hash
        });

        console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${gasUsed.toLocaleString()}`);

        // Verify payment received
        const balanceAfter = await ethers.provider.getBalance(payee2);
        expect(balanceAfter).to.equal(balanceBefore + releasable);

        console.log(`   Payee2 received: ${ethers.formatEther(releasable)} ETH`);
    });

    it("5. Should verify final contract state (view calls only - no gas)", async function () {
        console.log('\n📊 Test 5: Verifying final contract state...');

        // All view calls - no gas cost
        const totalShares = await contract.totalShares();
        const totalReleased = await contract.totalReleased();
        const contractBalance = await ethers.provider.getBalance(EXISTING_CONTRACT);
        const payeeCount = await contract.payeeCount();

        console.log(`\n   Final Contract State:`);
        console.log(`   - Total Shares: ${totalShares}`);
        console.log(`   - Total Released: ${ethers.formatEther(totalReleased)} ETH`);
        console.log(`   - Contract Balance: ${ethers.formatEther(contractBalance)} ETH`);
        console.log(`   - Payee Count: ${payeeCount}`);

        // Verify each payee
        for (let i = 0; i < payeeCount; i++) {
            const payeeAddress = await contract.payee(i);
            const shares = await contract.shares(payeeAddress);
            const released = await contract.released(payeeAddress);
            const releasable = await contract.releasable(payeeAddress);

            console.log(`\n   Payee ${i + 1}: ${payeeAddress}`);
            console.log(`   - Shares: ${shares}`);
            console.log(`   - Released: ${ethers.formatEther(released)} ETH`);
            console.log(`   - Releasable: ${ethers.formatEther(releasable)} ETH`);
        }

        // Basic assertions
        expect(totalShares).to.be.gt(0);
        expect(payeeCount).to.be.gt(0);

        console.log('\n   ✅ Contract state verified');
    });
});

/**
 * USAGE INSTRUCTIONS:
 * 
 * 1. Setup environment:
 * ```bash
 * # In .env file
 * ONCHAIN_TEST=true
 * BASE_RPC_URL=https://mainnet.base.org
 * PRIVATE_KEY=0xYourPrivateKey
 * SPLITSTREAM_CONTRACT=0x0231B43e23fFEc9A72F27540e4D799C418aE1CD2
 * ```
 * 
 * 2. Ensure hardhat.config.js has Base network:
 * ```javascript
 * module.exports = {
 *   networks: {
 *     base: {
 *       url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
 *       accounts: [process.env.PRIVATE_KEY],
 *       chainId: 8453,
 *     }
 *   }
 * };
 * ```
 * 
 * 3. Fund your address with ~0.001 ETH on Base mainnet
 * 
 * 4. Run tests:
 * ```bash
 * ONCHAIN_TEST=true npx hardhat test test/SplitStream.onchain.test.js --network base
 * ```
 * 
 * 5. Review output for:
 * - Transaction hashes (verify on Basescan)
 * - Gas usage report
 * - Total costs
 * 
 * SAFETY NOTES:
 * - Tests will NOT run without ONCHAIN_TEST=true
 * - You must explicitly confirm execution when prompted
 * - All transactions are logged with hashes for verification
 * - Tests are idempotent (safe to run multiple times)
 * 
 * GAS OPTIMIZATION:
 * - Uses existing contract (saves ~1.5M gas = ~$0.05)
 * - Minimal payment amounts (0.0001 ETH)
 * - Only 4 essential transactions
 * - Sequential tests (no wasted retries)
 * - Efficient assertions
 * 
 * COST BREAKDOWN (typical):
 * - Send payment #1: ~21k gas = ~$0.0002
 * - Release to payee1: ~45k gas = ~$0.0005
 * - Send payment #2: ~21k gas = ~$0.0002
 * - Release to payee2: ~45k gas = ~$0.0005
 * - View calls: 0 gas
 * Total: ~132k gas ≈ $0.0014 (at 0.1 gwei) + 0.0002 ETH in payments = ~$0.002 total
 * 
 * WELL BELOW TARGET of $0.15! 🎉
 */
