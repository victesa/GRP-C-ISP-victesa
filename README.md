# Land Registry System

A blockchain-based land registry system implementing secure, transparent, and immutable land ownership transfers using Ethereum smart contracts.

## Overview

This project provides a comprehensive solution for managing land transactions with multi-stage workflows, smart contract integration, and role-based access control. The system ensures transparency and prevents fraud through blockchain technology while maintaining proper legal oversight.

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

### 1. Environment Setup
Before running the application, you need to set up the blockchain environment:

1.  **Download Tools**: Download and install [Ganache](https://trufflesuite.com/ganache/) and the [MetaMask](https://metamask.io/) browser extension.
2.  **Configure Accounts**:
    - Open Ganache and start a workspace.
    - Connect MetaMask to the Ganache network (typically `http://127.0.0.1:7545` with Chain ID `1337`).
    - Import 4 distinct accounts from Ganache into MetaMask using their private keys.
    - For the best testing experience, use these 4 accounts as: Buyer, Seller, Advocate, and Land Official.

### 2. Installation

Clone the repository to your local machine:
```bash
git clone [https://your-repository-url-here.git](https://your-repository-url-here.git) 
```

### 3. Frontend Setup

Navigate to the client folder and install dependencies:
```bash
cd client-side
npm install
npm run dev
```
The application will be available at http://localhost:5174

### 4. Backend Setup

Navigate to the backend folder and set up the Python environment. It is recommended to use a virtual environment:
```bash
cd backend
python -m venv venv
```

Activate the virtual environment: 
- Windows: `venv\Scripts\activate`
- macOS/Linux: `source venv/bin/activate`

Install all dependencies from `requirements.txt`:

```bash
pip install -r requirements.txt
```
Run the Flask server:

```bash
python app.py
```
The backend will now be live.

### 5. Blockchain Setup
1. Open Remix IDE in your browser.
2. In the contracts folder of this repository, locate the smart contract file.
3. Paste the contract code into a new file in Remix IDE.
4. Navigate to the Solidity Compiler tab and select compiler version `0.8.19`.
5. Click "Compile" to compile the smart contract.
6. Ensure Ganache is running on your local machine.
7. Go to the "Deploy & Run Transactions" tab in Remix.
8. Select "Injected Provider - MetaMask" as the environment.
9. Deploy the contract to your local Ganache network.
10. Copy the deployed contract address and update it in your frontend configuration.

### 6. Usage
1. Access the application at `http://localhost:5174`
2. Connect your MetaMask wallet
3. Log in with the appropriate role (Admin, Advocate, Buyer, or Seller)
4. Create and manage land transactions through the multi-stage workflow
5. All transactions are recorded immutably on the Ethereum blockchain

