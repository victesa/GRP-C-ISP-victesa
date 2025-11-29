export const parseContractError = (error) => {
  // 1. User Rejected (MetaMask)
  if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
    return "Transaction cancelled by user.";
  }

  // 2. Extract the "Reason" string from the contract (Ethers v6)
  let reason = error.reason;

  // Fallback: Check nested structures for blockchain errors
  if (!reason && error.info?.error?.message) {
    reason = error.info.error.message;
  }
  
  // 3. IF IT IS A CONTRACT ERROR: Clean it and Map it
  if (reason) {
    // Remove technical prefixes
    const cleanReason = reason.replace('execution reverted: ', '').trim();

    switch (cleanReason) {
      case "AccessControl: account":
        return "You do not have the required role (Admin/Advocate).";
      case "Token already exists":
        return "This land parcel has already been registered.";
      case "Seller does not own this property":
        return "Verification Failed: The wallet provided for the Seller does not own this Token ID.";
      case "Invalid parties":
        return "The Buyer or Seller wallet address is invalid.";
      case "Property already in transaction":
        return "This property is currently locked in another active transaction.";
      case "Invalid transaction":
        return "Transaction not found or has invalid data.";
      case "Not a participant":
        return "You are not authorized to sign this.";
      case "Not assigned advocate":
        return "Only the advocate assigned to this transaction can upload documents.";
      case "Docs not uploaded":
        return "Cannot proceed: Legal documents have not been uploaded yet.";
      case "Advocate has not uploaded documents":
        return "Admin cannot approve: Advocate documents are missing.";
      case "Buyer/Seller not accepted":
        return "Admin cannot approve: Both Buyer and Seller must accept first.";
      case "ERC721: invalid token ID":
        return "System Error: The Property Token ID does not exist on the blockchain.";
      default:
        return `Contract Error: ${cleanReason}`;
    }
  }

  // 4. *** NEW ***: Handle Standard JavaScript/Backend Errors
  // If we didn't find a blockchain 'reason', but we have a normal 'message'
  if (error.message) {
    // If it's a technical RPC error we don't understand, fall back to generic
    if (error.message.includes("execution reverted") || error.message.includes("JSON-RPC")) {
       return "Transaction failed (Execution Reverted). Check console for details.";
    }
    // Otherwise, it's a simple error from our Backend (e.g. "Property not found")
    return error.message;
  }

  // 5. Ultimate Fallback
  return "An unexpected error occurred. Please check the console.";
};