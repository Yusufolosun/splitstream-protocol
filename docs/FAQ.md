# SplitStream FAQ

## General Questions

### What is SplitStream?
SplitStream is a trustless payment splitting protocol built on Solidity that allows ETH to be automatically distributed among multiple payees based on predefined shares. It's designed for teams, DAOs, and projects that need transparent, immutable revenue sharing without intermediaries.

### Who should use SplitStream?
SplitStream is ideal for:
- **Development teams** sharing revenue from projects
- **DAOs** distributing treasury funds to contributors
- **NFT projects** splitting royalties among creators
- **Content creators** sharing income with collaborators
- **Any group** requiring transparent, automated payment distribution

### Is SplitStream safe to use?
Yes, SplitStream is built with security best practices including:
- OpenZeppelin's battle-tested `ReentrancyGuard` to prevent reentrancy attacks
- Comprehensive input validation
- No admin privileges after deployment (immutable payee and share configuration)
- Protection against common vulnerabilities (zero address, integer overflow/underflow)
- Extensive security-focused test suite

### Has SplitStream been audited?
Please refer to the project repository for the latest audit information. The contract has undergone thorough internal security testing, including reentrancy protection, edge cases, and gas optimization tests. For production use with significant funds, we recommend obtaining an independent security audit.

### What makes SplitStream different from other payment splitters?
SplitStream distinguishes itself through:
- **Immutability**: Once deployed, payees and shares cannot be changed, ensuring trust
- **Zero fees**: No platform fees; 100% of payments go to payees
- **Gas optimization**: Efficient implementation minimizes transaction costs
- **Transparency**: All transactions are on-chain and verifiable
- **Simplicity**: Clean, minimal interface with no administrative overhead
- **Base optimization**: Specifically optimized for deployment on Base network

---

## Deployment Questions

### How do I deploy my own SplitStream contract?
To deploy a SplitStream contract:

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure your `.env` file:
   ```
   PRIVATE_KEY=your_private_key_here
   BASE_RPC_URL=your_base_rpc_url
   BASESCAN_API_KEY=your_basescan_api_key
   ```

3. Deploy using the deployment script:
   ```bash
   npx hardhat run scripts/deploy.js --network base
   ```

4. The script will prompt you to enter payee addresses and their corresponding shares.

### What are the deployment costs on Base?
Deployment costs vary based on network congestion, but typically range from **$0.10 to $0.50 USD** on Base. The exact cost depends on:
- Current gas price on Base
- Number of payees (more payees = higher deployment cost)
- ETH/USD exchange rate at deployment time

You can estimate costs by running:
```bash
npx hardhat run scripts/estimateGas.js --network base
```

### Can I change payees after deployment?
**No.** SplitStream contracts are immutable by design. Once deployed, the payee addresses cannot be modified. This ensures trust and transparency—no one can unilaterally change the payment distribution. If you need to change payees, you must deploy a new contract.

### Can I change share percentages after deployment?
**No.** Share percentages are set at deployment and cannot be changed. This immutability is a core security feature that prevents malicious modification of payment splits. Plan your share distribution carefully before deployment.

### What happens if I deploy with wrong parameters?
If you deploy with incorrect payee addresses or shares:
- The deployment will succeed, but the contract will use the wrong configuration
- You **cannot** modify the contract parameters
- You must deploy a **new contract** with the correct parameters
- Any funds sent to the incorrectly configured contract will be distributed according to the wrong parameters

**Best Practice**: Always double-check addresses and shares before deployment. Consider deploying to a testnet first.

### How many payees can I have?
While there's no hard limit in the contract code, practical considerations include:
- **Gas costs**: More payees increase deployment and withdrawal costs
- **Recommended maximum**: 10-20 payees for optimal gas efficiency
- **Technical limit**: Limited by Ethereum's block gas limit

For groups larger than 20, consider using a hierarchical approach (e.g., multiple SplitStream contracts).

---

## Usage Questions

### How do I send payments to the contract?
Send ETH directly to the contract address using any wallet or contract. The SplitStream contract automatically accepts ETH through its `receive()` function. You can:

- Send from a wallet (MetaMask, Coinbase Wallet, etc.)
- Send from another smart contract
- Set the contract as a payment recipient in NFT marketplaces or DeFi protocols

No special function calls are needed—just send ETH to the contract address.

### How do payees withdraw their funds?
Payees can withdraw using the `release(address payee)` function:

**Using the utility script:**
```bash
npx hardhat run scripts/release.js --network base
```

**Programmatically:**
```javascript
const splitStream = await ethers.getContractAt("SplitStream", contractAddress);
await splitStream.release(payeeAddress);
```

**Using Etherscan/Basescan:**
1. Navigate to the contract on Basescan
2. Go to "Write Contract"
3. Connect your wallet
4. Call `release` with the payee address

### What happens if a payee never withdraws?
Unclaimed funds remain in the contract indefinitely, accruing to the payee's pending balance. There's no expiration or redistribution:
- Funds are **never lost** and remain claimable forever
- Other payees can still withdraw their shares normally
- The payee (or anyone calling on their behalf) can withdraw at any time

You can check pending balances using the monitoring script:
```bash
npx hardhat run scripts/checkBalance.js --network base
```

### Can I withdraw on behalf of another payee?
**Yes.** Anyone can call the `release(address payee)` function to trigger a withdrawal to any payee. The withdrawn funds always go directly to the specified payee address, regardless of who calls the function. This allows:
- Automated withdrawal services
- Batch withdrawal scripts
- Helpful third parties to trigger withdrawals for others (paying gas on their behalf)

