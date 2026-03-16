#!/usr/bin/env node
/* global Promise, fetch */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const artifactPath = path.join(
  projectRoot,
  "build",
  "contracts",
  "ConditionalTokens.json"
);
const flattenerPath = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  "truffle-flattener"
);

const ETHERSCAN_API_URL =
  process.env.ETHERSCAN_API_URL || "https://api.etherscan.io/v2/api";
const API_KEY = process.env.BASESCAN_API_KEY || process.env.ETHERSCAN_API_KEY;
const CHAIN_ID = "8453";
const LICENSE_TYPE = process.env.ETHERSCAN_LICENSE_TYPE || "1";
const POLL_INTERVAL_MS = Number(process.env.ETHERSCAN_POLL_INTERVAL_MS || 5000);
const MAX_POLLS = Number(process.env.ETHERSCAN_MAX_POLLS || 30);

function parseArgs(argv) {
  const result = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--address" || arg === "-a") {
      result.address = argv[i + 1];
      i += 1;
    } else if (arg === "--guid" || arg === "-g") {
      result.guid = argv[i + 1];
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    }
  }

  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requireArtifact() {
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Missing artifact at ${artifactPath}. Run truffle compile first.`
    );
  }

  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

function getContractAddress(artifact, cliAddress) {
  if (cliAddress) {
    return cliAddress;
  }

  const networkInfo = artifact.networks && artifact.networks[CHAIN_ID];
  if (networkInfo && networkInfo.address) {
    return networkInfo.address;
  }

  throw new Error(
    "No contract address found. Pass --address 0x... or deploy the contract first."
  );
}

function flattenSource() {
  if (!fs.existsSync(flattenerPath)) {
    throw new Error(
      `Missing flattener at ${flattenerPath}. Install dependencies first.`
    );
  }

  return execFileSync(flattenerPath, ["contracts/ConditionalTokens.sol"], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
}

async function postForm(params) {
  const url = new URL(ETHERSCAN_API_URL);
  const queryParams = Object.assign({}, params);
  delete queryParams.sourceCode;
  delete queryParams.constructorArguments;

  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from Etherscan API`);
  }

  return response.json();
}

async function submitVerification(address, artifact, sourceCode) {
  const metadata = JSON.parse(artifact.metadata);

  return postForm({
    apikey: API_KEY,
    chainid: CHAIN_ID,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode,
    codeformat: "solidity-single-file",
    contractname: artifact.contractName,
    compilerversion: `v${metadata.compiler.version}`,
    optimizationUsed: metadata.settings.optimizer.enabled ? "1" : "0",
    runs: String(metadata.settings.optimizer.runs),
    constructorArguments: "",
    evmVersion: metadata.settings.evmVersion || "default",
    licenseType: LICENSE_TYPE
  });
}

async function checkStatus(guid) {
  return postForm({
    apikey: API_KEY,
    chainid: CHAIN_ID,
    module: "contract",
    action: "checkverifystatus",
    guid
  });
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/verify-basescan.js --address 0xYourContract",
      "  node scripts/verify-basescan.js --guid RECEIPT_GUID",
      "",
      "Environment:",
      "  BASESCAN_API_KEY or ETHERSCAN_API_KEY",
      "  ETHERSCAN_LICENSE_TYPE (optional, default: 1)",
      "  ETHERSCAN_POLL_INTERVAL_MS (optional, default: 5000)",
      "  ETHERSCAN_MAX_POLLS (optional, default: 30)"
    ].join("\n")
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!API_KEY) {
    throw new Error("Missing BASESCAN_API_KEY or ETHERSCAN_API_KEY.");
  }

  if (args.guid) {
    const status = await checkStatus(args.guid);
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  const artifact = requireArtifact();
  const address = getContractAddress(artifact, args.address);
  const sourceCode = flattenSource();

  console.log(`Submitting verification for ${address} on Base...`);
  const submission = await submitVerification(address, artifact, sourceCode);
  console.log(JSON.stringify(submission, null, 2));

  if (submission.status !== "1") {
    return;
  }

  const guid = submission.result;
  for (let attempt = 1; attempt <= MAX_POLLS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);
    const status = await checkStatus(guid);
    console.log(`Poll ${attempt}/${MAX_POLLS}: ${status.result}`);

    if (
      status.result === "Pass - Verified" ||
      status.result === "Already Verified"
    ) {
      return;
    }

    if (
      !String(status.result).includes("Pending in queue") &&
      !String(status.result).includes("In progress")
    ) {
      return;
    }
  }

  console.log(
    `Verification is still pending. Check later with --guid ${guid}.`
  );
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
