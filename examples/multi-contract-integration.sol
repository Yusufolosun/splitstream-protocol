// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Multi-Contract Integration Examples for SplitStream
 * @notice Demonstrates various patterns for integrating SplitStream with other contracts
 * 
 * This file contains multiple example contracts showing real-world integration patterns:
 * 
 * 1. RevenueSharer - Accepts payments and forwards to SplitStream
 * 2. DAOTreasury - DAO-controlled treasury using SplitStream
 * 3. NFTMarketplace - Marketplace with automatic royalty splitting
 * 4. StakingRewards - Staking contract distributing rewards via SplitStream
 * 
 * DEPLOYMENT CONSIDERATIONS:
 * - Deploy SplitStream contract first
 * - Pass SplitStream address to integrating contracts
 * - Ensure proper access control on functions that interact with SplitStream
 * - Consider gas costs of forwarding vs batching
 * 
 * SECURITY NOTES:
 * - Always validate SplitStream address in constructor
 * - Use pull-over-push pattern (SplitStream does this)
 * - Protect against reentrancy when forwarding funds
 * - Emit events for off-chain tracking
 * - Consider upgrade patterns if integration needs to change
 * 
 * TESTING:
 * See test file at test/MultiContractIntegration.t.sol for comprehensive tests
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * @title ISplitStream
 * @notice Minimal interface for interacting with SplitStream contract
 * @dev Use this interface in your contracts to interact with SplitStream
 */
interface ISplitStream {
    /**
     * @notice Get total number of shares
     */
    function totalShares() external view returns (uint256);
    
    /**
     * @notice Get shares for a specific account
     */
    function shares(address account) external view returns (uint256);
    
    /**
     * @notice Get amount already released to account
     */
    function released(address account) external view returns (uint256);
    
    /**
     * @notice Get amount currently releasable to account
     */
    function releasable(address account) external view returns (uint256);
    
    /**
     * @notice Get total amount released from contract
     */
    function totalReleased() external view returns (uint256);
    
    /**
     * @notice Get payee at index
     */
    function payee(uint256 index) external view returns (address);
    
    /**
     * @notice Get total number of payees
     */
    function payeeCount() external view returns (uint256);
    
    /**
     * @notice Release payment to specified account
     */
    function release(address account) external;
    
    /**
     * @notice Receive ETH - automatically handled by SplitStream
     */
    receive() external payable;
}

// ============================================================================
// PATTERN 1: REVENUE SHARER
// ============================================================================

/**
 * @title RevenueSharer
 * @notice Accepts payments from customers and automatically forwards to SplitStream
 * 
 * Use Case: Service/product that generates revenue to be split among team
 * 
 * Example: SaaS subscription service where revenue is split 40/30/30 among founders
 * 
 * Gas Optimization: Forwards immediately vs batching (trade-off based on usage)
 */
