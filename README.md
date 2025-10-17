# Transaction Branch - Land Registry System

This branch implements the transaction stages and smart contract functionality for the blockchain-based land registry system.

## Overview

The transaction branch builds upon the authentication module to add comprehensive transaction management and multi-stage land transfer workflows. This implementation utilizes Ethereum smart contracts to ensure secure, transparent, and immutable land ownership transfers.

## Features Implemented

### Transaction Stages
- **Stage 1: Transaction Creation** - Initiate land transfer requests between buyers and sellers
- **Stage 2: Document Sharing** - Upload and share required legal documents
- **Stage 3: Verification** - Advocate/legal representative verification of documents
- **Stage 4: Under Review** - Administrative review of transaction details
- **Stage 5: Multi-Signature** - Cryptographic approval from all parties
- **Stage 6: Finalized** - Completed transaction recorded on blockchain

### Smart Contract Integration
- Ethereum-based smart contracts for land ownership records
- MetaMask wallet integration for transaction signing
- Immutable transaction history on the blockchain
- Automated ownership transfer upon completion

### User Roles
- **Admin**: Review and approve transactions, manage system operations
- **Advocate**: Verify legal documents and provide legal oversight
- **Buyer/Seller**: Initiate and participate in land transfer transactions

## Files Included

### Backend
- `backend/app.py` - Flask API endpoints for transaction management
- `backend/requirements.txt` - Python dependencies

### Frontend Components
#### Transaction Pages
- `AdminTransactionDetailPage.jsx` - Admin transaction review interface
- `AdminTransactionRequests.jsx` - Admin transaction queue
- `AdvocateTransactionDetailPage.jsx` - Advocate transaction view
- `AdvocateTransactionPage.jsx` - Advocate dashboard
- `TransactionDetailPage.jsx` - General transaction details
- `TransactionsPage.jsx` - User transaction listing
- `UserTransactionList.jsx` - User-specific transactions
- `UserTransactionSummary.jsx` - Transaction summary view

#### Transaction Components
- `ActiveTransactions.jsx` - Display active transactions
- `AdvocateActiveTransactions.jsx` - Advocate's active cases
- `CreateTransaction.jsx` - Transaction creation form
- `TransactionDetails.jsx` - Detailed transaction information
- `TransactionSummary.jsx` - Transaction overview card

#### Stage Components
- `StageDocsShared.jsx` - Document sharing stage
- `StageVerified.jsx` - Verification confirmation stage
- `StageUnderReview.jsx` - Administrative review stage
- `StageMultiSignature.jsx` - Multi-party signature stage
- `StageFinalized.jsx` - Completion stage
- `StageWaitingForDocs.jsx` - Pending documents stage
- `AdminStageUnderReview.jsx` - Admin review interface
- `AdvocateStageAwaitingVerification.jsx` - Advocate verification stage
- `AdvocateStageDocsShared.jsx` - Advocate document review

## Technology Stack
- **Frontend**: React.js
- **Backend**: Python Flask
- **Blockchain**: Ethereum, Solidity smart contracts
- **Wallet**: MetaMask integration
- **Development**: Ganache, Remix IDE

## Prerequisites
- Node.js and npm
- Python 3.x
- MetaMask browser extension
- Ganache (for local blockchain testing)

## Getting Started

### Installation
