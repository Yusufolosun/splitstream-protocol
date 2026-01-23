/**
 * SplitStream React Integration Example
 * 
 * This is a complete, production-ready React component demonstrating
 * how to integrate the SplitStream payment splitter contract into your React app.
 * 
 * DEPENDENCIES:
 * ```bash
 * npm install wagmi viem @tanstack/react-query @rainbow-me/rainbowkit
 * npm install react react-dom
 * ```
 * 
 * SETUP INSTRUCTIONS:
 * 
 * 1. Install dependencies (see above)
 * 
 * 2. Wrap your app with providers (in your App.js or _app.js):
 * 
 * ```jsx
 * import '@rainbow-me/rainbowkit/styles.css';
 * import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
 * import { WagmiProvider } from 'wagmi';
 * import { base, baseSepolia } from 'wagmi/chains';
 * import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
 * 
 * const config = getDefaultConfig({
 *   appName: 'SplitStream App',
 *   projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // Get from https://cloud.walletconnect.com
 *   chains: [base, baseSepolia],
 *   ssr: false,
 * });
 * 
 * const queryClient = new QueryClient();
 * 
 * function App() {
 *   return (
 *     <WagmiProvider config={config}>
 *       <QueryClientProvider client={queryClient}>
 *         <RainbowKitProvider>
 *           <SplitStreamDashboard contractAddress="0xYOUR_CONTRACT_ADDRESS" />
 *         </RainbowKitProvider>
 *       </QueryClientProvider>
 *     </WagmiProvider>
 *   );
 * }
 * ```
 * 
 * 3. Create a file `splitstream-abi.json` with the contract ABI
 * 
 * 4. Use the SplitStreamDashboard component in your app
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWatchContractEvent, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatEther, parseAbiItem } from 'viem';

// Import your contract ABI
// You can generate this from: artifacts/contracts/SplitStream.sol/SplitStream.json
import SplitStreamABI from './splitstream-abi.json';

/**
 * Main SplitStream Dashboard Component
 * 
 * @param {string} contractAddress - The deployed SplitStream contract address
 */
export default function SplitStreamDashboard({ contractAddress }) {
    // Wallet connection state
    const { address, isConnected } = useAccount();

    // State for UI
    const [isReleasing, setIsReleasing] = useState(false);
    const [notification, setNotification] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);

    return (
        <div className="splitstream-dashboard">
            {/* Header with wallet connect */}
            <Header />

            {/* Main content - only show if wallet connected */}
            {isConnected ? (
                <>
                    <ContractInfo contractAddress={contractAddress} />
                    <PayeeStatus
                        contractAddress={contractAddress}
                        userAddress={address}
                        onRelease={() => setIsReleasing(true)}
                    />
                    <PaymentHistory
                        contractAddress={contractAddress}
                        events={paymentHistory}
                    />
                    <EventListener
                        contractAddress={contractAddress}
                        onNewEvent={(event) => {
                            setPaymentHistory(prev => [event, ...prev]);
                            showNotification('success', `New ${event.type} event detected!`);
                        }}
                    />
                </>
            ) : (
                <div className="connect-prompt">
                    <h2>Connect Your Wallet</h2>
                    <p>Please connect your wallet to view SplitStream contract details</p>
                </div>
            )}

            {/* Notification system */}
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}
        </div>
    );

    function showNotification(type, message) {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    }
}

/**
 * Header Component with Wallet Connection
 */
function Header() {
    return (
        <header className="header">
            <div className="header-content">
                <h1>💰 SplitStream Dashboard</h1>
                <ConnectButton />
            </div>

            <style jsx>{`
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1.5rem 2rem;
          margin-bottom: 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
        }
        h1 {
          margin: 0;
          font-size: 1.75rem;
        }
      `}</style>
        </header>
    );
}

/**
 * Contract Information Display
 * Shows total shares, contract balance, and total released
 */
