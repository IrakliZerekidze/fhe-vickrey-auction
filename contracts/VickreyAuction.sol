// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool, eaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
contract VickreyAuction is ZamaEthereumConfig {

    address public immutable beneficiary;
    uint256 public immutable endTime;

    euint64 private _highestBid;
    euint64 private _secondHighestBid;
    eaddress private _encryptedWinner;

    mapping(address => euint64) private _bids;
    address[] private _bidderList;
    mapping(address => bool) private _hasBid;

    bool public settled;
    eaddress public encryptedWinner;
    euint64 public encryptedWinnerPrice;

    event BidPlaced(address indexed bidder, uint256 totalBidders);
    event AuctionSettled();

    error AuctionNotEnded();
    error AuctionEnded();
    error AlreadySettled();
    error NoBids();

    constructor(address _beneficiary, uint256 _duration) {
        beneficiary = _beneficiary;
        endTime = block.timestamp + _duration;
    }

    function bid(externalEuint64 encryptedBid, bytes calldata inputProof) external {
        if (block.timestamp >= endTime) revert AuctionEnded();

        euint64 newBid = FHE.fromExternal(encryptedBid, inputProof);

        if (!_hasBid[msg.sender]) {
            _hasBid[msg.sender] = true;
            _bidderList.push(msg.sender);
        }

        FHE.allowThis(newBid);
        FHE.allow(newBid, msg.sender);
        _bids[msg.sender] = newBid;

        if (!FHE.isInitialized(_highestBid)) {
            _highestBid = newBid;
            _encryptedWinner = FHE.asEaddress(msg.sender);
            FHE.allowThis(_highestBid);
            FHE.allowThis(_encryptedWinner);
        } else {
            ebool isNewHighest = FHE.gt(newBid, _highestBid);

            euint64 newSecond = FHE.select(
                isNewHighest,
                _highestBid,
                FHE.select(FHE.gt(newBid, _secondHighestBid), newBid, _secondHighestBid)
            );
            euint64 newHighest = FHE.select(isNewHighest, newBid, _highestBid);
            eaddress newWinner = FHE.select(isNewHighest, FHE.asEaddress(msg.sender), _encryptedWinner);

            _secondHighestBid = newSecond;
            _highestBid = newHighest;
            _encryptedWinner = newWinner;

            FHE.allowThis(_highestBid);
            FHE.allowThis(_secondHighestBid);
            FHE.allowThis(_encryptedWinner);
        }

        emit BidPlaced(msg.sender, _bidderList.length);
    }

    function settle() external {
        if (block.timestamp < endTime) revert AuctionNotEnded();
        if (settled) revert AlreadySettled();
        if (_bidderList.length == 0) revert NoBids();

        settled = true;

        encryptedWinner = _encryptedWinner;
        FHE.makePubliclyDecryptable(_encryptedWinner);

        encryptedWinnerPrice = _secondHighestBid;
        if (FHE.isInitialized(_secondHighestBid)) {
            FHE.makePubliclyDecryptable(_secondHighestBid);
        }

        emit AuctionSettled();
    }

    function bidderCount() external view returns (uint256) { return _bidderList.length; }
    function hasBid(address bidder) external view returns (bool) { return _hasBid[bidder]; }
    function timeRemaining() external view returns (uint256) {
        if (block.timestamp >= endTime) return 0;
        return endTime - block.timestamp;
    }
    function getMyBid() external view returns (euint64) { return _bids[msg.sender]; }
    function getEncryptedWinner() external view returns (eaddress) { return encryptedWinner; }
    function getEncryptedWinnerPrice() external view returns (euint64) { return encryptedWinnerPrice; }
}
