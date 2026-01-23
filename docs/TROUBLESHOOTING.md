# SplitStream Troubleshooting Guide

This guide helps you diagnose and resolve common issues when working with the SplitStream protocol.

## Table of Contents

- [Deployment Issues](#deployment-issues)
- [Transaction Failures](#transaction-failures)
- [Verification Problems](#verification-problems)
- [Integration Issues](#integration-issues)
- [Payment Issues](#payment-issues)
- [Testing Problems](#testing-problems)
- [FAQ](#frequently-asked-questions)

---

## Deployment Issues

### Issue 1: Gas Estimation Failures

**Symptoms:**
```
Error: cannot estimate gas; transaction may fail or may require manual gas limit
```

**Root Cause:**
- Constructor parameters cause revert during simulation
- Network congestion or RPC issues
- Invalid payee addresses or shares

**Solution:**

```javascript
// 1. Validate inputs before deployment
const payees = ["0x123...", "0x456..."];
const shares = [50, 50];

// Check: Valid addresses
payees.forEach(addr => {
  if (!ethers.isAddress(addr)) {
    throw new Error(`Invalid address: ${addr}`);
  }
});

// Check: Shares sum correctly
const totalShares = shares.reduce((a, b) => a + b, 0);
console.log(`Total shares: ${totalShares}`);

// Check: No zero shares
if (shares.some(s => s === 0)) {
  throw new Error("Shares cannot be zero");
}

// 2. Set manual gas limit
const contract = await SplitStream.deploy(payees, shares, {
  gasLimit: 3000000
});
```

**Prevention:**
- Always validate constructor arguments
- Test deployment on testnet first
- Use `npx hardhat node` to test locally

---

### Issue 2: Constructor Argument Errors

**Symptoms:**
```
Error: No payees
Error: Payees and shares length mismatch
Error: Account is the zero address
```

**Root Cause:**
Contract validation requirements not met:
- Empty payees array
- Mismatched array lengths
- Zero address in payees
- Zero shares value

**Solution:**

```javascript
// Create validation helper
function validateDeploymentArgs(payees, shares) {
  // Check arrays not empty
  if (payees.length === 0) {
    throw new Error("Payees array cannot be empty");
  }
  
  // Check lengths match
  if (payees.length !== shares.length) {
    throw new Error(
      `Length mismatch: ${payees.length} payees vs ${shares.length} shares`
    );
  }
  
  // Check for zero address
  payees.forEach((addr, i) => {
    if (addr === ethers.ZeroAddress) {
      throw new Error(`Payee ${i} is zero address`);
    }
  });
  
  // Check for zero shares
  shares.forEach((share, i) => {
    if (share === 0) {
      throw new Error(`Payee ${i} has zero shares`);
    }
  });
  
  console.log("✓ Validation passed");
  return true;
}

// Use before deployment
validateDeploymentArgs(payees, shares);
const contract = await SplitStream.deploy(payees, shares);
```

**Prevention:**
- Create reusable validation functions
- Add pre-deployment checks to scripts
- Use TypeScript for type safety

---

### Issue 3: Network Connection Problems

**Symptoms:**
```
Error: could not detect network
Error: network does not support ENS
ProviderError: Too Many Requests
```

**Root Cause:**
- Invalid or rate-limited RPC URL
- Network configuration issues
- Firewall blocking requests

**Solution:**

```bash
# 1. Test RPC connection
curl -X POST $BASE_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Expected response: {"jsonrpc":"2.0","id":1,"result":"0x..."}

# 2. Verify hardhat.config.js network settings
cat hardhat.config.js | grep -A 5 "base:"

# 3. Use alternative RPC providers
# Add to hardhat.config.js:
base: {
  url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  accounts: [process.env.PRIVATE_KEY],
  timeout: 60000, // Increase timeout
  httpHeaders: {
    "User-Agent": "SplitStream/1.0"
  }
}

# 4. Check rate limits
echo "Checking RPC rate limits..."
for i in {1..10}; do
  cast block-number --rpc-url $BASE_RPC_URL
  sleep 1
done
```

**Prevention:**
- Use paid RPC providers (Alchemy, Infura)
- Implement retry logic
- Monitor rate limits

---

### Issue 4: Insufficient Funds for Deployment

**Symptoms:**
```
Error: insufficient funds for gas * price + value
Error: sender doesn't have enough funds
```

**Root Cause:**
Deployer account lacks ETH for gas fees.

**Solution:**

```bash
# 1. Check deployer balance
DEPLOYER=$(cast wallet address --private-key $PRIVATE_KEY)
BALANCE=$(cast balance $DEPLOYER --rpc-url $BASE_RPC_URL)

echo "Deployer: $DEPLOYER"
echo "Balance: $(cast --to-unit $BALANCE ether) ETH"

# 2. Estimate deployment cost
ESTIMATED_GAS=2500000
GAS_PRICE=$(cast gas-price --rpc-url $BASE_RPC_URL)
COST=$(echo "$ESTIMATED_GAS * $GAS_PRICE" | bc)

echo "Estimated cost: $(cast --to-unit $COST ether) ETH"

# 3. Fund if needed
if [ $BALANCE -lt $COST ]; then
  echo "⚠️  Insufficient funds. Need $(cast --to-unit $((COST - BALANCE)) ether) ETH more"
  echo "Send ETH to: $DEPLOYER"
else
  echo "✓ Sufficient funds"
fi
```

**Prevention:**
- Always check balance before deployment
- Maintain buffer for gas price spikes
- Use testnet for initial testing

---

### Issue 5: Nonce Errors

**Symptoms:**
```
Error: nonce has already been used
Error: replacement transaction underpriced
Error: nonce too low
```

**Root Cause:**
- Multiple transactions sent with same nonce
- Transaction stuck in mempool
- RPC node out of sync

**Solution:**

```javascript
// 1. Get current nonce
const [deployer] = await ethers.getSigners();
const currentNonce = await deployer.getNonce();
console.log(`Current nonce: ${currentNonce}`);

// 2. Check pending transactions
const pendingNonce = await deployer.getNonce("pending");
console.log(`Pending nonce: ${pendingNonce}`);

if (pendingNonce > currentNonce) {
  console.log("⚠️  Transactions pending. Wait for confirmation.");
}

// 3. Force specific nonce if needed
const tx = await contract.release(payeeAddress, {
  nonce: currentNonce
});

// 4. Replace stuck transaction (increase gas price)
const replacementTx = await deployer.sendTransaction({
  to: deployer.address,
  value: 0,
  nonce: currentNonce,
  gasPrice: ethers.parseUnits("50", "gwei") // Higher than stuck tx
});
```

**Prevention:**
- Wait for transaction confirmation before sending next
- Use `--confirmations 2` flag
- Implement proper transaction queuing

---

## Transaction Failures

### Issue 1: "Account has no shares" Errors

**Symptoms:**
```
Error: Account has no shares
Transaction reverted with custom error 'AccountHasNoShares()'
```

**Root Cause:**
Attempting to release payment for address that is not a payee.

**Solution:**

```javascript
// 1. Check if address is payee
const payeeAddress = "0x123...";
const shares = await contract.shares(payeeAddress);

console.log(`Shares for ${payeeAddress}: ${shares}`);

if (shares === 0n) {
  console.log("❌ Address is not a payee");
  
  // 2. List all valid payees
  const payeeCount = await contract.payeeCount();
  console.log("\nValid payees:");
  
  for (let i = 0; i < payeeCount; i++) {
    const addr = await contract.payee(i);
    const s = await contract.shares(addr);
    console.log(`  ${addr}: ${s} shares`);
  }
} else {
  console.log("✓ Address is valid payee");
  
  // 3. Check releasable amount
  const releasable = await contract.releasable(payeeAddress);
  console.log(`Releasable: ${ethers.formatEther(releasable)} ETH`);
}
```

**Prevention:**
- Query shares before releasing
- Maintain off-chain payee list
- Validate addresses in UI/scripts

---

### Issue 2: "Not due payment" Errors

**Symptoms:**
```
Error: Account is not due payment
Transaction reverted with custom error 'NotDuePayment()'
```

**Root Cause:**
No funds available to release for the payee.

**Solution:**

```javascript
// Check releasable amount first
const releasable = await contract.releasable(payeeAddress);
console.log(`Releasable: ${ethers.formatEther(releasable)} ETH`);

if (releasable === 0n) {
  console.log("❌ No payment due");
  
  // Check why no payment is due
  const totalReleased = await contract.totalReleased();
  const released = await contract.released(payeeAddress);
  const shares = await contract.shares(payeeAddress);
  const totalShares = await contract.totalShares();
  const contractBalance = await ethers.provider.getBalance(contract.target);
  
  console.log("\nContract status:");
  console.log(`  Balance: ${ethers.formatEther(contractBalance)} ETH`);
  console.log(`  Total released: ${ethers.formatEther(totalReleased)} ETH`);
  console.log(`  Your shares: ${shares}/${totalShares} (${shares * 100n / totalShares}%)`);
  console.log(`  Already released to you: ${ethers.formatEther(released)} ETH`);
  
  if (contractBalance === 0n) {
    console.log("\n💡 Contract has no balance. Send ETH first.");
  }
} else {
  // Safe to release
  const tx = await contract.release(payeeAddress);
  console.log(`✓ Released: ${tx.hash}`);
}
```

**Prevention:**
- Always check `releasable()` before calling `release()`
- Monitor contract balance
- Implement payment tracking

---

### Issue 3: Gas Limit Exceeded

**Symptoms:**
```
Error: Transaction ran out of gas
Error: gas required exceeds allowance
```

**Root Cause:**
- Complex operations exceeding block gas limit
- Reentrancy protection consuming gas
- Network gas limit changes

**Solution:**

```javascript
// 1. Estimate required gas
const estimatedGas = await contract.release.estimateGas(payeeAddress);
console.log(`Estimated gas: ${estimatedGas}`);

// 2. Add 20% buffer
const gasLimit = estimatedGas * 120n / 100n;
console.log(`Gas limit with buffer: ${gasLimit}`);

// 3. Execute with manual gas limit
const tx = await contract.release(payeeAddress, {
  gasLimit: gasLimit
});

// 4. For Base network, check current limits
const block = await ethers.provider.getBlock("latest");
console.log(`Block gas limit: ${block.gasLimit}`);
```

**Prevention:**
- Use gas estimation before transactions
- Add 10-20% buffer to estimates
- Monitor network conditions

---

### Issue 4: Underpriced Transaction

**Symptoms:**
```
Error: transaction underpriced
Error: max fee per gas less than block base fee
```

**Root Cause:**
Gas price too low for current network conditions (EIP-1559).

**Solution:**

```javascript
// 1. Get current fee data
const feeData = await ethers.provider.getFeeData();

console.log("Current gas prices:");
console.log(`  Base fee: ${ethers.formatUnits(feeData.maxFeePerGas, "gwei")} gwei`);
console.log(`  Priority fee: ${ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei")} gwei`);

// 2. Set appropriate fees for Base
const tx = await contract.release(payeeAddress, {
  maxFeePerGas: ethers.parseUnits("2", "gwei"), // Base is typically low
  maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei")
});

// 3. Or let ethers auto-calculate
const tx2 = await contract.release(payeeAddress); // Uses current network fees
```

**Prevention:**
- Use automatic fee calculation
- Monitor Base network gas prices
- Implement retry logic with higher fees

---

### Issue 5: Transaction Reverted Without Reason

**Symptoms:**
```
Error: transaction reverted without a reason string
```

**Root Cause:**
- Out of gas
- Fallback function issue
- Silent revert in external call

**Solution:**

```javascript
// 1. Use try-catch with detailed error handling
try {
  const tx = await contract.release(payeeAddress);
  const receipt = await tx.wait();
  console.log("✓ Success:", receipt.hash);
} catch (error) {
  console.error("Transaction failed:");
  
  // Check for custom errors
  if (error.data) {
    try {
      const decodedError = contract.interface.parseError(error.data);
      console.log("Custom error:", decodedError.name);
      console.log("Args:", decodedError.args);
    } catch (e) {
      console.log("Raw error data:", error.data);
    }
  }
  
  // Check transaction receipt if available
  if (error.receipt) {
    console.log("Gas used:", error.receipt.gasUsed.toString());
    console.log("Status:", error.receipt.status);
  }
  
  // Try to simulate transaction
  try {
    await contract.release.staticCall(payeeAddress);
  } catch (simError) {
    console.log("Simulation error:", simError.message);
  }
}

// 2. Use Hardhat console for debugging
// In test environment:
await contract.release(payeeAddress); // Will show detailed revert reason
```

**Prevention:**
- Use custom errors (already implemented)
- Test thoroughly on local network
- Simulate transactions before sending

---

## Verification Problems

### Issue 1: Contract Verification Failing

**Symptoms:**
```
Error: Failed to verify contract
Error: Contract source code already verified
Error: Unable to locate ContractName
```

**Solution:**

```bash
# 1. Basic verification
npx hardhat verify --network base CONTRACT_ADDRESS \
  '["0xPayee1", "0xPayee2"]' \
  '[50, 50]'

# 2. If failing, check contract exists
cast code CONTRACT_ADDRESS --rpc-url $BASE_RPC_URL

# 3. Try with constructor args file
cat > arguments.js << 'EOF'
module.exports = [
  ["0xPayee1Address", "0xPayee2Address"],
  [50, 50]
];
EOF

npx hardhat verify --network base \
  --constructor-args arguments.js \
  CONTRACT_ADDRESS

# 4. Manually verify on Basescan
# - Go to https://basescan.org/address/CONTRACT_ADDRESS#code
# - Click "Verify and Publish"
# - Select compiler version, optimization settings
# - Paste flattened source code

# 5. Generate flattened source
npx hardhat flatten contracts/SplitStream.sol > SplitStream_flat.sol
```

**Prevention:**
- Save constructor args during deployment
- Use `hardhat-etherscan` plugin
- Verify immediately after deployment

---

### Issue 2: Constructor Args Mismatch

**Symptoms:**
```
Error: Constructor arguments mismatch
```

**Root Cause:**
Arguments passed to verifier don't match deployed contract.

**Solution:**

```javascript
// 1. Save args during deployment
// In deploy.js:
const payees = ["0x123...", "0x456..."];
const shares = [50, 50];

const SplitStream = await ethers.getContractFactory("SplitStream");
const contract = await SplitStream.deploy(payees, shares);
await contract.waitForDeployment();

// Save for verification
const deploymentData = {
  address: await contract.getAddress(),
  constructorArgs: [payees, shares],
  network: hre.network.name,
  timestamp: new Date().toISOString()
};

fs.writeFileSync(
  `deployments/${hre.network.name}-latest.json`,
  JSON.stringify(deploymentData, null, 2)
);

// 2. Verify using saved args
const deployment = JSON.parse(
  fs.readFileSync(`deployments/base-latest.json`)
);

await hre.run("verify:verify", {
  address: deployment.address,
  constructorArguments: deployment.constructorArgs
});
```

**Prevention:**
- Always save deployment details
- Automate verification in deploy script
- Use deployment artifact system

---

### Issue 3: Compiler Version Issues

**Symptoms:**
```
Error: Compiler version mismatch
Error: ParserError: Source file requires different compiler version
```

**Solution:**

```javascript
// 1. Check contract pragma
// contracts/SplitStream.sol should have:
// pragma solidity ^0.8.23;

// 2. Match in hardhat.config.js
module.exports = {
  solidity: {
    version: "0.8.23",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};

// 3. For verification, specify exact version
await hre.run("verify:verify", {
  address: contractAddress,
  constructorArguments: args,
  contract: "contracts/SplitStream.sol:SplitStream" // Specify full path
});
```

**Prevention:**
- Use exact versions in pragma
- Document compiler settings
- Lock dependency versions

---

### Issue 4: Source Code Not Matching

**Symptoms:**
```
Error: Bytecode does not match
```

**Root Cause:**
Compiled bytecode differs from deployed bytecode.

**Solution:**

```bash
# 1. Get deployed bytecode
DEPLOYED=$(cast code $CONTRACT_ADDRESS --rpc-url $BASE_RPC_URL)

# 2. Compile and get local bytecode
npx hardhat compile
# Check artifacts/contracts/SplitStream.sol/SplitStream.json

# 3. Compare (they should match except metadata hash)
echo "Deployed length: ${#DEPLOYED}"

# 4. Ensure clean build
npx hardhat clean
npx hardhat compile

# 5. Verify with exact settings used during deployment
# Check deployment script for optimizer settings
cat scripts/deploy.js | grep -A 5 "optimizer"
```

**Prevention:**
- Use consistent compiler settings
- Don't modify code between deploy and verify
- Save compilation artifacts

---

## Integration Issues

### Issue 1: Cannot Read Contract

**Symptoms:**
```
TypeError: Cannot read properties of undefined
Error: contract runner does not support calling
```

**Solution:**

```javascript
// 1. Verify contract instance is properly created
const contractAddress = "0x123...";

// Wrong:
const contract = new ethers.Contract(contractAddress);

// Correct:
const contract = new ethers.Contract(
  contractAddress,
  SplitStreamABI,
  provider // Or signer for write operations
);

// 2. For read operations, use provider
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
const contractRead = new ethers.Contract(contractAddress, ABI, provider);
const balance = await contractRead.balanceOf(address);

// 3. For write operations, use signer
const signer = new ethers.Wallet(privateKey, provider);
const contractWrite = new ethers.Contract(contractAddress, ABI, signer);
const tx = await contractWrite.release(payeeAddress);

// 4. Or attach to existing instance
const contractWithSigner = contract.connect(signer);
```

**Prevention:**
- Always pass ABI and provider/signer
- Check contract instantiation pattern
- Use Hardhat's `getContractAt` helper

---

### Issue 2: ABI Mismatch Errors

**Symptoms:**
```
Error: no matching function
Error: unsupported fragment
```

**Solution:**

```javascript
// 1. Ensure ABI is current
const artifact = require("../artifacts/contracts/SplitStream.sol/SplitStream.json");
const ABI = artifact.abi;

// 2. Verify function exists in ABI
const functionExists = ABI.some(item => 
  item.type === 'function' && item.name === 'release'
);
console.log(`release() exists: ${functionExists}`);

// 3. For type safety, use TypeScript with Typechain
// Install: npm install --save-dev typechain @typechain/hardhat @typechain/ethers-v6

// hardhat.config.ts
import '@typechain/hardhat';

// Generate types
// npx hardhat typechain

// Usage:
import { SplitStream } from '../typechain-types';
const contract = await ethers.getContractAt("SplitStream", address) as SplitStream;
```

**Prevention:**
- Recompile contracts when changing code
- Use artifact files for ABI
- Implement TypeScript + Typechain

---

### Issue 3: Provider Connection Failures

**Symptoms:**
```
Error: could not connect to provider
ProviderError: connection timeout
```

**Solution:**

```javascript
// 1. Test provider connection
async function testProvider() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(`✓ Connected. Block: ${blockNumber}`);
    return true;
  } catch (error) {
    console.error(`❌ Connection failed: ${error.message}`);
    return false;
  }
}

// 2. Implement retry logic
async function getProviderWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const provider = new ethers.JsonRpcProvider(
        process.env.BASE_RPC_URL,
        {
          name: "base",
          chainId: 8453
        }
      );
      
      await provider.getBlockNumber(); // Test connection
      return provider;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error("Failed to connect after retries");
}

// 3. Use WebSocket provider for better connectivity
const wsProvider = new ethers.WebSocketProvider(
  "wss://base-mainnet.gateway.tenderly.co"
);
```

**Prevention:**
- Use reliable RPC providers
- Implement connection pooling
- Add health checks

---

### Issue 4: Wrong Network Errors

**Symptoms:**
```
Error: network changed
Error: underlying network changed
ChainId mismatch
```

**Solution:**

```javascript
// 1. Verify network before transactions
async function checkNetwork(provider) {
  const network = await provider.getNetwork();
  const expectedChainId = 8453n; // Base mainnet
  
  if (network.chainId !== expectedChainId) {
    throw new Error(
      `Wrong network! Expected ${expectedChainId}, got ${network.chainId}`
    );
  }
  
  console.log(`✓ Connected to ${network.name} (${network.chainId})`);
}

// 2. In frontend, request network switch
async function switchToBase() {
  if (window.ethereum) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }], // 8453 in hex
      });
    } catch (switchError) {
      // Network not added, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x2105',
            chainName: 'Base',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org']
          }]
        });
      }
    }
  }
}

