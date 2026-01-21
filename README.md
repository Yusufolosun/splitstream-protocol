# SplitStream Protocol

> Automated payroll splitting for teams and DAOs on Base

SplitStream is a smart contract protocol that enables automatic payment distribution among multiple payees based on predefined share allocations. Built on Base, it provides a trustless and transparent way to split incoming ETH payments proportionally.

## Features

- **Proportional Payment Distribution**: Automatically splits ETH among payees based on their share allocation
- **Pull Payment Pattern**: Payees withdraw their funds when ready, reducing gas costs and improving security
- **Immutable Share Allocation**: Shares are set at deployment and cannot be changed, ensuring predictability
- **Event Logging**: All payments and releases are logged on-chain for transparency
- **Gas Efficient**: Optimized for minimal gas consumption using OpenZeppelin utilities
- **Fully Tested**: Comprehensive test suite with 100% coverage of core functionality

## Smart Contract

### SplitStream.sol

The main contract that handles payment splitting and distribution.

**Key Functions:**

- `totalShares()`: Returns the total number of shares across all payees
- `shares(address payee)`: Returns the number of shares for a specific payee
- `released(address payee)`: Returns the amount already released to a payee
- `totalReleased()`: Returns the total amount released to all payees
- `payee(uint256 index)`: Returns the payee address at a given index
- `release(address payable account)`: Releases the owed payment to a payee

**Events:**

- `PaymentReceived(address indexed from, uint256 amount)`: Emitted when ETH is received
- `PaymentReleased(address indexed to, uint256 amount)`: Emitted when a payee withdraws

## Installation

```bash
# Clone the repository
git clone https://github.com/Yusufolosun/splitstream-protocol.git
cd splitstream-protocol

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

## Configuration

Edit `.env` file with your credentials:

```env
BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_private_key_here
BASESCAN_API_KEY=your_basescan_api_key_here
```

## Testing

Run the complete test suite:

```bash
npx hardhat test
```

Expected output:
```
  SplitStream
    Deployment
      ✔ Should set the correct total shares
      ✔ Should assign shares correctly to each payee
    Payment Release
      ✔ Should allow payees to release their shares
      ✔ Should prevent double payments
    Receive Function
      ✔ Should receive ETH and emit events

  18 passing (2s)
```

## Deployment

### Deploy to Base Mainnet

```bash
npx hardhat run scripts/deploy.js --network base
```

The deployment script will:
1. Deploy the SplitStream contract with configured payees and shares
2. Wait for block confirmation
3. Verify the deployment on-chain
4. Provide the contract address and verification command

### Deploy to Local Network

```bash
# Start local Hardhat node
npx hardhat node

# In another terminal, deploy
npx hardhat run scripts/deploy.js --network localhost
```

## Contract Verification

After deployment, verify your contract on Basescan:

```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> "[\"<PAYEE1>\",\"<PAYEE2>\",\"<PAYEE3>\"]" "[50,30,20]"
```

Example:
```bash
npx hardhat verify --network base 0x1234... "[\"0xABC...\",\"0xDEF...\",\"0x123...\"]" "[50,30,20]"
```

## Usage Examples

### 1. Deploy a New Payment Splitter

```javascript
const SplitStream = await ethers.getContractFactory("SplitStream");
const payees = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333"
];
const shares = [50, 30, 20]; // 50%, 30%, 20%

const splitter = await SplitStream.deploy(payees, shares);
await splitter.waitForDeployment();
```

### 2. Send ETH to the Contract

```javascript
// Anyone can send ETH to the contract
await signer.sendTransaction({
  to: contractAddress,
  value: ethers.parseEther("10.0") // Send 10 ETH
});
```

### 3. Release Payment to a Payee

```javascript
// Any payee can call release for themselves or others
await splitter.release(payeeAddress);

// Check how much has been released
const released = await splitter.released(payeeAddress);
console.log(`Released: ${ethers.formatEther(released)} ETH`);
```

### 4. Query Contract State

```javascript
// Get total shares
const totalShares = await splitter.totalShares();

// Get shares for a specific payee
const payeeShares = await splitter.shares(payeeAddress);

// Get total amount released
const totalReleased = await splitter.totalReleased();

// Get payee by index
const payee0 = await splitter.payee(0);
```

## Architecture

```
┌─────────────────────────────────────────┐
│         External Accounts               │
│    (Send ETH to SplitStream)            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         SplitStream Contract            │
│  ┌───────────────────────────────────┐  │
│  │  Receive ETH                      │  │
│  │  - Emit PaymentReceived event     │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Calculate Shares                 │  │
│  │  - Based on total shares          │  │
│  │  - Proportional distribution      │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Release Payments                 │  │
│  │  - Pull payment pattern           │  │
│  │  - Track released amounts         │  │
│  │  - Emit PaymentReleased event     │  │
│  └───────────────────────────────────┘  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│            Payees                       │
│   (Withdraw their proportional share)  │
└─────────────────────────────────────────┘
```

## Security Considerations

- **Immutable Shares**: Share allocations are set at deployment and cannot be modified
- **Pull Payment Pattern**: Payees must actively withdraw funds, preventing push payment vulnerabilities
- **Reentrancy Protection**: Uses OpenZeppelin's `sendValue` which includes reentrancy protection
- **Zero Address Checks**: Validates all payee addresses during deployment
- **Zero Shares Prevention**: Ensures all payees have non-zero share allocations
- **Duplicate Prevention**: Prevents the same address from being added multiple times

### Audit Status

⚠️ **This contract has not been audited.** Use at your own risk. Consider getting a professional audit before using in production with significant funds.

## Gas Optimization

- Uses `uint256` for efficient storage and computation
- Minimal storage reads through caching
- Efficient iteration patterns
- OpenZeppelin's optimized utilities

## Technology Stack

- **Solidity**: ^0.8.20
- **Hardhat**: Development environment
- **OpenZeppelin Contracts**: Secure, audited utilities
- **Ethers.js**: Ethereum library
- **Chai**: Testing assertions
- **Base**: Deployment network

## Project Structure

```
splitstream-protocol/
├── contracts/
│   ├── SplitStream.sol       # Main payment splitter contract
│   └── ISplitStream.sol      # Interface definition
├── scripts/
│   └── deploy.js             # Deployment script
├── test/
│   └── SplitStream.test.js   # Comprehensive test suite
├── hardhat.config.js         # Hardhat configuration
├── .env.example              # Environment template
└── README.md                 # This file
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For questions or issues:
- Open an issue on [GitHub](https://github.com/Yusufolosun/splitstream-protocol/issues)
- Check existing documentation and tests

## Acknowledgments

- Built with [OpenZeppelin Contracts](https://openzeppelin.com/contracts/)
- Deployed on [Base](https://base.org/)
- Inspired by payment splitter patterns in DeFi

---

**⚡ Built on Base | 🔒 Trustless | 📊 Transparent**