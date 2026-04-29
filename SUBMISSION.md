# Solana Validator Identity Transfer Tool

## Product name

Solana Validator Identity Transfer Tool

## Public demo URL

`https://solana-validator-identity-transfer.vercel.app`

## GitHub repo

`https://github.com/trazkul/solana-validator-identity-transfer-tool`

## Demo video URL

`https://drive.google.com/file/d/1KWgHKeY88Q_cqmPqF-kTc-WAlI6cstSy/view?usp=drive_link`

## Target user

Solana validator operators who need to safely move validator identity between servers.

## What problem it solves

The project demonstrates a safer operator workflow for validator identity migration by validating key material locally, encrypting it in the browser, checking transfer prerequisites, simulating orchestration steps, and surfacing edge cases before execution.

## What was implemented

- English-language public web application
- Transfer wizard with source and destination setup
- Solana-style keypair validation for demo input
- Client-side PBKDF2 + AES-GCM encryption
- Simulated preflight checks and dry-run planning
- Simulated transfer execution timeline
- Edge case handling and final operator report
- Security Model and Production Architecture sections
- Exportable production configuration template

## Why simulation mode is used

Simulation Mode is used to avoid asking bounty users to upload real validator private keys or real SSH credentials to a public web application while still demonstrating the full user flow and security posture.

## Future production extension

The intended production path is an operator-controlled local agent or SSH runner that consumes encrypted payloads and executes the migration inside infrastructure controlled by the validator operator.

## License

MIT