// 3. Lock provider to specific network
const provider = new ethers.JsonRpcProvider(
  process.env.BASE_RPC_URL,
  { name: "base", chainId: 8453 }
);
```

**Prevention:**
- Always validate chain ID
- Display current network to users
- Disable actions on wrong network

---

## Payment Issues

### Issue 1: Funds Sent But Not Showing

**Symptoms:**
- ETH sent to contract
- Balance shows in explorer
- `releasable()` returns 0

**Solution:**

```javascript
// 1. Verify funds reached contract
const contractBalance = await ethers.provider.getBalance(contractAddress);
console.log(`Contract balance: ${ethers.formatEther(contractBalance)} ETH`);

// 2. Check total received vs total released
const totalReleased = await contract.totalReleased();
console.log(`Total released: ${ethers.formatEther(totalReleased)} ETH`);

// 3. Calculate expected releasable
const shares = await contract.shares(payeeAddress);
const totalShares = await contract.totalShares();
const released = await contract.released(payeeAddress);

const totalReceived = contractBalance + totalReleased;
const expectedTotal = totalReceived * shares / totalShares;
const expected = expectedTotal - released;

console.log(`Expected releasable: ${ethers.formatEther(expected)} ETH`);

// 4. Check if payment was too small
if (expected < ethers.parseEther("0.000001")) {
  console.log("⚠️  Payment too small to show (dust amount)");
}

