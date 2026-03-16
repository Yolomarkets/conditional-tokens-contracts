YOLO Markets Conditional Tokens Contracts
=========================================

This repository is the YOLO Markets fork of Gnosis Conditional Tokens.

We use these contracts as the onchain position layer for fully collateralized
conditional markets on Base. The core contract exposes the standard conditional
tokens lifecycle:

* ``prepareCondition``
* ``splitPosition``
* ``mergePositions``
* ``reportPayouts``
* ``redeemPositions``

The main contract lives in ``contracts/ConditionalTokens.sol`` and is deployed
for YOLO Markets on Base mainnet.

Deployment
----------

Base mainnet deployment:

* ``0xF86c1f1c6F397B9DAE7967a139AE77C4519511EC``

Verified source:

* https://basescan.org/address/0xF86c1f1c6F397B9DAE7967a139AE77C4519511EC#code

Development
-----------

Install dependencies::

   yarn install

Compile contracts::

   yarn compile

Run tests::

   yarn test

Show deployed networks recorded in Truffle artifacts::

   yarn networks

Deploy locally against a node on ``localhost:8545``::

   yarn migrate --network local

Deploy to Base mainnet::

   export BASE_RPC_URL="https://mainnet.base.org"
   export BASE_PRIVATE_KEY="0x..."
   export BASE_GAS_PRICE_WEI=6000000
   export BASE_GAS_LIMIT=8000000
   yarn migrate --network base --f 2 --to 2 --reset

Verification
------------

This repo includes a BaseScan verification helper script::

   export BASESCAN_API_KEY="..."
   yarn verify:base --address 0xF86c1f1c6F397B9DAE7967a139AE77C4519511EC

Reference Documentation
-----------------------

The upstream Gnosis documentation is still useful for understanding the core
CTF model and contract semantics:

`→ Online Documentation`_

.. _→ Online Documentation: https://docs.gnosis.io/conditionaltokens/


License
-------

All smart contracts are released under the `LGPL 3.0`_ license.

Security and Liability
~~~~~~~~~~~~~~~~~~~~~~

All contracts are **WITHOUT ANY WARRANTY**; *without even* the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

.. _LGPL 3.0: https://www.gnu.org/licenses/lgpl-3.0.en.html
