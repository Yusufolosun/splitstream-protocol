const hre = require("hardhat");
const readline = require("readline");

/**
 * Utility script to release payments to SplitStream payees
 * Usage: 
 *   Single payee: PAYEE_ADDRESS=0x... npx hardhat run scripts/releasePayment.js --network base
 *   All payees: RELEASE_ALL=true npx hardhat run scripts/releasePayment.js --network base
 * 
 * Set CONTRACT_ADDRESS environment variable
 */

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${message} (yes/no): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

/**
 * Get all payees from contract
 */
async function getAllPayees(contract) {
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

    return payees;
}

/**
 * Calculate releasable amount for a payee
 */
async function getReleasableAmount(contract, payeeAddress) {
    const totalShares = await contract.totalShares();
    const shares = await contract.shares(payeeAddress);
    const released = await contract.released(payeeAddress);
    const contractBalance = await hre.ethers.provider.getBalance(await contract.getAddress());
    const totalReleased = await contract.totalReleased();
    const totalReceived = contractBalance + totalReleased;

    // Calculate total due
    const totalDue = (totalReceived * shares) / totalShares;

    // Calculate releasable (total due minus already released)
    const releasable = totalDue - released;

    return {
        shares,
        released,
        releasable,
        totalDue
    };
}

/**
 * Release payment to a single payee
 */
async function releaseSinglePayee(contract, payeeAddress, showDetails = true) {
    if (showDetails) {
        console.log(`\n🔍 Checking payee: ${payeeAddress}`);
    }

    // Check if payee has shares
    const shares = await contract.shares(payeeAddress);
    if (shares === 0n) {
        console.log(`❌ Error: ${payeeAddress} is not a payee in this contract\n`);
        return null;
    }

    // Get releasable amount
    const info = await getReleasableAmount(contract, payeeAddress);

    if (showDetails) {
        console.log(`   Shares: ${info.shares}`);
        console.log(`   Already Released: ${hre.ethers.formatEther(info.released)} ETH`);
        console.log(`   Releasable Amount: ${hre.ethers.formatEther(info.releasable)} ETH`);
    }

    if (info.releasable === 0n) {
        if (showDetails) {
            console.log(`\n⚠️  No funds available to release for this payee.\n`);
        }
        return null;
    }

    // Confirm release
    if (showDetails) {
        console.log(`\n💰 Ready to release ${hre.ethers.formatEther(info.releasable)} ETH to ${payeeAddress}`);
        const confirmed = await promptConfirmation("Proceed with release?");
        if (!confirmed) {
            console.log("❌ Release cancelled by user.\n");
            return null;
        }
    }

    // Execute release
    console.log(`\n⏳ Releasing payment to ${payeeAddress}...`);
    const tx = await contract.release(payeeAddress);
    const receipt = await tx.wait();

    return {
        payeeAddress,
        amount: info.releasable,
        receipt,
        previousReleased: info.released
    };
}

