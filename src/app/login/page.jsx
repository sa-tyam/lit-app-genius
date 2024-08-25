"use client";

import React from "react";
import { useState, useEffect } from "react";
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
  LitActionResource,
  generateAuthSig,
  createSiweMessageWithRecaps,
} from "@lit-protocol/auth-helpers";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import * as siwe from "siwe";

const MyComponent = () => {
  const { data: session } = useSession();

  // States
  const [callConfigureLitNetwork, setCallConfigureLitNetwork] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [litNodeConnected, setLitNodeConnected] = useState(false);
  const [walletSessionSigs, setWalletSessionSigs] = useState(false);
  const [contractClientConnected, setContractClientConnected] = useState(false);
  const [siweMessageSignature, setSiweMessageSignature] = useState("");
  const [pkpTokenId, setPKPTokenId] = useState("");
  const [pkpPublicKey, setPKPPublicKey] = useState("");
  const [pkpEthAddress, setPKPEthAddress] = useState("");
  const [capacityTokenId, setCapacityTokenId] = useState("");
  const [capacityDelegationAuthSig, setCapacityDelegationAuthSig] =
    useState("");
  const [pkpSessionSigs, setPKPSessionSigs] = useState({});

  useEffect(() => {
    const configureLitNetwork = async () => {
      try {
        if (session?.accessToken) {
          setAccessToken(session.accessToken);
        }

        // Create a wallet
        const wallet = new ethers.Wallet(
          "7cd048d1ba2b2f2ed4c16eb2194a395b1afa9ef454a0244a0ff928fed757331c",
          new JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
        );
        const address = await wallet.getAddress();
        setWalletAddress(address);

        // Initialize LitNodeClient
        const litNodeClient = new LitJsSdk.LitNodeClient({
          litNetwork: process.env.NEXT_PUBLIC_LIT_NETWORK,
          rpc: process.env.NEXT_PUBLIC_LIT_RPC,
        });
        await litNodeClient.connect();
        setLitNodeConnected(true);
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
        setWalletSessionSigs(true);
        console.log("Session Sigs:", walletSessionSigs);

        const contractClient = new LitContracts({
          privateKey:
            "0x7cd048d1ba2b2f2ed4c16eb2194a395b1afa9ef454a0244a0ff928fed757331c",
          network: LitNetwork.DatilTest,
        });
        await contractClient.connect();
        setContractClientConnected(true);
        console.log("Contract Client connected");

        const domain = "localhost";
        const origin = "https://localhost/login";
        const statement =
          "This is a test statement. You can put anything you want here.";

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
        setSiweMessageSignature(siweMessageSignature);

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
        setPKPTokenId(mintInfo.pkp.tokenId);
        setPKPPublicKey(mintInfo.pkp.publicKey);
        setPKPEthAddress(mintInfo.pkp.ethAddress);

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
        const { capacityTokenIdStr } =
          await contractClient.mintCapacityCreditsNFT({
            requestsPerKilosecond: 80,
            daysUntilUTCMidnightExpiration: 2,
          });
        setCapacityTokenId(capacityTokenIdStr);
        console.log("capacityTokenIdStr", capacityTokenIdStr);

        const { capacityDelegationAuthSig } =
          await litNodeClient.createCapacityDelegationAuthSig({
            uses: "1",
            dAppOwnerWallet: wallet,
            capacityTokenId: capacityTokenIdStr,
            delegateeAddresses: [mintInfo.pkp.ethAddress],
          });
        setCapacityDelegationAuthSig(capacityDelegationAuthSig.address);
        console.log("capacityDelegationAuthSig", capacityDelegationAuthSig);

        // Uncomment if needed
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
        //     if (!expiration) throw new Error("expiration is required");
        //     if (!resources) throw new Error("resources is required");
        //     if (!resourceAbilityRequests) throw new Error("resourceAbilityRequests is required");

        //     const response = await litNodeClient.signSessionKey({
        //       statement: 'Some custom statement.',
        //       authMethods: [authMethod],
        //       pkpPublicKey: mintInfo.pkp.publicKey,
        //       expiration: expiration,
        //       resources: resources,
        //       chainId: 1,
        //       resourceAbilityRequests: resourceAbilityRequests,
        //     });
        //     console.log("pkp session sig response:", response);
        //     return response.authSig;
        //   },
        //   capacityDelegationAuthSig,
        // });
        // setPKPSessionSigs(pkpSessionSigs);
        // console.log("pkpSessionSigs", pkpSessionSigs);

        setCallConfigureLitNetwork(false);
      } catch (error) {
        console.error("Error configuring Lit Network:", error);
      }
    };

    // Call configureLitNetwork when necessary
    if (callConfigureLitNetwork) {
      configureLitNetwork();
    }
  }, [callConfigureLitNetwork]);

  const configureLitNetwork = () => {
    setCallConfigureLitNetwork(true);
  };

  return (
    <div className="p-6 max-w-screen-md mx-auto">
      <div className="grid grid-cols-2 grid-rows-1">
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-4"
        onClick={() => signIn("google")}
      >
        Login with Google
      </button>

      <button
        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded m-4"
        onClick={() => configureLitNetwork()}
      >
        Connect to Lit Network
      </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-red-600">
        {accessToken && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold text-black">Google Access Token</h3>
            <p className="break-words">{accessToken}</p>
          </div>
        )}
        {walletAddress && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold text-black">Wallet Address</h3>
            <p className="break-words">{walletAddress}</p>
          </div>
        )}
        {litNodeConnected && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold text-black">Lit Node Status</h3>
            <p>Connected</p>
          </div>
        )}
        {walletSessionSigs && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold text-black">Wallet Session Signatures</h3>
            <p>Wallet Session signatures added</p>
          </div>
        )}
        {contractClientConnected && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold text-black">Contract Client Status</h3>
            <p>Connected</p>
          </div>
        )}
        {siweMessageSignature && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold text-black">SIWE Message Signature</h3>
            <p className="break-words">{siweMessageSignature}</p>
          </div>
        )}
        {pkpTokenId && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold text-black">PKP Token ID</h3>
            <p className="break-words">{pkpTokenId}</p>
          </div>
        )}
        {pkpPublicKey && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold text-black">PKP Public Key</h3>
            <p className="break-words">{pkpPublicKey}</p>
          </div>
        )}
        {pkpEthAddress && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold text-black">PKP Ethereum Address</h3>
            <p className="break-words">{pkpEthAddress}</p>
          </div>
        )}
        {capacityTokenId && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold text-black">Capacity Token ID</h3>
            <p className="break-words">{capacityTokenId}</p>
          </div>
        )}
        {capacityDelegationAuthSig && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="text-lg font-semibold text-black">
              Capacity Delegation Auth Sig
            </h3>
            <p className="break-words">{capacityDelegationAuthSig}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyComponent;
