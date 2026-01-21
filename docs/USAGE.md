# SplitStream Usage Guide

Practical examples and usage patterns for the SplitStream payment splitter contract.

## Table of Contents

- [Basic Usage Scenarios](#basic-usage-scenarios)
- [Complete Workflow Examples](#complete-workflow-examples)
- [Code Examples](#code-examples)
- [Frontend Integration](#frontend-integration)
- [Backend Integration](#backend-integration)
- [Multi-Contract Scenarios](#multi-contract-scenarios)
- [Best Practices](#best-practices)
- [Common Mistakes](#common-mistakes)
- [FAQ](#faq)

---

## Basic Usage Scenarios

### 1. Team Payroll Splitting

**Scenario**: A startup with 3 co-founders wants to split revenue automatically.

**Setup**:
- Founder A: 50% (technical lead)
- Founder B: 30% (business lead)
- Founder C: 20% (advisor)

**Benefits**:
- Automatic distribution
- Transparent allocation
- No manual calculations
- Each founder withdraws when needed

### 2. Creator Revenue Sharing

**Scenario**: Content creators collaborating on a project.

**Setup**:
- Creator 1: 40% (main creator)
- Creator 2: 35% (co-creator)
- Platform: 25% (hosting/distribution)

**Benefits**:
- Fair revenue split
- No intermediary needed
- Real-time settlement
- Transparent earnings

### 3. DAO Treasury Distribution

**Scenario**: DAO distributing funds to working groups.

**Setup**:
- Development Team: 50%
- Marketing Team: 30%
- Operations Team: 20%

**Benefits**:
- Trustless distribution
- Immutable allocation
- Transparent treasury management
- Reduced governance overhead

### 4. Freelancer Payment Splits

**Scenario**: Freelancers working together on a project.

**Setup**:
- Designer: 40%
- Developer: 40%
- Project Manager: 20%

**Benefits**:
- Client pays once to contract
- Automatic split among team
- No payment disputes
- Each member withdraws independently

---

## Complete Workflow Examples

### Example 1: Team Payroll Workflow

```javascript
const { ethers } = require("ethers");

// Step 1: Deploy the splitter
async function deployTeamSplitter() {
  const [deployer] = await ethers.getSigners();
  
  const teamMembers = [
    "0xFounderA...",
    "0xFounderB...",
    "0xFounderC..."
  ];
  
  const shares = [50, 30, 20];
  
  const SplitStream = await ethers.getContractFactory("SplitStream");
  const splitter = await SplitStream.deploy(teamMembers, shares);
  await splitter.waitForDeployment();
  
  console.log("Team splitter deployed:", await splitter.getAddress());
  return splitter;
}

// Step 2: Receive revenue
async function receiveRevenue(splitterAddress, amount) {
  const [sender] = await ethers.getSigners();
  
  const tx = await sender.sendTransaction({
    to: splitterAddress,
    value: ethers.parseEther(amount)
  });
  
  await tx.wait();
  console.log(`Received ${amount} ETH revenue`);
}

// Step 3: Team members withdraw
async function withdrawPayment(splitterAddress, memberSigner) {
  const splitter = await ethers.getContractAt("SplitStream", splitterAddress);
  
  // Check pending amount
  const pending = await calculatePending(splitter, memberSigner.address);
  console.log(`Pending: ${ethers.formatEther(pending)} ETH`);
  
  if (pending > 0) {
    const tx = await splitter.connect(memberSigner).release(memberSigner.address);
    await tx.wait();
    console.log("Payment withdrawn successfully");
  }
}

// Helper: Calculate pending payment
async function calculatePending(splitter, address) {
  const balance = await ethers.provider.getBalance(await splitter.getAddress());
  const totalReleased = await splitter.totalReleased();
  const totalReceived = balance + totalReleased;
  
  const shares = await splitter.shares(address);
  const totalShares = await splitter.totalShares();
  const released = await splitter.released(address);
  
  const entitled = (totalReceived * shares) / totalShares;
  return entitled - released;
}

// Complete workflow
async function runTeamPayrollWorkflow() {
  // Deploy
  const splitter = await deployTeamSplitter();
  const splitterAddress = await splitter.getAddress();
  
  // Receive monthly revenue
  await receiveRevenue(splitterAddress, "10.0");
  
  // Each founder withdraws their share
  const [_, founderA, founderB, founderC] = await ethers.getSigners();
  await withdrawPayment(splitterAddress, founderA); // Gets 5 ETH
  await withdrawPayment(splitterAddress, founderB); // Gets 3 ETH
  await withdrawPayment(splitterAddress, founderC); // Gets 2 ETH
}
```

### Example 2: Creator Revenue Sharing

```javascript
// Creator platform integration
class CreatorRevenueManager {
  constructor(splitterAddress, provider) {
    this.splitter = new ethers.Contract(
      splitterAddress,
      SplitStreamABI,
      provider
    );
  }
  
  // Track revenue from multiple sources
  async trackRevenue(source, amount) {
    const tx = await source.sendTransaction({
      to: await this.splitter.getAddress(),
      value: amount
    });
    
    await tx.wait();
    
    return {
      source: source.address,
      amount: ethers.formatEther(amount),
      timestamp: Date.now()
    };
  }
  
  // Get creator dashboard data
  async getCreatorDashboard(creatorAddress) {
    const shares = await this.splitter.shares(creatorAddress);
    const totalShares = await this.splitter.totalShares();
    const released = await this.splitter.released(creatorAddress);
    const pending = await this.calculatePending(creatorAddress);
    
    const balance = await ethers.provider.getBalance(
      await this.splitter.getAddress()
    );
    const totalReleased = await this.splitter.totalReleased();
    
    return {
      creator: creatorAddress,
      sharePercentage: (Number(shares) * 100 / Number(totalShares)).toFixed(2),
      totalEarned: ethers.formatEther(released + pending),
      withdrawn: ethers.formatEther(released),
      pending: ethers.formatEther(pending),
      contractBalance: ethers.formatEther(balance),
      totalRevenue: ethers.formatEther(balance + totalReleased)
    };
  }
  
  // Auto-withdraw when threshold reached
  async autoWithdraw(creatorSigner, thresholdETH) {
    const pending = await this.calculatePending(creatorSigner.address);
    const threshold = ethers.parseEther(thresholdETH);
    
    if (pending >= threshold) {
      const tx = await this.splitter.connect(creatorSigner).release(
        creatorSigner.address
      );
      await tx.wait();
      return ethers.formatEther(pending);
    }
    
    return null;
  }
  
  async calculatePending(address) {
    const balance = await ethers.provider.getBalance(
      await this.splitter.getAddress()
    );
    const totalReleased = await this.splitter.totalReleased();
    const totalReceived = balance + totalReleased;
    
    const shares = await this.splitter.shares(address);
    const totalShares = await this.splitter.totalShares();
    const released = await this.splitter.released(address);
    
    const entitled = (totalReceived * shares) / totalShares;
    return entitled - released;
  }
}

// Usage
const manager = new CreatorRevenueManager(splitterAddress, provider);

// Track revenue
await manager.trackRevenue(sponsor, ethers.parseEther("5.0"));

// Get dashboard
const dashboard = await manager.getCreatorDashboard(creatorAddress);
console.log(dashboard);

// Auto-withdraw if > 1 ETH pending
const withdrawn = await manager.autoWithdraw(creatorSigner, "1.0");
if (withdrawn) {
  console.log(`Auto-withdrew ${withdrawn} ETH`);
}
```

---

## Code Examples

### Connecting to Deployed Contract

```javascript
const { ethers } = require("ethers");

// Using ethers.js v6
async function connectToSplitter(contractAddress) {
  // Option 1: With Hardhat
  const splitter = await ethers.getContractAt("SplitStream", contractAddress);
  
  // Option 2: With provider and ABI
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const splitter = new ethers.Contract(contractAddress, SplitStreamABI, provider);
  
  // Option 3: With signer (for transactions)
  const signer = await provider.getSigner();
  const splitter = new ethers.Contract(contractAddress, SplitStreamABI, signer);
  
  return splitter;
}
```

### Checking Balance and Shares

```javascript
async function checkPayeeInfo(splitter, payeeAddress) {
  // Get share allocation
  const shares = await splitter.shares(payeeAddress);
  const totalShares = await splitter.totalShares();
  const percentage = (Number(shares) * 100 / Number(totalShares)).toFixed(2);
  
  // Get released amount
  const released = await splitter.released(payeeAddress);
  
  // Get contract balance
  const contractBalance = await ethers.provider.getBalance(
    await splitter.getAddress()
  );
  
  // Calculate pending
  const totalReleased = await splitter.totalReleased();
  const totalReceived = contractBalance + totalReleased;
  const entitled = (totalReceived * shares) / totalShares;
  const pending = entitled - released;
  
  return {
    address: payeeAddress,
    shares: shares.toString(),
    percentage: `${percentage}%`,
    released: ethers.formatEther(released),
    pending: ethers.formatEther(pending),
    total: ethers.formatEther(entitled),
    contractBalance: ethers.formatEther(contractBalance)
  };
}

// Usage
const info = await checkPayeeInfo(splitter, "0xPayeeAddress");
console.table(info);
```

### Releasing Payments

```javascript
// Release to self
async function releaseToSelf(splitter, signer) {
  const tx = await splitter.connect(signer).release(signer.address);
  const receipt = await tx.wait();
  
  // Find PaymentReleased event
  const event = receipt.logs.find(
    log => log.topics[0] === splitter.interface.getEvent("PaymentReleased").topicHash
  );
  
  if (event) {
    const decoded = splitter.interface.parseLog(event);
    return {
      to: decoded.args.to,
      amount: ethers.formatEther(decoded.args.amount),
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString()
    };
  }
}

// Release to another payee (anyone can call)
async function releaseToPayee(splitter, payeeAddress, signer) {
  const tx = await splitter.connect(signer).release(payeeAddress);
  await tx.wait();
  console.log(`Released payment to ${payeeAddress}`);
}

// Batch release to all payees
async function releaseToAll(splitter, signer) {
  const payees = await getAllPayees(splitter);
  const results = [];
  
  for (const payee of payees) {
    try {
      const result = await releaseToPayee(splitter, payee, signer);
      results.push({ payee, success: true, result });
    } catch (error) {
      results.push({ payee, success: false, error: error.message });
    }
  }
  
  return results;
}
```

### Monitoring Events

```javascript
// Real-time event monitoring
async function monitorSplitter(splitter) {
  console.log("Monitoring SplitStream events...");
  
  // Listen for payments received
  splitter.on("PaymentReceived", (from, amount, event) => {
    console.log(`💰 Received ${ethers.formatEther(amount)} ETH from ${from}`);
    console.log(`   TX: ${event.log.transactionHash}`);
  });
  
  // Listen for payments released
  splitter.on("PaymentReleased", (to, amount, event) => {
    console.log(`📤 Released ${ethers.formatEther(amount)} ETH to ${to}`);
    console.log(`   TX: ${event.log.transactionHash}`);
  });
}

// Query historical events
async function getPaymentHistory(splitter, fromBlock = 0) {
  const receivedFilter = splitter.filters.PaymentReceived();
  const releasedFilter = splitter.filters.PaymentReleased();
  
  const received = await splitter.queryFilter(receivedFilter, fromBlock);
  const released = await splitter.queryFilter(releasedFilter, fromBlock);
  
  return {
    received: received.map(e => ({
      from: e.args.from,
      amount: ethers.formatEther(e.args.amount),
      block: e.blockNumber,
      tx: e.transactionHash
    })),
    released: released.map(e => ({
      to: e.args.to,
      amount: ethers.formatEther(e.args.amount),
      block: e.blockNumber,
      tx: e.transactionHash
    }))
  };
}
```

---

## Frontend Integration

### React Component Example

```jsx
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function SplitStreamDashboard({ contractAddress }) {
  const [payeeInfo, setPayeeInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadPayeeInfo();
  }, [contractAddress]);
  
  async function loadPayeeInfo() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    const splitter = new ethers.Contract(
      contractAddress,
      SplitStreamABI,
      provider
    );
    
    const shares = await splitter.shares(address);
    const totalShares = await splitter.totalShares();
    const released = await splitter.released(address);
    
    const balance = await provider.getBalance(contractAddress);
    const totalReleased = await splitter.totalReleased();
    const totalReceived = balance + totalReleased;
    
    const entitled = (totalReceived * shares) / totalShares;
    const pending = entitled - released;
    
    setPayeeInfo({
      address,
      shares: shares.toString(),
      percentage: (Number(shares) * 100 / Number(totalShares)).toFixed(2),
      released: ethers.formatEther(released),
      pending: ethers.formatEther(pending),
      canWithdraw: pending > 0
    });
  }
  
  async function handleWithdraw() {
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      const splitter = new ethers.Contract(
        contractAddress,
        SplitStreamABI,
        signer
      );
      
      const tx = await splitter.release(address);
      await tx.wait();
      
      alert('Payment withdrawn successfully!');
      await loadPayeeInfo();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }
  
  if (!payeeInfo) return <div>Loading...</div>;
  
  return (
    <div className="dashboard">
      <h2>Your SplitStream Dashboard</h2>
      
      <div className="stats">
        <div className="stat">
          <label>Your Share</label>
          <value>{payeeInfo.percentage}%</value>
        </div>
        
        <div className="stat">
          <label>Total Withdrawn</label>
          <value>{payeeInfo.released} ETH</value>
        </div>
        
        <div className="stat">
          <label>Pending</label>
          <value>{payeeInfo.pending} ETH</value>
        </div>
      </div>
      
      <button
        onClick={handleWithdraw}
        disabled={!payeeInfo.canWithdraw || loading}
      >
        {loading ? 'Processing...' : 'Withdraw Payment'}
      </button>
    </div>
  );
}
```

---

## Backend Integration

### Node.js Automated Release Script

```javascript
const { ethers } = require('ethers');
const cron = require('node-cron');

class AutoReleaseService {
  constructor(splitterAddress, privateKey, rpcUrl) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.splitter = new ethers.Contract(
      splitterAddress,
      SplitStreamABI,
      this.wallet
    );
  }
  
  async releaseIfThresholdMet(payeeAddress, thresholdETH) {
    const pending = await this.calculatePending(payeeAddress);
    const threshold = ethers.parseEther(thresholdETH);
    
    if (pending >= threshold) {
      console.log(`Releasing ${ethers.formatEther(pending)} ETH to ${payeeAddress}`);
      const tx = await this.splitter.release(payeeAddress);
      await tx.wait();
      return true;
    }
    
    return false;
  }
  
  async calculatePending(address) {
    const balance = await this.provider.getBalance(
      await this.splitter.getAddress()
    );
    const totalReleased = await this.splitter.totalReleased();
    const totalReceived = balance + totalReleased;
    
    const shares = await this.splitter.shares(address);
    const totalShares = await this.splitter.totalShares();
    const released = await this.splitter.released(address);
    
    const entitled = (totalReceived * shares) / totalShares;
    return entitled - released;
  }
  
  async getAllPayees() {
    const payees = [];
    let index = 0;
    
    try {
      while (true) {
        payees.push(await this.splitter.payee(index++));
      }
    } catch {
      // End of array
    }
    
    return payees;
  }
  
  async runAutoRelease(thresholdETH) {
    console.log('Running auto-release check...');
    const payees = await this.getAllPayees();
    
    for (const payee of payees) {
      const released = await this.releaseIfThresholdMet(payee, thresholdETH);
      if (released) {
        console.log(`✅ Released payment to ${payee}`);
      }
    }
  }
  
  startScheduledRelease(cronSchedule, thresholdETH) {
    console.log(`Starting scheduled release: ${cronSchedule}`);
    
    cron.schedule(cronSchedule, async () => {
      await this.runAutoRelease(thresholdETH);
    });
  }
}

// Usage
const service = new AutoReleaseService(
  process.env.SPLITTER_ADDRESS,
  process.env.PRIVATE_KEY,
  process.env.BASE_RPC_URL
);

// Run daily at midnight, release if > 1 ETH pending
service.startScheduledRelease('0 0 * * *', '1.0');
```

---

## Multi-Contract Scenarios

### Managing Multiple Splitters

```javascript
class MultiSplitterManager {
  constructor(provider) {
    this.provider = provider;
    this.splitters = new Map();
  }
  
  addSplitter(name, address) {
    const splitter = new ethers.Contract(address, SplitStreamABI, this.provider);
    this.splitters.set(name, { address, contract: splitter });
  }
  
  async getOverview() {
    const overview = [];
    
    for (const [name, { address, contract }] of this.splitters) {
      const balance = await this.provider.getBalance(address);
      const totalReleased = await contract.totalReleased();
      const totalShares = await contract.totalShares();
      
      overview.push({
        name,
        address,
        balance: ethers.formatEther(balance),
        totalReleased: ethers.formatEther(totalReleased),
        totalShares: totalShares.toString()
      });
    }
    
    return overview;
  }
  
  async releaseFromAll(payeeAddress, signer) {
    const results = [];
    
    for (const [name, { contract }] of this.splitters) {
      try {
        const tx = await contract.connect(signer).release(payeeAddress);
        await tx.wait();
        results.push({ name, success: true });
      } catch (error) {
        results.push({ name, success: false, error: error.message });
      }
    }
    
    return results;
  }
}

// Usage
const manager = new MultiSplitterManager(provider);
manager.addSplitter('Team Payroll', '0x123...');
manager.addSplitter('Creator Revenue', '0x456...');
manager.addSplitter('DAO Treasury', '0x789...');

const overview = await manager.getOverview();
console.table(overview);

await manager.releaseFromAll(myAddress, signer);
```

---

## Best Practices

### For Payees

1. **Check Pending Before Withdrawing**
   ```javascript
   const pending = await calculatePending(splitter, myAddress);
   if (pending > ethers.parseEther("0.01")) {
     await splitter.release(myAddress);
   }
   ```

2. **Monitor Events for Incoming Payments**
   ```javascript
   splitter.on("PaymentReceived", () => {
     console.log("New payment received!");
   });
   ```

3. **Batch Withdrawals to Save Gas**
   - Wait until pending amount is significant
   - Withdraw during low gas periods

4. **Keep Records**
   - Track all withdrawal transactions
   - Monitor total earnings

### For Contract Deployers

1. **Verify Addresses Before Deployment**
2. **Document Share Distribution**
3. **Test with Small Amounts First**
4. **Verify Contract on Basescan**
5. **Share Contract Address with All Payees**

---

## Common Mistakes

### ❌ Mistake 1: Not Checking Pending Amount

```javascript
// Bad: Will revert if no payment due
await splitter.release(myAddress);

// Good: Check first
const pending = await calculatePending(splitter, myAddress);
if (pending > 0) {
  await splitter.release(myAddress);
}
```

### ❌ Mistake 2: Wrong Address Format

```javascript
// Bad: Using checksummed address inconsistently
const address = "0xabc..."; // lowercase

// Good: Use ethers.getAddress()
const address = ethers.getAddress("0xabc...");
```

### ❌ Mistake 3: Not Handling Errors

```javascript
// Bad: No error handling
await splitter.release(myAddress);

// Good: Proper error handling
try {
  await splitter.release(myAddress);
} catch (error) {
  if (error.message.includes("not due payment")) {
    console.log("No payment available yet");
  } else {
    console.error("Unexpected error:", error);
  }
}
```

---

## FAQ

### Q: How often should I withdraw?

**A**: Withdraw when the pending amount justifies the gas cost. For example, if gas costs $1, wait until you have at least $10-20 pending.

### Q: Can I withdraw on behalf of another payee?

**A**: Yes! Anyone can call `release()` for any payee. The payment always goes to the payee address.

### Q: What happens if I send ETH after everyone has withdrawn?

**A**: The new ETH becomes available for the next withdrawal cycle. The contract tracks cumulative totals.

### Q: Can shares be changed after deployment?

**A**: No. Shares are immutable. You would need to deploy a new contract.

### Q: What if a payee loses access to their address?

**A**: Their funds remain locked in the contract. This is why it's critical to verify addresses before deployment.

### Q: How do I calculate my exact pending amount?

**A**: Use the formula:
```javascript
pending = (totalReceived × myShares / totalShares) - alreadyReleased
```

### Q: Can the contract hold ERC20 tokens?

**A**: The current version only supports ETH. ERC20 support would require a different contract.

### Q: Is there a minimum withdrawal amount?

**A**: No minimum, but gas costs make small withdrawals inefficient.

---

## Additional Resources

- [API Documentation](./API.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Main README](../README.md)

---

**Usage Guide Version**: 1.0  
**Last Updated**: 2026-01-21

**Happy splitting! 💰**
