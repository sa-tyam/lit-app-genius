"use client";

import React, { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import LitUtil from "../api/lit/litUtil";
import LitOrderUtil from "../api/lit/litOrderUtil";
import Timeline from "../../component/Timeline";

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
  const [limitOrderExecutionResult, setLimitOrderExecutionResult] =
    useState(null);
  const [limitOrderSignature, setLimitOrderSignature] = useState("");
  const [litNodeClient, setLitNodeClient] = useState(null);
  const [contractClient, setContractClient] = useState(null);
  const [currentPrice, setCurrentPrice] = useState("");
  const [isConfigLitNetworkEnabled, setIsConfigLitNetworkEnabled] =
    useState(true);
  const [isConfigLitOrderEnabled, setIsConfigLitOrderEnabled] = useState(false);

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
    await litOrderUtil.executeOrder(Number(currentPrice));

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

    const litData = await litUtil.configureLitNetwork(
      session,
      setStateFunctions
    );

    if (litData) {
      console.log("Lit Network configured successfully", litData);
      setIsConfigLitNetworkEnabled(false);
      setIsConfigLitOrderEnabled(true);
    } else {
      console.error("Failed to configure Lit Network");
    }
  };

  useEffect(() => {
    if (callConfigureLitNetwork) {
      configLitNetwork();
    }
  }, [callConfigureLitNetwork]);

  const handleCurrentPriceChange = (event) => {
    setCurrentPrice(event.target.value);
  };

  const timelineSteps = [
    {
      title: "Lit Node Connected",
      value: litNodeConnected,
      status: litNodeConnected ? "active" : "inactive",
    },
    {
      title: "Contract Client Connected",
      value: contractClientConnected,
      status: contractClientConnected ? "active" : "inactive",
    },
    {
      title: "PKP Public Key",
      value: pkpPublicKey,
      status: pkpPublicKey ? "active" : "inactive",
    },
    {
      title: "Capacity Token ID",
      value: capacityTokenId,
      status: capacityTokenId ? "active" : "inactive",
    },
    {
      title: "Capacity Delegation Auth Sig",
      value: capacityDelegationAuthSig,
      status: capacityDelegationAuthSig ? "active" : "inactive",
    },

    {
      title: "Current Price",
      value: currentPrice,
      status: currentPrice ? "active" : "inactive",
    },
    {
      title: "Limit Order Execution Result",
      value: limitOrderExecutionResult,
      status: limitOrderExecutionResult ? "active" : "inactive",
    },
    {
      title: "Wallet Session Sigs",
      value: walletSessionSigs,
      status: walletSessionSigs ? "active" : "inactive",
    },
    {
      title: "PKPSession Sigs",
      value: pkpSessionSigs,
      status: pkpSessionSigs ? "active" : "inactive",
    },
    {
      title: "Limit Order Signature",
      value: limitOrderSignature,
      status: limitOrderSignature ? "active" : "inactive",
    },
  ];

  return (
    <div className="p-6 max-w-screen-md mx-auto">
      <div className="flex justify-end mb-4">
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={() => signIn("google")}
        >
          Login with Google
        </button>
      </div>
      <div className="grid grid-cols-2 grid-rows-1">
        <button
          className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded m-4 ${
            isConfigLitNetworkEnabled ? "" : "opacity-50 cursor-not-allowed"
          }`}
          onClick={() => configLitNetwork()}
          disabled={!isConfigLitNetworkEnabled}
        >
          Connect to Lit Network
        </button>

        <button
          className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded m-4 ${
            isConfigLitOrderEnabled ? "" : "opacity-50 cursor-not-allowed"
          }`}
          onClick={() => setCallConfigLitOrder(true)}
          disabled={!isConfigLitOrderEnabled}
        >
          Configure Lit order
        </button>
      </div>
      <div className="mb-4">
        <label
          htmlFor="currentPrice"
          className="block text-sm font-medium text-white"
        >
          Current Price:
        </label>
        <input
          type="number"
          id="currentPrice"
          value={currentPrice}
          onChange={handleCurrentPriceChange}
          className="mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm text-black"
        />
      </div>
      <Timeline steps={timelineSteps} />
    </div>
  );
};

export default MyComponent;
