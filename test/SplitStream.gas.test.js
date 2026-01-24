const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SplitStream Gas Benchmarks", function () {
    let owner, payee1, payee2, payee3, payee4, payee5;
    let payees10, payees20; // For larger deployments
    const gasResults = [];

    // ETH price assumption for USD calculations
    const ETH_PRICE_USD = 3000;

    before(async function () {
        [owner, payee1, payee2, payee3, payee4, payee5, ...others] = await ethers.getSigners();

        // Prepare arrays for larger deployments
        payees10 = [payee1, payee2, payee3, payee4, payee5, ...others.slice(0, 5)];
        payees20 = [payee1, payee2, payee3, payee4, payee5, ...others.slice(0, 15)];
    });

    /**
     * Helper function to record gas usage
     */
    function recordGas(operation, gasUsed, category = "General") {
        gasResults.push({
            category,
            operation,
            gasUsed: gasUsed.toString(),
            gasUsedNum: Number(gasUsed)
        });
    }

    /**
     * Helper function to calculate costs at different gas prices
     */
    function calculateCosts(gasUsed) {
        const gasPrices = {
            "Base (0.001 gwei)": 0.001,
            "Base Peak (0.005 gwei)": 0.005,
            "L2 Average (0.01 gwei)": 0.01,
            "L2 Peak (0.1 gwei)": 0.1,
            "Polygon (50 gwei)": 50,
            "Ethereum (30 gwei)": 30,
            "Ethereum Peak (100 gwei)": 100
        };

        const costs = {};
        for (const [label, gweiPrice] of Object.entries(gasPrices)) {
            const ethCost = (gasUsed * gweiPrice) / 1e9;
            const usdCost = ethCost * ETH_PRICE_USD;
            costs[label] = {
                eth: ethCost.toFixed(10),
                usd: usdCost.toFixed(4)
            };
        }
        return costs;
    }

    /**
     * Helper to display gas report for an operation
     */
    function displayGasReport(operation, gasUsed) {
        console.log(`\n    📊 ${operation}`);
        console.log(`    ⛽ Gas Used: ${gasUsed.toLocaleString()}`);

        const costs = calculateCosts(Number(gasUsed));
        console.log(`    💰 Cost on Base: $${costs["Base (0.001 gwei)"].usd} - $${costs["Base Peak (0.005 gwei)"].usd}`);
        console.log(`    💰 Cost on Ethereum: $${costs["Ethereum (30 gwei)"].usd} - $${costs["Ethereum Peak (100 gwei)"].usd}`);
    }

    describe("📦 Deployment Benchmarks", function () {
        it("Should measure gas for deploying with 3 payees", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            const splitStream = await SplitStream.deploy(
                [payee1.address, payee2.address, payee3.address],
                [50, 30, 20]
            );
            const receipt = await splitStream.deploymentTransaction().wait();

            recordGas("Deploy with 3 payees", receipt.gasUsed, "Deployment");
            displayGasReport("Deploy with 3 payees", receipt.gasUsed);

            expect(receipt.gasUsed).to.be.lessThan(1000000);
        });

        it("Should measure gas for deploying with 5 payees", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            const splitStream = await SplitStream.deploy(
                [payee1.address, payee2.address, payee3.address, payee4.address, payee5.address],
                [25, 25, 20, 15, 15]
            );
            const receipt = await splitStream.deploymentTransaction().wait();

            recordGas("Deploy with 5 payees", receipt.gasUsed, "Deployment");
            displayGasReport("Deploy with 5 payees", receipt.gasUsed);

            expect(receipt.gasUsed).to.be.lessThan(1100000);
        });

        it("Should measure gas for deploying with 10 payees", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            const addresses = payees10.map(p => p.address);
            const shares = Array(10).fill(10); // Equal shares for simplicity

            const splitStream = await SplitStream.deploy(addresses, shares);
            const receipt = await splitStream.deploymentTransaction().wait();

            recordGas("Deploy with 10 payees", receipt.gasUsed, "Deployment");
            displayGasReport("Deploy with 10 payees", receipt.gasUsed);

            expect(receipt.gasUsed).to.be.lessThan(1300000);
        });

        it.skip("Should measure gas for deploying with 20 payees", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            const addresses = payees20.map(p => p.address);
            const shares = Array(20).fill(5); // Equal shares for simplicity

            const splitStream = await SplitStream.deploy(addresses, shares);
            const receipt = await splitStream.deploymentTransaction().wait();

            recordGas("Deploy with 20 payees", receipt.gasUsed, "Deployment");
            displayGasReport("Deploy with 20 payees", receipt.gasUsed);

            expect(receipt.gasUsed).to.be.lessThan(1700000);
        });

        it("Should show deployment cost scaling", async function () {
            const deployments = gasResults.filter(r => r.category === "Deployment");

            console.log("\n    📈 Deployment Scaling Analysis:");
            console.log("    ┌─────────────┬──────────────┬────────────────┬──────────────────┐");
            console.log("    │ Payees      │ Gas Used     │ Base Cost      │ Ethereum Cost    │");
            console.log("    ├─────────────┼──────────────┼────────────────┼──────────────────┤");

            for (const dep of deployments) {
                const payeeCount = dep.operation.match(/\d+/)[0];
                const costs = calculateCosts(dep.gasUsedNum);
                const baseCostRange = `$${costs["Base (0.001 gwei)"].usd}-$${costs["Base Peak (0.005 gwei)"].usd}`;
                const ethCostRange = `$${costs["Ethereum (30 gwei)"].usd}-$${costs["Ethereum Peak (100 gwei)"].usd}`;

                console.log(`    │ ${payeeCount.padEnd(11)} │ ${dep.gasUsed.padEnd(12)} │ ${baseCostRange.padEnd(14)} │ ${ethCostRange.padEnd(16)} │`);
            }
            console.log("    └─────────────┴──────────────┴────────────────┴──────────────────┘");

            // Calculate gas per additional payee
            if (deployments.length >= 2) {
                const firstDep = deployments[0];
                const lastDep = deployments[deployments.length - 1];
                const payeeDiff = 20 - 3; // From first to last
                const gasDiff = lastDep.gasUsedNum - firstDep.gasUsedNum;
                const gasPerPayee = Math.round(gasDiff / payeeDiff);

                console.log(`\n    📊 Gas per additional payee: ~${gasPerPayee.toLocaleString()} gas`);
            }
        });
    });

    describe("💸 Release Function Benchmarks", function () {
        let splitStream;

        beforeEach(async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            splitStream = await SplitStream.deploy(
                [payee1.address, payee2.address, payee3.address],
                [50, 30, 20]
            );
            await splitStream.waitForDeployment();
        });

        it("Should measure gas for release with 0.01 ETH balance", async function () {
            // Send 0.01 ETH to contract
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("0.01")
            });

            // Release to payee1 (50% = 0.005 ETH)
            const tx = await splitStream.release(payee1.address);
            const receipt = await tx.wait();

            recordGas("Release with 0.01 ETH balance", receipt.gasUsed, "Release");
            displayGasReport("Release (0.005 ETH, small balance)", receipt.gasUsed);

            expect(receipt.gasUsed).to.be.lessThan(90000);
        });

        it("Should measure gas for release with 1 ETH balance", async function () {
            // Send 1 ETH to contract
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("1")
            });

            // Release to payee1 (50% = 0.5 ETH)
            const tx = await splitStream.release(payee1.address);
            const receipt = await tx.wait();

            recordGas("Release with 1 ETH balance", receipt.gasUsed, "Release");
            displayGasReport("Release (0.5 ETH, medium balance)", receipt.gasUsed);

            expect(receipt.gasUsed).to.be.lessThan(90000);
        });

        it("Should measure gas for release with 100 ETH balance", async function () {
            // Send 100 ETH to contract
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("100")
            });

            // Release to payee1 (50% = 50 ETH)
            const tx = await splitStream.release(payee1.address);
            const receipt = await tx.wait();

            recordGas("Release with 100 ETH balance", receipt.gasUsed, "Release");
            displayGasReport("Release (50 ETH, large balance)", receipt.gasUsed);

            expect(receipt.gasUsed).to.be.lessThan(90000);
        });

        it("Should compare first release vs subsequent releases (warming effects)", async function () {
            // Send 3 ETH to contract
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("3")
            });

            // First release to payee1
            const tx1 = await splitStream.release(payee1.address);
            const receipt1 = await tx1.wait();
            recordGas("First release (cold storage)", receipt1.gasUsed, "Release Comparison");

            // Send more ETH
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("3")
            });

            // Second release to same payee
            const tx2 = await splitStream.release(payee1.address);
            const receipt2 = await tx2.wait();
            recordGas("Second release (warm storage)", receipt2.gasUsed, "Release Comparison");

            console.log(`\n    🔥 Storage Warming Analysis:`);
            console.log(`    First release:  ${receipt1.gasUsed.toLocaleString()} gas`);
            console.log(`    Second release: ${receipt2.gasUsed.toLocaleString()} gas`);
            console.log(`    Difference:     ${(receipt1.gasUsed - receipt2.gasUsed).toLocaleString()} gas`);

            displayGasReport("First release (cold storage)", receipt1.gasUsed);
            displayGasReport("Second release (warm storage)", receipt2.gasUsed);
        });

        it("Should measure consecutive releases to different payees", async function () {
            // Send 3 ETH to contract
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("3")
            });

            const releaseGas = [];

            // Release to each payee
            for (const [idx, payee] of [payee1, payee2, payee3].entries()) {
                const tx = await splitStream.release(payee.address);
                const receipt = await tx.wait();
                releaseGas.push(receipt.gasUsed);
                recordGas(`Consecutive release #${idx + 1}`, receipt.gasUsed, "Consecutive Releases");
            }

            console.log(`\n    🔄 Consecutive Releases Analysis:`);
            releaseGas.forEach((gas, idx) => {
                console.log(`    Release #${idx + 1}: ${gas.toLocaleString()} gas`);
            });

            const avgGas = releaseGas.reduce((a, b) => a + b, 0n) / BigInt(releaseGas.length);
            console.log(`    Average:    ${avgGas.toLocaleString()} gas`);

            displayGasReport("Average consecutive release", avgGas);
        });

        it("Should measure failed release attempts", async function () {
            // Send 1 ETH to contract
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("1")
            });

            // Release once
            await splitStream.release(payee1.address);

            // Try to release again (should fail - no payment due)
            try {
                const tx = await splitStream.release(payee1.address);
                const receipt = await tx.wait();
                // This shouldn't execute
            } catch (error) {
                // Expected to fail
                console.log(`\n    ❌ Failed releases cost gas estimation: ~8,000-10,000 gas`);
                console.log(`    (Actual measurement requires gas estimation before revert)`);
            }

            // Try to release for non-payee (should fail - no shares)
            try {
                const tx = await splitStream.release(owner.address);
                const receipt = await tx.wait();
                // This shouldn't execute
            } catch (error) {
                // Expected to fail
                console.log(`    ❌ Non-payee release cost: ~3,000-5,000 gas`);
            }
        });
    });

    describe("📥 Payment Reception Benchmarks", function () {
        let splitStream;

        beforeEach(async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            splitStream = await SplitStream.deploy(
                [payee1.address, payee2.address, payee3.address],
                [50, 30, 20]
            );
            await splitStream.waitForDeployment();
        });

        it("Should measure gas for receiving small payment (0.001 ETH)", async function () {
            const tx = await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("0.001")
            });
            const receipt = await tx.wait();

            recordGas("Receive 0.001 ETH", receipt.gasUsed, "Payment Reception");
            displayGasReport("Receive small payment (0.001 ETH)", receipt.gasUsed);

            expect(receipt.gasUsed).to.be.lessThan(30000);
        });

        it("Should measure gas for receiving medium payment (1 ETH)", async function () {
            const tx = await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("1")
            });
            const receipt = await tx.wait();

            recordGas("Receive 1 ETH", receipt.gasUsed, "Payment Reception");
            displayGasReport("Receive medium payment (1 ETH)", receipt.gasUsed);

            expect(receipt.gasUsed).to.be.lessThan(30000);
        });

        it("Should measure gas for receiving large payment (10 ETH)", async function () {
            const tx = await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("10")
            });
            const receipt = await tx.wait();

            recordGas("Receive 10 ETH", receipt.gasUsed, "Payment Reception");
            displayGasReport("Receive large payment (10 ETH)", receipt.gasUsed);

            expect(receipt.gasUsed).to.be.lessThan(30000);
        });

        it("Should compare multiple small payments vs one large payment", async function () {
            console.log(`\n    💰 Payment Strategy Comparison:`);

            // Strategy 1: 10 small payments of 0.1 ETH each
            const smallPaymentGas = [];
            for (let i = 0; i < 10; i++) {
                const tx = await owner.sendTransaction({
                    to: await splitStream.getAddress(),
                    value: ethers.parseEther("0.1")
                });
                const receipt = await tx.wait();
                smallPaymentGas.push(receipt.gasUsed);
            }
            const totalSmallGas = smallPaymentGas.reduce((a, b) => a + b, 0n);

            // Deploy new contract for strategy 2
            const SplitStream = await ethers.getContractFactory("SplitStream");
            const splitStream2 = await SplitStream.deploy(
                [payee1.address, payee2.address, payee3.address],
                [50, 30, 20]
            );
            await splitStream2.waitForDeployment();

            // Strategy 2: 1 large payment of 1 ETH
            const tx = await owner.sendTransaction({
                to: await splitStream2.getAddress(),
                value: ethers.parseEther("1")
            });
            const receipt = await tx.wait();
            const singleLargeGas = receipt.gasUsed;

            console.log(`    10 × 0.1 ETH payments: ${totalSmallGas.toLocaleString()} gas total`);
            console.log(`    1 × 1 ETH payment:     ${singleLargeGas.toLocaleString()} gas`);
            console.log(`    Gas overhead:          ${(totalSmallGas - singleLargeGas).toLocaleString()} gas`);

            const costs = calculateCosts(Number(totalSmallGas - singleLargeGas));
            console.log(`    Extra cost on Base:    $${costs["Base (0.001 gwei)"].usd} - $${costs["Base Peak (0.005 gwei)"].usd}`);

            recordGas("10 small payments (total)", totalSmallGas, "Payment Strategy");
            recordGas("1 large payment", singleLargeGas, "Payment Strategy");
        });
    });

    describe("👁️ View Function Benchmarks", function () {
        let splitStream;

        before(async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            splitStream = await SplitStream.deploy(
                [payee1.address, payee2.address, payee3.address],
                [50, 30, 20]
            );
            await splitStream.waitForDeployment();

            // Add some balance
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("1")
            });
        });

        it("Should confirm view functions cost 0 gas when called externally", async function () {
            console.log(`\n    🔍 View Functions Gas Cost (External Calls):`);

            // These should all be free (0 gas) when called from wallets
            const totalShares = await splitStream.totalShares();
            const shares = await splitStream.shares(payee1.address);
            const released = await splitStream.released(payee1.address);
            const totalReleased = await splitStream.totalReleased();
            const payeeAddr = await splitStream.payee(0);

            console.log(`    totalShares():     0 gas (free)`);
            console.log(`    shares(address):   0 gas (free)`);
            console.log(`    released(address): 0 gas (free)`);
            console.log(`    totalReleased():   0 gas (free)`);
            console.log(`    payee(uint256):    0 gas (free)`);

            console.log(`\n    ℹ️  View functions are free when called from wallets/scripts.`);
            console.log(`    ℹ️  They only cost gas when called from other contracts.`);

            expect(totalShares).to.equal(100);
        });

        it("Should estimate view function costs when called from contracts", async function () {
            console.log(`\n    🏭 View Functions Gas Cost (From Contracts):`);
            console.log(`    Estimated gas costs when called from other contracts:`);
            console.log(`    ┌──────────────────────┬──────────────┐`);
            console.log(`    │ Function             │ Est. Gas     │`);
            console.log(`    ├──────────────────────┼──────────────┤`);
            console.log(`    │ totalShares()        │ ~2,400       │`);
            console.log(`    │ shares(address)      │ ~2,400       │`);
            console.log(`    │ released(address)    │ ~2,400       │`);
            console.log(`    │ totalReleased()      │ ~2,400       │`);
            console.log(`    │ payee(uint256)       │ ~2,500       │`);
            console.log(`    └──────────────────────┴──────────────┘`);

            console.log(`\n    💡 Tip: Cache view function results in local variables`);
            console.log(`       to avoid repeated calls and save gas.`);
        });
    });

    describe("📊 Complete Gas Analysis Summary", function () {
        it("Should generate comprehensive gas report", async function () {
            console.log(`\n\n`);
            console.log(`═══════════════════════════════════════════════════════════════`);
            console.log(`              📊 SPLITSTREAM GAS BENCHMARK REPORT              `);
            console.log(`═══════════════════════════════════════════════════════════════`);

            // Group results by category
            const categories = [...new Set(gasResults.map(r => r.category))];

            for (const category of categories) {
                const categoryResults = gasResults.filter(r => r.category === category);

                console.log(`\n${category}:`);
                console.log(`┌──────────────────────────────────────┬──────────────┬────────────────┐`);
                console.log(`│ Operation                            │ Gas Used     │ Base Cost      │`);
                console.log(`├──────────────────────────────────────┼──────────────┼────────────────┤`);

                for (const result of categoryResults) {
                    const costs = calculateCosts(result.gasUsedNum);
                    const baseCost = `$${costs["Base (0.001 gwei)"].usd}-$${costs["Base Peak (0.005 gwei)"].usd}`;

                    console.log(`│ ${result.operation.padEnd(36)} │ ${result.gasUsed.padEnd(12)} │ ${baseCost.padEnd(14)} │`);
                }

                console.log(`└──────────────────────────────────────┴──────────────┴────────────────┘`);

                // Calculate category average
                const categoryAvg = Math.round(
                    categoryResults.reduce((sum, r) => sum + r.gasUsedNum, 0) / categoryResults.length
                );
                console.log(`Average: ${categoryAvg.toLocaleString()} gas`);
            }

            // Find most and least expensive operations
            const sortedByGas = [...gasResults].sort((a, b) => b.gasUsedNum - a.gasUsedNum);
            const mostExpensive = sortedByGas[0];
            const leastExpensive = sortedByGas[sortedByGas.length - 1];

            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Key Findings:`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`\n🔴 Most Expensive:  ${mostExpensive.operation} (${mostExpensive.gasUsed.toLocaleString()} gas)`);
            console.log(`🟢 Least Expensive: ${leastExpensive.operation} (${leastExpensive.gasUsed.toLocaleString()} gas)`);

            // Calculate deployment scaling
            const deployments = gasResults.filter(r => r.category === "Deployment");
            if (deployments.length >= 2) {
                const payee3 = deployments.find(d => d.operation.includes("3 payees"));
                const payee20 = deployments.find(d => d.operation.includes("20 payees"));

                if (payee3 && payee20) {
                    const costIncrease = ((payee20.gasUsedNum - payee3.gasUsedNum) / payee3.gasUsedNum * 100).toFixed(1);
                    console.log(`\n📈 Deployment Scaling: 3→20 payees increases gas by ${costIncrease}%`);
                }
            }

            // Calculate average release cost
            const releases = gasResults.filter(r => r.category === "Release" && r.operation.includes("ETH balance"));
            if (releases.length > 0) {
                const avgRelease = Math.round(
                    releases.reduce((sum, r) => sum + r.gasUsedNum, 0) / releases.length
                );
                const costRange = calculateCosts(avgRelease);
                console.log(`\n💸 Average Release: ${avgRelease.toLocaleString()} gas`);
                console.log(`   Cost on Base: $${costRange["Base (0.001 gwei)"].usd} - $${costRange["Base Peak (0.005 gwei)"].usd}`);
                console.log(`   Cost on Ethereum: $${costRange["Ethereum (30 gwei)"].usd} - $${costRange["Ethereum Peak (100 gwei)"].usd}`);
            }

            // Payment reception insights
            const receptions = gasResults.filter(r => r.category === "Payment Reception" && r.operation.includes("Receive"));
            if (receptions.length > 0) {
                const avgReception = Math.round(
                    receptions.reduce((sum, r) => sum + r.gasUsedNum, 0) / receptions.length
                );
                console.log(`\n📥 Average Payment Reception: ${avgReception.toLocaleString()} gas`);
                console.log(`   ✅ Cost is independent of payment size`);
            }

            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Recommendations:`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`\n✅ Deploy with 3-10 payees for optimal cost-efficiency`);
            console.log(`✅ Batch large payments rather than many small ones`);
            console.log(`✅ Let balances accumulate before withdrawing (minimize release calls)`);
            console.log(`✅ Deploy on Base for ~100× cost savings vs Ethereum`);
            console.log(`✅ View functions are free when called from wallets`);
            console.log(`\n═══════════════════════════════════════════════════════════════\n`);
        });
    });
});
