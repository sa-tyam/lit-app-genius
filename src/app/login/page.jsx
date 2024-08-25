"use client";
import React from "react";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
// import { LocalStorage } from "node-localstorage";

// import { Wallet, providers } from "ethers";
import { ethers } from "ethers";
import { JsonRpcProvider } from "ethers/providers";

import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LIT_RPC } from "@lit-protocol/constants";
import { LitNetwork } from "@lit-protocol/constants";
import { AuthMethodScope, AuthMethodType } from "@lit-protocol/constants";
import { LitAuthClient } from "@lit-protocol/lit-auth-client";
import {
  LitAbility,
  LitAccessControlConditionResource,
  createSiweMessage,
  LitPKPResource,
  LitActionResource,
  generateAuthSig,
  createSiweMessageWithRecaps,
} from "@lit-protocol/auth-helpers";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { PKPEthersWallet } from "@lit-protocol/pkp-ethers";
import * as siwe from "siwe";
// import { LitAbility } from "@lit-protocol/lit-js-sdk";
// import { LitAccessControlConditionResource } from "@lit-protocol/lit-js-sdk";

// import dynamic from "next/dynamic";

// let LocalStorage;
// if (typeof window === "undefined") {
//   LocalStorage = require("node-localstorage").LocalStorage;
// }

