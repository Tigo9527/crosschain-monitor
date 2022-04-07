// SPDX-License-Identifier: GPL-3.0-only

pragma solidity 0.8.4;
interface Mintable {
    function mint(address _to, uint256 _amount) external;
}
contract TestCelerBridge {

    event DelayedTransferAdded(bytes32 id);
    event DelayedTransferExecuted(bytes32 id, address receiver, address token, uint256 amount);
    event Mint(
        bytes32 mintId,
        address token,
        address account,
        uint256 amount,
        uint64 refChainId,
        bytes32 refId,
        address depositor
    );

    struct delayedTransfer {
        address receiver;
        address token;
        uint256 amount;
        uint256 timestamp;
    }
    mapping(bytes32 => delayedTransfer) public delayedTransfers;

    function addDelayedTransfer(
        bytes32 id,
        address token,
        address receiver,
        uint256 amount,
        bytes32 refId
    ) public {
        require(delayedTransfers[id].timestamp == 0, "delayed transfer already exists");
        delayedTransfers[id] = delayedTransfer({
        receiver: receiver,
        token: token,
        amount: amount,
        timestamp: block.timestamp
        });
        emit DelayedTransferAdded(id);
        emit Mint(id, token, receiver, amount, 1, refId, receiver);
    }
    function mint(bytes32 id, address token, address account, uint256 amount) public {
        emit DelayedTransferExecuted(id, account, token, amount);
        Mintable(token).mint(account, amount);
    }
}