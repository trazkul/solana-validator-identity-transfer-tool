# Solana Validator Identity Transfer Tool

## Overview

Solana Validator Identity Transfer Tool is a public demo web application that shows how a validator operator could safely coordinate a validator identity migration between two servers.

This public demo runs in Simulation Mode to avoid asking users to upload real validator private keys or SSH credentials to a public bounty application.

The project is designed for the Superteam Ukraine bounty and is intended to demonstrate a credible, secure, and reviewable operator workflow rather than claim real validator migration capability in a public environment.

## Public links

- Public demo URL: `https://your-vercel-demo-url.vercel.app`
- GitHub repository: `https://github.com/your-org/solana-validator-identity-transfer-tool`
- Demo video URL: `https://your-demo-video-url`

## Target user

Solana validator operators who need to safely move validator identity between servers.

## Features

- Interactive transfer wizard covering source setup, destination setup, key handling, preflight checks, dry-run planning, execution, and verification
- Client-side keypair validation for Solana-style `validator-keypair.json` data
- Client-side encryption using PBKDF2 and AES-GCM through the Web Crypto API
- Simulation Mode edge cases including invalid keypair, destination not synced, missing tower file, duplicate identity detection, and transfer failure
- Production configuration export for future operator-controlled workflows
- Security Model and Production Architecture sections for bounty reviewers and operators

## Demo mode

The public interface is intentionally a simulation-first prototype.

- Demo validators are simulated and not connected to real infrastructure
- Raw validator identity is never sent to a backend
- Passphrases stay in browser memory only
- The execution timeline represents operator workflow logic, not a live mainnet migration
- The public app does not perform a real mainnet or testnet validator identity transfer

## Security model

- Raw validator identity key is never sent to the backend
- Encryption happens in the browser using Web Crypto API
- The passphrase never leaves the browser
- Only the encrypted payload is retained in application state
- The demo avoids localStorage persistence for raw key material

See also [SECURITY.md](</Users/mg/Solana Validator Identity Transfer Tool/SECURITY.md>).

## Core flow

The demo covers the following end-to-end flow:

- Source validator setup
- Destination validator setup
- Demo keypair upload or sample keypair generation
- Client-side encryption with PBKDF2 + AES-GCM
- Preflight checks
- Dry-run transfer confirmation
- Simulated transfer execution
- Final verification and operator result report
- Edge case handling

## Edge cases

The public demo includes dedicated Simulation Mode scenarios for:

- Successful transfer
- Destination not synced
- Missing tower file
- Duplicate identity detected
- Invalid keypair
- Transfer failure

## How to run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## How to build

```bash
npm run build
```

## How to deploy to Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Keep the default Next.js build settings.
4. Deploy without adding a backend secret for key handling, because the demo keeps raw key operations client-side.

## Limitations

- This public demo does not perform a real Solana validator migration
- No real SSH sessions, tower file operations, or validator restarts are executed
- The app is not a replacement for production-grade operator automation
- The sample keypair is demonstration data only
- The public deployment should be treated as a simulation artifact for review, not as a production transfer runner

## Future production mode

The production extension should use an operator-controlled local agent or SSH runner that receives only encrypted payloads and executes migration steps inside infrastructure controlled by the validator operator.

## Submission notes

- All user-facing materials are in English
- The app is designed for Vercel deployment
- Simulation Mode is used for safety, reviewability, and honest scope communication in the bounty submission

See also [SUBMISSION.md](</Users/mg/Solana Validator Identity Transfer Tool/SUBMISSION.md>).

## License

This project is released under the MIT License. See [LICENSE](</Users/mg/Solana Validator Identity Transfer Tool/LICENSE>).