function ContractInfo({ contractAddress }) {
    // Read contract data using wagmi hooks
    const { data: totalShares } = useReadContract({
        address: contractAddress,
        abi: SplitStreamABI,
        functionName: 'totalShares',
    });

    const { data: totalReleased } = useReadContract({
        address: contractAddress,
        abi: SplitStreamABI,
        functionName: 'totalReleased',
    });

    const { data: payeeCount } = useReadContract({
        address: contractAddress,
        abi: SplitStreamABI,
        functionName: 'payeeCount',
    });

    // Get contract balance
    const publicClient = usePublicClient();
    const [balance, setBalance] = useState(0n);

    useEffect(() => {
        async function fetchBalance() {
            if (publicClient && contractAddress) {
                const bal = await publicClient.getBalance({ address: contractAddress });
                setBalance(bal);
            }
        }
        fetchBalance();

        // Refresh balance every 10 seconds
        const interval = setInterval(fetchBalance, 10000);
        return () => clearInterval(interval);
    }, [publicClient, contractAddress]);

    // Calculate totals
    const totalReceived = balance + (totalReleased || 0n);

    return (
        <div className="contract-info">
            <h2>📊 Contract Information</h2>

            <div className="info-grid">
                <InfoCard
                    title="Contract Balance"
                    value={`${formatEther(balance || 0n)} ETH`}
                    description="Current ETH in contract"
                    icon="💵"
                />
                <InfoCard
                    title="Total Released"
                    value={`${formatEther(totalReleased || 0n)} ETH`}
                    description="Total ETH distributed"
                    icon="📤"
                />
                <InfoCard
                    title="Total Received"
                    value={`${formatEther(totalReceived || 0n)} ETH`}
                    description="All-time ETH received"
                    icon="📈"
                />
                <InfoCard
                    title="Payees"
                    value={payeeCount?.toString() || '0'}
                    description={`Total shares: ${totalShares?.toString() || '0'}`}
                    icon="👥"
                />
            </div>

            <div className="contract-address">
                <small>Contract: {contractAddress}</small>
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(contractAddress);
                        alert('Contract address copied!');
                    }}
                    className="copy-btn"
                >
                    📋 Copy
                </button>
            </div>

            <style jsx>{`
        .contract-info {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }
        h2 {
          margin-top: 0;
          color: #333;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .contract-address {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #f5f5f5;
          border-radius: 8px;
          font-family: monospace;
        }
        .copy-btn {
          padding: 0.25rem 0.75rem;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
        }
        .copy-btn:hover {
          background: #5568d3;
        }
      `}</style>
        </div>
    );
}

/**
 * Reusable Info Card Component
 */
function InfoCard({ title, value, description, icon }) {
    return (
        <div className="info-card">
            <div className="icon">{icon}</div>
            <div className="content">
                <h3>{title}</h3>
                <div className="value">{value}</div>
                <div className="description">{description}</div>
            </div>

            <style jsx>{`
        .info-card {
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          padding: 1.5rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .icon {
          font-size: 2rem;
        }
        .content h3 {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .value {
          font-size: 1.5rem;
          font-weight: bold;
          color: #333;
          margin-bottom: 0.25rem;
        }
        .description {
          font-size: 0.75rem;
          color: #888;
        }
      `}</style>
        </div>
    );
}

/**
 * Payee Status Component
 * Shows if user is a payee and allows releasing payments
 */
