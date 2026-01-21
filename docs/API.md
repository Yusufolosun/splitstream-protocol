# SplitStream API Documentation

Complete API reference for the SplitStream payment splitter contract.

## Table of Contents

- [Overview](#overview)
- [Constructor](#constructor)
- [View Functions](#view-functions)
- [State-Changing Functions](#state-changing-functions)
- [Receive Function](#receive-function)
- [Events](#events)
- [Error Messages](#error-messages)
- [Integration Examples](#integration-examples)

---

## Overview

The SplitStream contract provides a simple API for splitting ETH payments among multiple payees based on predefined shares. All share allocations are immutable after deployment.

**Contract Address (Base Mainnet)**: Deploy your own instance  
**Solidity Version**: ^0.8.20  
**License**: MIT

---

## Constructor

Initializes the payment splitter with payees and their respective shares.

### Signature

```solidity
constructor(address[] memory payees, uint256[] memory shares_) payable
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `payees` | `address[]` | Array of payee addresses that will receive payments |
| `shares_` | `uint256[]` | Array of share amounts corresponding to each payee |

### Requirements

- `payees` and `shares_` arrays must have the same length
- Both arrays must have at least one element
- All addresses in `payees` must be non-zero
- All values in `shares_` must be greater than zero
- No duplicate addresses in `payees`

### Example Usage

#### Ethers.js v6

```javascript
const { ethers } = require("hardhat");

async function deploySpli() {
  const [deployer, payee1, payee2, payee3] = await ethers.getSigners();
  
  const SplitStream = await ethers.getContractFactory("SplitStream");
  
  const payees = [
    payee1.address,
    payee2.address,
    payee3.address
  ];
  
  const shares = [50, 30, 20]; // 50%, 30%, 20%
  
  const splitter = await SplitStream.deploy(payees, shares);
  await splitter.waitForDeployment();
  
  console.log("SplitStream deployed to:", await splitter.getAddress());
  console.log("Total shares:", await splitter.totalShares()); // 100
}
```

#### Web3.js

```javascript
const Web3 = require('web3');
const web3 = new Web3('https://mainnet.base.org');

const abi = [...]; // Contract ABI
const bytecode = '0x...'; // Contract bytecode

const contract = new web3.eth.Contract(abi);

const deploy = contract.deploy({
  data: bytecode,
  arguments: [
    ['0x123...', '0x456...', '0x789...'], // payees
    [50, 30, 20] // shares
  ]
});

const instance = await deploy.send({
  from: deployerAddress,
  gas: 500000
});
```

---

## View Functions

View functions are read-only and do not require gas (when called externally).

### totalShares()

Returns the total number of shares across all payees.

#### Signature

```solidity
function totalShares() public view returns (uint256)
```

#### Returns

| Type | Description |
|------|-------------|
| `uint256` | The sum of all payee shares |

#### Example

```javascript
const totalShares = await splitter.totalShares();
console.log("Total shares:", totalShares.toString()); // "100"
```

---

### shares(address payee)

Returns the number of shares allocated to a specific payee.

#### Signature

```solidity
function shares(address payee) public view returns (uint256)
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `payee` | `address` | The address of the payee to query |

#### Returns

| Type | Description |
|------|-------------|
| `uint256` | The number of shares owned by the payee (0 if not a payee) |

#### Example

```javascript
const payeeShares = await splitter.shares(payee1.address);
console.log("Payee1 shares:", payeeShares.toString()); // "50"

// Check if address is a payee
const isPayee = (await splitter.shares(someAddress)) > 0;
console.log("Is payee:", isPayee);
```

---

### released(address payee)

Returns the total amount of ETH already released to a specific payee.

#### Signature

```solidity
function released(address payee) public view returns (uint256)
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `payee` | `address` | The address of the payee to query |

#### Returns

| Type | Description |
|------|-------------|
| `uint256` | The amount of wei already released to the payee |

#### Example

```javascript
const releasedAmount = await splitter.released(payee1.address);
console.log("Already released:", ethers.formatEther(releasedAmount), "ETH");

// Calculate pending amount
const totalReceived = await ethers.provider.getBalance(splitterAddress) + 
                      await splitter.totalReleased();
const payeeShares = await splitter.shares(payee1.address);
const totalShares = await splitter.totalShares();
const entitled = (totalReceived * payeeShares) / totalShares;
const pending = entitled - releasedAmount;

console.log("Pending:", ethers.formatEther(pending), "ETH");
```

---

### totalReleased()

Returns the total amount of ETH released to all payees.

#### Signature

```solidity
function totalReleased() public view returns (uint256)
```

#### Returns

| Type | Description |
|------|-------------|
| `uint256` | The total amount of wei released to all payees |

#### Example

```javascript
const totalReleased = await splitter.totalReleased();
const contractBalance = await ethers.provider.getBalance(splitterAddress);
const totalReceived = totalReleased + contractBalance;

console.log("Total released:", ethers.formatEther(totalReleased), "ETH");
console.log("Current balance:", ethers.formatEther(contractBalance), "ETH");
console.log("Total received:", ethers.formatEther(totalReceived), "ETH");
```

---

### payee(uint256 index)

Returns the payee address at a specific index in the payees array.

#### Signature

```solidity
function payee(uint256 index) public view returns (address)
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `index` | `uint256` | The index in the payees array (0-based) |

#### Returns

| Type | Description |
|------|-------------|
| `address` | The address of the payee at the given index |

#### Example

```javascript
// Get all payees
async function getAllPayees(splitter) {
  const payees = [];
  let index = 0;
  
  try {
    while (true) {
      const payee = await splitter.payee(index);
      payees.push(payee);
      index++;
    }
  } catch (error) {
    // Out of bounds - we've reached the end
  }
  
  return payees;
}

const allPayees = await getAllPayees(splitter);
console.log("All payees:", allPayees);

// Get first payee
const firstPayee = await splitter.payee(0);
console.log("First payee:", firstPayee);
```

---

## State-Changing Functions

State-changing functions modify the blockchain state and require gas.

### release(address payable account)

Releases the owed payment to a payee based on their share allocation.

#### Signature

```solidity
function release(address payable account) public
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `account` | `address payable` | The address of the payee to release payment to |

#### Requirements

- `account` must have shares (must be a payee)
- `account` must be due a payment (payment amount > 0)

#### Effects

1. Calculates the payment amount based on:
   - Total funds received (current balance + already released)
   - Payee's share proportion
   - Amount already released to the payee
2. Updates `_released[account]` with the new total
3. Updates `_totalReleased` with the payment amount
4. Transfers ETH to the payee
5. Emits `PaymentReleased` event

#### Events Emitted

- `PaymentReleased(address indexed to, uint256 amount)`

#### Gas Considerations

- Approximate gas cost: ~50,000 gas
- Payee pays gas for their own withdrawal
- Gas cost is independent of number of payees

#### Example Usage

```javascript
// Release payment to a specific payee
async function releasePayment(splitter, payeeAddress) {
  // Check if payee has pending payment
  const pending = await calculatePending(splitter, payeeAddress);
  
  if (pending > 0) {
    console.log(`Releasing ${ethers.formatEther(pending)} ETH to ${payeeAddress}`);
    
    const tx = await splitter.release(payeeAddress);
    console.log("Transaction hash:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Find the PaymentReleased event
    const event = receipt.logs.find(
      log => log.topics[0] === splitter.interface.getEvent("PaymentReleased").topicHash
    );
    
    if (event) {
      const decoded = splitter.interface.parseLog(event);
      console.log("Released to:", decoded.args.to);
      console.log("Amount:", ethers.formatEther(decoded.args.amount), "ETH");
    }
  } else {
    console.log("No pending payment for this payee");
  }
}

// Release to self (if caller is a payee)
async function releaseMySelf(splitter, signer) {
  const tx = await splitter.connect(signer).release(signer.address);
  await tx.wait();
  console.log("Payment released to self");
}

// Batch release to all payees
async function releaseToAll(splitter) {
  const payees = await getAllPayees(splitter);
  
  for (const payee of payees) {
    try {
      const tx = await splitter.release(payee);
      await tx.wait();
      console.log(`Released payment to ${payee}`);
    } catch (error) {
      console.log(`No payment due for ${payee}`);
    }
  }
}
```

---

## Receive Function

The contract can receive ETH directly via the `receive()` function.

### Signature

```solidity
receive() external payable
```

### Behavior

- Accepts ETH sent to the contract
- Emits `PaymentReceived` event
- No validation or restrictions on sender
- Funds become available for payees to release

### Events Emitted

- `PaymentReceived(address indexed from, uint256 amount)`

### Example Usage

```javascript
// Send ETH to the splitter
async function fundSplitter(splitter, amount) {
  const tx = await signer.sendTransaction({
    to: await splitter.getAddress(),
    value: ethers.parseEther(amount)
  });
  
  const receipt = await tx.wait();
  console.log(`Sent ${amount} ETH to splitter`);
  
  // Listen for PaymentReceived event
  const event = receipt.logs.find(
    log => log.topics[0] === splitter.interface.getEvent("PaymentReceived").topicHash
  );
  
  if (event) {
    const decoded = splitter.interface.parseLog(event);
    console.log("Received from:", decoded.args.from);
    console.log("Amount:", ethers.formatEther(decoded.args.amount), "ETH");
  }
}

// Alternative: use contract method (if wrapped)
await signer.sendTransaction({
  to: splitterAddress,
  value: ethers.parseEther("10.0")
});
```

---

## Events

### PaymentReceived

Emitted when the contract receives ETH.

#### Signature

```solidity
event PaymentReceived(address indexed from, uint256 amount)
```

#### Parameters

| Parameter | Indexed | Type | Description |
|-----------|---------|------|-------------|
| `from` | ✅ | `address` | The address that sent the ETH |
| `amount` | ❌ | `uint256` | The amount of wei received |

#### Example

```javascript
// Listen for PaymentReceived events
splitter.on("PaymentReceived", (from, amount, event) => {
  console.log(`Received ${ethers.formatEther(amount)} ETH from ${from}`);
  console.log("Transaction:", event.transactionHash);
});

// Query past events
const filter = splitter.filters.PaymentReceived();
const events = await splitter.queryFilter(filter, -1000); // Last 1000 blocks

events.forEach(event => {
  console.log(`${event.args.from} sent ${ethers.formatEther(event.args.amount)} ETH`);
});
```

---

### PaymentReleased

Emitted when a payee withdraws their payment.

#### Signature

```solidity
event PaymentReleased(address indexed to, uint256 amount)
```

#### Parameters

| Parameter | Indexed | Type | Description |
|-----------|---------|------|-------------|
| `to` | ✅ | `address` | The payee address that received the payment |
| `amount` | ❌ | `uint256` | The amount of wei released |

#### Example

```javascript
// Listen for PaymentReleased events
splitter.on("PaymentReleased", (to, amount, event) => {
  console.log(`Released ${ethers.formatEther(amount)} ETH to ${to}`);
  console.log("Transaction:", event.transactionHash);
});

// Query all releases for a specific payee
const filter = splitter.filters.PaymentReleased(payee1.address);
const events = await splitter.queryFilter(filter);

const totalReleased = events.reduce((sum, event) => {
  return sum + event.args.amount;
}, 0n);

console.log(`Total released to payee: ${ethers.formatEther(totalReleased)} ETH`);
```

---

## Error Messages

Understanding error messages helps with debugging and proper integration.

### Constructor Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `SplitStream: payees and shares length mismatch` | Arrays have different lengths | Ensure `payees.length === shares.length` |
| `SplitStream: no payees` | Empty arrays provided | Provide at least one payee |
| `SplitStream: account is the zero address` | Zero address in payees array | Use valid addresses only |
| `SplitStream: shares are 0` | Zero value in shares array | All shares must be > 0 |
| `SplitStream: account already has shares` | Duplicate address in payees | Remove duplicate addresses |

### Release Function Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `SplitStream: account has no shares` | Address is not a payee | Only payees can receive payments |
| `SplitStream: account is not due payment` | No pending payment | Wait for more funds or check calculation |

### Example Error Handling

```javascript
async function safeRelease(splitter, payee) {
  try {
    const tx = await splitter.release(payee);
    await tx.wait();
    console.log("Payment released successfully");
  } catch (error) {
    if (error.message.includes("account has no shares")) {
      console.error("Error: Address is not a payee");
    } else if (error.message.includes("account is not due payment")) {
      console.error("Error: No payment currently due");
    } else {
      console.error("Unexpected error:", error.message);
    }
  }
}
```

---

## Integration Examples

### Complete Integration Example

```javascript
const { ethers } = require("hardhat");

class SplitStreamManager {
  constructor(splitterAddress, provider) {
    this.splitter = new ethers.Contract(
      splitterAddress,
      SplitStreamABI,
      provider
    );
  }
  
  // Get all payee information
  async getPayeeInfo() {
    const payees = await this.getAllPayees();
    const totalShares = await this.splitter.totalShares();
    
    const info = await Promise.all(
      payees.map(async (address) => {
        const shares = await this.splitter.shares(address);
        const released = await this.splitter.released(address);
        const pending = await this.calculatePending(address);
        
        return {
          address,
          shares: shares.toString(),
          percentage: (Number(shares) * 100 / Number(totalShares)).toFixed(2),
          released: ethers.formatEther(released),
          pending: ethers.formatEther(pending)
        };
      })
    );
    
    return info;
  }
  
  // Calculate pending payment for a payee
  async calculatePending(payee) {
    const balance = await ethers.provider.getBalance(this.splitter.address);
    const totalReleased = await this.splitter.totalReleased();
    const totalReceived = balance + totalReleased;
    
    const shares = await this.splitter.shares(payee);
    const totalShares = await this.splitter.totalShares();
    const released = await this.splitter.released(payee);
    
    const entitled = (totalReceived * shares) / totalShares;
    return entitled - released;
  }
  
  // Get all payees
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
  
  // Release payment to a payee
  async release(payee, signer) {
    const pending = await this.calculatePending(payee);
    
    if (pending <= 0) {
      throw new Error("No payment due");
    }
    
    const tx = await this.splitter.connect(signer).release(payee);
    const receipt = await tx.wait();
    
    return {
      transactionHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
      amount: ethers.formatEther(pending)
    };
  }
  
  // Monitor events
  setupEventListeners() {
    this.splitter.on("PaymentReceived", (from, amount) => {
      console.log(`📥 Received ${ethers.formatEther(amount)} ETH from ${from}`);
    });
    
    this.splitter.on("PaymentReleased", (to, amount) => {
      console.log(`📤 Released ${ethers.formatEther(amount)} ETH to ${to}`);
    });
  }
}

// Usage
const manager = new SplitStreamManager(splitterAddress, provider);
await manager.setupEventListeners();

const payeeInfo = await manager.getPayeeInfo();
console.table(payeeInfo);

await manager.release(payee1Address, signer);
```

---

## Best Practices

1. **Always check pending amounts** before calling `release()` to avoid reverts
2. **Use events** for tracking payments and releases
3. **Handle errors gracefully** with try-catch blocks
4. **Cache view function results** when making multiple calls
5. **Estimate gas** before transactions in production
6. **Verify payee addresses** during deployment to avoid mistakes
7. **Test thoroughly** on testnet before mainnet deployment

---

**API Version**: 1.0  
**Last Updated**: 2026-01-21  
**Contract Version**: 1.0.0

For more information, see:
- [Architecture Documentation](./ARCHITECTURE.md)
- [Main README](../README.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
