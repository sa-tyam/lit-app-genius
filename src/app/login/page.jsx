"use client";

import React from "react";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";


import LitUtil  from "../api/lit/litUtil";
import LitOrderUtil from "../api/lit/litOrderUtil";

const MyComponent = () => {
  const { data: session } = useSession();

  // States
  const [callConfigureLitNetwork, setCallConfigureLitNetwork] = useState(false);
  const [callConfigLitOrder, setCallConfigLitOrder] = useState(false);
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
  const [pkpSessionSigs, setPKPSessionSigs] = useState(null);
  const [encryptResult, setEncryptResult] = useState(null);
  const [limitOrderExecutionResult, setLimitOrderExecutionResult] = useState(null);
  const [limitOrderSignature, setLimitOrderSignature] = useState("");
  const [litNodeClient, setLitNodeClient] = useState(null);
  const [contractClient, setContractClient] = useState(null);

  const configLitOrder = async () => {
    if (!litNodeClient) {
      console.error("Lit Node Client not connected");
      throw new Error("Lit Node Client not connected");
    }

    if (!pkpSessionSigs) {
      console.error("PKP Session Sigs not available");
      throw new Error("PKP Session Sigs not available");
    }

    if (!pkpPublicKey) {
      console.error("PKP Public Key not available");
      throw new Error("PKP Public Key not available");
    }

    const litOrderUtil = new LitOrderUtil({
      litNodeClient,
      pkpSessionSigs,
      pkpPublicKey,
      setLimitOrderSignature,
      setEncryptResult,
      setLimitOrderExecutionResult,
    });

    const limitOrder = {
      price: 3000,
      asset: "ETH",
      action: "buy", // or 'sell'
    };

    await litOrderUtil.encryptOrder(limitOrder);
    await litOrderUtil.decryptOrder();
    await litOrderUtil.executeOrder(3000);

    setCallConfigLitOrder(false);
  };

  useEffect(() => {

    if (callConfigLitOrder) {
      configLitOrder();
    }

  }, [callConfigLitOrder]);

  const configLitNetwork = async () => {
    const litUtil = new LitUtil();

    const setStateFunctions = {
      setAccessToken,
      setWalletAddress,
      setLitNodeConnected,
      setWalletSessionSigs,
      setContractClientConnected,
      setSiweMessageSignature,
      setPKPTokenId,
      setPKPPublicKey,
      setPKPEthAddress,
      setCapacityTokenId,
      setCapacityDelegationAuthSig,
      setPKPSessionSigs,
      setLitNodeClient,
      setContractClient,
    };

    const litData = await litUtil.configureLitNetwork(session, setStateFunctions);

    if (litData) {
      console.log("Lit Network configured successfully", litData);
    } else {
      console.error("Failed to configure Lit Network");
    }
  };

  useEffect(() => {
    if (callConfigureLitNetwork) {
      configLitNetwork();
    }

  }, [callConfigureLitNetwork]);

  const configureLitOrder = () => {
    setCallConfigLitOrder(true);
  };

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

        <button
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded m-4"
          onClick={() => configureLitOrder()}
        >
          Configure Lit order
        </button>
      </div>
    </div>
  );
};

export default MyComponent;