// 5. Verify calculation
const actual = await contract.releasable(payeeAddress);
console.log(`Actual releasable: ${ethers.formatEther(actual)} ETH`);
```

**Root Cause:**
Usually rounding in integer division for very small amounts.

**Prevention:**
- Send meaningful amounts (>0.001 ETH)
- Account for integer division rounding
- Monitor payment sizes

---

### Issue 2: Cannot Release Payments

**Symptoms:**
Transaction fails when calling `release()`

**Solution:**

```javascript
// 1. Complete diagnostic check
async function diagnoseReleaseIssue(payeeAddress) {
  console.log("🔍 Diagnosing release issue...\n");
  
  // Check 1: Is address a payee?
  const shares = await contract.shares(payeeAddress);
  if (shares === 0n) {
    console.log("❌ Address is not a payee");
    return;
  }
  console.log(`✓ Valid payee with ${shares} shares`);
  
  // Check 2: Any funds releasable?
  const releasable = await contract.releasable(payeeAddress);
  if (releasable === 0n) {
    console.log("❌ No payment due");
    return;
  }
  console.log(`✓ ${ethers.formatEther(releasable)} ETH releasable`);
  
  // Check 3: Sufficient gas?
  try {
    const gasEstimate = await contract.release.estimateGas(payeeAddress);
    console.log(`✓ Gas estimate: ${gasEstimate}`);
  } catch (error) {
    console.log(`❌ Gas estimation failed: ${error.message}`);
    return;
  }
  
  // Check 4: Simulate transaction
  try {
    await contract.release.staticCall(payeeAddress);
    console.log("✓ Simulation passed");
  } catch (error) {
    console.log(`❌ Simulation failed: ${error.message}`);
    return;
  }
  
  // All checks passed
  console.log("\n✅ Should be able to release. Try transaction.");
}

