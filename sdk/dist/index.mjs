// src/crypto/commitments.ts
import { randomBytes } from "@noble/hashes/utils";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex } from "@noble/hashes/utils";
var PedersenCommitment = class {
  /**
   * Create a simplified hash-based commitment for Solidity compatibility
   * C = keccak256(amount, randomness)
   * This is used for on-chain verification where EC operations are expensive
   */
  commitSimple(amount, randomness) {
    const r = randomness || randomBytes(32);
    const amountBytes = new Uint8Array(32);
    const amountBigInt = BigInt(amount);
    for (let i = 0; i < 32; i++) {
      amountBytes[31 - i] = Number(amountBigInt >> BigInt(i * 8) & BigInt(255));
    }
    const combined = new Uint8Array(64);
    combined.set(amountBytes, 0);
    combined.set(r, 32);
    const commitment = keccak_256(combined);
    return {
      commitment,
      commitmentHex: "0x" + bytesToHex(commitment),
      amount,
      randomness: r,
      randomnessHex: "0x" + bytesToHex(r)
    };
  }
  /**
   * Verify a simplified commitment opening
   */
  verifySimple(commitment, amount, randomness) {
    const recomputed = this.commitSimple(amount, randomness);
    return bytesToHex(commitment) === bytesToHex(recomputed.commitment);
  }
};
var NettingEngine = class {
  constructor() {
    this.pedersen = new PedersenCommitment();
  }
  /**
   * Compute net position from revealed intents
   * @param sellIntents Array of sell amounts
   * @param buyIntents Array of buy amounts
   * @returns Net position and efficiency metrics
   */
  computeNetPosition(sellIntents, buyIntents) {
    const totalSell = sellIntents.reduce((sum, amount) => sum + amount, 0n);
    const totalBuy = buyIntents.reduce((sum, amount) => sum + amount, 0n);
    const residual = totalSell > totalBuy ? totalSell - totalBuy : totalBuy - totalSell;
    const direction = totalSell > totalBuy ? "SELL" : "BUY";
    const totalVolume = totalSell + totalBuy;
    const nettedVolume = totalVolume - residual;
    const efficiency = totalVolume > 0n ? Number(nettedVolume * 10000n / totalVolume) / 100 : 0;
    return {
      totalSell,
      totalBuy,
      residual,
      direction,
      efficiency,
      nettedVolume,
      totalVolume
    };
  }
};

// src/network/yellow.ts
import { ethers } from "ethers";
var YellowAPIClient = class {
  constructor(privateKey, rpcUrl, apiUrl = "http://localhost:3000/api") {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.baseUrl = apiUrl;
  }
  async authenticate() {
    const response = await fetch(`${this.baseUrl}/yellow/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddress: this.wallet.address,
        chainId: await this.wallet.provider.getNetwork().then((n) => Number(n.chainId))
      })
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Authentication failed");
    }
    return { session: data.session?.id || data.intentId };
  }
  async createChannel(sessionId) {
    const response = await fetch(`${this.baseUrl}/yellow/create-channel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intentId: sessionId })
    });
    const data = await response.json();
    return { channelId: data.channelId || sessionId };
  }
  async sendCommitment(channelId, commitment) {
    return { success: true };
  }
};

// src/client/tint.ts
import { ethers as ethers2 } from "ethers";

