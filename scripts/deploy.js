const hre = require("hardhat");

async function main() {
    try {
        console.log("🚀 Starting SplitStream deployment...\n");

        // Get signers
        const signers = await hre.ethers.getSigners();
        const deployer = signers[0];

        console.log("📝 Deployment Details:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Deployer address: ${deployer.address}`);
        console.log(`Network: ${hre.network.name}`);
        console.log(`Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId}\n`);

        // Define payees and shares
        // ⚠️ WARNING: These are PLACEHOLDER addresses for initial deployment testing.
        // In PRODUCTION, replace these with your actual payee addresses before deploying!
        // The contract requires each payee address to be unique.
        const payees = [
            "0x000000000000000000000000000000000000dEaD",  // Placeholder 1 (burn address)
            "0x0000000000000000000000000000000000000001",  // Placeholder 2
            "0x0000000000000000000000000000000000000002"   // Placeholder 3
        ];
        const shares = [50, 30, 20];

        console.log("👥 Payee Configuration:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        payees.forEach((payee, index) => {
            console.log(`Payee ${index + 1}: ${payee} - ${shares[index]} shares (${shares[index]}%)`);
        });
        console.log(`Total shares: ${shares.reduce((a, b) => a + b, 0)}\n`);

        // Deploy contract
        console.log("⏳ Deploying SplitStream contract...");
        const SplitStream = await hre.ethers.getContractFactory("SplitStream");
        const splitStream = await SplitStream.deploy(payees, shares);

        // Wait for deployment
        await splitStream.waitForDeployment();
        const contractAddress = await splitStream.getAddress();

        console.log("✅ Contract deployed successfully!\n");

        console.log("📋 Deployment Summary:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Contract Address: ${contractAddress}`);
        console.log(`Deployment Transaction: ${splitStream.deploymentTransaction().hash}`);
        console.log(`Block Number: ${splitStream.deploymentTransaction().blockNumber || 'Pending'}\n`);

        // Wait for 1 block confirmation
        console.log("⏳ Waiting for 1 block confirmation...");
        await splitStream.deploymentTransaction().wait(1);
        console.log("✅ Deployment confirmed!\n");

        // Verify deployment by checking total shares
        const totalShares = await splitStream.totalShares();
        console.log("🔍 Verification:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Total shares on contract: ${totalShares}`);

        // Verify each payee's shares
        for (let i = 0; i < payees.length; i++) {
            const payeeShares = await splitStream.shares(payees[i]);
            console.log(`Payee ${i + 1} shares: ${payeeShares}`);
        }

        console.log("\n🎉 Deployment completed successfully!");
        console.log("\n📌 Next Steps:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`1. Verify contract on Basescan:`);
        console.log(`   npx hardhat verify --network ${hre.network.name} ${contractAddress} "[${payees.map(p => `\\"${p}\\"`).join(',')}]" "[${shares.join(',')}]"`);
        console.log(`\n2. View on Basescan: https://basescan.org/address/${contractAddress}`);

    } catch (error) {
        console.error("\n❌ Deployment failed!");
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.error("Error:", error.message);
        if (error.stack) {
            console.error("\nStack trace:", error.stack);
        }
        process.exit(1);
    }
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