function PayeeStatus({ contractAddress, userAddress, onRelease }) {
    // Check if user is a payee
    const { data: shares } = useReadContract({
        address: contractAddress,
        abi: SplitStreamABI,
        functionName: 'shares',
        args: [userAddress],
    });

    const { data: totalShares } = useReadContract({
        address: contractAddress,
        abi: SplitStreamABI,
        functionName: 'totalShares',
    });

    const { data: releasable, refetch: refetchReleasable } = useReadContract({
        address: contractAddress,
        abi: SplitStreamABI,
        functionName: 'releasable',
        args: [userAddress],
    });

    const { data: released } = useReadContract({
        address: contractAddress,
        abi: SplitStreamABI,
        functionName: 'released',
        args: [userAddress],
    });

    // Contract write hook for releasing payments
    const { writeContract, isPending, isSuccess, isError, error } = useWriteContract();

    // Handle release button click
    const handleRelease = async () => {
        try {
            onRelease?.();

            writeContract({
                address: contractAddress,
                abi: SplitStreamABI,
                functionName: 'release',
                args: [userAddress],
            });
        } catch (err) {
            console.error('Release error:', err);
        }
    };

    // Refetch releasable amount after successful release
    useEffect(() => {
        if (isSuccess) {
            setTimeout(() => refetchReleasable(), 2000);
        }
    }, [isSuccess, refetchReleasable]);

    // Check if user is a payee
    const isPayee = shares && shares > 0n;
    const sharePercentage = shares && totalShares
        ? Number((shares * 100n) / totalShares)
        : 0;

    if (!isPayee) {
        return (
            <div className="payee-status not-payee">
                <h2>❌ Not a Payee</h2>
                <p>Your address is not registered as a payee in this contract.</p>
                <p className="address">Connected as: {userAddress}</p>

                <style jsx>{`
          .payee-status {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
            text-align: center;
          }
          .not-payee {
            border-left: 4px solid #ff6b6b;
          }
          .address {
            font-family: monospace;
            font-size: 0.875rem;
            color: #666;
          }
        `}</style>
            </div>
        );
    }

    return (
        <div className="payee-status is-payee">
            <h2>✅ You are a Payee</h2>

            <div className="stats-grid">
                <div className="stat">
                    <div className="label">Your Shares</div>
                    <div className="value">{shares?.toString()} ({sharePercentage}%)</div>
                </div>
                <div className="stat">
                    <div className="label">Already Released</div>
                    <div className="value">{formatEther(released || 0n)} ETH</div>
                </div>
                <div className="stat highlight">
                    <div className="label">Available to Release</div>
                    <div className="value">{formatEther(releasable || 0n)} ETH</div>
                </div>
            </div>

            {/* Release button */}
            <div className="release-section">
                <button
                    onClick={handleRelease}
                    disabled={!releasable || releasable === 0n || isPending}
                    className="release-btn"
                >
                    {isPending ? '⏳ Releasing...' : '💸 Release Payment'}
                </button>

                {releasable === 0n && (
                    <p className="hint">No payment available to release at the moment.</p>
                )}

                {isSuccess && (
                    <div className="success-message">
                        ✅ Payment released successfully!
                    </div>
                )}

                {isError && (
                    <div className="error-message">
                        ❌ Error: {error?.message?.substring(0, 100)}
                    </div>
                )}
            </div>

            <style jsx>{`
        .payee-status {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }
        .is-payee {
          border-left: 4px solid #51cf66;
        }
        h2 {
          margin-top: 0;
          color: #333;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin: 1.5rem 0;
        }
        .stat {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
          text-align: center;
        }
        .stat.highlight {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .label {
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 0.5rem;
          opacity: 0.8;
        }
        .value {
          font-size: 1.5rem;
          font-weight: bold;
        }
        .release-section {
          text-align: center;
          margin-top: 2rem;
        }
        .release-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 1rem 2rem;
          font-size: 1.125rem;
          font-weight: bold;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .release-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .release-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .hint {
          margin-top: 1rem;
          color: #888;
          font-size: 0.875rem;
        }
        .success-message {
          margin-top: 1rem;
          padding: 1rem;
          background: #d4edda;
          color: #155724;
          border-radius: 4px;
        }
        .error-message {
          margin-top: 1rem;
          padding: 1rem;
          background: #f8d7da;
          color: #721c24;
          border-radius: 4px;
          font-size: 0.875rem;
        }
      `}</style>
        </div>
    );
}

