# SplitStream Deployment Guide

A comprehensive guide to deploying the SplitStream payment splitter contract to Base mainnet.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Environment Setup](#environment-setup)
- [Planning Your Deployment](#planning-your-deployment)
- [Local Testing](#local-testing)
- [Mainnet Deployment](#mainnet-deployment)
- [Post-Deployment Verification](#post-deployment-verification)
- [Contract Verification](#contract-verification)
- [Initial Testing](#initial-testing)
- [Troubleshooting](#troubleshooting)
- [Cost Estimation](#cost-estimation)
- [Security Best Practices](#security-best-practices)
- [After Deployment](#after-deployment)

---

## Pre-Deployment Checklist

Before deploying to Base mainnet, ensure you have:

### ✅ Required Items

- [ ] **Wallet with Private Key**: MetaMask or hardware wallet
- [ ] **ETH on Base**: For deployment gas fees (~0.001-0.002 ETH)
- [ ] **RPC Access**: Base mainnet RPC URL (public or private)
- [ ] **Basescan API Key**: For contract verification (free from basescan.org)
- [ ] **Node.js**: Version 16 or higher installed
- [ ] **Git**: For cloning the repository
- [ ] **Payee Addresses**: All recipient addresses confirmed and verified
- [ ] **Share Distribution**: Agreed-upon share percentages

### ⚠️ Safety Warnings

> **WARNING**: Never share your private key with anyone. Never commit it to version control.

> **WARNING**: Double-check all payee addresses. Once deployed, shares cannot be changed.

> **WARNING**: Test on a local network first before deploying to mainnet.

---

## Environment Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/Yusufolosun/splitstream-protocol.git
cd splitstream-protocol
```

### Step 2: Install Dependencies

```bash
npm install
```

Expected output:
```
added 234 packages, and audited 235 packages in 15s
```

### Step 3: Configure Environment Variables

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Base Network Configuration
BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_private_key_without_0x_prefix

# Basescan API Key for Contract Verification
BASESCAN_API_KEY=your_basescan_api_key_here
```

#### Getting Your Private Key

**From MetaMask:**
1. Open MetaMask
2. Click the three dots → Account details
3. Click "Export Private Key"
4. Enter your password
5. Copy the private key (remove the `0x` prefix)

> **SECURITY**: Use a dedicated deployment wallet, not your main wallet.

#### Getting Basescan API Key

1. Visit https://basescan.org/
2. Sign up for a free account
3. Go to "API Keys" section
4. Create a new API key
5. Copy the key to your `.env` file

### Step 4: Verify Configuration

Test your setup:

```bash
npx hardhat test
```

Expected output:
```
  SplitStream
    ✔ Should set the correct total shares
    ...
  18 passing (2s)
```

---

## Planning Your Deployment

### Determining Payees

**Important Considerations:**

1. **Verify All Addresses**: Triple-check each address
2. **Test Addresses**: Send a small amount first to verify
3. **Contract Addresses**: Ensure they can receive ETH
4. **No Duplicates**: Each address can only appear once

**Example Payee List:**

```javascript
const payees = [
  "0x1111111111111111111111111111111111111111", // Team Member 1
  "0x2222222222222222222222222222222222222222", // Team Member 2
  "0x3333333333333333333333333333333333333333"  // Team Member 3
];
```

### Determining Share Distribution

**Guidelines:**

- Shares can be any positive integer
- They represent proportions, not absolute amounts
- Total shares = sum of all individual shares

**Examples:**

```javascript
// Equal split (33.33% each)
const shares = [1, 1, 1];

// Percentage-based (50%, 30%, 20%)
const shares = [50, 30, 20];

// Custom ratios (40%, 35%, 25%)
const shares = [40, 35, 25];

// Large numbers work too (same as 50/30/20)
const shares = [5000, 3000, 2000];
```

**Verification Checklist:**

- [ ] All shares are greater than zero
- [ ] Number of shares matches number of payees
- [ ] Percentages add up as expected
- [ ] All parties agree to the distribution

---

## Local Testing

### Step 1: Start Local Hardhat Network

In one terminal:

```bash
npx hardhat node
```

Expected output:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
...
```

### Step 2: Deploy to Local Network

In another terminal:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Expected output:
```
🚀 Starting SplitStream deployment...

📝 Deployment Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Deployer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Network: localhost
Chain ID: 31337

👥 Payee Configuration:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Payee 1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 - 50 shares (50%)
Payee 2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC - 30 shares (30%)
Payee 3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906 - 20 shares (20%)
Total shares: 100

⏳ Deploying SplitStream contract...
✅ Contract deployed successfully!

📋 Deployment Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### Step 3: Test the Deployment

Create a test script `test-deployment.js`:

```javascript
const { ethers } = require("hardhat");

async function main() {
  const splitterAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const splitter = await ethers.getContractAt("SplitStream", splitterAddress);
  
  // Send test payment
  const [sender, payee1] = await ethers.getSigners();
  await sender.sendTransaction({
    to: splitterAddress,
    value: ethers.parseEther("1.0")
  });
  console.log("✅ Sent 1 ETH to splitter");
  
  // Release to payee1
  await splitter.release(payee1.address);
  console.log("✅ Released payment to payee1");
  
  // Check released amount
  const released = await splitter.released(payee1.address);
  console.log(`✅ Payee1 received: ${ethers.formatEther(released)} ETH`);
}

main().catch(console.error);
```

Run the test:

```bash
npx hardhat run test-deployment.js --network localhost
```

---

## Mainnet Deployment

### Step 1: Final Pre-Deployment Checks

```bash
# Verify environment variables are set
cat .env

# Check your wallet balance on Base
# Visit: https://basescan.org/address/YOUR_ADDRESS

# Ensure you have at least 0.002 ETH for gas
```

### Step 2: Update Deployment Script (Optional)

If you want custom payees, edit `scripts/deploy.js`:

```javascript
// Replace these with your actual payee addresses
const payees = [
  "0xYourPayee1Address",
  "0xYourPayee2Address",
  "0xYourPayee3Address"
];

const shares = [50, 30, 20]; // Your desired distribution
```

### Step 3: Deploy to Base Mainnet

> **FINAL WARNING**: This will deploy to mainnet and cost real ETH. Ensure everything is correct.

```bash
npx hardhat run scripts/deploy.js --network base
```

**Expected Output:**

```
🚀 Starting SplitStream deployment...

📝 Deployment Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Deployer address: 0xYourAddress
Network: base
Chain ID: 8453

👥 Payee Configuration:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Payee 1: 0x... - 50 shares (50%)
Payee 2: 0x... - 30 shares (30%)
Payee 3: 0x... - 20 shares (20%)
Total shares: 100

⏳ Deploying SplitStream contract...
✅ Contract deployed successfully!

📋 Deployment Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contract Address: 0x1234567890abcdef1234567890abcdef12345678
Deployment Transaction: 0xabcdef...
Block Number: 12345678

⏳ Waiting for 1 block confirmation...
✅ Deployment confirmed!

🔍 Verification:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total shares on contract: 100
Payee 1 shares: 50
Payee 2 shares: 30
Payee 3 shares: 20

🎉 Deployment completed successfully!
```

### Step 4: Save Deployment Information

**IMPORTANT**: Save this information immediately:

```bash
# Create a deployment record
cat > deployment-record.txt << EOF
Deployment Date: $(date)
Network: Base Mainnet
Contract Address: 0x1234567890abcdef1234567890abcdef12345678
Transaction Hash: 0xabcdef...
Deployer Address: 0xYourAddress
Payees:
  - 0xPayee1: 50 shares (50%)
  - 0xPayee2: 30 shares (30%)
  - 0xPayee3: 20 shares (20%)
EOF
```

---

## Post-Deployment Verification

### Step 1: Verify on Basescan

1. Visit https://basescan.org/address/YOUR_CONTRACT_ADDRESS
2. Check "Contract" tab shows bytecode
3. Verify "Transactions" shows deployment tx

### Step 2: Verify Contract State

```bash
npx hardhat console --network base
```

In the console:

```javascript
const splitter = await ethers.getContractAt(
  "SplitStream",
  "0xYourContractAddress"
);

// Check total shares
await splitter.totalShares(); // Should return 100n (or your total)

// Check each payee
await splitter.shares("0xPayee1Address"); // Should return 50n
await splitter.shares("0xPayee2Address"); // Should return 30n
await splitter.shares("0xPayee3Address"); // Should return 20n

// Check payee by index
await splitter.payee(0); // Should return payee1 address
await splitter.payee(1); // Should return payee2 address
await splitter.payee(2); // Should return payee3 address
```

---

## Contract Verification

Verify your contract on Basescan for transparency and easier interaction.

### Automatic Verification

```bash
npx hardhat verify --network base \
  0xYourContractAddress \
  '["0xPayee1","0xPayee2","0xPayee3"]' \
  '[50,30,20]'
```

**Example:**

```bash
npx hardhat verify --network base \
  0x1234567890abcdef1234567890abcdef12345678 \
  '["0x1111111111111111111111111111111111111111","0x2222222222222222222222222222222222222222","0x3333333333333333333333333333333333333333"]' \
  '[50,30,20]'
```

**Expected Output:**

```
Successfully submitted source code for contract
contracts/SplitStream.sol:SplitStream at 0x123...
for verification on the block explorer. Waiting for verification result...

Successfully verified contract SplitStream on Basescan.
https://basescan.org/address/0x123...#code
```

### Manual Verification (if automatic fails)

1. Go to https://basescan.org/verifyContract
2. Enter contract address
3. Select compiler version: `v0.8.28`
4. Select license: `MIT`
5. Paste flattened source code:

```bash
npx hardhat flatten contracts/SplitStream.sol > flattened.sol
```

6. Enter constructor arguments (ABI-encoded)
7. Submit for verification

---

## Initial Testing

### Test 1: Send Test Payment

```javascript
// Send 0.01 ETH test payment
const tx = await signer.sendTransaction({
  to: "0xYourContractAddress",
  value: ethers.parseEther("0.01")
});

await tx.wait();
console.log("✅ Test payment sent");
```

### Test 2: Check Balances

```javascript
const balance = await ethers.provider.getBalance("0xYourContractAddress");
console.log(`Contract balance: ${ethers.formatEther(balance)} ETH`);
```

### Test 3: Release Payment

```javascript
const splitter = await ethers.getContractAt(
  "SplitStream",
  "0xYourContractAddress"
);

// Release to first payee
await splitter.release("0xPayee1Address");
console.log("✅ Payment released to payee1");

// Check released amount
const released = await splitter.released("0xPayee1Address");
console.log(`Released: ${ethers.formatEther(released)} ETH`);
```

---

## Troubleshooting

### Common Issues

#### Issue: "Insufficient funds for gas"

**Solution:**
- Check your wallet balance on Base
- Ensure you have at least 0.002 ETH
- Bridge ETH to Base if needed

#### Issue: "Nonce too high"

**Solution:**
```bash
# Reset your account in MetaMask
# Settings → Advanced → Reset Account
```

#### Issue: "Contract verification failed"

**Solution:**
- Ensure constructor arguments are correct
- Use the exact compiler version (0.8.28)
- Try manual verification
- Check for extra spaces in arguments

#### Issue: "Transaction reverted"

**Solution:**
- Check payee addresses are valid
- Ensure no duplicate addresses
- Verify all shares are > 0
- Check arrays have same length

#### Issue: "Cannot connect to network"

**Solution:**
- Verify RPC URL in `.env`
- Try alternative RPC: `https://base.llamarpc.com`
- Check internet connection

---

## Cost Estimation

### Deployment Costs (Base Mainnet)

| Item | Estimated Cost | Notes |
|------|---------------|-------|
| Contract Deployment | 0.0008-0.0015 ETH | ~400,000 gas |
| Contract Verification | Free | Basescan service |
| Test Transaction | 0.00002 ETH | ~25,000 gas |
| Release Transaction | 0.00004 ETH | ~50,000 gas |

**Total Estimated Cost**: ~0.001-0.002 ETH ($3-6 USD at $3000/ETH)

### Gas Price Optimization

Check current gas prices:
- https://basescan.org/gastracker

Deploy during low-traffic times for cheaper gas.

---

## Security Best Practices

### Before Deployment

1. ✅ **Audit Payee Addresses**: Verify each address multiple times
2. ✅ **Test Locally First**: Always test on local network
3. ✅ **Use Hardware Wallet**: For large deployments
4. ✅ **Secure Private Key**: Never share or commit to git
5. ✅ **Verify Share Math**: Ensure percentages are correct

### During Deployment

1. ✅ **Double-Check Network**: Ensure deploying to correct network
2. ✅ **Monitor Transaction**: Watch deployment tx on Basescan
3. ✅ **Save Information**: Record all deployment details
4. ✅ **Verify Immediately**: Check contract state after deployment

### After Deployment

1. ✅ **Verify Contract**: Submit for Basescan verification
2. ✅ **Test with Small Amount**: Send test payment first
3. ✅ **Document Everything**: Save addresses and transaction hashes
4. ✅ **Inform Payees**: Share contract address with all payees
5. ✅ **Monitor Events**: Set up event monitoring

---

## After Deployment

### Immediate Actions

1. **Verify Contract on Basescan** ✅
2. **Test with Small Payment** ✅
3. **Document Deployment** ✅
4. **Share with Payees** ✅

### Share This Information with Payees

Create a document for payees:

```markdown
# SplitStream Payment Information

**Contract Address**: 0x...
**Network**: Base Mainnet
**Your Share**: XX%

## How to Withdraw

1. Visit: https://basescan.org/address/0x...
2. Connect your wallet
3. Go to "Write Contract" tab
4. Call `release` function with your address
5. Confirm transaction

## View Your Balance

1. Go to "Read Contract" tab
2. Call `released` with your address to see total withdrawn
3. Call `shares` with your address to see your share allocation
```

### Ongoing Monitoring

Set up monitoring for:
- Incoming payments (`PaymentReceived` events)
- Withdrawals (`PaymentReleased` events)
- Contract balance changes

### Integration

If integrating with other systems:
- See [API Documentation](./API.md)
- See [Integration Patterns](./ARCHITECTURE.md#integration-patterns)

---

## Checklist Summary

### Pre-Deployment ✅
- [ ] Wallet funded with ETH on Base
- [ ] Environment variables configured
- [ ] Payee addresses verified
- [ ] Share distribution agreed upon
- [ ] Local testing completed

### Deployment ✅
- [ ] Deployed to Base mainnet
- [ ] Deployment transaction confirmed
- [ ] Contract address saved
- [ ] Deployment details documented

### Post-Deployment ✅
- [ ] Contract verified on Basescan
- [ ] Initial state verified
- [ ] Test payment sent and released
- [ ] Payees informed
- [ ] Monitoring set up

---

## Support

If you encounter issues:
1. Check [Troubleshooting](#troubleshooting) section
2. Review [API Documentation](./API.md)
3. Open an issue on [GitHub](https://github.com/Yusufolosun/splitstream-protocol/issues)

---

**Deployment Guide Version**: 1.0  
**Last Updated**: 2026-01-21  
**Network**: Base Mainnet

**Good luck with your deployment! 🚀**
