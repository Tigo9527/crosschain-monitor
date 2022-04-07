// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token20 is ERC20 {
    constructor() ERC20("MyToken", "MTK") {}
    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function getRoleMemberCount(bytes32) public view returns (uint256) {
        return 1;
    }
    address minter;
    function setMinter(address who) public {
        minter = who;
    }
    function getRoleMember(bytes32 ,uint256 ) public view returns (address) {
        return minter;
    }

    struct MS {
        uint256 cap;
        uint256 total;
    }
    function minterSupply(address who) public view returns (MS memory) {
        return MS({cap:0, total:0});
    }
}