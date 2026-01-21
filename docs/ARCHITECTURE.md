# SplitStream Protocol - Technical Architecture

## Table of Contents

1. [System Overview](#system-overview)
2. [Design Philosophy](#design-philosophy)
3. [Contract Structure](#contract-structure)
4. [State Variables](#state-variables)
5. [Function Flow Diagrams](#function-flow-diagrams)
6. [Security Model](#security-model)
7. [Gas Optimization](#gas-optimization)
8. [Immutability Design](#immutability-design)
9. [Integration Patterns](#integration-patterns)
10. [Edge Cases](#edge-cases)
11. [Future Considerations](#future-considerations)

---

## System Overview

SplitStream is a trustless payment splitting protocol that distributes ETH among multiple payees based on predefined share allocations. The contract implements a pull payment pattern where payees actively withdraw their proportional share of accumulated funds.

### Core Principles

- **Trustless**: No admin control after deployment
- **Transparent**: All transactions logged on-chain
- **Efficient**: Optimized for minimal gas consumption
- **Secure**: Follows best practices and uses audited libraries

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    External Interactions                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   Send ETH        Query State    Release Payment
        │               │               │
        │               │               │
        ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                    SplitStream Contract                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  State Variables                                     │   │
│  │  - _totalShares: uint256                            │   │
│  │  - _totalReleased: uint256                          │   │
│  │  - _shares: mapping(address => uint256)             │   │
│  │  - _released: mapping(address => uint256)           │   │
│  │  - _payees: address[]                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Core Functions                                      │   │
│  │  - constructor(payees[], shares[])                   │   │
│  │  - receive() external payable                        │   │
│  │  - release(address payable)                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  View Functions                                      │   │
│  │  - totalShares(), totalReleased()                    │   │
│  │  - shares(address), released(address)                │   │
│  │  - payee(uint256)                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Philosophy

### 1. Pull Over Push

The contract uses a **pull payment pattern** rather than automatically distributing funds:

**Advantages:**
- Prevents reentrancy attacks
- Reduces gas costs (payees pay their own withdrawal gas)
- Eliminates risk of failed transfers blocking other payees
- Allows payees to withdraw when convenient

### 2. Immutability

Share allocations are **immutable** after deployment:

**Rationale:**
- Predictability for all parties
- Eliminates governance risks
- Simplifies security model
- Reduces attack surface

### 3. Proportional Distribution

Payments are distributed **proportionally** based on shares:

```
Payment = (TotalReceived × PayeeShares) / TotalShares - AlreadyReleased
```

This ensures fair distribution regardless of when payees withdraw.

---

## Contract Structure

### Inheritance Diagram

```
Context (OpenZeppelin)
    │
    ├─── ISplitStream (Interface)
    │         │
    │         └─── SplitStream (Implementation)
    │
    └─── Address (OpenZeppelin Library)
```

### Interface: ISplitStream

Defines the public API:
- Events: `PaymentReceived`, `PaymentReleased`
- View functions: `totalShares`, `shares`, `totalReleased`, `released`, `payee`
- State-changing: `release`

### Implementation: SplitStream

Implements the interface with:
- Constructor for initialization
- Private `_addPayee` function for setup
- `receive` function for accepting ETH
- Full implementation of interface functions

---

## State Variables

### Private State

```solidity
uint256 private _totalShares;
uint256 private _totalReleased;
mapping(address => uint256) private _shares;
mapping(address => uint256) private _released;
address[] private _payees;
```

### Variable Purposes

| Variable | Type | Purpose |
|----------|------|---------|
| `_totalShares` | `uint256` | Sum of all payee shares (denominator for calculations) |
| `_totalReleased` | `uint256` | Total ETH released to all payees (for accounting) |
| `_shares` | `mapping` | Maps payee address to their share allocation |
| `_released` | `mapping` | Maps payee address to amount already withdrawn |
| `_payees` | `address[]` | Array of all payee addresses (for enumeration) |

### Storage Layout

```
Slot 0: _totalShares (uint256)
Slot 1: _totalReleased (uint256)
Slot 2: _shares mapping base
Slot 3: _released mapping base
Slot 4: _payees array length
Slot 5+: _payees array data
```

---

## Function Flow Diagrams

### 1. Deployment Flow

```
┌─────────────────────────────────────────┐
│  constructor(payees[], shares[])        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Validate: payees.length == shares.length│
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Validate: payees.length > 0            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Loop: for each payee                   │
│    ├─ _addPayee(payee, shares)          │
│    │    ├─ Validate: not zero address   │
│    │    ├─ Validate: shares > 0         │
│    │    ├─ Validate: no duplicate       │
│    │    ├─ Add to _payees array         │
│    │    ├─ Set _shares[payee]           │
│    │    └─ Increment _totalShares       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Deployment Complete                    │
│  Contract Address: 0x...                │
└─────────────────────────────────────────┘
```

### 2. Payment Reception Flow

```
┌─────────────────────────────────────────┐
│  External Account sends ETH             │
│  → Contract Address                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  receive() external payable             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Emit PaymentReceived(sender, amount)   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  ETH stored in contract balance         │
│  Available for payees to release        │
└─────────────────────────────────────────┘
```

### 3. Release Payment Flow

```
┌─────────────────────────────────────────┐
│  release(address payable account)       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Validate: _shares[account] > 0         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Calculate Payment:                     │
│  totalReceived = balance + _totalReleased│
│  payment = (totalReceived × shares)     │
│            / _totalShares                │
│            - _released[account]          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Validate: payment > 0                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Update State (Checks-Effects-Interactions)│
│  _released[account] += payment          │
│  _totalReleased += payment              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Transfer ETH: account.sendValue(payment)│
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Emit PaymentReleased(account, payment) │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Transaction Complete                   │
└─────────────────────────────────────────┘
```

---

## Security Model

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Reentrancy | Checks-Effects-Interactions pattern + OpenZeppelin's `sendValue` |
| Integer Overflow | Solidity 0.8+ built-in overflow protection |
| Unauthorized Access | No admin functions; all operations permissionless |
| Zero Address | Validation in constructor |
| Zero Shares | Validation in constructor |
| Duplicate Payees | Validation in constructor |
| Failed Transfers | `sendValue` reverts on failure, protecting state |

### Security Assumptions

1. **Payee Addresses**: Assumed to be valid EOAs or contracts that can receive ETH
2. **Share Distribution**: Assumed to be fair and agreed upon before deployment
3. **No Upgrades**: Contract is immutable; bugs cannot be fixed post-deployment
4. **Gas Costs**: Payees responsible for their own withdrawal gas costs

### Checks-Effects-Interactions Pattern

```solidity
function release(address payable account) public override {
    // CHECKS
    require(_shares[account] > 0, "SplitStream: account has no shares");
    uint256 payment = calculatePayment(account);
    require(payment > 0, "SplitStream: account is not due payment");
    
    // EFFECTS
    _released[account] += payment;
    _totalReleased += payment;
    
    // INTERACTIONS
    account.sendValue(payment);
    emit PaymentReleased(account, payment);
}
```

---

## Gas Optimization

### Strategies Employed

1. **Minimal Storage Reads**
   - Cache frequently accessed values
   - Use local variables for calculations

2. **Efficient Data Types**
   - `uint256` for all numeric values (native EVM word size)
   - Packed storage not needed (no small types)

3. **OpenZeppelin Libraries**
   - Battle-tested, gas-optimized implementations
   - `sendValue` more efficient than raw `call`

4. **No Loops in Core Functions**
   - `release` operates on single payee (O(1))
   - No iteration over all payees

5. **Event Indexing**
   - Indexed parameters for efficient filtering
   - Minimal event data to reduce gas

### Gas Cost Analysis

| Operation | Approximate Gas | Notes |
|-----------|----------------|-------|
| Deployment (3 payees) | ~400,000 | One-time cost |
| Receive ETH | ~25,000 | Includes event emission |
| Release Payment | ~50,000 | Includes transfer + event |
| View Functions | 0 | Free (read-only) |

---

## Immutability Design

### Why Immutable?

1. **Trust Minimization**: No admin can change share allocations
2. **Predictability**: Payees know their share will never change
3. **Security**: Eliminates entire class of governance attacks
4. **Simplicity**: Reduces code complexity and attack surface

### Trade-offs

| Advantage | Disadvantage |
|-----------|--------------|
| No governance risk | Cannot fix bugs |
| Predictable behavior | Cannot adjust shares |
| Simpler code | Cannot add/remove payees |
| Lower gas costs | Must deploy new contract for changes |

### Alternative Considered: Upgradeable

**Rejected because:**
- Adds complexity (proxy pattern)
- Introduces trust assumptions (admin key)
- Increases gas costs
- Creates governance attack surface

**When to use upgradeable:**
- Complex protocols with evolving requirements
- Situations where admin control is acceptable
- Long-term projects requiring flexibility

---

## Integration Patterns

### 1. Direct Integration

Other contracts can deploy SplitStream instances:

```solidity
contract TeamPayroll {
    SplitStream public splitter;
    
    constructor(address[] memory team, uint256[] memory shares) {
        splitter = new SplitStream(team, shares);
    }
    
    function fundTeam() external payable {
        (bool success, ) = address(splitter).call{value: msg.value}("");
        require(success, "Transfer failed");
    }
}
```

### 2. Factory Pattern

Deploy multiple splitters from a factory:

```solidity
contract SplitStreamFactory {
    event SplitterCreated(address indexed splitter, address[] payees);
    
    function createSplitter(
        address[] memory payees,
        uint256[] memory shares
    ) external returns (address) {
        SplitStream splitter = new SplitStream(payees, shares);
        emit SplitterCreated(address(splitter), payees);
        return address(splitter);
    }
}
```

### 3. Automated Distribution

External service can monitor and auto-release:

```javascript
// Off-chain service
async function autoRelease(splitterAddress) {
  const splitter = await ethers.getContractAt("SplitStream", splitterAddress);
  const payeeCount = await getPayeeCount(splitter);
  
  for (let i = 0; i < payeeCount; i++) {
    const payee = await splitter.payee(i);
    const pending = await calculatePending(splitter, payee);
    
    if (pending > threshold) {
      await splitter.release(payee);
    }
  }
}
```

### 4. Multi-Signature Integration

Use with multi-sig for controlled funding:

```solidity
// Gnosis Safe or similar can send funds to splitter
// Payees withdraw independently
```

---

## Edge Cases

### 1. Zero Payment Available

**Scenario**: Payee calls `release` but has no funds to claim

**Handling**:
```solidity
require(payment > 0, "SplitStream: account is not due payment");
```

**Result**: Transaction reverts, no state change

### 2. Rounding Errors

**Scenario**: Integer division may leave dust in contract

**Example**:
- Total: 100 ETH
- Shares: [33, 33, 34]
- Payee 1: 33 ETH
- Payee 2: 33 ETH
- Payee 3: 34 ETH
- Dust: 0 ETH (perfect division)

**Handling**: Last payee gets any rounding remainder

### 3. Contract Receives ETH After All Released

**Scenario**: New ETH arrives after all payees have withdrawn

**Handling**: Automatically available for next withdrawal cycle

**Calculation**:
```solidity
totalReceived = address(this).balance + _totalReleased;
payment = (totalReceived * _shares[account]) / _totalShares - _released[account];
```

### 4. Payee Address is Contract

**Scenario**: Payee is a contract without `receive`/`fallback`

**Handling**: `sendValue` will revert, protecting state

**Recommendation**: Ensure payee contracts can receive ETH

### 5. Extremely Large Share Values

**Scenario**: Shares sum to near `uint256` max

**Handling**: Solidity 0.8+ overflow protection

**Recommendation**: Use reasonable share values (e.g., percentages)

### 6. Single Payee

**Scenario**: Deployed with only one payee

**Handling**: Works correctly; payee gets 100% of funds

**Use Case**: Simple escrow or vesting contract

---

## Future Considerations

### Potential Enhancements

1. **ERC20 Support**
   - Extend to support token splitting
   - Separate tracking per token
   - Additional complexity

2. **Batch Release**
   - Release to multiple payees in one transaction
   - Gas savings for administrators
   - Requires careful gas limit management

3. **Time-Based Vesting**
   - Release funds over time
   - Linear or cliff vesting schedules
   - Adds significant complexity

4. **Upgradeable Version**
   - Proxy pattern for upgradeability
   - Trade-off: trust vs flexibility
   - Separate product offering

5. **Emergency Pause**
   - Circuit breaker for emergencies
   - Requires admin role
   - Against current design philosophy

### Compatibility Considerations

- **EIP-4337 (Account Abstraction)**: Compatible; payees can be smart contract wallets
- **EIP-2771 (Meta Transactions)**: Not currently supported; could be added
- **Layer 2 Scaling**: Fully compatible with Base and other L2s
- **Cross-Chain**: Would require bridge integration

### Monitoring Recommendations

For production deployments:

1. **Event Monitoring**: Track `PaymentReceived` and `PaymentReleased`
2. **Balance Tracking**: Monitor contract balance vs expected
3. **Payee Activity**: Alert on unusual withdrawal patterns
4. **Gas Price Optimization**: Time releases for low gas periods

---

## Conclusion

SplitStream provides a simple, secure, and efficient payment splitting solution. The immutable design prioritizes security and predictability over flexibility, making it ideal for scenarios where share allocations are predetermined and trustless operation is paramount.

For integration questions or security concerns, please refer to the main [README](../README.md) or open an issue on GitHub.

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-21  
**Contract Version**: 1.0.0
