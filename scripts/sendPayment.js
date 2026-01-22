const hre = require("hardhat");
const readline = require("readline");

/**
 * Utility script to send test payments to SplitStream contract
 * Usage: 
 *   AMOUNT=0.1 npx hardhat run scripts/sendPayment.js --network base
 *   Or just: npx hardhat run scripts/sendPayment.js (uses default 0.001 ETH)
 * 
 * Set CONTRACT_ADDRESS environment variable
 */

// Safety limit: warn if sending more than this amount
const LARGE_AMOUNT_THRESHOLD_ETH = "1.0"; // 1 ETH
const DEFAULT_AMOUNT_ETH = "0.001"; // 0.001 ETH

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
 * Get payee information
 */
async function getPayeeInfo(contract, totalShares, totalEverReceived) {
    const payees = [];
    let index = 0;

    try {
        while (true) {
            const payeeAddress = await contract.payee(index);
            const shares = await contract.shares(payeeAddress);
            const released = await contract.released(payeeAddress);
            const totalDue = (totalEverReceived * shares) / totalShares;
            const pending = totalDue - released;

            payees.push({
                address: payeeAddress,
                shares,
                released,
                pending,
                totalDue
            });
            index++;
        }
    } catch (error) {
        // Expected error when we've found all payees
    }

    return payees;
}