/**
 * Payment History Component
 * Displays all payment events (received and released)
 */
function PaymentHistory({ contractAddress, events }) {
    const publicClient = usePublicClient();
    const [historicalEvents, setHistoricalEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCount, setShowCount] = useState(10);

    // Fetch historical events on mount
    useEffect(() => {
        async function fetchHistory() {
            try {
                setIsLoading(true);

                // Get recent blocks (last 10,000 blocks, adjust as needed)
                const currentBlock = await publicClient.getBlockNumber();
                const fromBlock = currentBlock - 10000n;

                // Fetch PaymentReceived events
                const receivedLogs = await publicClient.getLogs({
                    address: contractAddress,
                    event: parseAbiItem('event PaymentReceived(address indexed from, uint256 amount)'),
                    fromBlock,
                    toBlock: 'latest',
                });

                // Fetch PaymentReleased events
                const releasedLogs = await publicClient.getLogs({
                    address: contractAddress,
                    event: parseAbiItem('event PaymentReleased(address indexed to, uint256 amount)'),
                    fromBlock,
                    toBlock: 'latest',
                });

                // Combine and format events
                const allEvents = [
                    ...receivedLogs.map(log => ({
                        type: 'received',
                        address: log.args.from,
                        amount: log.args.amount,
                        blockNumber: log.blockNumber,
                        txHash: log.transactionHash,
                    })),
                    ...releasedLogs.map(log => ({
                        type: 'released',
                        address: log.args.to,
                        amount: log.args.amount,
                        blockNumber: log.blockNumber,
                        txHash: log.transactionHash,
                    })),
                ];

                // Sort by block number (most recent first)
                allEvents.sort((a, b) => Number(b.blockNumber - a.blockNumber));

                setHistoricalEvents(allEvents);
            } catch (error) {
                console.error('Error fetching history:', error);
            } finally {
                setIsLoading(false);
            }
        }

        if (publicClient && contractAddress) {
            fetchHistory();
        }
    }, [publicClient, contractAddress]);

    // Combine historical and live events
    const allEvents = [...events, ...historicalEvents];
    const displayedEvents = allEvents.slice(0, showCount);

    return (
        <div className="payment-history">
            <h2>📜 Payment History</h2>

            {isLoading ? (
                <div className="loading">Loading history...</div>
            ) : allEvents.length === 0 ? (
                <div className="no-events">No payment events yet.</div>
            ) : (
                <>
                    <div className="events-list">
                        {displayedEvents.map((event, index) => (
                            <EventItem key={`${event.txHash}-${index}`} event={event} />
                        ))}
                    </div>

                    {showCount < allEvents.length && (
                        <button
                            onClick={() => setShowCount(prev => prev + 10)}
                            className="load-more"
                        >
                            Load More ({allEvents.length - showCount} remaining)
                        </button>
                    )}
                </>
            )}

            <style jsx>{`
        .payment-history {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }
        h2 {
          margin-top: 0;
          color: #333;
        }
        .loading, .no-events {
          text-align: center;
          padding: 2rem;
          color: #888;
        }
        .events-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .load-more {
          width: 100%;
          margin-top: 1rem;
          padding: 0.75rem;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          cursor: pointer;
          color: #495057;
        }
        .load-more:hover {
          background: #e9ecef;
        }
      `}</style>
        </div>
    );
}

/**
 * Individual Event Item
 */
