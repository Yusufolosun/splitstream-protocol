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
});