await diagnoseReleaseIssue("0xPayeeAddress");
```

**Prevention:**
- Run diagnostic before release
- Implement proper error handling
- Use UI validation

---

### Issue 3: Incorrect Amount Calculations

**Symptoms:**
Released amount doesn't match expected share percentage.

**Solution:**

```javascript
// Understanding the calculation
async function explainCalculation(payeeAddress) {
  const shares = await contract.shares(payeeAddress);
  const totalShares = await contract.totalShares();
  const released = await contract.released(payeeAddress);
  const totalReleased = await contract.totalReleased();
  const contractBalance = await ethers.provider.getBalance(contract.target);
  
  console.log("Payment Calculation Breakdown:");
  console.log("================================");
  console.log(`Your shares: ${shares}/${totalShares} = ${Number(shares * 100n / totalShares)}%`);
  console.log(`Contract balance: ${ethers.formatEther(contractBalance)} ETH`);
  console.log(`Total ever released: ${ethers.formatEther(totalReleased)} ETH`);
  console.log(`Total ever received: ${ethers.formatEther(contractBalance + totalReleased)} ETH`);
  console.log("");
  
  const totalReceived = contractBalance + totalReleased;
  const yourTotalShare = totalReceived * shares / totalShares;
  const yourReleasable = yourTotalShare - released;
  
  console.log(`Your total share: ${ethers.formatEther(yourTotalShare)} ETH`);
  console.log(`Already released to you: ${ethers.formatEther(released)} ETH`);
  console.log(`Currently releasable: ${ethers.formatEther(yourReleasable)} ETH`);
  
  // Verify
  const actual = await contract.releasable(payeeAddress);
  console.log(`\nContract says releasable: ${ethers.formatEther(actual)} ETH`);
  console.log(actual === yourReleasable ? "✓ Match!" : "❌ Mismatch!");
}
```

**Root Cause:**
Misunderstanding of cumulative payment splitting.

**Prevention:**
- Understand the payment model
- Track historical releases
- Use provided calculation helpers

---

### Issue 4: Missing Events

**Symptoms:**
Events not showing in monitoring script or logs.

**Solution:**

```javascript
// 1. Query events manually
const receivedFilter = contract.filters.PaymentReceived();
const receivedEvents = await contract.queryFilter(
  receivedFilter,
  -1000, // Last 1000 blocks
  'latest'
);

