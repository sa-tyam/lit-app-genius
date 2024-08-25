"use client";
import React from "react";
import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

import { ethers } from "ethers";
import { JsonRpcProvider } from "ethers/providers";

import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LIT_RPC } from "@lit-protocol/constants";
import { LitNetwork } from "@lit-protocol/constants";
import { AuthMethodScope, AuthMethodType } from "@lit-protocol/constants";
import { LitAuthClient } from "@lit-protocol/lit-auth-client";
import {
  LitAbility,
  LitPKPResource,
  LitActionResource,
  generateAuthSig,
  createSiweMessageWithRecaps,
} from "@lit-protocol/auth-helpers";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import * as siwe from "siwe";

const Login = () => {
  const { data: session } = useSession();

  // States
  // const [accessToken, setAccessToken] = useState("");
  // const [walletAddress, setWalletAddress] = useState("");
  // const [litNodeConnected, setLitNodeConnected] = useState(false);
  // const [walletSessionSigs, setWalletSessionSigs] = useState({});
  // const [contractClientConnected, setContractClientConnected] = useState(false);
  // const [siweMessageSignature, setSiweMessageSignature] = useState("");
  // const [pkpTokenId, setPKPTokenId] = useState("");
  // const [pkpPublicKey, setPKPPublicKey] = useState("");
  // const [pkpEthAddress, setPKPEthAddress] = useState("");
  // const [capacityTokenId, setCapacityTokenId] = useState("");
  // const [capacityDelegationAuthSig, setCapacityDelegationAuthSig] =
  //   useState("");
  const [pkpSessionSigs, setPKPSessionSigs] = useState({});

  const at = session?.accessToken;
  // if (at) {
  //   setAccessToken(at);
  // }

  const configureLitNetwork = async () => {
    // Create a wallet
    const wallet = new ethers.Wallet(
      "7cd048d1ba2b2f2ed4c16eb2194a395b1afa9ef454a0244a0ff928fed757331c",
      new JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
    );
    const address = ethers.getAddress(await wallet.getAddress());
    // setWalletAddress(address);

    // Initialize LitNodeClient with the manually created authSig
    const litNodeClient = new LitJsSdk.LitNodeClient({
      litNetwork: process.env.NEXT_PUBLIC_LIT_NETWORK,
      rpc: process.env.NEXT_PUBLIC_LIT_RPC,
    });
    await litNodeClient.connect();
    // setLitNodeConnected(true);
    console.log("Lit Node Client connected");

    let nonce = await litNodeClient.getLatestBlockhash();
    let expirationTime = new Date(
      Date.now() + 1000 * 60 * 60 * 24
    ).toISOString();

    const walletSessionSigs = await litNodeClient.getSessionSigs({
      chain: "ethereum",
      expiration: expirationTime,
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
    // setWalletSessionSigs(walletSessionSigs);
    console.log("Session Sigs:", walletSessionSigs);

    const contractClient = new LitContracts({
      // signer: wallet,
      privateKey:
        "0x7cd048d1ba2b2f2ed4c16eb2194a395b1afa9ef454a0244a0ff928fed757331c",
      network: LitNetwork.DatilTest,
    });
    await contractClient.connect();
    // setContractClientConnected(true);
    console.log("Contract Client connected");

    const domain = "localhost";
    const origin = "https://localhost/login";
    const statement =
      "This is a test statement.  You can put anything you want here.";

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
    const siweMessageSignature = await wallet.signMessage(messageToSign);
    // setSiweMessageSignature(siweMessageSignature);

    const authSig = {
      sig: siweMessageSignature,
      derivedVia: "web3.eth.personal.sign",
      signedMessage: messageToSign,
      address: address,
    };
    console.log(authSig);

    const authMethod = {
      authMethodType: AuthMethodType.EthWallet,
      accessToken: JSON.stringify(authSig),
    };

    const mintInfo = await contractClient.mintWithAuth({
      authMethod: authMethod,
      scopes: [AuthMethodScope.SignAnything, AuthMethodScope.PersonalSign],
    });
    // setPKPTokenId(mintInfo.pkp.tokenId);
    // setPKPPublicKey(mintInfo.pkp.publicKey);
    // setPKPEthAddress(mintInfo.pkp.ethAddress);

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
    console.log("signAnythingScope", signAnythingScope);
    console.log("personalSignScope", personalSignScope);

    // this identifier will be used in delegation requests.
    const { capacityTokenIdStr } = await contractClient.mintCapacityCreditsNFT({
      requestsPerKilosecond: 80,
      daysUntilUTCMidnightExpiration: 2,
    });
    // setCapacityTokenId(capacityTokenIdStr);
    console.log("capacityTokenIdStr", capacityTokenIdStr);

    const { capacityDelegationAuthSig } =
      await litNodeClient.createCapacityDelegationAuthSig({
        uses: "1",
        dAppOwnerWallet: wallet,
        capacityTokenId: capacityTokenIdStr,
        delegateeAddresses: [mintInfo.pkp.ethAddress],
      });
    // setCapacityDelegationAuthSig(capacityDelegationAuthSig);
    console.log("capacityDelegationAuthSig", capacityDelegationAuthSig);

    // const pkpSessionSigs = await litNodeClient.getSessionSigs({
    //   pkpPublicKey: mintInfo.pkp.publicKey, // public key of the wallet which is delegated
    //   expiration: expirationTime, // 24 hours
    //   chain: "ethereum",
    //   resourceAbilityRequests: [
    //     {
    //       resource: new LitPKPResource("*"),
    //       ability: LitAbility.PKPSigning,
    //     },
    //   ],
    //   authNeededCallback: async ({
    //     expiration,
    //     resources,
    //     resourceAbilityRequests,
    //   }) => {
    //     // -- validate
    //     if (!expiration) {
    //       throw new Error("expiration is required");
    //     }

    //     if (!resources) {
    //       throw new Error("resources is required");
    //     }

    //     if (!resourceAbilityRequests) {
    //       throw new Error("resourceAbilityRequests is required");
    //     }

    //     const response = await litNodeClient.signSessionKey({
    //       statement: 'Some custom statement.',
    //       authMethods: [authMethod], // authMethods for signing the sessionSigs
    //       pkpPublicKey: mintInfo.pkp.publicKey, // public key of the wallet which is delegated
    //       expiration: expiration,
    //       resources: resources,
    //       chainId: 1,

    //       // optional (this would use normal siwe lib, without it, it would use lit-siwe)
    //       resourceAbilityRequests: resourceAbilityRequests,
    //     });

    //     console.log("satyam123 pkp session sig response:", response);

    //     return response.authSig;
    //   },
    //   capacityDelegationAuthSig, // here is where we add the delegation to our session request
    // });

    // console.log("pkpSessionSigs", pkpSessionSigs);
  };

  return (
    <div className="p-6 max-w-screen-md mx-auto">
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
        onClick={() => signIn("google")}
      >
        Login with Google
      </button>

      <button
        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-6"
        onClick={configureLitNetwork}
      >
        Connect to Lit Network
      </button>

      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accessToken && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">Access Token</h3>
            <p className="break-words">{accessToken}</p>
          </div>
        )}

        {walletAddress && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">Wallet Address</h3>
            <p className="break-words">{walletAddress}</p>
          </div>
        )}

        {litNodeConnected && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">Lit Node Connected</h3>
            <p>{litNodeConnected ? "Yes" : "No"}</p>
          </div>
        )}

        {walletSessionSigs && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">Wallet Session Signatures</h3>
            <pre className="break-words whitespace-pre-wrap">
              {JSON.stringify(walletSessionSigs, null, 2)}
            </pre>
          </div>
        )}

        {contractClientConnected && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">Contract Client Connected</h3>
            <p>{contractClientConnected ? "Yes" : "No"}</p>
          </div>
        )}

        {siweMessageSignature && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">SIWE Message Signature</h3>
            <p className="break-words">{siweMessageSignature}</p>
          </div>
        )}

        {pkpTokenId && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">PKP Token ID</h3>
            <p className="break-words">{pkpTokenId}</p>
          </div>
        )}

        {pkpPublicKey && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">PKP Public Key</h3>
            <p className="break-words">{pkpPublicKey}</p>
          </div>
        )}

        {pkpEthAddress && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">PKP Ethereum Address</h3>
            <p className="break-words">{pkpEthAddress}</p>
          </div>
        )}

        {capacityTokenId && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">Capacity Token ID</h3>
            <p className="break-words">{capacityTokenId}</p>
          </div>
        )}

        {capacityDelegationAuthSig && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">
              Capacity Delegation Auth Signature
            </h3>
            <p className="break-words">{capacityDelegationAuthSig}</p>
          </div>
        )}

        {pkpSessionSigs && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">PKP Session Signatures</h3>
            <pre className="break-words whitespace-pre-wrap">
              {JSON.stringify(pkpSessionSigs, null, 2)}
            </pre>
          </div>
        )}
      </div> */}
    </div>
  );
};

export default Login;
