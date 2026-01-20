// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISplitStream
 * @notice Interface for SplitStream payment splitter contract
 */
interface ISplitStream {
    /// @notice Emitted when a payment is received
    event PaymentReceived(address indexed from, uint256 amount);
    
    /// @notice Emitted when a payee withdraws their share
    event PaymentReleased(address indexed to, uint256 amount);
    
    /// @notice Returns the total shares
    function totalShares() external view returns (uint256);
    
    /// @notice Returns the shares of a specific payee
    function shares(address payee) external view returns (uint256);
    
    /// @notice Returns the total amount released
    function totalReleased() external view returns (uint256);
    
    /// @notice Returns the amount released to a specific payee
    function released(address payee) external view returns (uint256);
    
    /// @notice Returns payee at given index
    function payee(uint256 index) external view returns (address);
    
    /// @notice Release payment to a specific payee
    function release(address payable account) external;
}