// src/agent/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
var TintAgent = class {
  constructor(config) {
    this.genai = new GoogleGenerativeAI(config.apiKey);
    this.model = this.genai.getGenerativeModel({
      model: config.model || "gemini-robotics-er-1.5-preview"
    });
  }
  /**
   * Parse natural language into structured intents
   */
  async parseIntent(prompt, network = "ethereum") {
    try {
      const systemInstruction = `
You are an Intent Parsing Agent. Convert the user prompt into a list of Intent Actions.
Response Format: JSON object with key "intents" which is an array.

Intent Types:
1. SWAP: { "type": "SWAP", "fromToken": "sym", "toToken": "sym", "amount": number, "network": "chain" }
2. PAYMENT: { "type": "PAYMENT", "amount": number, "fromChain": "chain", "toChain": "chain", "recipient": "address" }

Rules:
- If prompt implies sequence (e.g. "swap then bridge"), generate multiple items.
- "fromChain" and "toChain" are critical for cross-chain.
- For PAYMENT: Default recipient: "0x000000000000000000000000000000000000dEaD"
- For SWAP: Do NOT include "recipient" field unless explicitly stated.
- Default network: "${network}"
`;
      const chat = this.model.startChat({
        history: [{ role: "user", parts: [{ text: "System Instruction: " + systemInstruction }] }]
      });
      const result = await chat.sendMessage(prompt);
      const text = result.response.text();
      const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedData = JSON.parse(cleanText);
      const intents = Array.isArray(parsedData.intents) ? parsedData.intents : [parsedData];
      return intents.map((intent) => ({
        ...intent,
        network: intent.network || network
      }));
    } catch (error) {
      if (!error.message.includes("429")) {
        console.warn("Gemini Agent Error (Falling back to Regex):", error.message);
      }
      return this.parseIntentFallback(prompt, network);
    }
  }
  /**
   * Regex fallback parser (no AI needed)
   */
  parseIntentFallback(prompt, network) {
    const p = prompt.toLowerCase();
    const rawSegments = p.split(/\s+(?:and|then)\s+|\.\s+|\s+\+\s+/);
    const intents = rawSegments.map((segment) => {
      const seg = segment.trim();
      if (!seg) return null;
      const intentData = { network: network || "ethereum" };
      if (seg.includes("pay") || seg.includes("send") || seg.includes("bridge")) {
        intentData.type = "PAYMENT";
        intentData.amount = parseFloat(seg.match(/(\d+(\.\d+)?)/)?.[0] || "1");
        const networks = ["base", "arbitrum", "optimism", "polygon", "ethereum"];
        const fromMatch = seg.match(/from\s+(\w+)/);
        if (fromMatch && networks.includes(fromMatch[1])) {
          intentData.network = fromMatch[1];
          intentData.fromChain = fromMatch[1];
        } else {
          for (const net of networks) {
            if (seg.includes(net)) intentData.network = net;
          }
          intentData.fromChain = intentData.network;
        }
        for (const net of networks) {
          if (seg.includes(`to ${net}`)) {
            intentData.toChain = net;
            break;
          }
        }
        if (!intentData.toChain) intentData.toChain = intentData.fromChain;
        const addr = seg.match(/0x[a-fA-F0-9]{40}/);
        intentData.recipient = addr ? addr[0] : "0x000000000000000000000000000000000000dEaD";
      } else {
        intentData.type = "SWAP";
        intentData.amount = parseFloat(seg.match(/(\d+(\.\d+)?)/)?.[0] || "1");
        if (seg.includes("usdc") && !seg.includes("to usdc")) {
          intentData.fromToken = "USDC";
          intentData.toToken = seg.includes("weth") ? "WETH" : "ETH";
        } else if (seg.includes("weth") && !seg.includes("to weth")) {
          intentData.fromToken = "WETH";
          intentData.toToken = "USDC";
        } else {
          intentData.fromToken = "USDC";
          intentData.toToken = "WETH";
        }
        if (seg.includes("base")) intentData.network = "base";
        else if (seg.includes("arbitrum")) intentData.network = "arbitrum";
        else if (seg.includes("optimism")) intentData.network = "optimism";
        else if (seg.includes("ethereum")) intentData.network = "ethereum";
      }
      return intentData;
    }).filter(Boolean);
    return intents;
  }
  /**
   * Generate a natural language summary of execution results
   */
  async summarizeExecution(intents, results) {
    const summary = `Executed ${intents.length} intent(s):
` + intents.map((intent, i) => {
      const result = results[i];
      const status = result?.success ? "\u2705" : "\u274C";
      const txInfo = result?.txHash ? `
  \u21B3 Tx: ${result.txHash}` : "";
      if (intent.type === "SWAP") {
        return `- Swap ${intent.amount} ${intent.fromToken} \u2192 ${intent.toToken}: ${status}${txInfo}`;
      } else {
        return `- ${intent.type}: ${status}${txInfo}`;
      }
    }).join("\n");
    return summary;
  }
  /**
   * Interactive agent loop (for CLI usage)
   */
  async chat(message) {
    try {
      const result = await this.model.generateContent(message);
      return result.response.text();
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
};

// src/client/tint.ts
var TintClient = class {
  constructor(config) {
    this.pendingIntents = [];
    this.config = config;
    const provider = new ethers2.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers2.Wallet(config.privateKey, provider);
    this.pedersen = new PedersenCommitment();
    this.netting = new NettingEngine();
    this.yellow = new YellowAPIClient(config.privateKey, config.rpcUrl, config.backendUrl);
    if (config.geminiApiKey) {
      this.agent = new TintAgent({ apiKey: config.geminiApiKey });
    }
  }
  /**
   * Initialize the client and open Yellow Network channel
   */
  async init() {
    const auth = await this.yellow.authenticate();
    const channel = await this.yellow.createChannel(auth.session);
    this.channelId = channel.channelId;
  }
  /**
   * Create an intent with Pedersen commitment
   */
  async createIntent(params) {
    let commitment;
    if (params.type === "SWAP") {
      const amount = typeof params.amount === "string" ? ethers2.parseUnits(params.amount, 6) : ethers2.parseUnits(params.amount.toString(), 6);
      commitment = this.pedersen.commitSimple(amount);
    }
    return { intent: params, commitment };
  }
  /**
   * Submit an intent to the collection
   */
  async submitIntent(intentData) {
    this.pendingIntents.push(intentData);
    if (intentData.commitment && this.channelId) {
      await this.yellow.sendCommitment(this.channelId, {
        commitment: intentData.commitment.commitmentHex,
        timestamp: Date.now()
      });
    }
  }
  /**
   * Execute all pending intents with netting
   */
  async executeBatch() {
    if (this.pendingIntents.length === 0) {
      return { success: false, error: "No pending intents" };
    }
    const swapIntents = this.pendingIntents.filter((i) => i.intent.type === "SWAP" && i.commitment);
    const otherIntents = this.pendingIntents.filter((i) => i.intent.type !== "SWAP");
    for (const { intent } of otherIntents) {
    }
    if (swapIntents.length > 0) {
      const sellAmounts = swapIntents.map((i) => {
        const amt = typeof i.intent.amount === "string" ? parseFloat(i.intent.amount) : i.intent.amount;
        return ethers2.parseUnits(amt.toString(), 6);
      });
      const netResult = this.netting.computeNetPosition(sellAmounts, []);
      const hookData = {
        commitments: swapIntents.map((i) => i.commitment.commitmentHex),
        amounts: sellAmounts.map((a) => a.toString()),
        randomness: swapIntents.map((i) => i.commitment.randomnessHex),
        directions: swapIntents.map(() => true),
        totalSell: netResult.totalSell.toString(),
        totalBuy: netResult.totalBuy.toString(),
        residual: netResult.residual.toString()
      };
      const firstIntent = swapIntents[0].intent;
      const netAmount = parseFloat(ethers2.formatUnits(netResult.residual, 6));
      const response = await fetch(`${this.config.backendUrl}/uniswap/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: "ethereum",
          tokenIn: firstIntent.fromToken,
          tokenOut: firstIntent.toToken,
          amount: netAmount.toFixed(6),
          recipient: firstIntent.recipient || this.wallet.address,
          hookData: JSON.stringify(hookData)
        })
      });
      const result = await response.json();
      this.pendingIntents = [];
      return {
        success: result.success,
        txHash: result.txHash,
        amountOut: result.amountOut,
        efficiency: netResult.efficiency,
        error: result.error
      };
    }
    this.pendingIntents = [];
    return { success: true };
  }
  /**
   * Get pending intents count
   */
  getPendingCount() {
    return this.pendingIntents.length;
  }
  /**
   * Clear all pending intents
   */
  clearPending() {
    this.pendingIntents = [];
  }
  /**
   * Get wallet address
   */
  getAddress() {
    return this.wallet.address;
  }
  /**
   * Process natural language intent (AI Agent Feature)
   * Example: "Swap 10 USDC to WETH"
   */
  async processNaturalLanguage(prompt, network = "ethereum") {
    if (!this.agent) {
      return {
        success: false,
        error: "AI agent not initialized. Provide geminiApiKey in config."
      };
    }
    try {
      const parsedIntents = await this.agent.parseIntent(prompt, network);
      if (parsedIntents.length === 0) {
        return { success: false, error: "Could not parse intent" };
      }
      for (const parsed of parsedIntents) {
        const intentData = await this.createIntent({
          type: parsed.type,
          fromToken: parsed.fromToken,
          toToken: parsed.toToken,
          amount: parsed.amount,
          recipient: parsed.recipient,
          fromChain: parsed.fromChain,
          toChain: parsed.toChain
        });
        await this.submitIntent(intentData);
      }
      const result = await this.executeBatch();
      if (this.agent) {
        const summary = await this.agent.summarizeExecution(parsedIntents, [result]);
        console.log("\u2705", summary);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  /**
   * Chat with AI agent (conversational interface)
   */
  async chat(message) {
    if (!this.agent) {
      return "AI agent not initialized. Provide geminiApiKey in config.";
    }
    return await this.agent.chat(message);
  }
  /**
   * Check if AI agent is available
   */
  hasAgent() {
    return !!this.agent;
  }
};
export {
  NettingEngine,
  PedersenCommitment,
  TintAgent,
  TintClient,
  YellowAPIClient
};