console.log(`Found ${receivedEvents.length} PaymentReceived events`);

// 2. Check event subscription
const provider = contract.runner.provider;
provider.on("block", async (blockNumber) => {
  console.log(`New block: ${blockNumber}`);
});

// 3. Listen for specific events
contract.on("PaymentReceived", (from, amount, event) => {
  console.log(`Payment received: ${ethers.formatEther(amount)} ETH from ${from}`);
});

// 4. Check WebSocket connection for real-time events
const wsProvider = new ethers.WebSocketProvider("wss://...");
const wsContract = new ethers.Contract(address, ABI, wsProvider);

wsContract.on("PaymentReleased", (to, amount) => {
  console.log(`Released ${ethers.formatEther(amount)} ETH to ${to}`);
});
```

**Prevention:**
- Use WebSocket for real-time monitoring
- Implement event polling fallback
- Check provider supports event filtering

---

## Testing Problems

### Issue 1: Tests Failing Locally

**Symptoms:**
Tests pass sometimes, fail others, especially timing-related tests.

**Solution:**

```javascript
// 1. Ensure hardhat network reset between tests
describe("SplitStream", () => {
  let contract, owner, addr1, addr2;
  
  beforeEach(async () => {
    // Fresh deployment for each test
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const SplitStream = await ethers.getContractFactory("SplitStream");
    contract = await SplitStream.deploy(
      [addr1.address, addr2.address],
      [50, 50]
    );
    await contract.waitForDeployment();
  });
  
  it("should distribute payments correctly", async () => {
    // Test logic
  });
});