function EventItem({ event }) {
    const isReceived = event.type === 'received';

    return (
        <div className={`event-item ${event.type}`}>
            <div className="event-icon">
                {isReceived ? '📥' : '📤'}
            </div>
            <div className="event-details">
                <div className="event-type">
                    {isReceived ? 'Payment Received' : 'Payment Released'}
                </div>
                <div className="event-address">
                    {isReceived ? 'From' : 'To'}: {formatAddress(event.address)}
                </div>
            </div>
            <div className="event-amount">
                {formatEther(event.amount)} ETH
            </div>
            <div className="event-link">
                <a
                    href={`https://basescan.org/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    🔗
                </a>
            </div>

            <style jsx>{`
        .event-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #ccc;
        }
        .event-item.received {
          border-left-color: #51cf66;
        }
        .event-item.released {
          border-left-color: #667eea;
        }
        .event-icon {
          font-size: 1.5rem;
        }
        .event-details {
          flex: 1;
        }
        .event-type {
          font-weight: bold;
          color: #333;
          margin-bottom: 0.25rem;
        }
        .event-address {
          font-size: 0.875rem;
          color: #666;
          font-family: monospace;
        }
        .event-amount {
          font-weight: bold;
          color: #667eea;
          font-size: 1.125rem;
        }
        .event-link a {
          text-decoration: none;
          font-size: 1.25rem;
        }
      `}</style>
        </div>
    );
}

/**
 * Real-time Event Listener
 * Watches for new contract events and notifies parent
 */
function EventListener({ contractAddress, onNewEvent }) {
    // Watch for PaymentReceived events
    useWatchContractEvent({
        address: contractAddress,
        abi: SplitStreamABI,
        eventName: 'PaymentReceived',
        onLogs(logs) {
            logs.forEach(log => {
                onNewEvent?.({
                    type: 'received',
                    address: log.args.from,
                    amount: log.args.amount,
                    blockNumber: log.blockNumber,
                    txHash: log.transactionHash,
                });
            });
        },
    });

    // Watch for PaymentReleased events
    useWatchContractEvent({
        address: contractAddress,
        abi: SplitStreamABI,
        eventName: 'PaymentReleased',
        onLogs(logs) {
            logs.forEach(log => {
                onNewEvent?.({
                    type: 'released',
                    address: log.args.to,
                    amount: log.args.amount,
                    blockNumber: log.blockNumber,
                    txHash: log.transactionHash,
                });
            });
        },
    });

    // This component doesn't render anything
    return null;
}

/**
 * Notification Component
 * Shows success/error messages
 */
function Notification({ type, message, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`notification ${type}`}>
            <span>{message}</span>
            <button onClick={onClose} className="close-btn">×</button>

            <style jsx>{`
        .notification {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          gap: 1rem;
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
        }
        .notification.success {
          background: #d4edda;
          color: #155724;
          border-left: 4px solid #28a745;
        }
        .notification.error {
          background: #f8d7da;
          color: #721c24;
          border-left: 4px solid #dc3545;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: inherit;
          opacity: 0.7;
        }
        .close-btn:hover {
          opacity: 1;
        }
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
        </div>
    );
}

/**
 * Helper function to format addresses
 */
function formatAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * EXAMPLE: Using this component in your app
 * 
 * ```jsx
 * import SplitStreamDashboard from './components/SplitStreamDashboard';
 * 
 * function MyApp() {
 *   const CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890";
 *   
 *   return (
 *     <div className="app">
 *       <SplitStreamDashboard contractAddress={CONTRACT_ADDRESS} />
 *     </div>
 *   );
 * }
 * ```
 * 
 * STYLING:
 * 
 * This component uses inline JSX styles for portability. For production,
 * consider moving styles to a CSS module or styled-components.
 * 
 * CUSTOMIZATION:
 * 
 * - Change colors in gradient backgrounds
 * - Adjust grid layouts for your design
 * - Add more contract functions (e.g., view all payees)
 * - Implement sorting/filtering for payment history
 * - Add charts/graphs for payment analytics
 * 
 * SECURITY NOTES:
 * 
 * - Always validate user inputs
 * - Use HTTPS for RPC connections
 * - Never expose private keys in frontend code
 * - Implement proper error handling for all contract calls
 * - Consider rate limiting for API calls
 */