contract RevenueSharer {
    /// @notice SplitStream contract address
    ISplitStream public immutable splitStream;
    
    /// @notice Total revenue processed through this contract
    uint256 public totalRevenueProcessed;
    
    /// @notice Minimum payment amount (prevents dust attacks)
    uint256 public constant MINIMUM_PAYMENT = 0.001 ether;
    
    /// @notice Contract owner (for admin functions)
    address public owner;
    
    // Events
    event RevenueReceived(address indexed from, uint256 amount, string service);
    event RevenueForwarded(address indexed splitStreamAddress, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // Errors
    error PaymentTooSmall();
    error ForwardingFailed();
    error Unauthorized();
    error InvalidSplitStream();
    
    /**
     * @notice Constructor
     * @param _splitStream Address of deployed SplitStream contract
     */
    constructor(address _splitStream) {
        if (_splitStream == address(0)) revert InvalidSplitStream();
        
        // Verify it's a valid SplitStream contract by checking interface
        ISplitStream stream = ISplitStream(_splitStream);
        require(stream.totalShares() > 0, "Invalid SplitStream contract");
        
        splitStream = stream;
        owner = msg.sender;
    }
    
    /**
     * @notice Accept payment for a service/product and forward to SplitStream
     * @param service Description of service/product (for accounting)
     * 
     * @dev Immediately forwards to SplitStream for real-time distribution
     * Alternative: Could batch forwards to save gas if high volume
     */
    function payForService(string calldata service) external payable {
        if (msg.value < MINIMUM_PAYMENT) revert PaymentTooSmall();
        
        emit RevenueReceived(msg.sender, msg.value, service);
        
        // Forward to SplitStream
        _forwardToSplitStream(msg.value);
    }
    
    /**
     * @notice Internal function to forward funds to SplitStream
     * @param amount Amount to forward
     */
    function _forwardToSplitStream(uint256 amount) internal {
        totalRevenueProcessed += amount;
        
        // Forward ETH to SplitStream (triggers receive() function)
        (bool success, ) = address(splitStream).call{value: amount}("");
        if (!success) revert ForwardingFailed();
        
        emit RevenueForwarded(address(splitStream), amount);
    }
    
    /**
     * @notice Fallback to accept any ETH sent directly
     * @dev Forwards to SplitStream automatically
     */
    receive() external payable {
        if (msg.value < MINIMUM_PAYMENT) revert PaymentTooSmall();
        
        emit RevenueReceived(msg.sender, msg.value, "direct-transfer");
        _forwardToSplitStream(msg.value);
    }
    
    /**
     * @notice Get SplitStream distribution info
     * @return totalShares Total shares in SplitStream
     * @return payeeCount Number of payees
     * @return contractBalance Current balance in SplitStream
     */
    function getSplitStreamInfo() external view returns (
        uint256 totalShares,
        uint256 payeeCount,
        uint256 contractBalance
    ) {
        totalShares = splitStream.totalShares();
        payeeCount = splitStream.payeeCount();
        contractBalance = address(splitStream).balance;
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert Unauthorized();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

// ============================================================================
// PATTERN 2: DAO TREASURY
// ============================================================================

/**
 * @title DAOTreasury
 * @notice DAO-controlled treasury that uses SplitStream for fund distribution
 * 
 * Use Case: DAO wants to distribute treasury to contributors based on governance
 * 
 * Example: DAO votes on contributor shares, admin updates SplitStream, funds distributed
 * 
 * Security: Only authorized multisig can trigger releases
 */
contract DAOTreasury {
    /// @notice SplitStream contract for distribution
    ISplitStream public splitStream;
    
    /// @notice DAO governance/multisig address
    address public governance;
    
    /// @notice Treasury balance before SplitStream deployment
    uint256 public legacyBalance;
    
    /// @notice Whether treasury is locked for distribution
    bool public distributionLocked;
    
    // Events
    event TreasuryDeposit(address indexed from, uint256 amount, string purpose);
    event SplitStreamUpdated(address indexed oldSplitStream, address indexed newSplitStream);
    event DistributionTriggered(address indexed by, uint256 amount);
    event DistributionLocked();
    event GovernanceTransferred(address indexed oldGovernance, address indexed newGovernance);
    
    // Errors
    error Unauthorized();
    error DistributionIsLocked();
    error NoSplitStreamConfigured();
    error InvalidAddress();
    
    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }
    
    /**
     * @notice Constructor
     * @param _governance DAO governance/multisig address
     */
    constructor(address _governance) {
        if (_governance == address(0)) revert InvalidAddress();
        governance = _governance;
    }
    
    /**
     * @notice Receive treasury deposits
     */
    receive() external payable {
        emit TreasuryDeposit(msg.sender, msg.value, "general");
    }
    
    /**
     * @notice Deposit with purpose label
     * @param purpose Description of deposit purpose
     */
    function deposit(string calldata purpose) external payable {
        emit TreasuryDeposit(msg.sender, msg.value, purpose);
    }
    
    /**
     * @notice Set SplitStream contract for distributions
     * @param _splitStream Address of SplitStream contract
     * 
     * @dev Governance can update SplitStream if distribution scheme changes
     * Example: DAO votes to change contributor shares
     */
    function setSplitStream(address _splitStream) external onlyGovernance {
        if (distributionLocked) revert DistributionIsLocked();
        if (_splitStream == address(0)) revert InvalidAddress();
        
        // Verify it's a valid SplitStream
        ISplitStream stream = ISplitStream(_splitStream);
        require(stream.totalShares() > 0, "Invalid SplitStream");
        
        address oldSplitStream = address(splitStream);
        splitStream = stream;
        
        emit SplitStreamUpdated(oldSplitStream, _splitStream);
    }
    
    /**
     * @notice Distribute specified amount to SplitStream
     * @param amount Amount to distribute
     * 
     * @dev Partial distributions allow flexibility in treasury management
     */
    function distribute(uint256 amount) external onlyGovernance {
        if (address(splitStream) == address(0)) revert NoSplitStreamConfigured();
        
        require(amount <= address(this).balance, "Insufficient balance");
        
        // Send to SplitStream
        (bool success, ) = address(splitStream).call{value: amount}("");
        require(success, "Distribution failed");
        
        emit DistributionTriggered(msg.sender, amount);
    }
    
    /**
     * @notice Distribute all treasury funds to SplitStream
     */
    function distributeAll() external onlyGovernance {
        if (address(splitStream) == address(0)) revert NoSplitStreamConfigured();
        
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to distribute");
        
        (bool success, ) = address(splitStream).call{value: balance}("");
        require(success, "Distribution failed");
        
        emit DistributionTriggered(msg.sender, balance);
    }
    
    /**
     * @notice Lock distribution (emergency use)
     * @dev Cannot be unlocked - deploy new treasury if needed
     */
    function lockDistribution() external onlyGovernance {
        distributionLocked = true;
        emit DistributionLocked();
    }
    
    /**
     * @notice Transfer governance
     * @param newGovernance New governance address
     */
    function transferGovernance(address newGovernance) external onlyGovernance {
        if (newGovernance == address(0)) revert InvalidAddress();
        emit GovernanceTransferred(governance, newGovernance);
        governance = newGovernance;
    }
    
    /**
     * @notice Get distribution status
     */
    function getStatus() external view returns (
        address currentSplitStream,
        uint256 treasuryBalance,
        uint256 splitStreamBalance,
        bool locked
    ) {
        currentSplitStream = address(splitStream);
        treasuryBalance = address(this).balance;
        splitStreamBalance = currentSplitStream != address(0) 
            ? address(splitStream).balance 
            : 0;
        locked = distributionLocked;
    }
}

// ============================================================================
// PATTERN 3: NFT MARKETPLACE WITH ROYALTY SPLITTING
// ============================================================================

/**
 * @title NFTMarketplace
 * @notice NFT marketplace that automatically splits sales via SplitStream
 * 
 * Use Case: NFT marketplace where artist teams share royalties
 * 
 * Example: Art collective sells NFTs, proceeds split according to contribution
 */
contract NFTMarketplace {
    /// @notice Platform fee (in basis points, 250 = 2.5%)
    uint256 public constant PLATFORM_FEE_BPS = 250;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    /// @notice Platform fee recipient
    address public platformFeeRecipient;
    
    /// @notice Mapping from NFT collection to SplitStream for royalties
    mapping(address => ISplitStream) public collectionRoyaltySplitter;
    
    /// @notice Total sales volume
    uint256 public totalSalesVolume;
    
    // Events
    event NFTSold(
        address indexed collection,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 price,
        uint256 platformFee,
        uint256 royaltyAmount
    );
    event RoyaltySplitterSet(address indexed collection, address indexed splitter);
    
    // Errors
    error InvalidPrice();
    error TransferFailed();
    error InvalidAddress();
    
    constructor(address _platformFeeRecipient) {
        if (_platformFeeRecipient == address(0)) revert InvalidAddress();
        platformFeeRecipient = _platformFeeRecipient;
    }
    
    /**
     * @notice Set royalty splitter for NFT collection
     * @param collection NFT collection address
     * @param splitter SplitStream address for royalty distribution
     * 
     * @dev Could be called by collection owner or during minting
     */
    function setRoyaltySplitter(address collection, address splitter) external {
        // In production, add access control (collection owner, etc.)
        if (splitter != address(0)) {
            ISplitStream stream = ISplitStream(splitter);
            require(stream.totalShares() > 0, "Invalid splitter");
        }
        
        collectionRoyaltySplitter[collection] = ISplitStream(splitter);
        emit RoyaltySplitterSet(collection, splitter);
    }
    
    /**
     * @notice Process NFT sale with automatic royalty splitting
     * @param collection NFT collection address
     * @param tokenId Token ID
     * @param seller Seller address
     * @param royaltyBps Royalty percentage in basis points
     * 
     * @dev Simplified - in production, would integrate with actual NFT transfer
     */
    function buyNFT(
        address collection,
        uint256 tokenId,
        address seller,
        uint256 royaltyBps
    ) external payable {
        if (msg.value == 0) revert InvalidPrice();
        
        uint256 price = msg.value;
        totalSalesVolume += price;
        
        // Calculate platform fee
        uint256 platformFee = (price * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        
        // Calculate royalty
        uint256 royaltyAmount = (price * royaltyBps) / BPS_DENOMINATOR;
        
        // Calculate seller proceeds
        uint256 sellerProceeds = price - platformFee - royaltyAmount;
        
        // Transfer platform fee
        (bool feeSuccess, ) = platformFeeRecipient.call{value: platformFee}("");
        if (!feeSuccess) revert TransferFailed();
        
        // Handle royalty via SplitStream if configured
        ISplitStream splitter = collectionRoyaltySplitter[collection];
        if (address(splitter) != address(0) && royaltyAmount > 0) {
            // Send royalty to SplitStream for automatic distribution
            (bool royaltySuccess, ) = address(splitter).call{value: royaltyAmount}("");
            if (!royaltySuccess) revert TransferFailed();
        } else if (royaltyAmount > 0) {
            // No splitter configured, add to seller proceeds
            sellerProceeds += royaltyAmount;
        }
        
        // Transfer to seller
        (bool sellerSuccess, ) = seller.call{value: sellerProceeds}("");
        if (!sellerSuccess) revert TransferFailed();
        
        emit NFTSold(
            collection,
            tokenId,
            seller,
            msg.sender,
            price,
            platformFee,
            royaltyAmount
        );
    }
}

// ============================================================================
// PATTERN 4: STAKING REWARDS DISTRIBUTOR
// ============================================================================

/**
 * @title StakingRewards
 * @notice Staking contract that distributes rewards via SplitStream
 * 
 * Use Case: Staking pool where rewards are split proportionally among stakers
 * 
 * Example: Users stake tokens, rewards accumulated in SplitStream based on stake weight
 * 
 * Note: This is simplified - production would need:
 * - Stake weight tracking over time
 * - Reward calculation based on duration
 * - Unstaking cooldown periods
 */
contract StakingRewards {
    /// @notice SplitStream for reward distribution
    ISplitStream public rewardSplitter;
    
    /// @notice Admin address
    address public admin;
    
    /// @notice Total staked amount
    uint256 public totalStaked;
    
    /// @notice Mapping of user stakes
    mapping(address => uint256) public stakes;
    
    /// @notice Total rewards distributed
    uint256 public totalRewardsDistributed;
    
    // Events
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsDeposited(uint256 amount);
    event RewardSplitterUpdated(address indexed newSplitter);
    
    // Errors
    error Unauthorized();
    error InsufficientStake();
    error InvalidAmount();
    
    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }
    
    constructor(address _rewardSplitter) {
        require(_rewardSplitter != address(0), "Invalid splitter");
        rewardSplitter = ISplitStream(_rewardSplitter);
        admin = msg.sender;
    }
    
    /**
     * @notice Stake tokens
     * @dev In production, would handle ERC20 token transfers
     */
    function stake() external payable {
        if (msg.value == 0) revert InvalidAmount();
        
        stakes[msg.sender] += msg.value;
        totalStaked += msg.value;
        
        emit Staked(msg.sender, msg.value);
    }
    
    /**
     * @notice Unstake tokens
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external {
        if (stakes[msg.sender] < amount) revert InsufficientStake();
        
        stakes[msg.sender] -= amount;
        totalStaked -= amount;
        
        // Return stake
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Unstaked(msg.sender, amount);
    }
    
    /**
     * @notice Deposit rewards to be distributed via SplitStream
     * @dev Rewards are forwarded to SplitStream for distribution based on shares
     */
    function depositRewards() external payable onlyAdmin {
        if (msg.value == 0) revert InvalidAmount();
        
        totalRewardsDistributed += msg.value;
        
        // Forward to SplitStream
        (bool success, ) = address(rewardSplitter).call{value: msg.value}("");
        require(success, "Reward distribution failed");
        
        emit RewardsDeposited(msg.value);
    }
    
    /**
     * @notice Update reward splitter
     * @param newSplitter New SplitStream address
     * 
     * @dev Would be called when stake weights change and new SplitStream deployed
     */
    function updateRewardSplitter(address newSplitter) external onlyAdmin {
        require(newSplitter != address(0), "Invalid splitter");
        rewardSplitter = ISplitStream(newSplitter);
        emit RewardSplitterUpdated(newSplitter);
    }
    
    /**
     * @notice Get user's share of rewards
     * @param user User address
     */
    function getUserRewardInfo(address user) external view returns (
        uint256 userStake,
        uint256 userShares,
        uint256 releasableRewards
    ) {
        userStake = stakes[user];
        userShares = rewardSplitter.shares(user);
        releasableRewards = rewardSplitter.releasable(user);
    }
}

/**
 * INTEGRATION TEST EXAMPLE
 * 
 * See test/MultiContractIntegration.t.sol for complete tests.
 * 
 * Basic test pattern:
 * 
 * ```solidity
 * function testRevenueSharer() public {
 *     // 1. Deploy SplitStream
 *     address[] memory payees = new address[](2);
 *     payees[0] = alice;
 *     payees[1] = bob;
 *     
 *     uint256[] memory shares = new uint256[](2);
 *     shares[0] = 60;
 *     shares[1] = 40;
 *     
 *     SplitStream splitter = new SplitStream(payees, shares);
 *     
 *     // 2. Deploy RevenueSharer with SplitStream address
 *     RevenueSharer revenueSharer = new RevenueSharer(address(splitter));
 *     
 *     // 3. Customer pays for service
 *     vm.prank(customer);
 *     revenueSharer.payForService{value: 1 ether}("premium-subscription");
 *     
 *     // 4. Verify funds in SplitStream
 *     assertEq(address(splitter).balance, 1 ether);
 *     
 *     // 5. Verify payees can release
 *     vm.prank(alice);
 *     splitter.release(alice);
 *     assertEq(alice.balance, 0.6 ether); // 60% of 1 ETH
 *     
 *     vm.prank(bob);
 *     splitter.release(bob);
 *     assertEq(bob.balance, 0.4 ether); // 40% of 1 ETH
 * }
 * ```
 * 
 * DEPLOYMENT SCRIPT EXAMPLE
 * 
 * ```javascript
 * // scripts/deployIntegration.js
 * async function main() {
 *   // 1. Deploy SplitStream
 *   const SplitStream = await ethers.getContractFactory("SplitStream");
 *   const payees = ["0xAlice", "0xBob"];
 *   const shares = [60, 40];
 *   const splitter = await SplitStream.deploy(payees, shares);
 *   await splitter.waitForDeployment();
 *   
 *   console.log("SplitStream deployed:", await splitter.getAddress());
 *   
 *   // 2. Deploy RevenueSharer
 *   const RevenueSharer = await ethers.getContractFactory("RevenueSharer");
 *   const revenueSharer = await RevenueSharer.deploy(await splitter.getAddress());
 *   await revenueSharer.waitForDeployment();
 *   
 *   console.log("RevenueSharer deployed:", await revenueSharer.getAddress());
 * }
 * ```
 * 
 * GAS OPTIMIZATION NOTES:
 * 
 * 1. Immediate Forwarding vs Batching
 *    - Immediate: Higher gas per tx, real-time distribution
 *    - Batching: Lower gas overall, delayed distribution
 *    - Choose based on use case
 * 
 * 2. Using immutable for SplitStream address
 *    - Saves gas on every read (no SLOAD)
 *    - Trade-off: Can't update address
 * 
 * 3. Event emissions
 *    - Essential for off-chain tracking
 *    - Minimal gas cost vs value provided
 * 
 * SECURITY CHECKLIST:
 * 
 * ✅ Validate SplitStream address in constructor
 * ✅ Use pull-over-push for payments (SplitStream handles this)
 * ✅ Protect against reentrancy (use checks-effects-interactions)
 * ✅ Emit events for all important state changes
 * ✅ Use custom errors for gas efficiency
 * ✅ Implement access control where needed
 * ✅ Test edge cases (zero amounts, invalid addresses, etc.)
 */
