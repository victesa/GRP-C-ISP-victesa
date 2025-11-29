// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// Corrected imports for Remix IDE
import "@openzeppelin/contracts@4.9.3/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts@4.9.3/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts@4.9.3/access/AccessControl.sol";
import "@openzeppelin/contracts@4.9.3/security/ReentrancyGuard.sol";

contract LandRegistry is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard {

    // --- Roles ---
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ADVOCATE_ROLE = keccak256("ADVOCATE_ROLE");

    // --- State ---
    uint256 private _tokenCounter; 

    struct LandTransaction {
        uint256 tokenId; 
        address seller;
        address buyer;
        address advocate;
        string documentHash; 
        bool buyerAccepted;
        bool sellerAccepted;
        bool advocateDocsUploaded;
        bool adminApproved;
    }

    mapping(bytes32 => LandTransaction) public transactions;
    mapping(uint256 => bytes32) public activeTransactionForProperty; // prevent duplicates

    // --- Events ---
    event PropertyRegistered(uint256 indexed tokenId, address indexed owner, string tokenURI);
    event TransactionInitiated(bytes32 indexed transactionId, uint256 indexed tokenId, address indexed seller, address buyer, address advocate);
    event TransactionDocsUploaded(bytes32 indexed transactionId, string documentHash);
    event TransactionPartyAccepted(bytes32 indexed transactionId, address indexed party, string stage);
    event TransactionCompleted(bytes32 indexed transactionId, uint256 indexed tokenId, address indexed newOwner);
    event TransactionCancelled(bytes32 indexed transactionId, uint256 indexed tokenId, address indexed cancelledBy);
    event AdvocateRoleGranted(address indexed advocateAddress);

    // --- Constructor ---
    constructor() ERC721("KenyaLandRegistry", "KLR") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // --- Role Management ---
    function grantAdvocateRole(address advocateAddress) 
        public 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        _grantRole(ADVOCATE_ROLE, advocateAddress);
        emit AdvocateRoleGranted(advocateAddress);
    }

    // --- Property Registration ---
    function registerProperty(address owner, string memory _tokenURI) 
        public 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        _tokenCounter++;
        uint256 tokenId = _tokenCounter;

        require(_ownerOf(tokenId) == address(0), "Token already exists");

        _mint(owner, tokenId);
        _setTokenURI(tokenId, _tokenURI); 
        emit PropertyRegistered(tokenId, owner, _tokenURI);
    }

    // --- Transaction Lifecycle ---

    // Step 1: Advocate initiates transaction
    function initiateTransaction(address seller, address buyer, uint256 tokenId) 
        public 
        onlyRole(ADVOCATE_ROLE) 
        nonReentrant 
    {
        require(ownerOf(tokenId) == seller, "Seller does not own this property");
        require(seller != address(0) && buyer != address(0), "Invalid parties");
        require(activeTransactionForProperty[tokenId] == bytes32(0), "Property already in transaction");

        bytes32 transactionId = keccak256(
            abi.encodePacked(seller, buyer, tokenId, msg.sender, block.prevrandao, block.timestamp)
        );

        transactions[transactionId] = LandTransaction({
            tokenId: tokenId,
            seller: seller,
            buyer: buyer,
            advocate: msg.sender,
            documentHash: "",
            buyerAccepted: false,
            sellerAccepted: false,
            advocateDocsUploaded: false,
            adminApproved: false
        });

        activeTransactionForProperty[tokenId] = transactionId;
        emit TransactionInitiated(transactionId, tokenId, seller, buyer, msg.sender);
    }

    // Step 2: Buyer or seller accept initiation
    function acceptInitiation(bytes32 transactionId) 
        public 
        nonReentrant 
    {
        LandTransaction storage txn = transactions[transactionId];
        require(txn.advocate != address(0), "Invalid transaction");
        require(msg.sender == txn.seller || msg.sender == txn.buyer, "Not a participant");

        if (msg.sender == txn.seller) {
            txn.sellerAccepted = true;
        } else {
            txn.buyerAccepted = true;
        }

        emit TransactionPartyAccepted(transactionId, msg.sender, "InitiationAccepted");
    }

    // Step 3: Advocate uploads documents
    function uploadDocuments(bytes32 transactionId, string memory docHash) 
        public 
        onlyRole(ADVOCATE_ROLE) 
        nonReentrant 
    {
        LandTransaction storage txn = transactions[transactionId];
        require(txn.advocate == msg.sender, "Not assigned advocate");

        txn.documentHash = docHash;
        txn.advocateDocsUploaded = true;
        txn.buyerAccepted = false;
        txn.sellerAccepted = false;

        emit TransactionDocsUploaded(transactionId, docHash);
    }

    // Step 4: Buyer and seller accept uploaded documents
    function acceptDocuments(bytes32 transactionId) 
        public 
        nonReentrant 
    {
        LandTransaction storage txn = transactions[transactionId];
        require(txn.advocateDocsUploaded, "Docs not uploaded");
        require(msg.sender == txn.seller || msg.sender == txn.buyer, "Not a participant");

        if (msg.sender == txn.seller) {
            txn.sellerAccepted = true;
        } else {
            txn.buyerAccepted = true;
        }

        emit TransactionPartyAccepted(transactionId, msg.sender, "DocumentsAccepted");
    }

    // Step 5 & 6: Admin final approval and property transfer
    function finalAdminApproval(bytes32 transactionId) 
        public 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        LandTransaction storage txn = transactions[transactionId];

        require(txn.advocateDocsUploaded, "Advocate has not uploaded documents");
        require(txn.buyerAccepted && txn.sellerAccepted, "Buyer/Seller not accepted");

        txn.adminApproved = true;
        _transfer(txn.seller, txn.buyer, txn.tokenId);

        emit TransactionCompleted(transactionId, txn.tokenId, txn.buyer);

        // cleanup to prevent reuse
        delete activeTransactionForProperty[txn.tokenId];
        delete transactions[transactionId];
    }

    // --- NEW: Cancel Transaction ---
    function cancelTransaction(bytes32 transactionId) 
        public 
        nonReentrant 
    {
        LandTransaction storage txn = transactions[transactionId];
        
        // Only participants or admin can cancel
        require(
            msg.sender == txn.advocate || 
            msg.sender == txn.seller || 
            msg.sender == txn.buyer || 
            hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized to cancel"
        );
        
        require(txn.advocate != address(0), "Invalid transaction");
        require(!txn.adminApproved, "Cannot cancel completed transaction");
        
        uint256 tokenId = txn.tokenId;
        
        // Clear the active transaction for this property
        delete activeTransactionForProperty[tokenId];
        
        // Delete the transaction record
        delete transactions[transactionId];
        
        emit TransactionCancelled(transactionId, tokenId, msg.sender);
    }

    // --- REQUIRED OVERRIDES FOR V4.9.3 ---
    
    function _burn(uint256 tokenId) 
        internal 
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
