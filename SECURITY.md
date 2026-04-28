# Security Model

## Client-side encryption

The public demo encrypts validator identity data in the browser using the Web Crypto API. PBKDF2 derives an AES-GCM key from the operator passphrase, and a random salt plus IV are generated locally in the browser.

## No raw private key backend storage

The public application does not send raw validator keypair bytes to a backend and does not store raw key material on the server.

## No passphrase transmission

The passphrase remains inside the browser session and is not transmitted to any backend service.

## Demo mode safety

This project is intentionally designed as a Simulation Mode prototype for public review and bounty judging.

- Demo validators are simulated
- Sample keypair data is non-production demo data
- No claim is made that the public app performs a real mainnet validator migration

## Production recommendation

Any production-grade workflow should use a local agent or operator-controlled SSH runner that executes migration steps inside infrastructure owned or controlled by the validator operator.

## Limitations and non-goals

- No real SSH execution is performed in the public demo
- No real Solana validator identity transfer is performed
- No secret persistence mechanism is provided for production use
- The public app is intended to demonstrate safer flow design, not replace an audited migration system
