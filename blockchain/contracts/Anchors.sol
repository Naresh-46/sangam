// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract Anchors {
    address public immutable anchorer;
    mapping(bytes32 => uint256) public anchoredAt;

    event EventHashAnchored(bytes32 indexed eventHash, uint256 timestamp);

    constructor() {
        anchorer = msg.sender;
    }

    modifier onlyAnchorer() {
        require(msg.sender == anchorer, "Only the anchorer can submit hashes");
        _;
    }

    function anchor(bytes32 eventHash) external onlyAnchorer {
        require(eventHash != bytes32(0), "Event hash cannot be empty");
        require(anchoredAt[eventHash] == 0, "Event hash already anchored");

        anchoredAt[eventHash] = block.timestamp;
        emit EventHashAnchored(eventHash, block.timestamp);
    }

    function verify(bytes32 eventHash) external view returns (bool) {
        return anchoredAt[eventHash] != 0;
    }
}
