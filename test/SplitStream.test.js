const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SplitStream", function () {
    let splitStream;
    let owner;
    let payee1;
    let payee2;
    let payee3;

    beforeEach(async function () {
        // Get signers
        [owner, payee1, payee2, payee3] = await ethers.getSigners();

        // Deploy SplitStream contract
        const SplitStream = await ethers.getContractFactory("SplitStream");
        splitStream = await SplitStream.deploy(
            [payee1.address, payee2.address, payee3.address],
            [50, 30, 20]
        );
        await splitStream.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the correct total shares", async function () {
            expect(await splitStream.totalShares()).to.equal(100);
        });

        it("Should assign 50 shares to payee1", async function () {
            expect(await splitStream.shares(payee1.address)).to.equal(50);
        });

        it("Should assign 30 shares to payee2", async function () {
            expect(await splitStream.shares(payee2.address)).to.equal(30);
        });

        it("Should assign 20 shares to payee3", async function () {
            expect(await splitStream.shares(payee3.address)).to.equal(20);
        });
    });

    describe("Deployment Validation", function () {
        it("Should revert when payees and shares arrays have different lengths", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            await expect(
                SplitStream.deploy([payee1.address], [50, 30])
            ).to.be.revertedWith("SplitStream: payees and shares length mismatch");
        });

        it("Should revert when no payees are provided", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            await expect(
                SplitStream.deploy([], [])
            ).to.be.revertedWith("SplitStream: no payees");
        });

        it("Should revert when a payee address is zero address", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            await expect(
                SplitStream.deploy(
                    [ethers.ZeroAddress, payee2.address, payee3.address],
                    [50, 30, 20]
                )
            ).to.be.revertedWith("SplitStream: account is the zero address");
        });

        it("Should revert when shares amount is zero", async function () {
            const SplitStream = await ethers.getContractFactory("SplitStream");
            await expect(
                SplitStream.deploy(
                    [payee1.address, payee2.address, payee3.address],
                    [50, 0, 20]
                )
            ).to.be.revertedWith("SplitStream: shares are 0");
        });
    });

    describe("Payment Release", function () {
        beforeEach(async function () {
            // Send 1 ETH to the contract
            await owner.sendTransaction({
                to: await splitStream.getAddress(),
                value: ethers.parseEther("1")
            });
        });

        it("Should allow payee1 to release their correct share (0.5 ETH for 50%)", async function () {
            const contractAddress = await splitStream.getAddress();
            const contractBalanceBefore = await ethers.provider.getBalance(contractAddress);
            const expectedPayment = ethers.parseEther("0.5");

            await splitStream.release(payee1.address);

            const contractBalanceAfter = await ethers.provider.getBalance(contractAddress);
            expect(contractBalanceBefore - contractBalanceAfter).to.equal(expectedPayment);
            expect(await splitStream.released(payee1.address)).to.equal(expectedPayment);
        });

        it("Should allow payee2 to release their correct share (0.3 ETH for 30%)", async function () {
            const contractAddress = await splitStream.getAddress();
            const contractBalanceBefore = await ethers.provider.getBalance(contractAddress);
            const expectedPayment = ethers.parseEther("0.3");

            await splitStream.release(payee2.address);

            const contractBalanceAfter = await ethers.provider.getBalance(contractAddress);
            expect(contractBalanceBefore - contractBalanceAfter).to.equal(expectedPayment);
            expect(await splitStream.released(payee2.address)).to.equal(expectedPayment);
        });

        it("Should allow payee3 to release their correct share (0.2 ETH for 20%)", async function () {
            const contractAddress = await splitStream.getAddress();
            const contractBalanceBefore = await ethers.provider.getBalance(contractAddress);
            const expectedPayment = ethers.parseEther("0.2");

            await splitStream.release(payee3.address);

            const contractBalanceAfter = await ethers.provider.getBalance(contractAddress);
            expect(contractBalanceBefore - contractBalanceAfter).to.equal(expectedPayment);
            expect(await splitStream.released(payee3.address)).to.equal(expectedPayment);
        });

        it("Should revert when calling release twice (no double payment)", async function () {
            // First release should succeed
            await splitStream.release(payee1.address);

            // Second release should revert
            await expect(
                splitStream.release(payee1.address)
            ).to.be.revertedWith("SplitStream: account is not due payment");
        });

        it("Should revert when non-payee address tries to release", async function () {
            await expect(
                splitStream.release(owner.address)
            ).to.be.revertedWith("SplitStream: account has no shares");
        });

        it("Should increase totalReleased correctly after each release", async function () {
            expect(await splitStream.totalReleased()).to.equal(0);

            await splitStream.release(payee1.address);
            expect(await splitStream.totalReleased()).to.equal(ethers.parseEther("0.5"));

            await splitStream.release(payee2.address);
            expect(await splitStream.totalReleased()).to.equal(ethers.parseEther("0.8"));

            await splitStream.release(payee3.address);
            expect(await splitStream.totalReleased()).to.equal(ethers.parseEther("1"));
        });

        it("Should emit PaymentReleased event with correct parameters", async function () {
            await expect(splitStream.release(payee1.address))
                .to.emit(splitStream, "PaymentReleased")
                .withArgs(payee1.address, ethers.parseEther("0.5"));
        });
    });

    describe("Receive Function", function () {
        it("Should receive ETH directly and increase contract balance", async function () {
            const contractAddress = await splitStream.getAddress();
            const balanceBefore = await ethers.provider.getBalance(contractAddress);

            await owner.sendTransaction({
                to: contractAddress,
                value: ethers.parseEther("1")
            });

            const balanceAfter = await ethers.provider.getBalance(contractAddress);
            expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1"));
        });

        it("Should emit PaymentReceived event when ETH is sent", async function () {
            const contractAddress = await splitStream.getAddress();

            await expect(
                owner.sendTransaction({
                    to: contractAddress,
                    value: ethers.parseEther("1")
                })
            ).to.emit(splitStream, "PaymentReceived")
                .withArgs(owner.address, ethers.parseEther("1"));
        });

        it("Should accumulate multiple payments correctly", async function () {
            const contractAddress = await splitStream.getAddress();
            const initialBalance = await ethers.provider.getBalance(contractAddress);

            // Send first payment of 0.5 ETH
            await owner.sendTransaction({
                to: contractAddress,
                value: ethers.parseEther("0.5")
            });

            const balanceAfterFirst = await ethers.provider.getBalance(contractAddress);
            expect(balanceAfterFirst - initialBalance).to.equal(ethers.parseEther("0.5"));

            // Send second payment of 0.3 ETH
            await owner.sendTransaction({
                to: contractAddress,
                value: ethers.parseEther("0.3")
            });

            const balanceAfterSecond = await ethers.provider.getBalance(contractAddress);
            expect(balanceAfterSecond - initialBalance).to.equal(ethers.parseEther("0.8"));
        });
    });
});