async function main() {
    try {
        console.log("💸 SplitStream Payment Releaser\n");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        // Get contract address
        const contractAddress = process.env.CONTRACT_ADDRESS;
        if (!contractAddress) {
            console.error("❌ Error: CONTRACT_ADDRESS not set");
            console.log("\n💡 Usage:");
            console.log("   Single: CONTRACT_ADDRESS=0x... PAYEE_ADDRESS=0x... npx hardhat run scripts/releasePayment.js --network base");
            console.log("   All:    CONTRACT_ADDRESS=0x... RELEASE_ALL=true npx hardhat run scripts/releasePayment.js --network base\n");
            process.exit(1);
        }

        // Validate contract address
        if (!hre.ethers.isAddress(contractAddress)) {
            console.error(`❌ Error: Invalid contract address format: ${contractAddress}\n`);
            process.exit(1);
        }

        // Get release mode
        const releaseAll = process.env.RELEASE_ALL === 'true';
        const payeeAddress = process.env.PAYEE_ADDRESS;

        if (!releaseAll && !payeeAddress) {
            console.error("❌ Error: PAYEE_ADDRESS not set and RELEASE_ALL is not true");
            console.log("\n💡 Usage:");
            console.log("   Specify PAYEE_ADDRESS=0x... for single release, or");
            console.log("   Set RELEASE_ALL=true to release to all payees\n");
            process.exit(1);
        }

        if (!releaseAll && !hre.ethers.isAddress(payeeAddress)) {
            console.error(`❌ Error: Invalid payee address format: ${payeeAddress}\n`);
            process.exit(1);
        }

        // Get network info
        const network = await hre.ethers.provider.getNetwork();
        const signer = (await hre.ethers.getSigners())[0];

        console.log("📋 Release Details");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Contract Address:  ${contractAddress}`);
        console.log(`Network:           ${hre.network.name} (Chain ID: ${network.chainId})`);
        console.log(`Caller:            ${signer.address}`);
        console.log(`Mode:              ${releaseAll ? 'Release to ALL payees' : 'Single payee release'}`);
        if (!releaseAll) {
            console.log(`Payee Address:     ${payeeAddress}`);
        }
        console.log();

        // Mainnet safety check
        if (hre.network.name === "base" && network.chainId === 8453n) {
            console.log("⚠️  You are executing on Base Mainnet!");
            const confirmed = await promptConfirmation("Do you want to continue?");
            if (!confirmed) {
                console.log("\n❌ Operation cancelled by user.\n");
                process.exit(0);
            }
            console.log();
        }

        // Connect to contract
        console.log("⏳ Connecting to contract...");
        const SplitStream = await hre.ethers.getContractFactory("SplitStream");
        const contract = SplitStream.attach(contractAddress);

        // Verify contract exists
        const code = await hre.ethers.provider.getCode(contractAddress);
        if (code === "0x") {
            console.error(`❌ Error: No contract found at address ${contractAddress}\n`);
            process.exit(1);
        }

        console.log("✅ Contract connected!\n");

        // Get contract state before
        const contractBalanceBefore = await hre.ethers.provider.getBalance(contractAddress);
        const totalReleasedBefore = await contract.totalReleased();

        console.log("📊 Contract State Before");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Contract Balance:  ${hre.ethers.formatEther(contractBalanceBefore)} ETH`);
        console.log(`Total Released:    ${hre.ethers.formatEther(totalReleasedBefore)} ETH`);

        let results = [];

        if (releaseAll) {
            // Release to all payees
            console.log("\n🔄 Releasing to all payees...\n");

            const payees = await getAllPayees(contract);
            console.log(`Found ${payees.length} payee(s)\n`);

            if (payees.length === 0) {
                console.log("⚠️  No payees found in contract.\n");
                process.exit(0);
            }

            // Confirm batch release
            console.log("⚠️  Batch Release Confirmation");
            const confirmed = await promptConfirmation(`Release payments to all ${payees.length} payees?`);
            if (!confirmed) {
                console.log("\n❌ Batch release cancelled by user.\n");
                process.exit(0);
            }

            // Release to each payee
            for (let i = 0; i < payees.length; i++) {
                console.log(`\n[${i + 1}/${payees.length}] Processing ${payees[i]}...`);

                const result = await releaseSinglePayee(contract, payees[i], false);
                if (result) {
                    results.push(result);
                    console.log(`✅ Released ${hre.ethers.formatEther(result.amount)} ETH`);
                } else {
                    console.log(`⏭️  Skipped (no funds available)`);
                }
            }

        } else {
            // Single payee release
            const result = await releaseSinglePayee(contract, payeeAddress, true);
            if (result) {
                results.push(result);
            }
        }

        if (results.length === 0) {
            console.log("\n⚠️  No payments were released.\n");
            process.exit(0);
        }

        // Display results
        console.log("\n✅ Release Summary");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        let totalReleased = 0n;
        let totalGasCost = 0n;

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const gasPrice = result.receipt.gasPrice || 0n;
            const gasCost = result.receipt.gasUsed * gasPrice;
            totalReleased += result.amount;
            totalGasCost += gasCost;

            console.log(`\n${i + 1}. Payee: ${result.payeeAddress}`);
            console.log(`   Amount Released:     ${hre.ethers.formatEther(result.amount)} ETH`);
            console.log(`   Transaction Hash:    ${result.receipt.hash}`);
            console.log(`   Block Number:        ${result.receipt.blockNumber}`);
            console.log(`   Gas Used:            ${result.receipt.gasUsed.toString()}`);
            console.log(`   Gas Cost:            ${hre.ethers.formatEther(gasCost)} ETH`);
            console.log(`   Total Released Now:  ${hre.ethers.formatEther(result.previousReleased + result.amount)} ETH`);
        }

        // Get contract state after
        const contractBalanceAfter = await hre.ethers.provider.getBalance(contractAddress);
        const totalReleasedAfter = await contract.totalReleased();

        console.log("\n📊 Contract State After");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Contract Balance:  ${hre.ethers.formatEther(contractBalanceAfter)} ETH`);
        console.log(`Total Released:    ${hre.ethers.formatEther(totalReleasedAfter)} ETH`);

        console.log("\n📈 Comparison");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Balance Change:        -${hre.ethers.formatEther(contractBalanceBefore - contractBalanceAfter)} ETH`);
        console.log(`Total Released:        ${hre.ethers.formatEther(totalReleased)} ETH`);
        console.log(`Total Gas Cost:        ${hre.ethers.formatEther(totalGasCost)} ETH`);
        console.log(`Transactions:          ${results.length}`);

        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("✅ Release completed successfully!\n");

        if (results.length === 1) {
            console.log("💡 Next Steps:");
            console.log(`   - View transaction: https://basescan.org/tx/${results[0].receipt.hash}\n`);
        }

    } catch (error) {
        console.error("\n❌ Release failed!");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        if (error.message && error.message.includes("account has no shares")) {
            console.error("Error: The specified address is not a payee in this contract\n");
        } else if (error.message && error.message.includes("account is not due payment")) {
            console.error("Error: No payment is due to this payee");
            console.log("The payee may have already withdrawn all available funds.\n");
        } else if (error.code === "INSUFFICIENT_FUNDS") {
            console.error("Insufficient Funds: Not enough ETH for gas fees");
            console.log("Please ensure your wallet has enough ETH for gas.\n");
        } else if (error.code === "NETWORK_ERROR") {
            console.error("Network Error: Unable to connect to the network");
            console.log("Please check your internet connection and RPC URL.\n");
        } else if (error.code === "CALL_EXCEPTION") {
            console.error("Contract Error: Transaction would fail");
            console.log("This may indicate the contract doesn't support this operation.\n");
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
