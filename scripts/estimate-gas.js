const hre = require("hardhat");

async function main() {
    console.log("⛽ Gas Estimation for SplitStream Deployment\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Get signers
    const [deployer, payee1, payee2, payee3] = await hre.ethers.getSigners();

    // Test scenarios with different numbers of payees
    const scenarios = [
        {
            name: "2 Payees (50/50 split)",
            payees: [payee1.address, payee2.address],
            shares: [50, 50]
        },
        {
            name: "3 Payees (50/30/20 split)",
            payees: [payee1.address, payee2.address, payee3.address],
            shares: [50, 30, 20]
        },
        {
            name: "5 Payees (equal split)",
            payees: [
                payee1.address,
                payee2.address,
                payee3.address,
                "0x1111111111111111111111111111111111111111",
                "0x2222222222222222222222222222222222222222"
            ],
            shares: [20, 20, 20, 20, 20]
        }
    ];

    const SplitStream = await hre.ethers.getContractFactory("SplitStream");

    for (const scenario of scenarios) {
        console.log(`📊 Scenario: ${scenario.name}`);
        console.log("─────────────────────────────────────────────────────────────────────────────");

        try {
            // Estimate deployment gas
            const deployTransaction = await SplitStream.getDeployTransaction(
                scenario.payees,
                scenario.shares
            );

            const gasEstimate = await hre.ethers.provider.estimateGas(deployTransaction);

            console.log(`   Payees: ${scenario.payees.length}`);
            console.log(`   Shares: [${scenario.shares.join(", ")}]`);
            console.log(`   Estimated Gas: ${gasEstimate.toLocaleString()} gas`);

            // Get current gas price
            const feeData = await hre.ethers.provider.getFeeData();
            const gasPrice = feeData.gasPrice;

            console.log(`   Current Gas Price: ${hre.ethers.formatUnits(gasPrice, "gwei")} gwei`);

            // Calculate cost in ETH
            const costInWei = gasEstimate * gasPrice;
            const costInEth = hre.ethers.formatEther(costInWei);

            console.log(`   Deployment Cost: ${costInEth} ETH`);

            // Calculate cost in USD (assuming ETH price - you can update this)
            const ethPriceUSD = 3000; // Update with current ETH price
            const costInUSD = parseFloat(costInEth) * ethPriceUSD;

            console.log(`   Estimated USD Cost: $${costInUSD.toFixed(2)} (at $${ethPriceUSD}/ETH)`);
            console.log("");

        } catch (error) {
            console.log(`   ❌ Error estimating gas: ${error.message}\n`);
        }
    }

    // Additional operations gas estimates
    console.log("\n📈 Gas Estimates for Contract Operations");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Deploy a test contract for operation estimates
    const testPayees = [payee1.address, payee2.address, payee3.address];
    const testShares = [50, 30, 20];

    console.log("Deploying test contract for operation estimates...");
    const testContract = await SplitStream.deploy(testPayees, testShares);
    await testContract.waitForDeployment();
    console.log("✅ Test contract deployed\n");

    // Estimate receive function gas
    console.log("🔹 Receive ETH (send 1 ETH to contract):");
    try {
        const receiveGas = await deployer.estimateGas({
            to: await testContract.getAddress(),
            value: hre.ethers.parseEther("1")
        });
        console.log(`   Gas: ${receiveGas.toLocaleString()} gas\n`);
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
    }

    // Send some ETH first
    await deployer.sendTransaction({
        to: await testContract.getAddress(),
        value: hre.ethers.parseEther("1")
    });

    // Estimate release function gas
    console.log("🔹 Release Payment (payee withdraws their share):");
    try {
        const releaseGas = await testContract.release.estimateGas(payee1.address);
        console.log(`   Gas: ${releaseGas.toLocaleString()} gas\n`);
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
    }

    // Estimate view functions (should be 0)
    console.log("🔹 View Functions (read-only operations):");
    console.log("   totalShares(): 0 gas (free)");
    console.log("   shares(address): 0 gas (free)");
    console.log("   totalReleased(): 0 gas (free)");
    console.log("   released(address): 0 gas (free)");
    console.log("   payee(index): 0 gas (free)\n");

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n✅ Gas estimation complete!\n");
    console.log("💡 Tips:");
    console.log("   • Gas prices vary - check current rates before deploying");
    console.log("   • Consider deploying during low-traffic periods for lower costs");
    console.log("   • View functions are free (no gas cost)");
    console.log("   • Payees pay their own gas when withdrawing funds\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
