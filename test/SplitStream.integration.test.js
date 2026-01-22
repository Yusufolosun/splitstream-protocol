const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SplitStream - Integration Tests", function () {
    let SplitStream;
    let owner, alice, bob, charlie, donor1, donor2, donor3;

    beforeEach(async function () {
        [owner, alice, bob, charlie, donor1, donor2, donor3] = await ethers.getSigners();
        SplitStream = await ethers.getContractFactory("SplitStream");
    });

    describe("Team Payroll Scenario", function () {
        it("Should handle monthly payroll for a 3-person team over 6 months", async function () {
            // Deploy contract with team structure: Lead (50%), Developer (30%), Designer (20%)
            const teamSplitter = await SplitStream.deploy(
                [alice.address, bob.address, charlie.address],
                [50, 30, 20]
            );
            await teamSplitter.waitForDeployment();

            const monthlyBudget = ethers.parseEther("10"); // 10 ETH per month

            // Simulate 6 months of payments
            for (let month = 1; month <= 6; month++) {
                // Company sends monthly payment
                await owner.sendTransaction({
                    to: await teamSplitter.getAddress(),
                    value: monthlyBudget
                });

                // Team members withdraw at end of month
                await teamSplitter.release(alice.address);  // Lead gets 5 ETH
                await teamSplitter.release(bob.address);    // Dev gets 3 ETH
                await teamSplitter.release(charlie.address); // Designer gets 2 ETH

                // Verify accumulation is correct
                expect(await teamSplitter.released(alice.address)).to.equal(
                    monthlyBudget * BigInt(month) * 50n / 100n
                );
                expect(await teamSplitter.released(bob.address)).to.equal(
                    monthlyBudget * BigInt(month) * 30n / 100n
                );
                expect(await teamSplitter.released(charlie.address)).to.equal(
                    monthlyBudget * BigInt(month) * 20n / 100n
                );
            }

            // After 6 months, verify total distribution
            expect(await teamSplitter.totalReleased()).to.equal(monthlyBudget * 6n);
            expect(await ethers.provider.getBalance(await teamSplitter.getAddress())).to.equal(0);
        });

        it("Should handle mid-month withdrawals and end-of-month balancing", async function () {
            const teamSplitter = await SplitStream.deploy(
                [alice.address, bob.address, charlie.address],
                [50, 30, 20]
            );
            await teamSplitter.waitForDeployment();

            // Month 1: Payment arrives mid-month
            await owner.sendTransaction({
                to: await teamSplitter.getAddress(),
                value: ethers.parseEther("5")
            });

            // Alice withdraws mid-month
            await teamSplitter.release(alice.address);
            expect(await teamSplitter.released(alice.address)).to.equal(ethers.parseEther("2.5"));

            // Rest of month payment arrives
            await owner.sendTransaction({
                to: await teamSplitter.getAddress(),
                value: ethers.parseEther("5")
            });

            // All withdraw at end of month
            await teamSplitter.release(alice.address);  // Gets remaining 2.5 ETH
            await teamSplitter.release(bob.address);    // Gets full 3 ETH
            await teamSplitter.release(charlie.address); // Gets full 2 ETH

            expect(await teamSplitter.released(alice.address)).to.equal(ethers.parseEther("5"));
            expect(await teamSplitter.released(bob.address)).to.equal(ethers.parseEther("3"));
            expect(await teamSplitter.released(charlie.address)).to.equal(ethers.parseEther("2"));
        });
    });

    describe("Creator Revenue Sharing", function () {
        it("Should handle multiple revenue streams with varying amounts", async function () {
            // Content creators: Writer (40%), Editor (35%), Marketer (25%)
            const creatorSplitter = await SplitStream.deploy(
                [alice.address, bob.address, charlie.address],
                [40, 35, 25]
            );
            await creatorSplitter.waitForDeployment();

            // Revenue stream 1: Ad revenue (small, frequent)
            await donor1.sendTransaction({
                to: await creatorSplitter.getAddress(),
                value: ethers.parseEther("0.5")
            });

            // Revenue stream 2: Sponsorship (medium)
            await donor2.sendTransaction({
                to: await creatorSplitter.getAddress(),
                value: ethers.parseEther("5")
            });

            // Revenue stream 3: Premium subscriptions (large)
            await donor3.sendTransaction({
                to: await creatorSplitter.getAddress(),
                value: ethers.parseEther("20")
            });

            const totalRevenue = ethers.parseEther("25.5");

            // Staged withdrawals - not everyone withdraws immediately
            // Writer withdraws first
            await creatorSplitter.release(alice.address);
            expect(await creatorSplitter.released(alice.address)).to.equal(
                totalRevenue * 40n / 100n
            ); // 10.2 ETH

            // More revenue comes in
            await donor1.sendTransaction({
                to: await creatorSplitter.getAddress(),
                value: ethers.parseEther("4.5")
            });

            // Editor withdraws after new revenue
            await creatorSplitter.release(bob.address);
            const newTotal = ethers.parseEther("30");
            expect(await creatorSplitter.released(bob.address)).to.equal(
                newTotal * 35n / 100n
            ); // 10.5 ETH

            // Marketer waits and withdraws last
            await creatorSplitter.release(charlie.address);
            expect(await creatorSplitter.released(charlie.address)).to.equal(
                newTotal * 25n / 100n
            ); // 7.5 ETH

            // Writer withdraws accumulated amount from new revenue
            await creatorSplitter.release(alice.address);
            expect(await creatorSplitter.released(alice.address)).to.equal(
                newTotal * 40n / 100n
            ); // Now 12 ETH total
        });

        it("Should handle irregular payment patterns over time", async function () {
            const creatorSplitter = await SplitStream.deploy(
                [alice.address, bob.address],
                [60, 40]
            );
            await creatorSplitter.waitForDeployment();

            const payments = [
                ethers.parseEther("1.5"),   // Week 1
                ethers.parseEther("0.3"),   // Week 2
                ethers.parseEther("8"),     // Week 3 (big sponsorship)
                ethers.parseEther("0.5"),   // Week 4
                ethers.parseEther("2.2")    // Week 5
            ];

            let totalPaid = 0n;
            for (const payment of payments) {
                await owner.sendTransaction({
                    to: await creatorSplitter.getAddress(),
                    value: payment
                });
                totalPaid += payment;
            }

            // Both creators withdraw at end
            await creatorSplitter.release(alice.address);
            await creatorSplitter.release(bob.address);

            expect(await creatorSplitter.released(alice.address)).to.equal(
                totalPaid * 60n / 100n
            );
            expect(await creatorSplitter.released(bob.address)).to.equal(
                totalPaid * 40n / 100n
            );
            expect(await creatorSplitter.totalReleased()).to.equal(totalPaid);
        });
    });

    describe("DAO Treasury Distribution", function () {
        it("Should handle large single treasury distribution", async function () {
            // DAO treasury distribution: Community (45%), Development (35%), Operations (20%)
            const daoSplitter = await SplitStream.deploy(
                [alice.address, bob.address, charlie.address],
                [45, 35, 20]
            );
            await daoSplitter.waitForDeployment();

            // Large treasury allocation (1000 ETH)
            const treasuryAmount = ethers.parseEther("1000");
            await owner.sendTransaction({
                to: await daoSplitter.getAddress(),
                value: treasuryAmount
            });

            // Each department withdraws their allocation
            await daoSplitter.release(alice.address);   // Community: 450 ETH
            await daoSplitter.release(bob.address);     // Development: 350 ETH
            await daoSplitter.release(charlie.address); // Operations: 200 ETH

            expect(await daoSplitter.released(alice.address)).to.equal(ethers.parseEther("450"));
            expect(await daoSplitter.released(bob.address)).to.equal(ethers.parseEther("350"));
            expect(await daoSplitter.released(charlie.address)).to.equal(ethers.parseEther("200"));
            expect(await daoSplitter.totalReleased()).to.equal(treasuryAmount);
        });

        it("Should handle quarterly DAO distributions", async function () {
            const daoSplitter = await SplitStream.deploy(
                [alice.address, bob.address, charlie.address],
                [45, 35, 20]
            );
            await daoSplitter.waitForDeployment();

            const quarters = [
                ethers.parseEther("250"),  // Q1
                ethers.parseEther("300"),  // Q2
                ethers.parseEther("275"),  // Q3
                ethers.parseEther("325")   // Q4
            ];

            for (let q = 0; q < quarters.length; q++) {
                // Quarterly distribution
                await owner.sendTransaction({
                    to: await daoSplitter.getAddress(),
                    value: quarters[q]
                });

                // Not everyone withdraws every quarter
                if (q % 2 === 0) {
                    // Community withdraws every other quarter
                    await daoSplitter.release(alice.address);
                }
                if (q > 0) {
                    // Development withdraws from Q2 onwards
                    await daoSplitter.release(bob.address);
                }
            }

            // Operations withdraws everything at year end
            await daoSplitter.release(charlie.address);

            // Final withdrawal for Alice only (Bob already withdrew in Q2, Q3, Q4)
            await daoSplitter.release(alice.address);

            const totalYear = quarters.reduce((a, b) => a + b, 0n);
            expect(await daoSplitter.totalReleased()).to.equal(totalYear);
            expect(await ethers.provider.getBalance(await daoSplitter.getAddress())).to.equal(0);
        });
    });

    describe("Continuous Payment Stream", function () {
        it("Should handle many small payments over time with periodic withdrawals", async function () {
            const streamSplitter = await SplitStream.deploy(
                [alice.address, bob.address],
                [50, 50]
            );
            await streamSplitter.waitForDeployment();

            // Simulate 20 small payments (like daily micro-payments)
            const dailyPayment = ethers.parseEther("0.1");
            for (let day = 1; day <= 20; day++) {
                await owner.sendTransaction({
                    to: await streamSplitter.getAddress(),
                    value: dailyPayment
                });

                // Alice withdraws every 5 days
                if (day % 5 === 0) {
                    await streamSplitter.release(alice.address);
                    expect(await streamSplitter.released(alice.address)).to.equal(
                        dailyPayment * BigInt(day) / 2n
                    );
                }
            }

            // Bob withdraws everything at the end
            await streamSplitter.release(bob.address);
            expect(await streamSplitter.released(bob.address)).to.equal(
                dailyPayment * 20n / 2n
            );

            // Alice already withdrew everything on day 20, verify total
            expect(await streamSplitter.totalReleased()).to.equal(dailyPayment * 20n);
        });

        it("Should handle streaming with withdrawal frequency differences", async function () {
            const streamSplitter = await SplitStream.deploy(
                [alice.address, bob.address, charlie.address],
                [50, 30, 20]
            );
            await streamSplitter.waitForDeployment();

            const payment = ethers.parseEther("1");
            let totalStreamed = 0n;

            // 15 payments
            for (let i = 1; i <= 15; i++) {
                await owner.sendTransaction({
                    to: await streamSplitter.getAddress(),
                    value: payment
                });
                totalStreamed += payment;

                // Alice: Withdraws every payment (frequent)
                await streamSplitter.release(alice.address);

                // Bob: Withdraws every 3 payments (moderate)
                if (i % 3 === 0) {
                    await streamSplitter.release(bob.address);
                }

                // Charlie: Withdraws every 5 payments (infrequent)
                if (i % 5 === 0) {
                    await streamSplitter.release(charlie.address);
                }
            }

            // Final withdrawals (Bob last withdrew at i=15, Charlie at i=15)

            expect(await streamSplitter.released(alice.address)).to.equal(totalStreamed * 50n / 100n);
            expect(await streamSplitter.released(bob.address)).to.equal(totalStreamed * 30n / 100n);
            expect(await streamSplitter.released(charlie.address)).to.equal(totalStreamed * 20n / 100n);
        });
    });

    describe("Emergency Scenarios", function () {
        it("Should handle funds received before payees are aware", async function () {
            const splitter = await SplitStream.deploy(
                [alice.address, bob.address],
                [70, 30]
            );
            await splitter.waitForDeployment();

            // Unexpected large payment arrives (donation, grant, etc.)
            const unexpectedAmount = ethers.parseEther("50");
            await donor1.sendTransaction({
                to: await splitter.getAddress(),
                value: unexpectedAmount
            });

            // Time passes... then payees discover the funds
            // They can withdraw at any time without loss
            await splitter.release(alice.address);
            await splitter.release(bob.address);

            expect(await splitter.released(alice.address)).to.equal(
                unexpectedAmount * 70n / 100n
            );
            expect(await splitter.released(bob.address)).to.equal(
                unexpectedAmount * 30n / 100n
            );
        });

        it("Should handle one payee never withdrawing while others do", async function () {
            const splitter = await SplitStream.deploy(
                [alice.address, bob.address, charlie.address],
                [40, 40, 20]
            );
            await splitter.waitForDeployment();

            // Multiple payment rounds
            for (let i = 0; i < 5; i++) {
                await owner.sendTransaction({
                    to: await splitter.getAddress(),
                    value: ethers.parseEther("10")
                });

                // Alice and Bob withdraw regularly
                await splitter.release(alice.address);
                await splitter.release(bob.address);
                // Charlie never withdraws (lost keys? doesn't know? waiting?)
            }

            // After 5 rounds, contract should hold Charlie's accumulated share
            const totalPaid = ethers.parseEther("50");
            const charlieShare = totalPaid * 20n / 100n;

            expect(await ethers.provider.getBalance(await splitter.getAddress())).to.equal(charlieShare);
            expect(await splitter.released(alice.address)).to.equal(totalPaid * 40n / 100n);
            expect(await splitter.released(bob.address)).to.equal(totalPaid * 40n / 100n);
            expect(await splitter.released(charlie.address)).to.equal(0);
        });

        it("Should allow delayed withdrawal years later with correct accounting", async function () {
            const splitter = await SplitStream.deploy(
                [alice.address, bob.address],
                [50, 50]
            );
            await splitter.waitForDeployment();

            // Initial payments in "year 1"
            await owner.sendTransaction({
                to: await splitter.getAddress(),
                value: ethers.parseEther("100")
            });

            // Alice withdraws immediately
            await splitter.release(alice.address);
            expect(await splitter.released(alice.address)).to.equal(ethers.parseEther("50"));

            // More payments come in "year 2" and "year 3"
            await owner.sendTransaction({
                to: await splitter.getAddress(),
                value: ethers.parseEther("50")
            });

            await owner.sendTransaction({
                to: await splitter.getAddress(),
                value: ethers.parseEther("25")
            });

            // Alice withdraws after year 3
            await splitter.release(alice.address);

            // Bob finally withdraws after years - should get full accumulated amount
            const totalFunds = ethers.parseEther("175");
            await splitter.release(bob.address);
            expect(await splitter.released(bob.address)).to.equal(totalFunds / 2n);
            expect(await splitter.released(alice.address)).to.equal(totalFunds / 2n);
        });
    });

    describe("Multi-Round Distribution", function () {
        it("Should handle multiple payment cycles with different amounts", async function () {
            const splitter = await SplitStream.deploy(
                [alice.address, bob.address, charlie.address],
                [50, 30, 20]
            );
            await splitter.waitForDeployment();

            const rounds = [
                { amount: ethers.parseEther("10"), withdrawers: [alice, bob, charlie] },
                { amount: ethers.parseEther("5"), withdrawers: [alice] },
                { amount: ethers.parseEther("20"), withdrawers: [bob, charlie] },
                { amount: ethers.parseEther("15"), withdrawers: [alice, bob] },
                { amount: ethers.parseEther("8"), withdrawers: [charlie] }
            ];

            for (const round of rounds) {
                // Payment arrives
                await owner.sendTransaction({
                    to: await splitter.getAddress(),
                    value: round.amount
                });

                // Only specified withdrawers withdraw this round
                for (const withdrawer of round.withdrawers) {
                    await splitter.release(withdrawer.address);
                }
            }

            // Final withdrawals - Alice and Bob have remaining funds from round 5
            await splitter.release(alice.address);
            await splitter.release(bob.address);

            const totalPayments = ethers.parseEther("58");
            expect(await splitter.totalReleased()).to.equal(totalPayments);
            expect(await ethers.provider.getBalance(await splitter.getAddress())).to.equal(0);
        });

        it("Should handle variable payment amounts with consistent distribution percentages", async function () {
            const splitter = await SplitStream.deploy(
                [alice.address, bob.address],
                [75, 25]
            );
            await splitter.waitForDeployment();

            const variablePayments = [
                ethers.parseEther("1.234"),
                ethers.parseEther("0.567"),
                ethers.parseEther("12.89"),
                ethers.parseEther("0.001"),
                ethers.parseEther("100"),
                ethers.parseEther("7.777")
            ];

            let total = 0n;
            for (const payment of variablePayments) {
                await owner.sendTransaction({
                    to: await splitter.getAddress(),
                    value: payment
                });
                total += payment;
            }

            // Withdraw all at once
            await splitter.release(alice.address);
            await splitter.release(bob.address);

            // Verify percentages maintained despite variable amounts
            const aliceExpected = total * 75n / 100n;
            const bobExpected = total * 25n / 100n;

            expect(await splitter.released(alice.address)).to.equal(aliceExpected);
            expect(await splitter.released(bob.address)).to.equal(bobExpected);
        });
    });

    describe("Partial Withdrawals", function () {
        it("Should handle staggered withdrawal patterns across payees", async function () {
            const splitter = await SplitStream.deploy(
                [alice.address, bob.address, charlie.address],
                [40, 35, 25]
            );
            await splitter.waitForDeployment();

            // Initial funding
            await owner.sendTransaction({
                to: await splitter.getAddress(),
                value: ethers.parseEther("100")
            });

            // Alice withdraws immediately (early bird)
            await splitter.release(alice.address);
            expect(await splitter.released(alice.address)).to.equal(ethers.parseEther("40"));

            // More funds come in
            await owner.sendTransaction({
                to: await splitter.getAddress(),
                value: ethers.parseEther("50")
            });

            // Bob withdraws after second payment
            await splitter.release(bob.address);
            expect(await splitter.released(bob.address)).to.equal(ethers.parseEther("52.5")); // 35% of 150

            // Even more funds
            await owner.sendTransaction({
                to: await splitter.getAddress(),
                value: ethers.parseEther("50")
            });

            // Alice withdraws again
            await splitter.release(alice.address);
            expect(await splitter.released(alice.address)).to.equal(ethers.parseEther("80")); // 40% of 200

            // Charlie waits until the very end
            await splitter.release(charlie.address);
            expect(await splitter.released(charlie.address)).to.equal(ethers.parseEther("50")); // 25% of 200

            // Final withdrawals
            await splitter.release(bob.address);
            expect(await splitter.totalReleased()).to.equal(ethers.parseEther("200"));
        });

        it("Should handle mixed withdrawal strategies in production scenario", async function () {
            // Real-world: Startup with founders and advisors
            const splitter = await SplitStream.deploy(
                [alice.address, bob.address, charlie.address],
                [60, 25, 15] // Founder, Co-founder, Advisor
            );
            await splitter.waitForDeployment();

            // Revenue comes in chunks over time
            const revenues = [
                ethers.parseEther("5"),    // Small client
                ethers.parseEther("15"),   // Medium client
                ethers.parseEther("2"),    // Small client
                ethers.parseEther("30"),   // Large client
                ethers.parseEther("8")     // Medium client
            ];

            let cumulativeRevenue = 0n;

            for (let i = 0; i < revenues.length; i++) {
                await owner.sendTransaction({
                    to: await splitter.getAddress(),
                    value: revenues[i]
                });
                cumulativeRevenue += revenues[i];

                // Founder (Alice) withdraws monthly (every 2 payments in this simulation)
                if (i % 2 === 1) {
                    await splitter.release(alice.address);
                }

                // Co-founder (Bob) withdraws when needed (after large payments)
                if (revenues[i] >= ethers.parseEther("15")) {
                    await splitter.release(bob.address);
                }

                // Advisor (Charlie) withdraws quarterly (at end)
            }

            // Quarter end - all withdraw remaining
            await splitter.release(alice.address);
            await splitter.release(bob.address);
            await splitter.release(charlie.address);

            expect(await splitter.released(alice.address)).to.equal(cumulativeRevenue * 60n / 100n);
            expect(await splitter.released(bob.address)).to.equal(cumulativeRevenue * 25n / 100n);
            expect(await splitter.released(charlie.address)).to.equal(cumulativeRevenue * 15n / 100n);
            expect(await ethers.provider.getBalance(await splitter.getAddress())).to.equal(0);
        });
    });

    describe("Complex Real-World Scenario", function () {
        it("Should handle full year of varied operations for a small business", async function () {
            // Small business: Owner (50%), Developer (30%), Designer (20%)
            const business = await SplitStream.deploy(
                [alice.address, bob.address, charlie.address],
                [50, 30, 20]
            );
            await business.waitForDeployment();

            let yearlyRevenue = 0n;

            // Q1: Slow start
            const q1Payments = [
                ethers.parseEther("2"),
                ethers.parseEther("3.5"),
                ethers.parseEther("1.8")
            ];

            for (const payment of q1Payments) {
                await donor1.sendTransaction({
                    to: await business.getAddress(),
                    value: payment
                });
                yearlyRevenue += payment;
            }

            // Q2: Growth
            const q2Payments = [
                ethers.parseEther("5"),
                ethers.parseEther("7.2"),
                ethers.parseEther("6.5"),
                ethers.parseEther("4.8")
            ];

            for (const payment of q2Payments) {
                await donor2.sendTransaction({
                    to: await business.getAddress(),
                    value: payment
                });
                yearlyRevenue += payment;
            }

            // Mid-year withdrawals
            await business.release(alice.address);
            await business.release(bob.address);

            // Q3: Peak season
            const q3Payments = [
                ethers.parseEther("12"),
                ethers.parseEther("15.5"),
                ethers.parseEther("18"),
                ethers.parseEther("10.2")
            ];

            for (const payment of q3Payments) {
                await donor3.sendTransaction({
                    to: await business.getAddress(),
                    value: payment
                });
                yearlyRevenue += payment;
            }

            // Q4: Steady
            const q4Payments = [
                ethers.parseEther("8"),
                ethers.parseEther("9.5"),
                ethers.parseEther("7.3")
            ];

            for (const payment of q4Payments) {
                await owner.sendTransaction({
                    to: await business.getAddress(),
                    value: payment
                });
                yearlyRevenue += payment;
            }

            // Year-end withdrawals
            await business.release(alice.address);
            await business.release(bob.address);
            await business.release(charlie.address);

            // Verify annual totals
            expect(await business.released(alice.address)).to.equal(yearlyRevenue * 50n / 100n);
            expect(await business.released(bob.address)).to.equal(yearlyRevenue * 30n / 100n);
            expect(await business.released(charlie.address)).to.equal(yearlyRevenue * 20n / 100n);
            expect(await business.totalReleased()).to.equal(yearlyRevenue);
            expect(await ethers.provider.getBalance(await business.getAddress())).to.equal(0);
        });
    });
});
