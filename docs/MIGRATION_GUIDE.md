# SplitStream Migration Guide

**Version:** 1.0.0  
**Last Updated:** 2026-01-22

---

## 📋 Table of Contents

1. [When to Migrate](#1-when-to-migrate)
2. [Migration Strategies](#2-migration-strategies)
3. [Step-by-Step Migration Process](#3-step-by-step-migration-process)
4. [Common Migration Scenarios](#4-common-migration-scenarios)
5. [Data Preservation](#5-data-preservation)
6. [Rollback Procedures](#6-rollback-procedures)
7. [Testing Migration](#7-testing-migration)
8. [Scripts & Automation](#8-scripts--automation)

---

## 1. When to Migrate

### Scenarios Requiring Migration

#### ✅ **Business Requirement Changes**

**When:**
- Need to add or remove payees
- Share distribution needs updating
- Business partnership terms change

**Example:**
```
Current: Alice (50%), Bob (50%)
New: Alice (40%), Bob (40%), Charlie (20%)
```

**Action Required:** Deploy new contract with updated payees and shares

---

#### ✅ **Bug Discovery (Hypothetical)**

**When:**
- Critical vulnerability discovered (unlikely with current implementation)
- Logic error affecting fund distribution
- Security audit recommends changes

**Severity Levels:**

| Severity | Action | Timeline |
|----------|--------|----------|
| **Critical** | Emergency migration immediately | < 24 hours |
| **High** | Planned migration within 1 week | 1-7 days |
| **Medium** | Scheduled migration next cycle | 1-4 weeks |
| **Low** | Optional upgrade on convenience | Flexible |

> **Note:** Current SplitStream implementation has passed security audit with no critical issues.

---

#### ✅ **New Features Needed**

**When:**
- Need pause functionality
- Want to add access controls
- Require minimum payment thresholds
- Need upgradeable pattern

**Example Enhancements:**
```solidity
// V2 Features
- Minimum payment threshold (prevent dust attacks)
- Emergency pause by multisig
- Dynamic share adjustment (with governance)
- Multiple token support (not just ETH)
```

---

#### ✅ **Regulatory Requirements**

**When:**
- Compliance requirements change
- KYC/AML integration needed
- Tax reporting automation required
- Geographic restrictions imposed

**Action:** Deploy contract with compliance features

---

#### ⚠️ **Network Migration**

**When:**
- Moving from testnet to mainnet
- Switching L2 networks (e.g., Base to Optimism)
- Network deprecation

**Important:** Cannot migrate same contract across networks - must deploy new instance

---

## 2. Migration Strategies

### Strategy A: Clean Cut Migration (Recommended)

**Use When:**
- No ongoing payment streams
- Can coordinate all parties
- Want clean break

**Process:**
1. Announce migration date
2. Release all pending payments
3. Deploy new contract
4. Update all integrations
5. Resume operations

**Advantages:**
- ✅ Clean separation
- ✅ Simple accounting
- ✅ Clear audit trail

**Disadvantages:**
- ⚠️ Requires coordination
- ⚠️ Temporary service interruption

---

### Strategy B: Gradual Migration

**Use When:**
- Continuous payment flow
- Large number of integrations
- Risk-averse approach needed

**Process:**
1. Deploy new contract
2. Redirect new payments to new contract
3. Allow old contract to drain naturally
4. Eventually release remaining funds
5. Deprecate old contract

**Advantages:**
- ✅ No service interruption
- ✅ Lower risk
- ✅ Easier coordination

**Disadvantages:**
- ⚠️ More complex accounting
- ⚠️ Maintain two contracts temporarily
- ⚠️ Longer transition period

---

### Strategy C: Emergency Migration

**Use When:**
- Critical bug discovered
- Security threat imminent
- Immediate action required

**Process:**
1. Deploy new contract immediately
2. Release ALL funds to payees from old contract
3. Payees manually send to new contract (if needed)
4. Update all integrations ASAP
5. Blacklist old contract address

**Advantages:**
- ✅ Fast response
- ✅ Minimizes risk exposure

**Disadvantages:**
- ⚠️ Chaotic
- ⚠️ May lose some funds in transition
- ⚠️ Requires emergency communication

---

## 3. Step-by-Step Migration Process

### Phase 1: Pre-Migration Planning

#### 📋 Pre-Migration Checklist

- [ ] **Identify reason for migration**
  - Document what's changing and why
  
- [ ] **Define new contract parameters**
  - [ ] List all payees (addresses)
  - [ ] Define share distribution
  - [ ] Sum shares to verify total
  
- [ ] **Estimate remaining funds in old contract**
  ```bash
  CONTRACT_ADDRESS=0xOLD_ADDRESS npx hardhat run scripts/checkBalance.js --network base
  ```
  
- [ ] **Notify all stakeholders**
  - Payees
  - Integration partners
  - Frontend users
  - Monitoring systems
  
- [ ] **Prepare migration scripts**
  - Test on testnet
  - Verify gas estimates
  
- [ ] **Schedule maintenance window**
  - Low-traffic period
  - Coordinate with all parties
  
- [ ] **Backup all data**
  - Export transaction history
  - Save event logs
  - Document current state

---

### Phase 2: Old Contract Closure

#### Step 1: Export Current State

```javascript
// scripts/exportState.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const contractAddress = process.env.OLD_CONTRACT_ADDRESS;
    const SplitStream = await hre.ethers.getContractFactory("SplitStream");
    const contract = SplitStream.attach(contractAddress);
    
    // Get all payees
    const payees = [];
    let index = 0;
    try {
        while (true) {
            payees.push(await contract.payee(index++));
        }
    } catch {}
    
    // Export state
    const state = {
        contractAddress,
        exportDate: new Date().toISOString(),
        totalShares: (await contract.totalShares()).toString(),
        totalReleased: hre.ethers.formatEther(await contract.totalReleased()),
        balance: hre.ethers.formatEther(await hre.ethers.provider.getBalance(contractAddress)),
        payees: []
    };
    
    for (const payee of payees) {
        state.payees.push({
            address: payee,
            shares: (await contract.shares(payee)).toString(),
            released: hre.ethers.formatEther(await contract.released(payee))
        });
    }
    
    // Save to file
    fs.writeFileSync(
        `migration_state_${Date.now()}.json`,
        JSON.stringify(state, null, 2)
    );
    
    console.log("✅ State exported successfully");
    console.log(JSON.stringify(state, null, 2));
}

main().catch(console.error);
```

**Run:**
```bash
OLD_CONTRACT_ADDRESS=0x... npx hardhat run scripts/exportState.js --network base
```

---

#### Step 2: Release All Pending Payments

```javascript
// scripts/releaseAll.js
const hre = require("hardhat");

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const SplitStream = await hre.ethers.getContractFactory("SplitStream");
    const contract = SplitStream.attach(contractAddress);
    
    // Get all payees
    const payees = [];
    let index = 0;
    try {
        while (true) {
            payees.push(await contract.payee(index++));
        }
    } catch {}
    
    console.log(`Found ${payees.length} payees`);
    
    // Release for each payee
    for (const payee of payees) {
        try {
            const tx = await contract.release(payee);
            console.log(`✅ Released payment to ${payee}: ${tx.hash}`);
            await tx.wait();
        } catch (error) {
            console.log(`⚠️  No payment due for ${payee} or already released`);
        }
    }
    
    // Verify final balance
    const finalBalance = await hre.ethers.provider.getBalance(contractAddress);
    console.log(`\nFinal contract balance: ${hre.ethers.formatEther(finalBalance)} ETH`);
    
    if (finalBalance > 0n) {
        console.log("⚠️  Warning: Contract still has balance (likely dust from rounding)");
    }
}

main().catch(console.error);
```

**Run:**
```bash
CONTRACT_ADDRESS=0xOLD_ADDRESS npx hardhat run scripts/releaseAll.js --network base
```

---

### Phase 3: New Contract Deployment

#### Step 3: Deploy New Contract

**Prepare deployment parameters:**

```javascript
// scripts/migrateToNewContract.js
const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying new SplitStream contract...\n");
    
    // NEW CONTRACT PARAMETERS
    const newPayees = [
        "0xAddress1...",  // Alice
        "0xAddress2...",  // Bob
        "0xAddress3..."   // Charlie (new)
    ];
    
    const newShares = [
        40,  // Alice: 40%
        40,  // Bob: 40%
        20   // Charlie: 20%
    ];
    
    // Validate
    console.log("Payees and Shares:");
    for (let i = 0; i < newPayees.length; i++) {
        console.log(`  ${newPayees[i]}: ${newShares[i]} shares`);
    }
    
    const totalShares = newShares.reduce((a, b) => a + b, 0);
    console.log(`\nTotal shares: ${totalShares}\n`);
    
    // Deploy
    const SplitStream = await hre.ethers.getContractFactory("SplitStream");
    const contract = await SplitStream.deploy(newPayees, newShares);
    await contract.waitForDeployment();
    
    const address = contract.target || contract.address;
    console.log(`✅ New contract deployed at: ${address}`);
    console.log(`   Network: ${hre.network.name}`);
    console.log(`   Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId}`);
    
    // Save deployment info
    const deploymentInfo = {
        address,
        network: hre.network.name,
        deployedAt: new Date().toISOString(),
        payees: newPayees,
        shares: newShares,
        deployer: (await hre.ethers.getSigners())[0].address
    };
    
    require('fs').writeFileSync(
        'deployment_new.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("\n📝 Deployment info saved to deployment_new.json");
}

main().catch(console.error);
```

**Run:**
```bash
npx hardhat run scripts/migrateToNewContract.js --network base
```

---

#### Step 4: Verify New Contract

```bash
# Check new contract status
CONTRACT_ADDRESS=0xNEW_ADDRESS npx hardhat run scripts/checkBalance.js --network base
```

**Verification Checklist:**
- [ ] All payees are correct
- [ ] All shares are correct
- [ ] Total shares sum is expected
- [ ] Contract balance is 0 (initially)
- [ ] No pending payments (initially)

---

### Phase 4: Integration Updates

#### Step 5: Update Environment Variables

```bash
# .env
OLD_CONTRACT_ADDRESS=0x...  # Keep for reference
CONTRACT_ADDRESS=0xNEW_ADDRESS...  # Update to new address
```

---

#### Step 6: Update Frontend/Integration

```javascript
// Before
const contractAddress = "0xOLD_ADDRESS";

// After
const contractAddress = "0xNEW_ADDRESS";
```

**Update Everywhere:**
- Frontend configuration
- Backend services
- Monitoring scripts
- Documentation
- Team wikis
- Customer-facing docs

---

### Phase 5: Post-Migration Validation

#### Step 7: Send Test Transaction

```bash
# Send small test amount
npx hardhat run scripts/sendTestPayment.js --network base
```

```javascript
// scripts/sendTestPayment.js
const hre = require("hardhat");

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const [signer] = await hre.ethers.getSigners();
    
    const tx = await signer.sendTransaction({
        to: contractAddress,
        value: hre.ethers.parseEther("0.001") // 0.001 ETH test
    });
    
    console.log(`✅ Test payment sent: ${tx.hash}`);
    await tx.wait();
    
    // Verify
    const balance = await hre.ethers.provider.getBalance(contractAddress);
    console.log(`Contract balance: ${hre.ethers.formatEther(balance)} ETH`);
}

main().catch(console.error);
```

---

#### Step 8: Test Release Function

```bash
# Pick one payee to test withdrawal
PAYEE_ADDRESS=0x... npx hardhat run scripts/releasePayment.js --network base
```

**Validation:**
- [ ] Payment received event emitted
- [ ] Payment released event emitted
- [ ] Correct amount withdrawn
- [ ] Balance updated correctly

---

#### Step 9: Monitor Events

```bash
# Start monitoring for 5 minutes
CONTRACT_ADDRESS=0xNEW_ADDRESS npx hardhat run scripts/monitor.js --network base
```

**Watch for:**
- PaymentReceived events
- PaymentReleased events
- Any errors or reverts

---

### Phase 6: Full Cutover

#### Step 10: Announce Migration Complete

**Communication Template:**

```
🎉 Migration Complete!

Old Contract: 0xOLD_ADDRESS (deprecated)
New Contract: 0xNEW_ADDRESS (active)

Changes:
- Added payee: Charlie (20% share)
- Updated shares: Alice 40%, Bob 40%, Charlie 20%

Action Required:
- Update any saved addresses to new contract
- All payments should now go to: 0xNEW_ADDRESS

Questions? Contact: team@example.com
```

---

#### Step 11: Document Migration

```markdown
# Migration Record

**Date:** 2026-01-22
**Reason:** Added new payee
**Old Contract:** 0xOLD_ADDRESS
**New Contract:** 0xNEW_ADDRESS

## Changes
- Added Charlie as payee with 20% share
- Reduced Alice and Bob to 40% each

## Final State of Old Contract
- Total Released: 10.5 ETH
- Final Balance: 0.0001 ETH (dust)
- All payees withdrawn successfully

## New Contract Status
- Deployed successfully
- Test transactions verified
- Monitoring active
```

---

## 4. Common Migration Scenarios

### Scenario A: Adding a New Payee

**Situation:** Partnership expands, need to add new member

**Before:**
```javascript
const payees = [
    "0xAlice...",
    "0xBob..."
];
const shares = [50, 50]; // 50/50 split
```

**After:**
```javascript
const payees = [
    "0xAlice...",
    "0xBob...",
    "0xCharlie..."  // New member
];
const shares = [40, 40, 20]; // 40/40/20 split
```

**Steps:**
1. Release all funds from old contract
2. Deploy new contract with 3 payees
3. Update all payment sources
4. Resume operations

**Timeline:** 1-2 hours

---

### Scenario B: Removing a Payee

**Situation:** Partner leaves, needs final payout

**Before:**
```javascript
const payees = ["0xAlice...", "0xBob...", "0xCharlie..."];
const shares = [33, 33, 34];
```

**After:**
```javascript
const payees = ["0xAlice...", "0xBob..."];
const shares = [50, 50];
```

**Steps:**
1. Release Charlie's final payment from old contract
2. Deploy new contract with 2 payees
3. Update integrations
4. Charlie confirms receipt

**Important:** Ensure departing payee receives ALL owed funds before migration!

---

### Scenario C: Changing Share Distribution

**Situation:** Renegotiated partnership terms

**Before:**
```javascript
const shares = [50, 50]; // Equal split
```

**After:**
```javascript
const shares = [70, 30]; // 70/30 split
```

**Steps:**
1. Settle all pending payments at OLD ratio
2. Deploy new contract with NEW ratio
3. Clearly communicate change date
4. All NEW payments use new ratio

**Communication Critical:** Document exact cutover timestamp!

---

### Scenario D: Network Migration

**Situation:** Moving from Base Goerli (testnet) to Base Mainnet

**Process:**
```bash
# 1. Export state from testnet
OLD_CONTRACT_ADDRESS=0x... npx hardhat run scripts/exportState.js --network base-goerli

# 2. Deploy to mainnet with SAME parameters
npx hardhat run scripts/deploy.js --network base

# 3. Verify on mainnet
CONTRACT_ADDRESS=0x... npx hardhat run scripts/checkBalance.js --network base

# 4. Update all integrations to mainnet
```

**Important:** This is a NEW deployment, not a migration. No funds transfer between networks!

---

### Scenario E: Upgrading Contract Logic

**Situation:** Want to add ReentrancyGuard or other features

**Before:** SplitStream V1 (current)

**After:** SplitStream V2 (with enhancements)

**Migration Process:**

1. **Develop V2 Contract:**
   ```solidity
   // contracts/SplitStreamV2.sol
   import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
   
   contract SplitStreamV2 is SplitStream, ReentrancyGuard {
       uint256 public constant MIN_PAYMENT = 0.001 ether;
       
       receive() external payable override {
           require(msg.value >= MIN_PAYMENT, "Payment too small");
           super.receive();
       }
       
       function release(address payable account) public override nonReentrant {
           super.release(account);
       }
   }
   ```

2. **Test V2 on testnet**
3. **Release all funds from V1**
4. **Deploy V2 to mainnet**
5. **Update all integrations**

---

## 5. Data Preservation

### Export Transaction History

#### Method 1: Export from Events

```javascript
// scripts/exportHistory.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const SplitStream = await hre.ethers.getContractFactory("SplitStream");
    const contract = SplitStream.attach(contractAddress);
    
    // Get deployment block (you should save this during deployment)
    const deploymentBlock = process.env.DEPLOYMENT_BLOCK || 0;
    
    console.log("📊 Exporting transaction history...\n");
    
    // Get PaymentReceived events
    const receivedFilter = contract.filters.PaymentReceived();
    const receivedEvents = await contract.queryFilter(receivedFilter, deploymentBlock);
    
    // Get PaymentReleased events
    const releasedFilter = contract.filters.PaymentReleased();
    const releasedEvents = await contract.queryFilter(releasedFilter, deploymentBlock);
    
    // Format history
    const history = {
        contractAddress,
        exportDate: new Date().toISOString(),
        deploymentBlock,
        paymentsReceived: [],
        paymentsReleased: []
    };
    
    for (const event of receivedEvents) {
        const block = await event.getBlock();
        history.paymentsReceived.push({
            blockNumber: event.blockNumber,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            sender: event.args.sender,
            amount: hre.ethers.formatEther(event.args.amount),
            txHash: event.transactionHash
        });
    }
    
    for (const event of releasedEvents) {
        const block = await event.getBlock();
        history.paymentsReleased.push({
            blockNumber: event.blockNumber,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            payee: event.args.payee,
            amount: hre.ethers.formatEther(event.args.amount),
            txHash: event.transactionHash
        });
    }
    
    // Calculate totals
    const totalReceived = history.paymentsReceived.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
    );
    const totalReleased = history.paymentsReleased.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
    );
    
    history.summary = {
        totalPaymentsReceived: history.paymentsReceived.length,
        totalPaymentsReleased: history.paymentsReleased.length,
        totalAmountReceived: `${totalReceived.toFixed(6)} ETH`,
        totalAmountReleased: `${totalReleased.toFixed(6)} ETH`
    };
    
    // Save to file
    const filename = `history_${contractAddress}_${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(history, null, 2));
    
    console.log(`✅ History exported to ${filename}`);
    console.log(`\nSummary:`);
    console.log(`  Payments Received: ${history.paymentsReceived.length}`);
    console.log(`  Payments Released: ${history.paymentsReleased.length}`);
    console.log(`  Total Received: ${totalReceived.toFixed(6)} ETH`);
    console.log(`  Total Released: ${totalReleased.toFixed(6)} ETH`);
}

main().catch(console.error);
```

**Usage:**
```bash
CONTRACT_ADDRESS=0x... DEPLOYMENT_BLOCK=12345678 npx hardhat run scripts/exportHistory.js --network base
```

---

#### Method 2: Export from Block Explorer

1. Visit block explorer (BaseScan)
2. Go to contract address
3. Navigate to "Events" tab
4. Export PaymentReceived events (CSV)
5. Export PaymentReleased events (CSV)
6. Save locally for records

---

### Maintain Audit Trail

**Create Migration Log:**

```json
{
  "migrations": [
    {
      "date": "2026-01-22T19:00:00Z",
      "reason": "Added new payee",
      "oldContract": "0xOLD_ADDRESS",
      "newContract": "0xNEW_ADDRESS",
      "oldPayees": ["0xAlice", "0xBob"],
      "newPayees": ["0xAlice", "0xBob", "0xCharlie"],
      "finalOldBalance": "0.0001 ETH",
      "initiatedBy": "0xDEPLOYER",
      "approvedBy": ["Alice", "Bob"],
      "transactionHashes": {
        "deployment": "0xDEPLOY_TX",
        "finalReleases": ["0xRELEASE1", "0xRELEASE2"]
      }
    }
  ]
}
```

**Store:**
- Git repository (version controlled)
- Secure backup storage
- Company documentation system
- Blockchain (as events/transactions)

---

## 6. Rollback Procedures

### Understanding Rollback Limitations

> ⚠️ **Critical:** Once a contract is deployed and receives funds, there is NO true "rollback" on blockchain.

**What you CAN do:**
- Deploy a new contract with old parameters
- Migrate funds back to original configuration
- Restore business logic to previous state

**What you CANNOT do:**
- Undo blockchain transactions
- Delete deployed contracts
- Restore historical state magically

---

### Pseudo-Rollback: Reverting to Previous Configuration

**Scenario:** Deployed wrong parameters, catch it quickly

**Within 1 hour of deployment:**

```bash
# 1. Immediately release all funds (if any)
CONTRACT_ADDRESS=0xNEW_WRONG npx hardhat run scripts/releaseAll.js --network base

# 2. Deploy contract with CORRECT parameters
npx hardhat run scripts/deploy.js --network base

# 3. Update all integrations to CORRECT address
# Edit .env: CONTRACT_ADDRESS=0xCORRECT_ADDRESS

# 4. Communicate mistake and correction
```

---

### Emergency Recovery

**Scenario:** Critical bug discovered in new deployment

#### Recovery Plan:

1. **Stop All Inflows** (if possible)
   - Pause payment integrations
   - Notify senders
   - Redirect to safe address

2. **Extract All Funds**
   ```bash
   CONTRACT_ADDRESS=0xBUGGY npx hardhat run scripts/releaseAll.js --network base
   ```

3. **Deploy Safe Contract**
   - Use previously audited version
   - Or deploy temporary holding contract

4. **Investigate & Fix**
   - Identify root cause
   - Develop patch
   - Re-audit if necessary

5. **Deploy Fixed Version**
   - Test extensively on testnet
   - Deploy to mainnet
   - Resume operations

---

### Fund Safety Guarantees

**The Good News:** ✅

SplitStream contract guarantees:
- Funds can ALWAYS be withdrawn by rightful payees
- No owner can lock or steal funds
- No selfdestruct to destroy funds
- Math ensures all funds are distributable

**Steps to Guarantee Safety:**

1. **Verify Payee Addresses** before deployment
   ```javascript
   // Triple-check each address
   const payees = [
       "0x742d35Cc6634C0532925a3b8D402EDeD60000000",  // ✅ Checksum valid
       "0x742D35CC6634C0532925A3B8D402EDED60000000"   // ✅ Same address
   ];
   
   // Validate
   for (const addr of payees) {
       if (!hre.ethers.isAddress(addr)) {
           throw new Error(`Invalid address: ${addr}`);
       }
       console.log(`✅ ${addr} is valid`);
   }
   ```

2. **Test Withdrawals** immediately after deployment

3. **Use Multisig** for high-value payees

4. **Backup Private Keys** securely

---

## 7. Testing Migration

### Testnet Rehearsal

**Before ANY mainnet migration, rehearse on testnet!**

#### Step-by-Step Testnet Practice:

```bash
# 1. Deploy "old" contract to testnet
npx hardhat run scripts/deploy.js --network base-goerli

# 2. Send test funds
npx hardhat run scripts/sendTestPayment.js --network base-goerli

# 3. Test releases
npx hardhat run scripts/releaseAll.js --network base-goerli

# 4. Export state
npx hardhat run scripts/exportState.js --network base-goerli

# 5. Deploy "new" contract
npx hardhat run scripts/migrateToNewContract.js --network base-goerli

# 6. Verify new contract
CONTRACT_ADDRESS=0xNEW npx hardhat run scripts/checkBalance.js --network base-goerli

# 7. Send test payment to new contract
CONTRACT_ADDRESS=0xNEW npx hardhat run scripts/sendTestPayment.js --network base-goerli

# 8. Test withdrawal from new contract
CONTRACT_ADDRESS=0xNEW npx hardhat run scripts/releasePayment.js --network base-goerli
```

**Time Investment:** 1-2 hours  
**Value:** Priceless! Catch issues before mainnet.

---

### Migration Validation Checklist

#### Pre-Deployment Validation

- [ ] All new payee addresses verified (checksummed)
- [ ] Shares sum to expected total
- [ ] Deployment script tested on testnet
- [ ] Gas estimates acceptable
- [ ] Sufficient ETH for deployment
- [ ] All stakeholders notified

#### Post-Deployment Validation

- [ ] New contract deployed successfully
- [ ] Contract code verified on block explorer
- [ ] All payees present in new contract
- [ ] All shares correct in new contract
- [ ] Total shares matches expected
- [ ] Test transaction sent and received
- [ ] Test withdrawal successful
- [ ] Events emitting correctly
- [ ] Monitoring script running

#### Post-Migration Validation

- [ ] Old contract fully drained (or dust only)
- [ ] All integrations updated
- [ ] Documentation updated
- [ ] Team notified
- [ ] Customers notified (if applicable)
- [ ] Migration record saved
- [ ] Transaction history exported

---

### Common Pitfalls

#### ❌ Pitfall 1: Wrong Address Checksum

**Problem:**
```javascript
const payees = ["0xabc..."];  // Lowercase - might be wrong!
```

**Solution:**
```javascript
const payees = ["0xABC..."];  // Use checksummed address

// Or validate:
if (!hre.ethers.isAddress(addr)) {
    throw new Error("Invalid");
}
```

---

#### ❌ Pitfall 2: Forgetting to Release Old Funds

**Problem:** Deploy new contract, forget old one has funds

**Solution:** Always run `releaseAll.js` on old contract first!

---

#### ❌ Pitfall 3: Shares Don't Sum Correctly

**Problem:**
```javascript
const shares = [33, 33, 33];  // Only 99 total!
```

**Solution:**
```javascript
const shares = [33, 33, 34];  // 100 total
const sum = shares.reduce((a, b) => a + b, 0);
console.log(`Total shares: ${sum}`);  // Verify!
```

---

#### ❌ Pitfall 4: Updating Wrong Contract Address

**Problem:** Update .env but not frontend config

**Solution:** Maintain checklist of ALL places address appears:
- `.env`
- Frontend config
- Backend config
- Documentation
- Monitoring scripts
- README
- Team wiki

---

#### ❌ Pitfall 5: Not Testing First

**Problem:** Deploy directly to mainnet without testing

**Solution:** ALWAYS test on testnet first!

---

## 8. Scripts & Automation

### Complete Migration Script

```javascript
// scripts/completeMigration.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const question = (query) => new Promise((resolve) => readline.question(query, resolve));
    
    console.log("🔄 SplitStream Migration Tool\n");
    console.log("This will guide you through the migration process.\n");
    
    // Step 1: Get old contract address
    const oldAddress = await question("Enter OLD contract address: ");
    
    if (!hre.ethers.isAddress(oldAddress)) {
        console.error("❌ Invalid address");
        process.exit(1);
    }
    
    // Step 2: Export old state
    console.log("\n📊 Exporting old contract state...");
    const SplitStream = await hre.ethers.getContractFactory("SplitStream");
    const oldContract = SplitStream.attach(oldAddress);
    
    const oldState = {
        address: oldAddress,
        balance: hre.ethers.formatEther(await hre.ethers.provider.getBalance(oldAddress)),
        totalShares: (await oldContract.totalShares()).toString(),
        totalReleased: hre.ethers.formatEther(await oldContract.totalReleased())
    };
    
    console.log("Old Contract State:", oldState);
    
    // Step 3: Confirm release all
    const confirmRelease = await question("\n⚠️  Release all pending payments? (yes/no): ");
    
    if (confirmRelease.toLowerCase() === 'yes') {
        console.log("💸 Releasing all payments...");
        // Release logic here (from releaseAll.js)
        console.log("✅ All payments released");
    }
    
    // Step 4: Get new parameters
    console.log("\n📝 Enter new contract parameters:");
    const payeeCount = parseInt(await question("Number of payees: "));
    
    const newPayees = [];
    const newShares = [];
    
    for (let i = 0; i < payeeCount; i++) {
        const addr = await question(`Payee ${i + 1} address: `);
        const share = parseInt(await question(`Payee ${i + 1} shares: `));
        
        if (!hre.ethers.isAddress(addr)) {
            console.error(`❌ Invalid address: ${addr}`);
            process.exit(1);
        }
        
        newPayees.push(addr);
        newShares.push(share);
    }
    
    const totalShares = newShares.reduce((a, b) => a + b, 0);
    console.log(`\nTotal shares: ${totalShares}`);
    
    // Step 5: Confirm deployment
    console.log("\n📋 New Contract Configuration:");
    for (let i = 0; i < newPayees.length; i++) {
        console.log(`  ${newPayees[i]}: ${newShares[i]} shares (${(newShares[i]/totalShares*100).toFixed(2)}%)`);
    }
    
    const confirmDeploy = await question("\n🚀 Deploy new contract? (yes/no): ");
    
    if (confirmDeploy.toLowerCase() === 'yes') {
        console.log("Deploying...");
        const newContract = await SplitStream.deploy(newPayees, newShares);
        await newContract.waitForDeployment();
        
        const newAddress = newContract.target || newContract.address;
        console.log(`✅ New contract deployed: ${newAddress}`);
        
        // Save migration record
        const record = {
            date: new Date().toISOString(),
            oldContract: oldAddress,
            newContract: newAddress,
            oldState,
            newPayees,
            newShares
        };
        
        fs.writeFileSync(
            `migration_${Date.now()}.json`,
            JSON.stringify(record, null, 2)
        );
        
        console.log("\n✅ Migration complete!");
        console.log(`   Old: ${oldAddress}`);
        console.log(`   New: ${newAddress}`);
    }
    
    readline.close();
}

main().catch(console.error);
```

**Usage:**
```bash
npx hardhat run scripts/completeMigration.js --network base
```

---

### Quick Reference Commands

```bash
# Export current state
CONTRACT_ADDRESS=0x... npx hardhat run scripts/exportState.js --network base

# Release all payments
CONTRACT_ADDRESS=0x... npx hardhat run scripts/releaseAll.js --network base

# Deploy new contract
npx hardhat run scripts/deploy.js --network base

# Check balance
CONTRACT_ADDRESS=0x... npx hardhat run scripts/checkBalance.js --network base

# Export history
CONTRACT_ADDRESS=0x... DEPLOYMENT_BLOCK=123456 npx hardhat run scripts/exportHistory.js --network base

# Monitor events
CONTRACT_ADDRESS=0x... npx hardhat run scripts/monitor.js --network base
```

---

## Summary

### Migration Best Practices

1. ✅ **Always test on testnet first**
2. ✅ **Export all data before migrating**
3. ✅ **Release all pending payments from old contract**
4. ✅ **Verify new contract thoroughly**
5. ✅ **Document everything**
6. ✅ **Communicate clearly with all stakeholders**
7. ✅ **Keep migration records**
8. ✅ **Monitor for 24-48 hours post-migration**

### Migration Timeline

| Phase | Duration | Key Activities |
|-------|----------|----------------|
| Planning | 1-2 days | Requirements, communication, testing |
| Preparation | 2-4 hours | Scripts, testnet rehearsal |
| Execution | 1-2 hours | Deploy, release, update |
| Validation | 2-4 hours | Testing, monitoring |
| Post-Migration | 1-2 days | Monitoring, support |

### Support

For migration assistance:
- Review this guide
- Check [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)
- Review [README.md](../README.md)
- Test on testnet first

---

**Last Updated:** 2026-01-22  
**Version:** 1.0.0
