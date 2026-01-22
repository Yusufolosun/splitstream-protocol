const hre = require("hardhat");

/**
 * Utility script to check SplitStream contract balance and status
 * Usage: npx hardhat run scripts/checkBalance.js --network base
 * 
 * Set CONTRACT_ADDRESS environment variable or edit the address below
 */

async function main() {
    try {
        console.log("🔍 SplitStream Balance Checker\n");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        // Get contract address from environment variable or use a default
        const contractAddress = process.env.CONTRACT_ADDRESS;

        if (!contractAddress) {
            console.error("❌ Error: CONTRACT_ADDRESS not set");
            console.log("\n💡 Usage:");
            console.log("   Set CONTRACT_ADDRESS in .env file, or run:");
            console.log("   CONTRACT_ADDRESS=0x... npx hardhat run scripts/checkBalance.js --network base\n");
            process.exit(1);
        }

        // Validate contract address format
        if (!hre.ethers.isAddress(contractAddress)) {
            console.error(`❌ Error: Invalid contract address format: ${contractAddress}\n`);
            process.exit(1);
        }

        // Get network information
        const network = await hre.ethers.provider.getNetwork();
        const blockNumber = await hre.ethers.provider.getBlockNumber();
        const signer = (await hre.ethers.getSigners())[0];

        // Display contract metadata
        console.log("📋 Contract Metadata");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Contract Address:  ${contractAddress}`);
        console.log(`Network:           ${hre.network.name}`);
        console.log(`Chain ID:          ${network.chainId}`);
        console.log(`Current Block:     ${blockNumber}`);
        console.log(`Connected Account: ${signer.address}\n`);

        // Connect to the contract
        console.log("⏳ Connecting to contract...");
        const SplitStream = await hre.ethers.getContractFactory("SplitStream");
        const contract = SplitStream.attach(contractAddress);

        // Verify contract exists
        const code = await hre.ethers.provider.getCode(contractAddress);
        if (code === "0x") {
            console.error(`❌ Error: No contract found at address ${contractAddress}`);
            console.log("   This address may not be deployed on this network.\n");
            process.exit(1);
        }

        console.log("✅ Contract connected successfully!\n");

        // Get contract balance
        const contractBalance = await hre.ethers.provider.getBalance(contractAddress);
        const contractBalanceEth = hre.ethers.formatEther(contractBalance);

        // Get total shares and total released
        const totalShares = await contract.totalShares();
        const totalReleased = await contract.totalReleased();
        const totalReleasedEth = hre.ethers.formatEther(totalReleased);

        // Display contract overview
        console.log("💰 Contract Overview");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Current Balance:   ${contractBalanceEth} ETH`);
        console.log(`Total Shares:      ${totalShares}`);
        console.log(`Total Released:    ${totalReleasedEth} ETH\n`);

        // Calculate total ever received
        const totalEverReceived = contractBalance + totalReleased;
        const totalEverReceivedEth = hre.ethers.formatEther(totalEverReceived);
        console.log(`Total Ever Received: ${totalEverReceivedEth} ETH`);
        console.log(`Total Pending:       ${contractBalanceEth} ETH\n`);

        // Get all payees information
        console.log("👥 Payee Details");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        // Find all payees by iterating until we hit an error
        const payees = [];
        let index = 0;

        try {
            while (true) {
                const payeeAddress = await contract.payee(index);
                payees.push(payeeAddress);
                index++;
            }
        } catch (error) {
            // Expected error when we've found all payees
        }

        if (payees.length === 0) {
            console.log("⚠️  No payees found in this contract.\n");
        } else {
            console.log(`Found ${payees.length} payee(s):\n`);

            // Table header
            console.log("┌────┬──────────────────────────────────────────────┬────────┬──────────┬─────────────┬─────────────┬─────────────┐");
            console.log("│ #  │ Address                                      │ Shares │ Percent  │ Released    │ Pending     │ Total Due   │");
            console.log("├────┼──────────────────────────────────────────────┼────────┼──────────┼─────────────┼─────────────┼─────────────┤");

            let totalPendingAmount = 0n;

            for (let i = 0; i < payees.length; i++) {
                const payeeAddress = payees[i];
                const payeeShares = await contract.shares(payeeAddress);
                const payeeReleased = await contract.released(payeeAddress);

                // Calculate percentage
                const percentage = (Number(payeeShares) * 100 / Number(totalShares)).toFixed(2);

                // Calculate total amount this payee should have based on shares
                const totalDueToPayee = (totalEverReceived * payeeShares) / totalShares;

                // Calculate pending (total due minus already released)
                const pendingAmount = totalDueToPayee - payeeReleased;
                totalPendingAmount += pendingAmount;

                // Format amounts
                const releasedEth = hre.ethers.formatEther(payeeReleased);
                const pendingEth = hre.ethers.formatEther(pendingAmount);
                const totalDueEth = hre.ethers.formatEther(totalDueToPayee);

                // Truncate address for display
                const shortAddress = `${payeeAddress.slice(0, 6)}...${payeeAddress.slice(-4)}`;
                const fullAddress = payeeAddress;

                // Format row with proper padding
                const num = String(i + 1).padEnd(2);
                const addr = fullAddress.padEnd(44);
                const share = String(payeeShares).padEnd(6);
                const pct = `${percentage}%`.padEnd(8);
                const rel = `${parseFloat(releasedEth).toFixed(4)} ETH`.padEnd(11);
                const pend = `${parseFloat(pendingEth).toFixed(4)} ETH`.padEnd(11);
                const tot = `${parseFloat(totalDueEth).toFixed(4)} ETH`.padEnd(11);

                console.log(`│ ${num} │ ${addr} │ ${share} │ ${pct} │ ${rel} │ ${pend} │ ${tot} │`);
            }

            console.log("└────┴──────────────────────────────────────────────┴────────┴──────────┴─────────────┴─────────────┴─────────────┘");

            // Summary
            const totalPendingEth = hre.ethers.formatEther(totalPendingAmount);
            console.log(`\n📊 Summary:`);
            console.log(`   Total Payees:         ${payees.length}`);
            console.log(`   Total Pending:        ${parseFloat(totalPendingEth).toFixed(4)} ETH`);
            console.log(`   Available to Claim:   ${contractBalanceEth} ETH\n`);

            // Check if any payee has claimable funds
            const hasClaimableFunds = totalPendingAmount > 0n;
            if (hasClaimableFunds) {
                console.log("💡 Action Items:");
                console.log("   - Payees can call release() to claim their pending amounts");
                console.log(`   - Use: await contract.release("PAYEE_ADDRESS")\n`);
            } else {
                console.log("✅ All payees are up to date. No pending claims.\n");
            }
        }

        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("✅ Balance check completed successfully!\n");

    } catch (error) {
        console.error("\n❌ Balance check failed!");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        if (error.code === "NETWORK_ERROR") {
            console.error("Network Error: Unable to connect to the network");
            console.log("Please check:");
            console.log("  - Your internet connection");
            console.log("  - RPC URL in hardhat.config.js");
            console.log("  - Network is accessible and running\n");
        } else if (error.code === "CALL_EXCEPTION") {
            console.error("Contract Call Error: Unable to read from contract");
            console.log("This may indicate:");
            console.log("  - Contract is not deployed at this address");
            console.log("  - Contract interface mismatch");
            console.log("  - Network connection issues\n");
        } else {
            console.error("Error:", error.message);
            if (error.stack) {
                console.log("\nStack trace:");
                console.error(error.stack);
            }
        }

        process.exit(1);
    }
}

// Execute the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