// 2. Use proper async/await
// Wrong:
it("test", () => {
  contract.release(addr1.address); // Missing await!
});

// Correct:
it("test", async () => {
  await contract.release(addr1.address);
});

// 3. Clean environment
npx hardhat clean
npx hardhat compile
npx hardhat test
```

**Prevention:**
- Use `beforeEach` for fresh state
- Always await async calls
- Run `hardhat clean` when in doubt

---

### Issue 2: Hardhat Network Issues

**Symptoms:**
```
Error: cannot estimate gas
HardhatError: HH108: Cannot connect to the network
```

**Solution:**

```bash
# 1. Reset Hardhat network
npx hardhat clean
rm -rf cache artifacts

# 2. Check hardhat.config.js
cat hardhat.config.js

# Ensure networks configured:
networks: {
  hardhat: {
    chainId: 31337
  },
  localhost: {
    url: "http://127.0.0.1:8545"
  }
}

# 3. Start local node if needed
npx hardhat node

# In another terminal:
npx hardhat test --network localhost

# 4. Check for port conflicts
lsof -i :8545  # On Unix
netstat -ano | findstr :8545  # On Windows
```

**Prevention:**
- Use built-in hardhat network for tests
- Reserve localhost for manual testing
- Don't run multiple nodes simultaneously

---

### Issue 3: Gas Estimation in Tests

**Symptoms:**
Gas estimates differ between runs or networks.

**Solution:**

```javascript
// 1. Enable gas reporting
// hardhat.config.js
require("hardhat-gas-reporter");

