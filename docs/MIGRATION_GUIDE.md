# SplitStream Migration Guide

This guide provides comprehensive instructions for migrating between SplitStream contract versions, handling issues, and managing various upgrade scenarios.

## Table of Contents

- [When to Migrate](#when-to-migrate)
- [Migration Strategies](#migration-strategies)
- [Step-by-Step Migration Process](#step-by-step-migration-process)
- [Common Migration Scenarios](#common-migration-scenarios)
- [Data Preservation](#data-preservation)
- [Rollback Procedures](#rollback-procedures)
- [Testing Migration](#testing-migration)
- [Emergency Procedures](#emergency-procedures)

---

## When to Migrate

### 1. Active Contract with Updated Share Requirements

**Scenario**: Your contract has accumulated funds, but payee shares need to be updated.

**Indicators**:
- New team members join requiring payment allocation
- Existing payees need share adjustments
- Contract balance > 0 and ongoing payments expected

**Migration Required**: ✅ Yes - Deploy new contract with updated shares

---

### 2. Bug Discovery (Hypothetical)

**Scenario**: A vulnerability or bug is discovered in the contract logic.

**Indicators**:
- Security audit reveals issues
- Unexpected behavior in payment distribution
- Logic errors in share calculations

**Migration Required**: ✅ Yes - Immediate migration to patched contract

> [!CAUTION]
> If a critical vulnerability is discovered, pause all payments immediately and follow emergency migration procedures.

---

### 3. New Features Needed

**Scenario**: Business requirements change requiring new functionality.

**Examples**:
- Adding admin capabilities for share adjustment
- Implementing payment scheduling
- Adding multi-token support (beyond ETH)
- Implementing governance features

**Migration Required**: ✅ Yes - Deploy enhanced contract version

---

### 4. Regulatory Requirements

**Scenario**: Legal or compliance requirements necessitate contract changes.

**Examples**:
- KYC/AML integration requirements
- Tax reporting enhancements
- Geographic restrictions
- Compliance with new blockchain regulations

**Migration Required**: ✅ Yes - Deploy compliant contract version

---

## Migration Strategies

### Strategy 1: Complete Migration (Recommended)

**Best For**: Clean breaks, major upgrades, security issues

**Process**:
1. Deploy new contract
2. Release all pending payments from old contract
3. Transfer remaining balance to new contract
4. Update all integration points
5. Deprecate old contract

**Pros**:
- Clean separation of concerns
- No confusion about active contract
- Simple to verify completion

**Cons**:
- Requires coordination
- Potential downtime
- All integrations must update simultaneously

---

### Strategy 2: Gradual Migration with Transition Period

**Best For**: Large ecosystems, multiple integrations, non-urgent upgrades

**Process**:
1. Deploy new contract alongside old contract
2. Announce transition period (e.g., 30 days)
3. Gradually move payment sources to new contract
4. Allow payees to claim from both contracts
5. After transition period, sunset old contract

**Pros**:
- Minimal disruption
- Time for integrations to update
- Reduced coordination overhead

**Cons**:
- Funds split across two contracts
- Complex accounting during transition
- Extended timeline

---

### Strategy 3: Emergency Migration

**Best For**: Critical vulnerabilities, immediate threats

**Process**:
1. **Immediately** pause all payment inputs
2. Deploy audited fix/new contract
3. Release all funds from vulnerable contract
4. Transfer to secure holding address or new contract
5. Communicate to all stakeholders
6. Resume operations on new contract

**Pros**:
- Protects funds immediately
- Minimizes exposure window

**Cons**:
- Rushed process increases risk
- May require manual intervention
- Potential for confusion

---

## Step-by-Step Migration Process

### Phase 1: Pre-Migration Checklist

#### 1.1 Assessment

```bash
# Check current contract status
npx hardhat run scripts/checkBalance.js --network base

# Export current state
npx hardhat run scripts/exportContractState.js --network base > migration-snapshot.json
```

**Verify**:
- [ ] Current contract balance
- [ ] Total shares distribution
- [ ] Pending payments per payee
- [ ] Recent transaction history
- [ ] All payee addresses are known and accessible

#### 1.2 Communication Plan

- [ ] Notify all payees of migration timeline
- [ ] Document reason for migration
- [ ] Share new contract address (after deployment)
- [ ] Provide claim instructions
- [ ] Set deadline for claiming from old contract

#### 1.3 Preparation

```bash
# Prepare new contract configuration
cat > migration-config.json << EOF
{
  "newPayees": [
    {"address": "0x123...", "shares": 40},
    {"address": "0x456...", "shares": 30},
    {"address": "0x789...", "shares": 30}
  ],
  "oldContractAddress": "0xOLD_CONTRACT_ADDRESS",
  "migrationDate": "2026-02-15T00:00:00Z"
}
EOF
```

---

### Phase 2: Deployment of New Contract

#### 2.1 Test Deployment

```bash
# Deploy to testnet first
npx hardhat run scripts/deploy.js --network base-sepolia

# Verify deployment
npx hardhat verify --network base-sepolia DEPLOYED_ADDRESS \
  '["0x123...", "0x456..."]' \
  '[40, 60]'
```

#### 2.2 Production Deployment

```bash
# Deploy to mainnet
npx hardhat run scripts/deploy.js --network base

# Verify on Basescan
npx hardhat verify --network base NEW_CONTRACT_ADDRESS \
  '["0x123...", "0x456...", "0x789..."]' \
  '[40, 30, 30]'
```

**Save deployment details**:
```bash
echo "NEW_CONTRACT_ADDRESS=0xNEW_ADDRESS" >> .env
echo "MIGRATION_BLOCK=$(cast block-number --rpc-url $BASE_RPC_URL)" >> .env
echo "MIGRATION_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .env
```

---

### Phase 3: Fund Transfer Procedures

#### 3.1 Release All Pending Payments

Create `scripts/releaseAll.js`:

```javascript
const hre = require("hardhat");

async function main() {
  const oldContractAddress = process.env.OLD_CONTRACT_ADDRESS;
  const SplitStream = await hre.ethers.getContractFactory("SplitStream");
  const contract = SplitStream.attach(oldContractAddress);
  
  // Get all payees
  const payeeCount = await contract.payeeCount();
  console.log(`Found ${payeeCount} payees`);
  
  for (let i = 0; i < payeeCount; i++) {
    const payeeAddress = await contract.payee(i);
    const pending = await contract.releasable(payeeAddress);
    
    if (pending > 0) {
      console.log(`Releasing ${hre.ethers.formatEther(pending)} ETH to ${payeeAddress}...`);
      const tx = await contract.release(payeeAddress);
      await tx.wait();
      console.log(`✓ Released in tx: ${tx.hash}`);
    } else {
      console.log(`⊘ No pending payment for ${payeeAddress}`);
    }
  }
  
  console.log("\n✅ All payments released");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Execute**:
```bash
OLD_CONTRACT_ADDRESS=0xOLD_ADDRESS npx hardhat run scripts/releaseAll.js --network base
```

#### 3.2 Transfer Remaining Balance

If there's a remaining balance (future payments), you have two options:

**Option A: Manual Transfer**
```bash
# Send remaining balance to new contract
cast send $OLD_CONTRACT_ADDRESS \
  --value $(cast balance $OLD_CONTRACT_ADDRESS) \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY
```

**Option B: Create Transfer Script**

```javascript
// scripts/transferBalance.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const oldAddress = process.env.OLD_CONTRACT_ADDRESS;
  const newAddress = process.env.NEW_CONTRACT_ADDRESS;
  
  const balance = await hre.ethers.provider.getBalance(oldAddress);
  console.log(`Old contract balance: ${hre.ethers.formatEther(balance)} ETH`);
  
  if (balance > 0) {
    console.log(`Transferring to new contract at ${newAddress}...`);
    const tx = await signer.sendTransaction({
      to: newAddress,
      value: balance,
      from: oldAddress
    });
    await tx.wait();
    console.log(`✅ Transfer complete: ${tx.hash}`);
  } else {
    console.log("⊘ No balance to transfer");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

### Phase 4: Verification Steps

#### 4.1 Contract Verification Checklist

```bash
# Create verification script
cat > scripts/verifyMigration.js << 'EOF'
const hre = require("hardhat");
const chalk = require("chalk");

async function main() {
  const oldAddress = process.env.OLD_CONTRACT_ADDRESS;
  const newAddress = process.env.NEW_CONTRACT_ADDRESS;
  
  const SplitStream = await hre.ethers.getContractFactory("SplitStream");
  const oldContract = SplitStream.attach(oldAddress);
  const newContract = SplitStream.attach(newAddress);
  
  console.log(chalk.bold("\n🔍 Migration Verification Report\n"));
  
  // Check old contract
  const oldBalance = await hre.ethers.provider.getBalance(oldAddress);
  console.log(chalk.yellow("Old Contract:"));
  console.log(`  Address: ${oldAddress}`);
  console.log(`  Balance: ${hre.ethers.formatEther(oldBalance)} ETH`);
  
  if (oldBalance > hre.ethers.parseEther("0.001")) {
    console.log(chalk.red("  ⚠️  WARNING: Old contract still has significant balance!"));
  } else {
    console.log(chalk.green("  ✓ Old contract properly drained"));
  }
  
  // Check new contract
  const newBalance = await hre.ethers.provider.getBalance(newAddress);
  const newPayeeCount = await newContract.payeeCount();
  const newTotalShares = await newContract.totalShares();
  
  console.log(chalk.green("\nNew Contract:"));
  console.log(`  Address: ${newAddress}`);
  console.log(`  Balance: ${hre.ethers.formatEther(newBalance)} ETH`);
  console.log(`  Payees: ${newPayeeCount}`);
  console.log(`  Total Shares: ${newTotalShares}`);
  
  // Verify payees
  console.log(chalk.blue("\nPayee Configuration:"));
  for (let i = 0; i < newPayeeCount; i++) {
    const payeeAddress = await newContract.payee(i);
    const shares = await newContract.shares(payeeAddress);
    const releasable = await newContract.releasable(payeeAddress);
    
    console.log(`  ${i + 1}. ${payeeAddress}`);
    console.log(`     Shares: ${shares} (${(shares * 100n / newTotalShares)}%)`);
    console.log(`     Releasable: ${hre.ethers.formatEther(releasable)} ETH`);
  }
  
  console.log(chalk.bold.green("\n✅ Migration verification complete\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
EOF
```

**Run verification**:
```bash
npx hardhat run scripts/verifyMigration.js --network base
```

#### 4.2 Test New Contract

```bash
# Send small test payment
cast send $NEW_CONTRACT_ADDRESS \
  --value 0.01ether \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY

# Check distribution
npx hardhat run scripts/checkBalance.js --network base
```

---

### Phase 5: Post-Migration Validation

#### 5.1 Update Documentation

- [ ] Update README.md with new contract address
- [ ] Update deployment documentation
- [ ] Archive old contract address with deprecation notice
- [ ] Update integration documentation

#### 5.2 Update Integrations

```javascript
// Update frontend configuration
// config/contracts.js
module.exports = {
  SPLITSTREAM_ADDRESS: "0xNEW_CONTRACT_ADDRESS", // Updated
  DEPRECATED_ADDRESSES: [
    "0xOLD_CONTRACT_ADDRESS" // For reference only
  ],
  MIGRATION_DATE: "2026-02-15",
  NETWORK: "base"
};
```

#### 5.3 Monitor New Contract

```bash
# Start monitoring
npx hardhat run scripts/monitor.js --network base

# Watch for events
# - PaymentReceived events
# - PaymentReleased events
# - Verify amounts match expected distribution
```

---

## Common Migration Scenarios

### Scenario 1: Adding New Payees

**Situation**: New team member joins, needs to be added to payment distribution.

#### Impact Analysis
- ✅ **CAN** add by deploying new contract
- ❌ **CANNOT** add to existing immutable contract
- ⚠️ Existing pending payments must be settled first

#### Migration Process

```bash
# 1. Export current configuration
npx hardhat run scripts/exportConfig.js --network base > old-config.json

# 2. Create new configuration
cat > new-config.json << EOF
{
  "payees": [
    {"address": "0xOLD_PAYEE_1", "shares": 30},
    {"address": "0xOLD_PAYEE_2", "shares": 30},
    {"address": "0xNEW_PAYEE", "shares": 40}
  ]
}
EOF

# 3. Release all pending payments from old contract
npx hardhat run scripts/releaseAll.js --network base

# 4. Deploy new contract with updated payees
npx hardhat run scripts/deployWithConfig.js --network base --config new-config.json

# 5. Verify new configuration
npx hardhat run scripts/verifyMigration.js --network base
```

#### Post-Migration

```bash
# Notify all payees
node scripts/notifyPayees.js \
  --old-contract $OLD_CONTRACT_ADDRESS \
  --new-contract $NEW_CONTRACT_ADDRESS \
  --message "New team member added. Please update your records."
```

---

### Scenario 2: Removing Payees

**Situation**: Team member leaves, should no longer receive payments.

> [!IMPORTANT]
> Ensure departing payee receives all pending payments before migration.

#### Migration Process

```javascript
// scripts/removePayee.js
const hre = require("hardhat");

async function main() {
  const oldAddress = process.env.OLD_CONTRACT_ADDRESS;
  const payeeToRemove = process.env.PAYEE_TO_REMOVE;
  
  const SplitStream = await hre.ethers.getContractFactory("SplitStream");
  const oldContract = SplitStream.attach(oldAddress);
  
  // 1. Release final payment to departing payee
  const pending = await oldContract.releasable(payeeToRemove);
  console.log(`Final payment: ${hre.ethers.formatEther(pending)} ETH`);
  
  if (pending > 0) {
    const tx = await oldContract.release(payeeToRemove);
    await tx.wait();
    console.log(`✓ Final payment released: ${tx.hash}`);
  }
  
  // 2. Get remaining payees
  const payeeCount = await oldContract.payeeCount();
  const newPayees = [];
  const newShares = [];
  
  for (let i = 0; i < payeeCount; i++) {
    const address = await oldContract.payee(i);
    if (address.toLowerCase() !== payeeToRemove.toLowerCase()) {
      const shares = await oldContract.shares(address);
      newPayees.push(address);
      newShares.push(shares);
    }
  }
  
  console.log("\nNew configuration:");
  console.log("Payees:", newPayees);
  console.log("Shares:", newShares);
  
  // 3. Deploy new contract (requires manual execution)
  console.log("\nNext step: Deploy new contract with above configuration");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Execute**:
```bash
PAYEE_TO_REMOVE=0xPAYEE_ADDRESS npx hardhat run scripts/removePayee.js --network base
```

---

### Scenario 3: Changing Share Distribution

**Situation**: Business agreement changes, shares need reallocation.

#### Example: 50/50 → 60/40 Split

```javascript
// scripts/rebalanceShares.js
const hre = require("hardhat");

async function main() {
  const oldAddress = process.env.OLD_CONTRACT_ADDRESS;
  const SplitStream = await hre.ethers.getContractFactory("SplitStream");
  const oldContract = SplitStream.attach(oldAddress);
  
  // Current configuration
  const currentConfig = [
    { address: "0xPayee1", shares: 50 },
    { address: "0xPayee2", shares: 50 }
  ];
  
  // New configuration
  const newConfig = [
    { address: "0xPayee1", shares: 60 },
    { address: "0xPayee2", shares: 40 }
  ];
  
  console.log("Current distribution:", currentConfig);
  console.log("New distribution:", newConfig);
  
  // Release all pending under old distribution
  console.log("\nReleasing pending payments under old distribution...");
  for (const payee of currentConfig) {
    const pending = await oldContract.releasable(payee.address);
    if (pending > 0) {
      const tx = await oldContract.release(payee.address);
      await tx.wait();
      console.log(`✓ Released ${hre.ethers.formatEther(pending)} ETH to ${payee.address}`);
    }
  }
  
  // Deploy new contract
  console.log("\nReady to deploy new contract with updated shares");
  console.log("Payees:", newConfig.map(p => p.address));
  console.log("Shares:", newConfig.map(p => p.shares));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

### Scenario 4: Upgrading Contract Version

**Situation**: New SplitStream version released with enhanced features.

#### Version Upgrade Checklist

```bash
# 1. Review changelog
cat CHANGELOG.md | grep -A 20 "Version 2.0.0"

# 2. Test new version on testnet
git checkout v2.0.0
npm install
npx hardhat test
npx hardhat run scripts/deploy.js --network base-sepolia

# 3. Audit new contract
# - Run security tests
npx hardhat test --grep "Security"
# - External audit if major changes
# - Compare gas costs
npx hardhat test --gas-reporter

# 4. Plan migration window
# - Choose low-activity period
# - Notify stakeholders 48h advance
# - Prepare rollback plan

# 5. Execute migration (as per standard process)
npx hardhat run scripts/migrate.js --network base

# 6. Validate
npx hardhat run scripts/verifyMigration.js --network base
```

---

### Scenario 5: Moving to Different Network

**Situation**: Migrating from Base Sepolia (testnet) to Base Mainnet, or Base to another L2.

#### Cross-Network Migration

```javascript
// scripts/crossNetworkMigration.js
const hre = require("hardhat");

async function main() {
  const sourceNetwork = "base-sepolia";
  const targetNetwork = "base";
  
  console.log(`Migrating from ${sourceNetwork} to ${targetNetwork}`);
  
  // 1. Export configuration from source
  const sourceContract = await hre.ethers.getContractAt(
    "SplitStream",
    process.env.SOURCE_CONTRACT_ADDRESS
  );
  
  const payeeCount = await sourceContract.payeeCount();
  const payees = [];
  const shares = [];
  
  for (let i = 0; i < payeeCount; i++) {
    const payeeAddress = await sourceContract.payee(i);
    const payeeShares = await sourceContract.shares(payeeAddress);
    payees.push(payeeAddress);
    shares.push(payeeShares);
  }
  
  console.log("Configuration to migrate:");
  console.log("Payees:", payees);
  console.log("Shares:", shares);
  
  // 2. Deploy to target network
  console.log(`\nDeploy to ${targetNetwork} with:`);
  console.log(`npx hardhat run scripts/deploy.js --network ${targetNetwork}`);
  console.log(`Constructor args: ${JSON.stringify({ payees, shares })}`);
  
  // 3. Transfer strategy options
  console.log("\nTransfer options:");
  console.log("A. Release all funds on source, payees deposit to target manually");
  console.log("B. Use bridge to transfer contract balance (if available)");
  console.log("C. Admin bridge transfer to new contract");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Execution**:
```bash
# Run on source network
SOURCE_CONTRACT_ADDRESS=0xSOURCE npx hardhat run scripts/crossNetworkMigration.js --network base-sepolia

# Deploy to target network
npx hardhat run scripts/deploy.js --network base

# Manual verification both networks operational
```

---

## Data Preservation

### Exporting Payment History

Since SplitStream events are emitted on-chain, historical data remains permanently accessible via blockchain explorers and RPC queries.

#### Create Export Script

```javascript
// scripts/exportHistory.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const fromBlock = parseInt(process.env.FROM_BLOCK || "0");
  const toBlock = process.env.TO_BLOCK || "latest";
  
  const SplitStream = await hre.ethers.getContractFactory("SplitStream");
  const contract = SplitStream.attach(contractAddress);
  
  console.log(`Exporting history from block ${fromBlock} to ${toBlock}...`);
  
  // Get all PaymentReceived events
  const receivedFilter = contract.filters.PaymentReceived();
  const receivedEvents = await contract.queryFilter(receivedFilter, fromBlock, toBlock);
  
  // Get all PaymentReleased events
  const releasedFilter = contract.filters.PaymentReleased();
  const releasedEvents = await contract.queryFilter(releasedFilter, fromBlock, toBlock);
  
  const history = {
    contractAddress,
    exportDate: new Date().toISOString(),
    fromBlock,
    toBlock,
    paymentsReceived: [],
    paymentsReleased: [],
    summary: {}
  };
  
  // Process received events
  for (const event of receivedEvents) {
    const block = await event.getBlock();
    history.paymentsReceived.push({
      blockNumber: event.blockNumber,
      timestamp: block.timestamp,
      from: event.args.from,
      amount: event.args.amount.toString(),
      amountETH: hre.ethers.formatEther(event.args.amount),
      txHash: event.transactionHash
    });
  }
  
  // Process released events
  for (const event of releasedEvents) {
    const block = await event.getBlock();
    history.paymentsReleased.push({
      blockNumber: event.blockNumber,
      timestamp: block.timestamp,
      to: event.args.to,
      amount: event.args.amount.toString(),
      amountETH: hre.ethers.formatEther(event.args.amount),
      txHash: event.transactionHash
    });
  }
  
  // Calculate summary
  const totalReceived = receivedEvents.reduce(
    (sum, e) => sum + e.args.amount,
    0n
  );
  const totalReleased = releasedEvents.reduce(
    (sum, e) => sum + e.args.amount,
    0n
  );
  
  history.summary = {
    totalPaymentsReceived: receivedEvents.length,
    totalPaymentsReleased: releasedEvents.length,
    totalAmountReceived: totalReceived.toString(),
    totalAmountReceivedETH: hre.ethers.formatEther(totalReceived),
    totalAmountReleased: totalReleased.toString(),
    totalAmountReleasedETH: hre.ethers.formatEther(totalReleased)
  };
  
  // Save to file
  const filename = `payment-history-${contractAddress}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(history, null, 2));
  
  console.log(`\n✅ Export complete: ${filename}`);
  console.log(`\nSummary:`);
  console.log(`  Payments Received: ${history.summary.totalPaymentsReceived}`);
  console.log(`  Payments Released: ${history.summary.totalPaymentsReleased}`);
  console.log(`  Total Received: ${history.summary.totalAmountReceivedETH} ETH`);
  console.log(`  Total Released: ${history.summary.totalAmountReleasedETH} ETH`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Usage**:
```bash
# Export full history
CONTRACT_ADDRESS=0xOLD_CONTRACT npx hardhat run scripts/exportHistory.js --network base

# Export specific block range
FROM_BLOCK=1000000 TO_BLOCK=2000000 CONTRACT_ADDRESS=0xOLD_CONTRACT \
  npx hardhat run scripts/exportHistory.js --network base
```

---

### Maintaining Audit Trail

#### Create Migration Record

```json
{
  "migrationId": "migration-2026-02-15",
  "timestamp": "2026-02-15T00:00:00Z",
  "reason": "Adding new team member",
  "contracts": {
    "old": {
      "address": "0xOLD_CONTRACT_ADDRESS",
      "network": "base",
      "deployedAt": "2026-01-20T12:00:00Z",
      "finalBalance": "0.0",
      "totalReceived": "10.5 ETH",
      "totalReleased": "10.5 ETH",
      "payees": [
        {"address": "0xPayee1", "shares": 50, "totalReleased": "5.25 ETH"},
        {"address": "0xPayee2", "shares": 50, "totalReleased": "5.25 ETH"}
      ]
    },
    "new": {
      "address": "0xNEW_CONTRACT_ADDRESS",
      "network": "base",
      "deployedAt": "2026-02-15T00:00:00Z",
      "payees": [
        {"address": "0xPayee1", "shares": 30},
        {"address": "0xPayee2", "shares": 30},
        {"address": "0xPayee3", "shares": 40}
      ]
    }
  },
  "verification": {
    "testnetDeployment": "0xTESTNET_ADDRESS",
    "testsDuration": "2 days",
    "auditPerformed": true,
    "approvers": ["deployer@example.com", "admin@example.com"]
  },
  "artifacts": {
    "historyExport": "payment-history-OLD_CONTRACT-1738972800.json",
    "deploymentTx": "0xDEPLOYMENT_TX_HASH",
    "verificationTx": "0xVERIFICATION_TX_HASH"
  }
}
```

Save this to `migrations/migration-2026-02-15.json`

---

### Off-Chain Record Keeping

#### Database Schema Example

```sql
-- Migration tracking table
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  migration_date TIMESTAMP NOT NULL,
  old_contract_address VARCHAR(42) NOT NULL,
  new_contract_address VARCHAR(42) NOT NULL,
  network VARCHAR(20) NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL, -- 'planned', 'in-progress', 'completed', 'rolled-back'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payment history table (off-chain mirror)
CREATE TABLE payment_history (
  id SERIAL PRIMARY KEY,
  contract_address VARCHAR(42) NOT NULL,
  event_type VARCHAR(20) NOT NULL, -- 'received' or 'released'
  from_address VARCHAR(42),
  to_address VARCHAR(42),
  amount NUMERIC(78, 0) NOT NULL, -- Wei
  amount_eth DECIMAL(18, 8),
  block_number BIGINT NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(transaction_hash, event_type, to_address)
);

-- Contract configurations
CREATE TABLE contract_configs (
  id SERIAL PRIMARY KEY,
  contract_address VARCHAR(42) NOT NULL UNIQUE,
  network VARCHAR(20) NOT NULL,
  payees JSONB NOT NULL,
  deployed_at TIMESTAMP NOT NULL,
  deprecated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Sync Script

```javascript
// scripts/syncToDatabase.js
const hre = require("hardhat");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const fromBlock = parseInt(process.env.FROM_BLOCK || "0");
  
  const SplitStream = await hre.ethers.getContractFactory("SplitStream");
  const contract = SplitStream.attach(contractAddress);
  
  // Sync PaymentReceived events
  const receivedFilter = contract.filters.PaymentReceived();
  const receivedEvents = await contract.queryFilter(receivedFilter, fromBlock);
  
  for (const event of receivedEvents) {
    const block = await event.getBlock();
    
    await pool.query(`
      INSERT INTO payment_history 
      (contract_address, event_type, from_address, amount, amount_eth, 
       block_number, transaction_hash, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8))
      ON CONFLICT (transaction_hash, event_type, to_address) DO NOTHING
    `, [
      contractAddress,
      'received',
      event.args.from,
      event.args.amount.toString(),
      parseFloat(hre.ethers.formatEther(event.args.amount)),
      event.blockNumber,
      event.transactionHash,
      block.timestamp
    ]);
  }
  
  // Sync PaymentReleased events
  const releasedFilter = contract.filters.PaymentReleased();
  const releasedEvents = await contract.queryFilter(releasedFilter, fromBlock);
  
  for (const event of releasedEvents) {
    const block = await event.getBlock();
    
    await pool.query(`
      INSERT INTO payment_history 
      (contract_address, event_type, to_address, amount, amount_eth, 
       block_number, transaction_hash, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8))
      ON CONFLICT (transaction_hash, event_type, to_address) DO NOTHING
    `, [
      contractAddress,
      'released',
      event.args.to,
      event.args.amount.toString(),
      parseFloat(hre.ethers.formatEther(event.args.amount)),
      event.blockNumber,
      event.transactionHash,
      block.timestamp
    ]);
  }
  
  console.log(`✅ Synced ${receivedEvents.length + releasedEvents.length} events to database`);
  
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

## Rollback Procedures

### Understanding Rollback Limitations

> [!WARNING]
> SplitStream contracts are **immutable**. Once deployed, the code cannot be changed. "Rollback" means reverting to a previous contract address and configuration.

#### When Rollback is Possible

✅ **Possible Scenarios**:
- New contract has a bug discovered before significant funds deposited
- Configuration error in new contract deployment
- Failed migration testing
- Stakeholder disagreement on new terms

❌ **Not Possible**:
- Cannot undo transactions on deployed contract
- Cannot recover from true smart contract vulnerability (must migrate forward)
- Cannot reverse time-based events

---

### Rollback Process

#### Step 1: Assess Situation

```bash
# Check new contract status
NEW_CONTRACT_ADDRESS=0xNEW npx hardhat run scripts/checkBalance.js --network base

# Verify old contract still accessible
OLD_CONTRACT_ADDRESS=0xOLD npx hardhat run scripts/checkBalance.js --network base
```

**Questions to answer**:
- How much value is in new contract?
- Can funds be safely extracted?
- Is old contract still functional?
- What integrations have switched?

---

#### Step 2: Extract Funds from New Contract

```javascript
// scripts/rollback.js
const hre = require("hardhat");

async function main() {
  const newAddress = process.env.NEW_CONTRACT_ADDRESS;
  const oldAddress = process.env.OLD_CONTRACT_ADDRESS;
  
  console.log("⚠️  ROLLBACK INITIATED");
  console.log(`Rolling back from ${newAddress} to ${oldAddress}`);
  
  const SplitStream = await hre.ethers.getContractFactory("SplitStream");
  const newContract = SplitStream.attach(newAddress);
  
  // Release all funds from new contract
  const payeeCount = await newContract.payeeCount();
  
  for (let i = 0; i < payeeCount; i++) {
    const payeeAddress = await newContract.payee(i);
    const releasable = await newContract.releasable(payeeAddress);
    
    if (releasable > 0) {
      console.log(`Releasing ${hre.ethers.formatEther(releasable)} ETH to ${payeeAddress}...`);
      const tx = await newContract.release(payeeAddress);
      await tx.wait();
      console.log(`✓ Released: ${tx.hash}`);
    }
  }
  
  const remainingBalance = await hre.ethers.provider.getBalance(newAddress);
  console.log(`\nRemaining balance in new contract: ${hre.ethers.formatEther(remainingBalance)} ETH`);
  
  console.log(`\n✅ Rollback extraction complete`);
  console.log(`\nNext steps:`);
  console.log(`1. Update all integrations to use: ${oldAddress}`);
  console.log(`2. Notify all stakeholders of rollback`);
  console.log(`3. Document reason for rollback`);
  console.log(`4. Plan corrective action for next migration`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Execute**:
```bash
NEW_CONTRACT_ADDRESS=0xNEW OLD_CONTRACT_ADDRESS=0xOLD \
  npx hardhat run scripts/rollback.js --network base
```

---

#### Step 3: Revert Integrations

```javascript
// Update config files
// config/contracts.js (revert changes)
module.exports = {
  SPLITSTREAM_ADDRESS: "0xOLD_CONTRACT_ADDRESS", // Reverted
  FAILED_MIGRATION: {
    address: "0xNEW_CONTRACT_ADDRESS",
    failureDate: "2026-02-16",
    reason: "Configuration error - incorrect share distribution"
  },
  NETWORK: "base"
};
```

---

#### Step 4: Document Rollback

```json
{
  "rollbackId": "rollback-2026-02-16",
  "timestamp": "2026-02-16T12:00:00Z",
  "originalMigration": "migration-2026-02-15",
  "reason": "Configuration error: shares summed to 110 instead of 100",
  "impactAnalysis": {
    "fundsInNewContract": "0.5 ETH",
    "fundsExtracted": "0.5 ETH",
    "affectedPayees": 3,
    "downtime": "2 hours"
  },
  "actions": {
    "fundsReleased": true,
    "integrationsReverted": true,
    "stakeholdersNotified": true,
    "postMortemScheduled": true
  },
  "preventiveMeasures": [
    "Add share validation to deployment script",
    "Extend testnet validation period to 48h",
    "Require multi-sig approval for migrations"
  ]
}
```

---

### Emergency Recovery Options

#### Scenario: Critical Bug in New Contract

```bash
# IMMEDIATE ACTIONS (execute in order)
# 1. Pause new payment sources
echo "🚨 EMERGENCY: Stop sending payments to $NEW_CONTRACT_ADDRESS"

# 2. Extract all funds
npx hardhat run scripts/emergencyExtract.js --network base

# 3. Deploy fixed version
npx hardhat run scripts/deploy.js --network base

# 4. Communicate to all stakeholders
node scripts/notifyEmergency.js
```

```javascript
// scripts/emergencyExtract.js
const hre = require("hardhat");

async function main() {
  console.log("🚨 EMERGENCY EXTRACTION");
  
  const contractAddress = process.env.EMERGENCY_CONTRACT_ADDRESS;
  const SplitStream = await hre.ethers.getContractFactory("SplitStream");
  const contract = SplitStream.attach(contractAddress);
  
  // Get all funds out ASAP
  const payeeCount = await contract.payeeCount();
  const results = [];
  
  for (let i = 0; i < payeeCount; i++) {
    const payee = await contract.payee(i);
    const releasable = await contract.releasable(payee);
    
    if (releasable > 0) {
      try {
        const tx = await contract.release(payee, {
          gasLimit: 500000 // Force high gas to ensure execution
        });
        await tx.wait();
        results.push({ payee, amount: releasable, status: "success", tx: tx.hash });
      } catch (error) {
        results.push({ payee, amount: releasable, status: "failed", error: error.message });
      }
    }
  }
  
  console.log("\nExtraction results:");
  console.table(results);
  
  const failed = results.filter(r => r.status === "failed");
  if (failed.length > 0) {
    console.error("\n⚠️  FAILURES DETECTED - Manual intervention required");
    console.error(JSON.stringify(failed, null, 2));
  } else {
    console.log("\n✅ All funds extracted successfully");
  }
}

main().catch((error) => {
  console.error("CRITICAL ERROR:", error);
  process.exitCode = 1;
});
```

---

### Fund Safety Guarantees

#### Multi-Signature Safeguard (Optional Enhancement)

For high-value deployments, consider deploying via multi-sig:

```javascript
// Deploy via Gnosis Safe or similar
// This allows migration rollback with consensus

// Example: Gnosis Safe deployment
const safe = await hre.ethers.getContractAt("GnosisSafe", SAFE_ADDRESS);

// Create migration transaction
const deployData = SplitStream.getDeployTransaction(payees, shares).data;

// Requires 2/3 signatures to execute
await safe.execTransaction(
  FACTORY_ADDRESS,
  0,
  deployData,
  SafeOperation.DelegateCall,
  0, 0, 0,
  ethers.ZeroAddress,
  ethers.ZeroAddress,
  signatures
);
```

---

## Testing Migration

### Testnet Rehearsal Steps

#### Complete Migration Rehearsal Checklist

```bash
# 1. Deploy old contract to testnet
echo "Deploying v1.0 to Base Sepolia..."
npx hardhat run scripts/deployV1.js --network base-sepolia
# Save address: OLD_TESTNET_ADDRESS

# 2. Send test payments
cast send $OLD_TESTNET_ADDRESS --value 1ether --rpc-url $BASE_SEPOLIA_RPC

# 3. Verify distribution
npx hardhat run scripts/checkBalance.js --network base-sepolia

# 4. Practice migration
npx hardhat run scripts/migrate.js --network base-sepolia
# Save new address: NEW_TESTNET_ADDRESS

# 5. Verify new contract
npx hardhat run scripts/verifyMigration.js --network base-sepolia

# 6. Test rollback scenario
npx hardhat run scripts/rollback.js --network base-sepolia

# 7. Document results
echo "✅ Migration rehearsal complete. Results:" > testnet-migration-report.txt
```

---

### Validation Checklist

#### Pre-Migration Validation

- [ ] Old contract balance verified
- [ ] All payee addresses confirmed accessible
- [ ] Pending payments calculated correctly
- [ ] New contract configuration reviewed
- [ ] Gas costs estimated
- [ ] Testnet migration successful
- [ ] All stakeholders notified
- [ ] Rollback plan documented

#### Post-Migration Validation

- [ ] Old contract balance zero or acceptable
- [ ] New contract deployed and verified
- [ ] All payees present in new contract
- [ ] Share distribution correct
- [ ] Test payment sent and distributed correctly
- [ ] Monitoring active
- [ ] Documentation updated
- [ ] Integrations updated

---

### Common Pitfalls

#### Pitfall 1: Forgetting to Release Pending Payments

**Problem**: Migrating without releasing pending payments loses funds.

**Solution**:
```javascript
// Always check and release before migrating
const pending = await contract.releasable(payeeAddress);
if (pending > 0) {
  console.warn(`⚠️  ${payeeAddress} has ${hre.ethers.formatEther(pending)} ETH pending!`);
  // Don't proceed without releasing
}
```

#### Pitfall 2: Incorrect Share Calculation

**Problem**: New shares don't sum to same total as old shares.

**Solution**:
```javascript
// Validate total shares
const totalShares = shares.reduce((a, b) => a + b, 0);
if (totalShares !== 100) { // Or expected total
  throw new Error(`Shares must sum to 100, got ${totalShares}`);
}
```

#### Pitfall 3: Not Testing on Testnet

**Problem**: Bugs discovered on mainnet cost real money.

**Solution**: ALWAYS migrate on testnet first, wait 24-48h, then mainnet.

#### Pitfall 4: Losing Access to Old Contract

**Problem**: Private keys lost, can't release final payments.

**Solution**:
```bash
# Verify key access before migration
cast wallet address --private-key $PRIVATE_KEY

# Test signing a transaction
cast send $OLD_CONTRACT_ADDRESS "totalShares()" --private-key $PRIVATE_KEY --rpc-url $RPC
```

#### Pitfall 5: Gas Price Spikes During Migration

**Problem**: Migration times out or costs too much due to high gas.

**Solution**:
```javascript
// Monitor gas and wait for optimal time
const gasPrice = await hre.ethers.provider.getFeeData();
console.log(`Current base fee: ${hre.ethers.formatUnits(gasPrice.maxFeePerGas, "gwei")} gwei`);

if (gasPrice.maxFeePerGas > hre.ethers.parseUnits("50", "gwei")) {
  console.warn("⚠️  Gas too high, waiting...");
  // Delay migration
}
```

---

## Emergency Procedures

### Emergency Contact Protocol

```json
{
  "emergencyContacts": [
    {
      "role": "Primary Admin",
      "contact": "admin@example.com",
      "phone": "+1-XXX-XXX-XXXX",
      "availability": "24/7"
    },
    {
      "role": "Smart Contract Developer",
      "contact": "dev@example.com",
      "availability": "Business hours"
    },
    {
      "role": "Security Auditor",
      "contact": "security@audit-firm.com",
      "availability": "On-call"
    }
  ],
  "escalationPath": [
    "1. Detect issue",
    "2. Notify Primary Admin immediately",
    "3. If unavailable, contact Developer",
    "4. If critical vulnerability, contact Security Auditor",
    "5. Execute emergency procedures"
  ]
}
```

### Emergency Shutdown Procedure

> [!CAUTION]
> SplitStream has no pause functionality. Emergency response involves fund extraction only.

```bash
# Emergency response script
#!/bin/bash

# emergency-response.sh

echo "🚨 EMERGENCY RESPONSE ACTIVATED"
echo "Contract: $EMERGENCY_CONTRACT_ADDRESS"
echo "Reason: $EMERGENCY_REASON"

# 1. Document the emergency
cat > emergency-$(date +%s).json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contract": "$EMERGENCY_CONTRACT_ADDRESS",
  "reason": "$EMERGENCY_REASON",
  "respondent": "$(git config user.email)"
}
EOF

# 2. Extract all funds
EMERGENCY_CONTRACT_ADDRESS=$EMERGENCY_CONTRACT_ADDRESS \
  npx hardhat run scripts/emergencyExtract.js --network base

# 3. Notify all stakeholders
node scripts/sendEmergencyNotification.js

# 4. Post public notice
echo "🚨 NOTICE: Emergency migration in progress. Stand by for updates." \
  | npx hardhat run scripts/postToSocial.js

echo "✅ Emergency procedures complete"
echo "Next: Deploy fixed contract and resume operations"
```

---

## Summary

### Quick Reference

| Scenario | Action | RiskLevel |
|----------|--------|-----------|
| Add payee | Deploy new contract with updated payees | 🟡 Medium |
| Remove payee | Release final payment, deploy new contract | 🟡 Medium |
| Change shares | Release all pending, deploy with new shares | 🟡 Medium |
| Bug fix | Emergency extract, deploy fixed version | 🔴 High |
| Version upgrade | Standard migration process | 🟢 Low |
| Network change | Export config, deploy to new network | 🟡 Medium |

### Best Practices

1. **Always test on testnet first** - No exceptions
2. **Release pending payments before migration** - Don't lock funds
3. **Document everything** - Future you will thank you
4. **Verify smart contract code** - Never deploy unverified contracts
5. **Communicate with stakeholders** - Surprises are bad
6. **Have a rollback plan** - Hope for best, plan for worst
7. **Monitor after migration** - Watch for unexpected behavior
8. **Keep historical data** - Export before deprecating old contracts

---

## Additional Resources

- [SplitStream Documentation](../README.md)
- [Security Audit Report](./SECURITY_AUDIT.md)
- [Deployment Guide](../README.md#deployment)
- [Base Network Status](https://status.base.org/)
- [Basescan Contract Verification](https://basescan.org/)

---

**Last Updated**: 2026-01-23  
**Version**: 1.0.0  
**Maintainer**: SplitStream Protocol Team