const Login = () => {
  const [message, setMessage] = useState("");
  const [sessionSigs, setSessionSigs] = useState(null);
  const [encryptedOrder, setEncryptedOrder] = useState(null);
  const [authSig, setAuthSig] = useState(null);

  const { data: session } = useSession();
  // Log session to see what's available
  console.log("Session:", session);
  const accessToken = session?.accessToken;
  const userId = session?.user?.id;
  console.log("User ID:", userId);

  const connectLitNetwork = async () => {
    // Manually create authSig based on Google ID token
    // const authSig = {
    //   sig: accessToken, // Google ID token
    //   derivedVia: "googleAuth",
    //   signedMessage: "Authenticate with Google",
    //   address: "google-oauth2|" + userId, // Use unique identifier
    // };
    // setAuthSig(authSig);

    const wallet = new ethers.Wallet(
      "7cd048d1ba2b2f2ed4c16eb2194a395b1afa9ef454a0244a0ff928fed757331c",
      new JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
    );
    const address = ethers.getAddress(await wallet.getAddress());

    // Craft the SIWE message

    // Initialize LitNodeClient with the manually created authSig
    const litNodeClient = new LitJsSdk.LitNodeClient({
      litNetwork: process.env.NEXT_PUBLIC_LIT_NETWORK,
      rpc: process.env.NEXT_PUBLIC_LIT_RPC,
      //   storageProvider: {
      //     provider: new LocalStorage("./lit_storage.db"),
      //   },
    });
    await litNodeClient.connect();
    console.log("Lit Node Client connected");

    let nonce = await litNodeClient.getLatestBlockhash();

    // const sessionSigs = await litNodeClient.getSessionSigs({ authSig });
    // console.log("Session Sigs:", sessionSigs);
    // setSessionSigs(sessionSigs);

    const sessionSignatures = await litNodeClient.getSessionSigs({
      chain: "ethereum",
      expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
      resourceAbilityRequests: [
        {
          resource: new LitActionResource("*"),
          ability: LitAbility.LitActionExecution,
        },
      ],
      authNeededCallback: async ({
        resourceAbilityRequests,
        expiration,
        uri,
      }) => {
        const toSign = await createSiweMessageWithRecaps({
          uri,
          expiration,
          resources: resourceAbilityRequests,
          walletAddress: await wallet.getAddress(),
          nonce,
          litNodeClient,
        });

        return await generateAuthSig({
          signer: wallet,
          toSign,
        });
      },
    });

    console.log("Session Sigs:", sessionSignatures);
    setSessionSigs(sessionSignatures);

    // Prepare needed params for authContext
    const resourceAbilities = [
      {
        resource: new LitActionResource("*"),
        ability: LitAbility.PKPSigning,
      },
    ];

    const contractClient = new LitContracts({
      // signer: wallet,
      privateKey:
        "0x7cd048d1ba2b2f2ed4c16eb2194a395b1afa9ef454a0244a0ff928fed757331c",
      network: LitNetwork.DatilTest,
    });
    await contractClient.connect();

    const domain = "localhost";
    const origin = "https://localhost/login";
    const statement =
      "This is a test statement.  You can put anything you want here.";

    // expiration time in ISO 8601 format.  This is 7 days in the future, calculated in milliseconds
    const expirationTime = new Date(
      Date.now() + 1000 * 60 * 60 * 24 * 7
    ).toISOString();

    const siweMessage = new siwe.SiweMessage({
      domain,
      address: address,
      statement,
      uri: origin,
      version: "1",
      chainId: 1,
      nonce,
      expirationTime,
    });
    const messageToSign = siweMessage.prepareMessage();

    // Sign the message and format the authSig
    const signature = await wallet.signMessage(messageToSign);

    const authSig = {
      sig: signature,
      derivedVia: "web3.eth.personal.sign",
      signedMessage: messageToSign,
      address: address,
    };

    console.log(authSig);
    setAuthSig(authSig);

    console.log("before authMethod accessToken: ", accessToken);
    const authMethod = {
      authMethodType: AuthMethodType.EthWallet,
      accessToken: JSON.stringify(authSig),
    };

    const mintInfo = await contractClient.mintWithAuth({
      authMethod: authMethod,
      scopes: [
        // AuthMethodScope.NoPermissions,
        AuthMethodScope.SignAnything,
        AuthMethodScope.PersonalSign,
        // AuthMethodScope.PKPSigning,
      ],
    });

    const authId = await LitAuthClient.getAuthIdByAuthMethod(authMethod);
    const scopes =
      await contractClient.pkpPermissionsContract.read.getPermittedAuthMethodScopes(
        mintInfo.pkp.tokenId,
        AuthMethodType.EthWallet,
        authId,
        3
      );

    const signAnythingScope = scopes[1];
    const personalSignScope = scopes[2];
    console.log("satyam123 signAnythingScope", signAnythingScope);
    console.log("satyam123 personalSignScope", personalSignScope);

    // this identifier will be used in delegation requests.
    const { capacityTokenIdStr } = await contractClient.mintCapacityCreditsNFT({
      requestsPerKilosecond: 80,
      // requestsPerDay: 14400,
      // requestsPerSecond: 10,
      daysUntilUTCMidnightExpiration: 2,
    });

    console.log("satyam123 capacityTokenIdStr", capacityTokenIdStr);

    const { capacityDelegationAuthSig } =
      await litNodeClient.createCapacityDelegationAuthSig({
        uses: "1",
        // privateKey:
        // "0x7cd048d1ba2b2f2ed4c16eb2194a395b1afa9ef454a0244a0ff928fed757331c",
        dAppOwnerWallet: wallet,
        capacityTokenId: capacityTokenIdStr,
        delegateeAddresses: [mintInfo.pkp.ethAddress],
      });

    console.log(
      "satyam123 capacityDelegationAuthSig",
      capacityDelegationAuthSig
    );

    const pkpSessionSigs = await litNodeClient.getSessionSigs({
      pkpPublicKey: mintInfo.pkp.publicKey, // public key of the wallet which is delegated
      expiration: expirationTime, // 24 hours
      chain: "ethereum",
      resourceAbilityRequests: [
        {
          resource: new LitPKPResource("*"),
          ability: LitAbility.PKPSigning,
        },
      ],
      authNeededCallback: async ({
        expiration,
        resources,
        resourceAbilityRequests,
      }) => {
        // -- validate
        if (!expiration) {
          throw new Error("expiration is required");
        }

        if (!resources) {
          throw new Error("resources is required");
        }

        if (!resourceAbilityRequests) {
          throw new Error("resourceAbilityRequests is required");
        }

        const response = await litNodeClient.signSessionKey({
          statement: 'Some custom statement.',
          authMethods: [authMethod], // authMethods for signing the sessionSigs
          pkpPublicKey: mintInfo.pkp.publicKey, // public key of the wallet which is delegated
          expiration: expiration,
          resources: resources,
          chainId: 1,

          // optional (this would use normal siwe lib, without it, it would use lit-siwe)
          resourceAbilityRequests: resourceAbilityRequests,
        });

        console.log("satyam123 pkp session sig response:", response);

        return response.authSig;
      },
      capacityDelegationAuthSig, // here is where we add the delegation to our session request
    });

    console.log("satyam123 pkpSessionSigs", pkpSessionSigs);
  };

  async function encryptLimitOrder(order) {
    if (sessionSigs) {
      const encrypted = await LitJsSdk.encryptWithSignature({
        sessionSigs,
        data: order,
      });
      localStorage.setItem("encryptedLimitOrder", encrypted);
      setEncryptedOrder(encrypted);
    }
  }

  async function getCurrentEthPrice() {
    const response = await fetch("https://api.defined.fi/v1/token-prices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer YOUR_API_KEY", // Replace with your actual API key
      },
      body: JSON.stringify({
        network: "ethereum",
        token: "ETH",
      }),
    });

    const data = await response.json();
    return data.price; // Adjust based on the actual response structure
  }

  async function executeLimitOrder() {
    if (!sessionSigs || !encryptedOrder) {
      setMessage("Session not initialized or no encrypted order found");
      return;
    }

    // Decrypt the order
    const decryptedOrder = await LitJsSdk.decryptWithSignature({
      encryptedData: encryptedOrder,
      sessionSigs,
    });

    // Fetch current ETH price
    const currentPrice = await getCurrentEthPrice();

    // Check if price condition is met
    if (currentPrice >= decryptedOrder.limitPrice) {
      const litNodeClient = new LitJsSdk.LitNodeClient({
        litNetwork: process.env.NEXT_PUBLIC_LIT_NETWORK,
        rpc: process.env.NEXT_PUBLIC_LIT_RPC,
      });
      await litNodeClient.connect();

      const signedMessage = await litNodeClient.executeJs({
        code: `
              const signedMsg = await LitActions.signMessage({
                message: "Order executed",
                authSig,
                chain: "ethereum",
              });
              return signedMsg;
            `,
        authSig,
        sessionSigs,
      });

      setMessage("Signed Message: " + signedMessage);
    } else {
      setMessage("Price condition not met.");
    }
  }

  // Get the access token
  return (
    <div>
      <button onClick={() => signIn("google")}>Login with Google</button>
      {accessToken && <p>Your access token: {accessToken}</p>}
      <p></p>
      <button onClick={connectLitNetwork}>Connect to Lit Network</button>
      <p></p>
      <button onClick={encryptLimitOrder}>Encrypt Limit Order</button>
      <p></p>
      <button onClick={executeLimitOrder}>Execute Limit Order</button>
    </div>
  );
};

export default Login;