### What's the minimum payment amount?
There's no enforced minimum, but consider:
- **Practical minimum**: Ensure payments are large enough that withdrawal gas costs don't exceed the payment value
- **Gas costs**: Withdrawal costs approximately $0.01-0.05 on Base
- **Recommendation**: For micro-payments, let balances accumulate before withdrawing

### Are there any fees?
**No platform fees.** SplitStream charges zero fees. The only costs are:
- **Deployment gas**: One-time cost to deploy the contract
- **Withdrawal gas**: Paid by whoever triggers the withdrawal (typically $0.01-0.05 on Base)

100% of payments go to payees according to their share percentages.

---

## Technical Questions

### Which networks does SplitStream support?
SplitStream is designed for **EVM-compatible networks** and has been optimized for:
- **Base Mainnet** (primary target, production-ready)
- **Base Sepolia** (testnet)

The contract can be deployed to any EVM chain (Ethereum, Optimism, Arbitrum, etc.) with minimal or no modifications.

### What token standards are supported?
**Currently: ETH only.** The current version supports native ETH payments. ERC-20 token support is not yet implemented. For ERC-20 token splitting, you'll need to:
- Wait for a future version with ERC-20 support
- Deploy a modified version of the contract (requires development)
- Use a different payment splitter that supports ERC-20

### Can I integrate SplitStream with my dApp?
**Absolutely!** SplitStream is designed for easy integration:

**Interface:**
```solidity
interface ISplitStream {
    function totalShares() external view returns (uint256);
    function totalReleased() external view returns (uint256);
    function shares(address account) external view returns (uint256);
    function released(address account) external view returns (uint256);
    function payee(uint256 index) external view returns (address);
    function releasable(address account) external view returns (uint256);
    function release(address payable account) external;
}
```

**Integration examples:**
- **NFT Royalties**: Set SplitStream address as royalty recipient
- **DeFi Protocols**: Route revenue to SplitStream for distribution
- **Payment Gateways**: Use as a multi-recipient payment endpoint
- **DAO Treasury**: Automate recurring distributions

### What are the gas costs for each operation?
Approximate gas costs on Base (prices vary with network conditions):

| Operation | Gas Used | Cost (Base) |
|-----------|----------|-------------|
| Deployment (3 payees) | ~350,000 | $0.15-0.30 |
| Deployment (10 payees) | ~600,000 | $0.25-0.50 |
| Receive payment | ~21,000 | $0.01-0.02 |
| Release/Withdraw | ~35,000-50,000 | $0.01-0.05 |
| View functions | 0 (free) | $0.00 |

**Note**: Base has significantly lower gas costs than Ethereum mainnet.

### How do I verify my deployed contract?
Verify your contract on Basescan for transparency:

**Automatic verification (recommended):**
```bash
npx hardhat verify --network base DEPLOYED_CONTRACT_ADDRESS "CONSTRUCTOR_ARGS"
```

**Manual verification:**
1. Go to Basescan and find your contract
2. Click "Contract" → "Verify and Publish"
3. Select compiler version (0.8.23)
4. Upload source code or use Hardhat verification
5. Submit for verification

The deployment script can be configured to auto-verify contracts.

---

## Troubleshooting

### Why is my transaction failing?
Common causes and solutions:

**"Insufficient funds" error:**
- Ensure your wallet has enough ETH to cover the transaction + gas fees
- Check the current gas price on Base

**"Invalid payee" error:**
- Verify you're using a valid payee address that exists in the contract
- Check that the address is checksummed correctly

**"No payment due" error:**
- The payee has no pending balance to withdraw
- Check pending balance with `npx hardhat run scripts/checkBalance.js --network base`

**Gas estimation failed:**
- Your transaction may be reverting; check error messages
- Ensure contract is deployed and you're on the correct network

**Network issues:**
- Verify your RPC URL is correct in `.env`
- Try switching to a different RPC provider
- Check Base network status

### Why does my pending balance show as 0?
If you're a payee but your pending balance is 0:

1. **No payments received yet**: The contract hasn't received any ETH since deployment (or since your last withdrawal)

2. **Already withdrew**: Check your `released` amount using:
   ```bash
   npx hardhat run scripts/checkBalance.js --network base
   ```

3. **Wrong contract**: Verify you're checking the correct contract address

4. **Not a payee**: Confirm your address is listed as a payee using:
   ```javascript
   await splitStream.shares(yourAddress); // Should return > 0
   ```

5. **Recent payment**: If payment was just received, it may take a few blocks to confirm

### How do I check the contract's current state?
Use the balance checker utility:

```bash
npx hardhat run scripts/checkBalance.js --network base
```

This displays:
- Contract ETH balance
- Total shares and total released
- Per-payee information (shares, released, pending)
- Total pending across all payees

You can also view the contract on Basescan or use the monitoring script for real-time event tracking.

### Can I recover funds sent to the wrong contract?
**No.** Blockchain transactions are irreversible. If you send ETH to the wrong address:
- Funds cannot be recovered unless you control that address
- Always double-check the recipient address before sending
- Use small test transactions first when interacting with new contracts

### What if I lost my private key?
If you're a payee and lost your private key:
- You **cannot** recover your funds
- The funds remain in the contract forever
- No one else can withdraw your share
- **Prevention**: Use hardware wallets and secure key backup methods

---

## Additional Resources

- **GitHub Repository**: [View source code and documentation](#)
- **Deployment Guide**: See `README.md` for detailed setup instructions
- **Contract Address**: Check your deployment output or Basescan
- **Support**: Open an issue on GitHub for questions or problems

---

*Last updated: January 2026*