module.exports = {
  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 0.05 // Base typical price in gwei
  }
};

// 2. In tests, log gas usage
it("should release payment", async () => {
  const tx = await contract.release(addr1.address);
  const receipt = await tx.wait();
  
  console.log(`Gas used: ${receipt.gasUsed}`);
  expect(receipt.gasUsed).to.be.lessThan(100000);
});

// 3. Test gas with overrides
const tx = await contract.release(addr1, {
  gasLimit: 150000
});
```

**Prevention:**
- Use gas reporter plugin
- Set realistic gas expectations
- Test on multiple networks

---

### Issue 4: Timing Issues

**Symptoms:**
Tests fail inconsistently, especially with events or block numbers.

**Solution:**

```javascript
// 1. Wait for transaction confirmation
const tx = await contract.release(addr1.address);
await tx.wait(); // Wait for mining

// 2. Mine blocks manually if needed
await ethers.provider.send("evm_mine", []);

// 3. Increase time for timing tests
await ethers.provider.send("evm_increaseTime", [3600]); // +1 hour
await ethers.provider.send("evm_mine", []);

// 4. Wait for events properly
const tx = await contract.release(addr1.address);
const receipt = await tx.wait();

const event = receipt.logs.find(
  log => contract.interface.parseLog(log)?.name === "PaymentReleased"
);
expect(event).to.not.be.undefined;

