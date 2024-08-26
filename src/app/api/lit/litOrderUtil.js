import * as LitJsSdk from "@lit-protocol/lit-node-client";

class LitOrderUtil {
  constructor({
    litNodeClient,
    pkpSessionSigs,
    pkpPublicKey,
    setLimitOrderSignature,
    setEncryptResult,
    setLimitOrderExecutionResult,
  }) {
    this.litNodeClient = litNodeClient;
    this.pkpSessionSigs = pkpSessionSigs;
    this.setLimitOrderSignature = setLimitOrderSignature;
    this.setEncryptResult = setEncryptResult;
    this.setLimitOrderExecutionResult = setLimitOrderExecutionResult;
    this.pkpPublicKey = pkpPublicKey;
  }

  // Lit Action Code
  limitOrderLitActionCode = `
  const go = async () => {
    // Decrypt the limit order
    const decryptedOrder = await Lit.Actions.decryptAndCombine({
      ciphertext: ciphertext,
      dataToEncryptHash: dataToEncryptHash,
      chain: chain,
      authSig: null,
      // sessionSigs: sessionSigs,
      accessControlConditions: accessControlConditions,
    }, litNodeClient);
    console.log('Decrypted limit order:', decryptedOrder);

    if (!decryptedOrder) {
      console.log('Failed to decrypt limit order.');
      return;
    }
    console.log('Decrypted limit order:', decryptedOrder);

    // Parse the decrypted order
    const limitOrder = JSON.parse(decryptedOrder);

    console.log('Decrypted limit order:', limitOrder);

    console.log('Current Price:', currentPrice);

    // Check if the price satisfies the limit order condition
    if (limitOrder.action === 'buy' && currentPrice <= limitOrder.price) {
      // Sign a message if the condition is met
      const message = new TextEncoder().encode('Limit order condition met');
      const toSign = await crypto.subtle.digest('SHA-256', message);
      const sigShare = await Lit.Actions.signEcdsa({
        toSign: new Uint8Array(toSign),
        publicKey: publicKey,
        sigName,
      });
      console.log('Signature Share:', sigShare);
    } else if (limitOrder.action === 'sell' && currentPrice >= limitOrder.price) {
      const message = new TextEncoder().encode('Limit order condition met');
      const toSign = await crypto.subtle.digest('SHA-256', message);
      const sigShare = await Lit.Actions.signEcdsa({
        toSign: new Uint8Array(toSign),
        publicKey: publicKey,
        sigName,
      });
      console.log('Signature Share:', sigShare);
    } else {
      console.log('Limit order condition not met');
    }
  };

  go();
   `;

  accessControlConditions = [
    {
      contractAddress: "",
      standardContractType: "",
      chain: "ethereum",
      method: "eth_getBalance",
      parameters: [":userAddress", "latest"],
      returnValueTest: {
        comparator: ">=",
        value: "0",
      },
    },
  ];

  async encryptOrder(limitOrder) {
    const encodedOrder = JSON.stringify(limitOrder);

    const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptString(
      {
        dataToEncrypt: encodedOrder,
        accessControlConditions: this.accessControlConditions,
        chain: "ethereum",
        sessionSigs: this.pkpSessionSigs,
      },
      this.litNodeClient
    );

    localStorage.setItem("ciphertext", JSON.stringify(ciphertext));
    localStorage.setItem(
      "dataToEncryptHash",
      JSON.stringify(dataToEncryptHash)
    );
    this.setEncryptResult({ ciphertext, dataToEncryptHash });
    console.log("Limit order encrypted and saved to local storage");
  }

  async executeOrder(currentPrice) {
    // Retrieve the encrypted limit order from local storage
    const ciphertext = JSON.parse(localStorage.getItem("ciphertext"));
    console.log("Ciphertext:", ciphertext);
    const dataToEncryptHash = JSON.parse(
      localStorage.getItem("dataToEncryptHash")
    );
    console.log("Data to Encrypt Hash:", dataToEncryptHash);

    try {
      const limitOrderSignatures = await this.litNodeClient.executeJs({
        code: this.limitOrderLitActionCode,
        sessionSigs: this.pkpSessionSigs,
        jsParams: {
          ciphertext,
          dataToEncryptHash,
          publicKey: this.pkpPublicKey,
          sigName: "sig1",
          accessControlConditions: this.accessControlConditions,
          chain: "ethereum",
          litNodeClient: this.litNodeClient,
          currentPrice,
        },
      });

      this.setLimitOrderExecutionResult(limitOrderSignatures);
      console.log("Limit order execution result:", limitOrderSignatures);
    } catch (error) {
      console.error("Error executing limit order:", error);
      throw error;
    }
  }
}

export default LitOrderUtil;
