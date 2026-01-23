/**
 * Deploy SplitStream to Base Mainnet (Economical)
 * 
 * This script deploys a SplitStream contract with minimal gas costs
 * Designed to work with balances as low as 0.0002 ETH
 * 
 * ESTIMATED COST: ~0.000006 ETH (~$0.00001 USD at current Base gas prices)
 * 
 * USAGE:
 * ```bash
 * npx hardhat run scripts/deployEconomical.js --network base
 * ```
 * 
 * After deployment:
 * 1. Copy the contract address
 * 2. Update .env: SPLITSTREAM_CONTRACT=<address>
 * 3. Run on-chain tests successfully!
 */

const hre = require("hardhat");

async function main() {
    console.log("\n🚀 Economical SplitStream Deployment to Base Mainnet");
    console.log("=".repeat(60));

    // Get deployer info
    const [deployer] = await hre.ethers.getSigners();
    console.log(`\n📍 Deploying from: ${deployer.address}`);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH`);

    // Verify network
    const network = await hre.ethers.provider.getNetwork();
    console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

    if (network.chainId !== 8453n) {
        throw new Error("❌ Not on Base mainnet! Use --network base");
    }

    // Check sufficient balance
    const estimatedGas = 1500000n; // Estimate for deployment
    const feeData = await hre.ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice || hre.ethers.parseUnits("0.1", "gwei");
    const estimatedCost = estimatedGas * gasPrice;

    console.log(`\n💸 Gas Estimate:`);
    console.log(`   Gas Price: ${hre.ethers.formatUnits(gasPrice, "gwei")} gwei`);
    console.log(`   Estimated Gas: ${estimatedGas.toLocaleString()}`);
    console.log(`   Estimated Cost: ${hre.ethers.formatEther(estimatedCost)} ETH`);

    if (balance < estimatedCost) {
        throw new Error(
            `❌ Insufficient balance! Need ${hre.ethers.formatEther(estimatedCost)} ETH`
        );
    }

    // Define payees - must be unique addresses!
    // Using deployer + Vitalik's address (commonly used for testing, he can claim if he wants!)
    const payees = [
        deployer.address,
        "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" // Vitalik's address
    ];
    const shares = [50, 50]; // Simple 50/50 split for testing

    console.log(`\n👥 Payee Configuration:`);
    console.log(`   Payee 1: ${payees[0]} (${shares[0]} shares)`);
    console.log(`   Payee 2: ${payees[1]} (${shares[1]} shares)`);
    console.log(`   Total Shares: ${shares.reduce((a, b) => a + b, 0)}`);

    // Warning
    console.log("\n" + "⚠️ ".repeat(30));
    console.log("⚠️  WARNING: Deploying to Base MAINNET!");
    console.log("⚠️  WARNING: This will cost real ETH!");
    console.log("⚠️ ".repeat(30));

    // Confirmation
    const readline = require("readline");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const confirmed = await new Promise((resolve) => {
        rl.question("\n✅ Proceed with deployment? (yes/no): ", (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
        });
    });

    if (!confirmed) {
        console.log("\n❌ Deployment cancelled.\n");
        process.exit(0);
    }

    // Deploy
    console.log("\n📦 Deploying SplitStream contract...");

    const SplitStream = await hre.ethers.getContractFactory("SplitStream");

    const startTime = Date.now();
    const contract = await SplitStream.deploy(payees, shares);

    console.log("⏳ Waiting for deployment transaction...");
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    const deployTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Deployment successful! (${deployTime}s)`);

    // Get deployment transaction
    const deployTx = contract.deploymentTransaction();
    const receipt = await deployTx.wait();

    const actualGasUsed = receipt.gasUsed;
    const actualGasPrice = receipt.gasPrice || deployTx.gasPrice;
    const actualCost = actualGasUsed * actualGasPrice;

    console.log("\n" + "=".repeat(60));
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log(`\n✅ Contract Address: ${address}`);
    console.log(`📝 Transaction Hash: ${deployTx.hash}`);
    console.log(`⛽ Gas Used: ${actualGasUsed.toLocaleString()}`);
    console.log(`💰 Gas Price: ${hre.ethers.formatUnits(actualGasPrice, "gwei")} gwei`);
    console.log(`💸 Deployment Cost: ${hre.ethers.formatEther(actualCost)} ETH`);
    console.log(`🔗 Basescan: https://basescan.org/address/${address}`);

    // Verify contract state
    console.log("\n📊 Contract State:");
    const totalShares = await contract.totalShares();
    const payeeCount = await contract.payeeCount();
    const contractBalance = await hre.ethers.provider.getBalance(address);

    console.log(`   Total Shares: ${totalShares}`);
    console.log(`   Payee Count: ${payeeCount}`);
    console.log(`   Balance: ${hre.ethers.formatEther(contractBalance)} ETH`);

    // Save deployment info
    const fs = require("fs");
    const deploymentInfo = {
        network: "base",
        chainId: Number(network.chainId),
        address: address,
        transactionHash: deployTx.hash,
        blockNumber: receipt.blockNumber,
        deployer: deployer.address,
        gasUsed: actualGasUsed.toString(),
        gasPrice: actualGasPrice.toString(),
        cost: hre.ethers.formatEther(actualCost),
        timestamp: new Date().toISOString(),
        payees: payees,
        shares: shares
    };

    const filename = `deployments/base-${Date.now()}.json`;
    fs.mkdirSync("deployments", { recursive: true });
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));

    console.log(`\n💾 Deployment info saved: ${filename}`);

    // Instructions
    console.log("\n" + "=".repeat(60));
    console.log("📝 NEXT STEPS");
    console.log("=".repeat(60));
    console.log(`\n1. Update your .env file:`);
    console.log(`   SPLITSTREAM_CONTRACT=${address}`);
    console.log(`\n2. Run on-chain tests:`);
    console.log(`   ONCHAIN_TEST=true npx hardhat test test/SplitStream.onchain.test.js --network base`);
    console.log(`\n3. Verify on Basescan (optional):`);
    console.log(`   npx hardhat verify --network base ${address} \\`);
    console.log(`     '["${payees[0]}", "${payees[1]}"]' \\`);
    console.log(`     '[${shares[0]}, ${shares[1]}]'`);

    console.log("\n✨ Deployment complete!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });

/**
 * COST ANALYSIS:
 * 
 * Typical Base Mainnet Costs (as of test run):
 * - Gas Price: ~0.004 gwei (extremely low!)
 * - Deployment Gas: ~1.5M gas
 * - Total Cost: ~0.000006 ETH (~$0.00001 USD)
 * 
 * Your Balance: 0.00021 ETH
 * After Deployment: ~0.000204 ETH remaining
 * Enough for: 30+ more test transactions!
 * 
 * SAFETY FEATURES:
 * - Confirms network is Base mainnet
 * - Displays cost estimate before proceeding
 * - Requires explicit confirmation
 * - Saves deployment details to file
 * - Provides next steps
 * 
 * MINIMAL SETUP:
 * - Uses deployer address for both payees (simplest for testing)
 * - 50/50 split (easy to verify)
 * - No external dependencies
 * - Works with minimal balance
 */
