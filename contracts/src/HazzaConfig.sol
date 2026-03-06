// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title HazzaConfig
/// @notice External configuration registry for HazzaRegistryV2.
///         Owner can update any parameter without redeploying the registry.
///         All values are public and verifiable onchain.
contract HazzaConfig is Ownable {
    mapping(bytes32 => uint256) private _values;

    event ConfigUpdated(bytes32 indexed key, uint256 oldValue, uint256 newValue);
    event ConfigBatchUpdated(uint256 count);

    constructor() Ownable(msg.sender) {
        // Pricing (USDC 6 decimals)
        _init("PRICE_3_CHAR",   100e6);   // $100
        _init("PRICE_4_CHAR",   25e6);    // $25
        _init("PRICE_5_PLUS",   5e6);     // $5
        _init("RENEWAL_FEE",    2e6);     // $2/year
        _init("REDEMPTION_FEE", 10e6);    // $10 penalty
        _init("NAMESPACE_PRICE", 0);      // Free to enable
        _init("SUBNAME_PRICE",  1e6);     // $1 per subname

        // Time
        _init("YEAR",              365 days);
        _init("GRACE_PERIOD",     30 days);
        _init("REDEMPTION_PERIOD", 30 days);
        _init("PRICING_WINDOW",   90 days);

        // Name constraints
        _init("MIN_NAME_LENGTH", 3);
        _init("MAX_NAME_LENGTH", 63);

        // Commit-reveal
        _init("MIN_COMMIT_AGE", 60);
        _init("MAX_COMMIT_AGE", 86400);

        // Rate limits — non-members
        _init("DAILY_LIMIT_NONMEMBER_EARLY", 1);
        _init("DAILY_LIMIT_NONMEMBER_LATER", 3);
        _init("TOTAL_LIMIT_NONMEMBER", 10);

        // Rate limits — members
        _init("DAILY_LIMIT_MEMBER_EARLY", 3);
        _init("TOTAL_LIMIT_MEMBER", 30);

        _init("EARLY_PERIOD", 7 days);

        // Discount basis points (10000 = 100%)
        _init("UNLIMITED_PASS_DISCOUNT", 2000);  // 20%
        _init("ENS_IMPORT_DISCOUNT", 5000);       // 50%

        // Progressive pricing multipliers (x1000 for precision)
        _init("PROGRESSIVE_MULT_1", 2500);  // 2.5x for 2nd name in window
        _init("PROGRESSIVE_MULT_2", 5000);  // 5x for 3rd
        _init("PROGRESSIVE_MULT_3", 10000); // 10x for 4th+

        // Relayer commission cap (basis points)
        _init("MAX_RELAYER_COMMISSION", 5000); // 50%
    }

    function _init(string memory key, uint256 value) private {
        _values[keccak256(abi.encodePacked(key))] = value;
    }

    /// @notice Get a config value
    function get(bytes32 key) external view returns (uint256) {
        return _values[key];
    }

    /// @notice Get a config value by string key (convenience)
    function getByName(string calldata key) external view returns (uint256) {
        return _values[keccak256(abi.encodePacked(key))];
    }

    /// @notice Update a single config value
    function set(bytes32 key, uint256 value) external onlyOwner {
        uint256 old = _values[key];
        _values[key] = value;
        emit ConfigUpdated(key, old, value);
    }

    /// @notice Update a config value by string key (convenience)
    function setByName(string calldata key, uint256 value) external onlyOwner {
        bytes32 k = keccak256(abi.encodePacked(key));
        uint256 old = _values[k];
        _values[k] = value;
        emit ConfigUpdated(k, old, value);
    }

    /// @notice Batch update multiple config values
    function setBatch(bytes32[] calldata keys, uint256[] calldata values) external onlyOwner {
        require(keys.length == values.length, "Length mismatch");
        for (uint256 i = 0; i < keys.length; i++) {
            _values[keys[i]] = values[i];
        }
        emit ConfigBatchUpdated(keys.length);
    }

    // Pre-computed keccak256 keys for gas-efficient reads from registry
    // These match what HazzaRegistryV2 uses as constants
    bytes32 public constant K_PRICE_3_CHAR = keccak256("PRICE_3_CHAR");
    bytes32 public constant K_PRICE_4_CHAR = keccak256("PRICE_4_CHAR");
    bytes32 public constant K_PRICE_5_PLUS = keccak256("PRICE_5_PLUS");
    bytes32 public constant K_RENEWAL_FEE = keccak256("RENEWAL_FEE");
    bytes32 public constant K_REDEMPTION_FEE = keccak256("REDEMPTION_FEE");
    bytes32 public constant K_NAMESPACE_PRICE = keccak256("NAMESPACE_PRICE");
    bytes32 public constant K_SUBNAME_PRICE = keccak256("SUBNAME_PRICE");
    bytes32 public constant K_YEAR = keccak256("YEAR");
    bytes32 public constant K_GRACE_PERIOD = keccak256("GRACE_PERIOD");
    bytes32 public constant K_REDEMPTION_PERIOD = keccak256("REDEMPTION_PERIOD");
    bytes32 public constant K_PRICING_WINDOW = keccak256("PRICING_WINDOW");
    bytes32 public constant K_MIN_NAME_LENGTH = keccak256("MIN_NAME_LENGTH");
    bytes32 public constant K_MAX_NAME_LENGTH = keccak256("MAX_NAME_LENGTH");
    bytes32 public constant K_MIN_COMMIT_AGE = keccak256("MIN_COMMIT_AGE");
    bytes32 public constant K_MAX_COMMIT_AGE = keccak256("MAX_COMMIT_AGE");
}
