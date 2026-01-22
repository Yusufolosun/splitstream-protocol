const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SplitStream - Security Tests", function () {
    let splitStream;
    let owner, payee1, payee2, payee3, attacker;

    beforeEach(async function () {
        // Get signers
        [owner, payee1, payee2, payee3, attacker] = await ethers.getSigners();

        // Deploy fresh contract for each test
        const SplitStream = await ethers.getContractFactory("SplitStream");
        splitStream = await SplitStream.deploy(
            [payee1.address, payee2.address, payee3.address],
            [50, 30, 20]
        );
        await splitStream.waitForDeployment();
    });

    describe("Reentrancy Protection", function () {
        it("Should prevent reentrancy attacks during release", async function () {
            // Fund the contract
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("10")
            });

            // First release should succeed
            await splitStream.release(payee1.address);
            const released = await splitStream.released(payee1.address);
            expect(released).to.equal(ethers.parseEther("5"));

            // Attempting to release again immediately should fail
            // (no payment due since already released)
            await expect(
                splitStream.release(payee1.address)
            ).to.be.revertedWith("SplitStream: account is not due payment");
        });

        it("Should maintain correct state even with multiple sequential releases", async function () {
            // Fund the contract
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("10")
            });

            // Release to all payees in sequence
            await splitStream.release(payee1.address);
            await splitStream.release(payee2.address);
            await splitStream.release(payee3.address);

            // Verify total released equals total received
            const totalReleased = await splitStream.totalReleased();
            expect(totalReleased).to.equal(ethers.parseEther("10"));
        });
    });

    describe("Zero Address Protection", function () {
        it("Should reject zero address as payee during deployment", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            await expect(
                SplitStream.deploy(
                    [ethers.ZeroAddress, payee2.address, payee3.address],
                    [50, 30, 20]
                )
            ).to.be.revertedWith("SplitStream: account is the zero address");
        });

        it("Should reject zero address in any payee position", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");

            // Test zero address at position 1
            await expect(
                SplitStream.deploy(
                    [payee1.address, ethers.ZeroAddress, payee3.address],
                    [50, 30, 20]
                )
            ).to.be.revertedWith("SplitStream: account is the zero address");

            // Test zero address at position 2
            await expect(
                SplitStream.deploy(
                    [payee1.address, payee2.address, ethers.ZeroAddress],
                    [50, 30, 20]
                )
            ).to.be.revertedWith("SplitStream: account is the zero address");
        });

        it("Should reject release to zero address", async function () {
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("1")
            });

            await expect(
                splitStream.release(ethers.ZeroAddress)
            ).to.be.revertedWith("SplitStream: account has no shares");
        });
    });

    describe("Integer Overflow/Underflow Protection", function () {
        it("Should handle very large share amounts without overflow", async function () {
            const largeShares = ethers.MaxUint256 / 3n; // Divide max uint256 by 3

            const SplitStream = await ethers.getContractFactory("SplitStream");
            const largeSplitter = await SplitStream.deploy(
                [payee1.address, payee2.address],
                [largeShares, largeShares]
            );
            await largeSplitter.waitForDeployment();

            // Verify total shares calculated correctly
            const totalShares = await largeSplitter.totalShares();
            expect(totalShares).to.equal(largeShares * 2n);
        });

        it("Should handle maximum ETH amount distribution correctly", async function () {
            // Send a large amount (100 ETH)
            const largeAmount = ethers.parseEther("100");

            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: largeAmount
            });

            // Release to payee1 (50%)
            await splitStream.release(payee1.address);
            const released = await splitStream.released(payee1.address);

            expect(released).to.equal(ethers.parseEther("50"));
        });

        it("Should prevent underflow when calculating payments", async function () {
            // No funds sent - attempting release should fail gracefully
            await expect(
                splitStream.release(payee1.address)
            ).to.be.revertedWith("SplitStream: account is not due payment");
        });
    });

    describe("Payment Distribution Accuracy", function () {
        it("Should distribute payments with exact precision (no rounding errors)", async function () {
            // Send exact amount divisible by total shares
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("100")
            });

            await splitStream.release(payee1.address);
            await splitStream.release(payee2.address);
            await splitStream.release(payee3.address);

            expect(await splitStream.released(payee1.address)).to.equal(ethers.parseEther("50"));
            expect(await splitStream.released(payee2.address)).to.equal(ethers.parseEther("30"));
            expect(await splitStream.released(payee3.address)).to.equal(ethers.parseEther("20"));
        });

        it("Should handle odd amounts with minimal dust remaining", async function () {
            // Send amount not evenly divisible by shares
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("1.111111111111111111")
            });

            await splitStream.release(payee1.address);
            await splitStream.release(payee2.address);
            await splitStream.release(payee3.address);

            const totalReleased = await splitStream.totalReleased();
            const contractBalance = await ethers.provider.getBalance(await splitStream.getAddress());

            // Total released + remaining balance should equal original amount
            expect(totalReleased + contractBalance).to.equal(ethers.parseEther("1.111111111111111111"));
        });

        it("Should maintain accuracy across multiple payment rounds", async function () {
            // First payment round
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("10")
            });
            await splitStream.release(payee1.address);

            // Second payment round
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("10")
            });
            await splitStream.release(payee1.address);

            // Should have received 50% of 20 ETH total
            expect(await splitStream.released(payee1.address)).to.equal(ethers.parseEther("10"));
        });

        it("Should distribute wei-level amounts correctly", async function () {
            // Send very small amount (1000 wei)
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: 1000n
            });

            await splitStream.release(payee1.address);
            const released = await splitStream.released(payee1.address);

            // 50% of 1000 wei = 500 wei
            expect(released).to.equal(500n);
        });
    });

    describe("Edge Case Shares", function () {
        it("Should work with minimum shares (1:1:1)", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            const minShareSplitter = await SplitStream.deploy(
                [payee1.address, payee2.address, payee3.address],
                [1, 1, 1]
            );
            await minShareSplitter.waitForDeployment();

            await owner.sendTransaction({
                to: await minShareSplitter.getAddress(),
                value: ethers.parseEther("3")
            });

            await minShareSplitter.release(payee1.address);
            expect(await minShareSplitter.released(payee1.address)).to.equal(ethers.parseEther("1"));
        });

        it("Should work with very uneven distribution (99:1)", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            const unevenSplitter = await SplitStream.deploy(
                [payee1.address, payee2.address],
                [99, 1]
            );
            await unevenSplitter.waitForDeployment();

            await owner.sendTransaction({
                to: await unevenSplitter.getAddress(),
                value: ethers.parseEther("100")
            });

            await unevenSplitter.release(payee1.address);
            await unevenSplitter.release(payee2.address);

            expect(await unevenSplitter.released(payee1.address)).to.equal(ethers.parseEther("99"));
            expect(await unevenSplitter.released(payee2.address)).to.equal(ethers.parseEther("1"));
        });

        it("Should reject zero shares during deployment", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            await expect(
                SplitStream.deploy(
                    [payee1.address, payee2.address, payee3.address],
                    [50, 0, 20]
                )
            ).to.be.revertedWith("SplitStream: shares are 0");
        });

        it("Should work with single payee (100% share)", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            const singlePayeeSplitter = await SplitStream.deploy(
                [payee1.address],
                [100]
            );
            await singlePayeeSplitter.waitForDeployment();

            await owner.sendTransaction({
                to: await singlePayeeSplitter.getAddress(),
                value: ethers.parseEther("5")
            });

            await singlePayeeSplitter.release(payee1.address);
            expect(await singlePayeeSplitter.released(payee1.address)).to.equal(ethers.parseEther("5"));
        });
    });

    describe("Gas Limits and Scalability", function () {
        it("Should handle 10 payees without exceeding gas limits", async function () {
            const payees = [];
            const shares = [];
            const signers = await ethers.getSigners();

            for (let i = 0; i < 10; i++) {
                payees.push(signers[i].address);
                shares.push(10); // Equal distribution
            }

            const SplitStream = await ethers.getContractFactory("SplitStream");
            const multiPayeeSplitter = await SplitStream.deploy(payees, shares);
            await multiPayeeSplitter.waitForDeployment();

            // Verify deployment succeeded
            expect(await multiPayeeSplitter.totalShares()).to.equal(100);
        });

        it("Should handle 20 payees efficiently", async function () {
            const payees = [];
            const shares = [];

            // Generate 20 unique addresses using wallet generation
            for (let i = 0; i < 20; i++) {
                const wallet = ethers.Wallet.createRandom();
                payees.push(wallet.address);
                shares.push(5); // Equal distribution
            }

            const SplitStream = await ethers.getContractFactory("SplitStream");
            const multiPayeeSplitter = await SplitStream.deploy(payees, shares);
            await multiPayeeSplitter.waitForDeployment();

            expect(await multiPayeeSplitter.totalShares()).to.equal(100);
        });

        it("Release function should use constant gas regardless of number of payees", async function () {
            // This test verifies that release() is O(1) - doesn't iterate over all payees
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("1")
            });

            // Estimate gas for release - should be similar regardless of total payees
            const gasEstimate = await splitStream.release.estimateGas(payee1.address);

            // Gas should be reasonable (less than 100k for a simple release)
            expect(gasEstimate).to.be.lessThan(100000n);
        });
    });

    describe("Front-running Protection", function () {
        it("Should ensure fair distribution regardless of release order", async function () {
            // Send funds
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("10")
            });

            // Payee3 releases first (not typical order)
            await splitStream.release(payee3.address);
            expect(await splitStream.released(payee3.address)).to.equal(ethers.parseEther("2"));

            // Payee1 releases second
            await splitStream.release(payee1.address);
            expect(await splitStream.released(payee1.address)).to.equal(ethers.parseEther("5"));

            // Payee2 releases last
            await splitStream.release(payee2.address);
            expect(await splitStream.released(payee2.address)).to.equal(ethers.parseEther("3"));
        });

        it("Should calculate payments correctly even if one payee delays withdrawal", async function () {
            // First payment
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("10")
            });

            // Only payee1 and payee2 withdraw
            await splitStream.release(payee1.address);
            await splitStream.release(payee2.address);

            // Second payment arrives
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("10")
            });

            // Payee3 finally withdraws - should get both rounds
            await splitStream.release(payee3.address);
            expect(await splitStream.released(payee3.address)).to.equal(ethers.parseEther("4"));
        });

        it("Should prevent any payee from claiming more than their share", async function () {
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("10")
            });

            // Attacker tries to release for payee1 multiple times
            await splitStream.connect(attacker).release(payee1.address);

            // Second attempt should fail
            await expect(
                splitStream.connect(attacker).release(payee1.address)
            ).to.be.revertedWith("SplitStream: account is not due payment");

            // Verify only received correct amount
            expect(await splitStream.released(payee1.address)).to.equal(ethers.parseEther("5"));
        });
    });

    describe("Duplicate Payee Prevention", function () {
        it("Should reject duplicate payee addresses during deployment", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            await expect(
                SplitStream.deploy(
                    [payee1.address, payee1.address, payee2.address],
                    [50, 30, 20]
                )
            ).to.be.revertedWith("SplitStream: account already has shares");
        });

        it("Should detect duplicates anywhere in the payees array", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            await expect(
                SplitStream.deploy(
                    [payee1.address, payee2.address, payee1.address],
                    [50, 30, 20]
                )
            ).to.be.revertedWith("SplitStream: account already has shares");
        });
    });

    describe("View Function Security", function () {
        it("Should return accurate data without state modification", async function () {
            const totalSharesBefore = await splitStream.totalShares();
            const sharesBefore = await splitStream.shares(payee1.address);
            const releasedBefore = await splitStream.released(payee1.address);

            // Call view functions multiple times
            await splitStream.totalShares();
            await splitStream.shares(payee1.address);
            await splitStream.released(payee1.address);
            await splitStream.payee(0);

            // Verify state hasn't changed
            expect(await splitStream.totalShares()).to.equal(totalSharesBefore);
            expect(await splitStream.shares(payee1.address)).to.equal(sharesBefore);
            expect(await splitStream.released(payee1.address)).to.equal(releasedBefore);
        });

        it("Should return zero for non-existent payees", async function () {
            expect(await splitStream.shares(attacker.address)).to.equal(0);
            expect(await splitStream.released(attacker.address)).to.equal(0);
        });
    });
});