async function main() {
    try {
        console.log("💸 SplitStream Payment Sender\n");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        // Get contract address
        const contractAddress = process.env.CONTRACT_ADDRESS;
        if (!contractAddress) {
            console.error("❌ Error: CONTRACT_ADDRESS not set");
            console.log("\n💡 Usage:");
            console.log("   CONTRACT_ADDRESS=0x... AMOUNT=0.1 npx hardhat run scripts/sendPayment.js --network base\n");
            process.exit(1);
        }

        // Validate contract address
        if (!hre.ethers.isAddress(contractAddress)) {
            console.error(`❌ Error: Invalid contract address format: ${contractAddress}\n`);
            process.exit(1);
        }

        // Get payment amount from environment variable or use default
        const amountEth = process.env.AMOUNT || DEFAULT_AMOUNT_ETH;
        const amount = hre.ethers.parseEther(amountEth);

        // Get network and signer info
        const network = await hre.ethers.provider.getNetwork();
        const signer = (await hre.ethers.getSigners())[0];
        const signerBalance = await hre.ethers.provider.getBalance(signer.address);

        console.log("📋 Payment Details");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Contract Address:  ${contractAddress}`);
        console.log(`Network:           ${hre.network.name} (Chain ID: ${network.chainId})`);
        console.log(`Sender:            ${signer.address}`);
        console.log(`Sender Balance:    ${hre.ethers.formatEther(signerBalance)} ETH`);
        console.log(`Payment Amount:    ${amountEth} ETH\n`);

        // Safety check for large amounts
        if (parseFloat(amountEth) > parseFloat(LARGE_AMOUNT_THRESHOLD_ETH)) {
            console.log(`⚠️  WARNING: You are about to send ${amountEth} ETH (>${LARGE_AMOUNT_THRESHOLD_ETH} ETH)`);
            const confirmed = await promptConfirmation("Are you sure you want to proceed?");
            if (!confirmed) {
                console.log("\n❌ Payment cancelled by user.\n");
                process.exit(0);
            }
        }

        // Mainnet safety check
        if (hre.network.name === "base" && network.chainId === 8453n) {
            console.log("⚠️  You are sending real ETH on Base Mainnet!");
            const confirmed = await promptConfirmation("Do you want to continue?");
            if (!confirmed) {
                console.log("\n❌ Payment cancelled by user.\n");
                process.exit(0);
            }
        }

        // Check if sender has enough balance
        if (signerBalance < amount) {
            console.error(`❌ Error: Insufficient balance`);
            console.log(`   Required: ${amountEth} ETH`);
            console.log(`   Available: ${hre.ethers.formatEther(signerBalance)} ETH\n`);
            process.exit(1);
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

        // Capture BEFORE state
        console.log("📊 Before Payment");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const balanceBefore = await hre.ethers.provider.getBalance(contractAddress);
        const totalSharesBefore = await contract.totalShares();
        const totalReleasedBefore = await contract.totalReleased();
        const totalEverReceivedBefore = balanceBefore + totalReleasedBefore;

        console.log(`Contract Balance:    ${hre.ethers.formatEther(balanceBefore)} ETH`);
        console.log(`Total Shares:        ${totalSharesBefore}`);
        console.log(`Total Released:      ${hre.ethers.formatEther(totalReleasedBefore)} ETH`);
        console.log(`Total Ever Received: ${hre.ethers.formatEther(totalEverReceivedBefore)} ETH\n`);

        // Get payee info before
        const payeesBefore = await getPayeeInfo(contract, totalSharesBefore, totalEverReceivedBefore);

        if (payeesBefore.length > 0) {
            console.log("Payee Pending Amounts:");
            for (let i = 0; i < payeesBefore.length; i++) {
                const p = payeesBefore[i];
                const shortAddr = `${p.address.slice(0, 6)}...${p.address.slice(-4)}`;
                console.log(`  ${i + 1}. ${shortAddr}: ${hre.ethers.formatEther(p.pending)} ETH pending`);
            }
            console.log();
        }

        // Send payment
        console.log("💰 Sending Payment");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Sending ${amountEth} ETH to contract...\n`);

        const tx = await signer.sendTransaction({
            to: contractAddress,
            value: amount
        });

        console.log(`⏳ Transaction sent: ${tx.hash}`);
        console.log("   Waiting for confirmation...\n");

        // Wait for confirmation
        const receipt = await tx.wait();

        // Display transaction details
        console.log("✅ Transaction Confirmed!");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Transaction Hash:  ${receipt.hash}`);
        console.log(`Block Number:      ${receipt.blockNumber}`);
        console.log(`Gas Used:          ${receipt.gasUsed.toString()}`);

        const gasPrice = receipt.gasPrice || tx.gasPrice;
        const gasCost = receipt.gasUsed * gasPrice;
        console.log(`Gas Price:         ${hre.ethers.formatUnits(gasPrice, "gwei")} gwei`);
        console.log(`Gas Cost:          ${hre.ethers.formatEther(gasCost)} ETH`);
        console.log(`Status:            ${receipt.status === 1 ? 'Success' : 'Failed'}\n`);

        // Capture AFTER state
        console.log("📊 After Payment");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const balanceAfter = await hre.ethers.provider.getBalance(contractAddress);
        const totalReleasedAfter = await contract.totalReleased();
        const totalEverReceivedAfter = balanceAfter + totalReleasedAfter;

        console.log(`Contract Balance:    ${hre.ethers.formatEther(balanceAfter)} ETH`);
        console.log(`Total Released:      ${hre.ethers.formatEther(totalReleasedAfter)} ETH`);
        console.log(`Total Ever Received: ${hre.ethers.formatEther(totalEverReceivedAfter)} ETH\n`);

        // Get payee info after
        const payeesAfter = await getPayeeInfo(contract, totalSharesBefore, totalEverReceivedAfter);

        if (payeesAfter.length > 0) {
            console.log("Updated Payee Pending Amounts:");
            for (let i = 0; i < payeesAfter.length; i++) {
                const p = payeesAfter[i];
                const shortAddr = `${p.address.slice(0, 6)}...${p.address.slice(-4)}`;
                console.log(`  ${i + 1}. ${shortAddr}: ${hre.ethers.formatEther(p.pending)} ETH pending`);
            }
            console.log();
        }

        // Display comparison
        console.log("📈 Comparison");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        const balanceIncrease = balanceAfter - balanceBefore;
        console.log(`Balance Change:      +${hre.ethers.formatEther(balanceIncrease)} ETH`);
        console.log(`Payment Sent:        ${amountEth} ETH`);
        console.log(`Match:               ${balanceIncrease === amount ? '✅ Yes' : '❌ No'}\n`);

        if (payeesAfter.length > 0) {
            console.log("Payee Pending Changes:");
            for (let i = 0; i < payeesAfter.length; i++) {
                const before = payeesBefore[i];
                const after = payeesAfter[i];
                const change = after.pending - before.pending;
                const shortAddr = `${after.address.slice(0, 6)}...${after.address.slice(-4)}`;
                const percentage = (Number(after.shares) * 100 / Number(totalSharesBefore)).toFixed(2);
                console.log(`  ${i + 1}. ${shortAddr} (${percentage}%): +${hre.ethers.formatEther(change)} ETH`);
            }
            console.log();
        }

        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("✅ Payment completed successfully!\n");

        console.log("💡 Next Steps:");
        console.log(`   - View transaction: https://basescan.org/tx/${receipt.hash}`);
        console.log("   - Payees can now call release() to claim their updated shares\n");

    } catch (error) {
        console.error("\n❌ Payment failed!");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        if (error.code === "INSUFFICIENT_FUNDS") {
            console.error("Insufficient Funds: Not enough ETH to complete transaction");
            console.log("Please ensure your wallet has enough ETH for the payment plus gas fees.\n");
        } else if (error.code === "NETWORK_ERROR") {
            console.error("Network Error: Unable to connect to the network");
            console.log("Please check your internet connection and RPC URL.\n");
        } else if (error.code === "CALL_EXCEPTION") {
            console.error("Contract Error: Transaction would fail");
            console.log("The contract may not be accepting payments or may not exist.\n");
        } else if (error.message && error.message.includes("user rejected")) {
            console.error("Transaction Rejected: User cancelled the transaction\n");
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
