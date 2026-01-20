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
});