// 5. Use Promise.all for parallel operations
await Promise.all([
  contract.release(addr1.address),
  contract.release(addr2.address)
]);
```

**Prevention:**
- Always wait for transactions
- Use deterministic time manipulation
- Avoid race conditions

---

## Frequently Asked Questions

### General

**Q: How much gas does deployment cost?**

A: Approximately 1.5-2M gas. On Base (~0.05 gwei): $0.10-0.15 USD.

```bash
# Estimate:
npx hardhat run scripts/estimateDeployment.js
```

**Q: Can I modify payees after deployment?**

A: No, SplitStream is immutable. You must deploy a new contract. See [Migration Guide](./MIGRATION_GUIDE.md).

**Q: What happens to dust amounts (very small remainders)?**

A: Integer division may leave tiny amounts (<1 wei) in contract. These accumulate and distribute with future payments.

---

### Payments

**Q: Do I need to call release() for every payment?**

A: No. Payments accumulate. Payees can call `release()` whenever convenient.

**Q: Can someone else release my payment?**

A: Yes, anyone can call `release(payeeAddress)`, but funds always go to the payee.

**Q: What if I send the wrong amount to the contract?**

A: It's distributed according to shares. **No refunds possible**. Always verify destination.

---

### Security

**Q: Is SplitStream audited?**

A: See [Security Audit Report](./SECURITY_AUDIT.md) for comprehensive analysis.

**Q: Can the contract be paused or upgraded?**

A: No. It's immutable. This prevents tampering but means bugs can't be hotfixed.

**Q: What if a payee loses their private key?**

A: Funds are locked forever. Consider using multi-sig or social recovery wallets.

---

### Technical

**Q: Which networks are supported?**

A: Base mainnet and Base Sepolia testnet. Could deploy to any EVM chain.

**Q: What Solidity version is required?**

A: 0.8.23 or compatible. Uses modern features and custom errors.

**Q: How do I get historical payment data?**

A: Query `PaymentReceived` and `PaymentReleased` events. See [Migration Guide - Data Preservation](./MIGRATION_GUIDE.md#data-preservation).

---

### Troubleshooting

**Q: My transaction is stuck. What do I do?**

A: Send a replacement transaction with same nonce but higher gas price, or wait for it to expire/drop.

**Q: Verification keeps failing. Help?**

A: Ensure exact compiler settings match, try constructor args file, or manually verify on Basescan.

**Q: Tests work locally but fail on testnet. Why?**

A: Network latency, gas prices, or state differences. Add retries and delays.

---

## Getting Help

### Resources

- **Documentation**: [Main README](../README.md)
- **Security**: [Security Audit](./SECURITY_AUDIT.md)
- **Migration**: [Migration Guide](./MIGRATION_GUIDE.md)
- **Code**: [GitHub Repository](https://github.com/Yusufolosun/splitstream-protocol)

### Support Channels

- **GitHub Issues**: Technical bugs and feature requests
- **Discussions**: Architecture and design questions
- **Security**: security@splitstream.example (for vulnerabilities)

### Reporting Bugs

Include:
1. **Environment**: Network, Hardhat version, Node version
2. **Error message**: Full stack trace
3. **Reproduction steps**: Minimal code to reproduce
4. **Expected vs actual**: What should happen vs what does
5. **Additional context**: Logs, screenshots, transaction hashes

---

**Last Updated**: 2026-01-23  
**Version**: 1.0.0
