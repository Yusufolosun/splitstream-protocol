// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./ISplitStream.sol";

/**
 * @title SplitStream
 * @dev Implementation of a payment splitter contract that allows splitting incoming ETH
 * payments among multiple payees according to their assigned shares.
 * 
 * This contract follows the pull payment pattern where payees must call release()
 * to withdraw their share of the accumulated funds.
 */
contract SplitStream is Context, ISplitStream {
    using Address for address payable;

    /// @dev Total number of shares across all payees
    uint256 private _totalShares;
    
    /// @dev Total amount of ETH that has been released to payees
    uint256 private _totalReleased;
    
    /// @dev Mapping from payee address to their number of shares
    mapping(address => uint256) private _shares;
    
    /// @dev Mapping from payee address to the amount of ETH they have already released
    mapping(address => uint256) private _released;
    
    /// @dev Array of all payee addresses
    address[] private _payees;

    /**
     * @dev Creates an instance of SplitStream where each account in `payees` is assigned
     * the number of shares at the matching position in the `shares_` array.
     * 
     * All addresses in `payees` must be non-zero and all values in `shares_` must be non-zero.
     * Each address can only appear once in the `payees` array.
     * 
     * @param payees Array of addresses that will receive payments
     * @param shares_ Array of share amounts corresponding to each payee
     * 
     * Requirements:
     * - `payees` and `shares_` must have the same non-zero length
     * - All addresses in `payees` must be non-zero
     * - All values in `shares_` must be non-zero
     * - No duplicate addresses in `payees`
     */
    constructor(address[] memory payees, uint256[] memory shares_) payable {
        require(payees.length == shares_.length, "SplitStream: payees and shares length mismatch");
        require(payees.length > 0, "SplitStream: no payees");

        for (uint256 i = 0; i < payees.length; i++) {
            _addPayee(payees[i], shares_[i]);
        }
    }

    /**
     * @dev Adds a new payee to the contract.
     * @param account The address of the payee to add
     * @param shares_ The number of shares owned by the payee
     * 
     * Requirements:
     * - `account` cannot be the zero address
     * - `shares_` must be greater than 0
     * - `account` must not already be a payee
     */
    function _addPayee(address account, uint256 shares_) private {
        require(account != address(0), "SplitStream: account is the zero address");
        require(shares_ > 0, "SplitStream: shares are 0");
        require(_shares[account] == 0, "SplitStream: account already has shares");

        _payees.push(account);
        _shares[account] = shares_;
        _totalShares += shares_;
    }

    /**
     * @dev Getter for the total shares held by payees.
     * @return The total number of shares
     */
    function totalShares() public view override returns (uint256) {
        return _totalShares;
    }

    /**
     * @dev Getter for the number of shares held by an account.
     * @param payee The address of the payee
     * @return The number of shares held by the payee
     */
    function shares(address payee) public view override returns (uint256) {
        return _shares[payee];
    }

    /**
     * @dev Getter for the total amount of ETH already released.
     * @return The total amount of ETH released to all payees
     */
    function totalReleased() public view override returns (uint256) {
        return _totalReleased;
    }

    /**
     * @dev Getter for the amount of ETH already released to a payee.
     * @param payee The address of the payee
     * @return The amount of ETH already released to the payee
     */
    function released(address payee) public view override returns (uint256) {
        return _released[payee];
    }

    /**
     * @dev Getter for the address of a payee by index.
     * @param index The index of the payee in the payees array
     * @return The address of the payee at the given index
     */
    function payee(uint256 index) public view override returns (address) {
        return _payees[index];
    }

    /**
     * @dev Triggers a transfer to `account` of the amount of ETH they are owed,
     * according to their percentage of the total shares and their previous withdrawals.
     * 
     * The payment is calculated based on the payee's share of the total accumulated
     * funds (current balance + already released funds) minus what they have already
     * withdrawn.
     * 
     * @param account The address of the payee to release payment to
     * 
     * Requirements:
     * - `account` must be due a payment (payment amount must be greater than 0)
     * 
     * Emits a {PaymentReleased} event.
     */
    function release(address payable account) public override {
        require(_shares[account] > 0, "SplitStream: account has no shares");

        uint256 totalReceived = address(this).balance + _totalReleased;
        uint256 payment = (totalReceived * _shares[account]) / _totalShares - _released[account];

        require(payment > 0, "SplitStream: account is not due payment");

        _released[account] += payment;
        _totalReleased += payment;

        account.sendValue(payment);
        emit PaymentReleased(account, payment);
    }

    /**
     * @dev Receive function to accept incoming ETH payments.
     * 
     * Emits a {PaymentReceived} event when ETH is received.
     */
    receive() external payable {
        emit PaymentReceived(_msgSender(), msg.value);
    }
}
