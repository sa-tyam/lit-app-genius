import { ethers } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LIT_RPC, LitNetwork, AuthMethodType, AuthMethodScope } from "@lit-protocol/constants";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import {
  LitAbility,
  LitActionResource,
  LitPKPResource,
  generateAuthSig,
  createSiweMessageWithRecaps,
} from "@lit-protocol/auth-helpers";
import * as siwe from "siwe";

class LitUtil {
    constructor() {
      this.litNodeClient = null;
      this.contractClient = null;
    }
  
    async configureLitNetwork(session, setStateFunctions) {
      const {
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
      } = setStateFunctions;
  
      try {
        // Step 1: Set Access Token
        this.setAccessTokenFromSession(session, setAccessToken);
  
        // Step 2: Create a Wallet
        const wallet = await this.createWallet(setWalletAddress);
  
        // Step 3: Initialize LitNodeClient
        await this.initLitNodeClient(setLitNodeConnected, setLitNodeClient);
  
        // Step 4: Get Wallet Session Signatures
        const walletSessionSigs = await this.getWalletSessionSigs(wallet);
        setWalletSessionSigs(walletSessionSigs);
  
        // Step 5: Initialize Contract Client
        await this.initContractClient(setContractClientConnected, setContractClient);
  
        // Step 6: Create SIWE Message and Get Signature
        const { authSig, siweMessageSignature } = await this.createSiweMessage(
          wallet,
          setSiweMessageSignature,
          setWalletAddress
        );
  
        // Step 7: Mint PKP
        const mintInfo = await this.mintPKP(authSig, setPKPTokenId, setPKPPublicKey, setPKPEthAddress);
  
        // Step 8: Mint Capacity Credits NFT and Delegate Capacity
        const capacityDelegationAuthSig = await this.mintCapacityAndDelegate(
          mintInfo,
          wallet,
          setCapacityTokenId,
          setCapacityDelegationAuthSig
        );
  
        // Step 9: Get PKP Session Signatures
        const pkpSessionSigs = await this.getPKPSessionSigs(
          mintInfo,
          capacityDelegationAuthSig,
          wallet,
          setPKPSessionSigs
        );
  
        return {
          wallet,
          walletSessionSigs,
          authSig,
          mintInfo,
          pkpSessionSigs,
        };
      } catch (error) {
        console.error("Error configuring Lit Network:", error);
      }
    }
  
    setAccessTokenFromSession(session, setAccessToken) {
      if (session?.accessToken) {
        setAccessToken(session.accessToken);
      }
    }
  
    async createWallet(setWalletAddress) {
      const wallet = new ethers.Wallet(
        "7cd048d1ba2b2f2ed4c16eb2194a395b1afa9ef454a0244a0ff928fed757331c",
        new JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
      );
      const address = await wallet.getAddress();
      setWalletAddress(address);
      console.log("Wallet Address:", address);
      return wallet;
    }
  
    async initLitNodeClient(setLitNodeConnected, setLitNodeClient) {
      this.litNodeClient = new LitJsSdk.LitNodeClient({
        litNetwork: LitNetwork.Datil,
        rpc: process.env.NEXT_PUBLIC_LIT_RPC,
        debug: true,
      });
      await this.litNodeClient.connect();
      setLitNodeConnected(true);
      setLitNodeClient(this.litNodeClient);
      console.log("Lit Node Client connected");
    }
  
    async getWalletSessionSigs(wallet) {
      const nonce = await this.litNodeClient.getLatestBlockhash();
      const expirationTime = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  
      const walletSessionSigs = await this.litNodeClient.getSessionSigs({
        chain: "ethereum",
        expiration: expirationTime,
        resourceAbilityRequests: [
          {
            resource: new LitActionResource("*"),
            ability: LitAbility.LitActionExecution,
          },
          {
            resource: new LitPKPResource("*"),
            ability: LitAbility.PKPSigning,
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
            litNodeClient: this.litNodeClient,
          });
  
          return await generateAuthSig({
            signer: wallet,
            toSign,
          });
        },
      });

      console.log("Wallet Session Sigs:", walletSessionSigs);
      return walletSessionSigs;
    }
  
    async initContractClient(setContractClientConnected, setContractClient) {
      this.contractClient = new LitContracts({
        privateKey: "0x7cd048d1ba2b2f2ed4c16eb2194a395b1afa9ef454a0244a0ff928fed757331c",
        network: LitNetwork.Datil,
        debug: true,
      });
      await this.contractClient.connect();
      setContractClientConnected(true);
      setContractClient(this.contractClient);
      console.log("Contract Client connected");
    }
  
    async createSiweMessage(wallet, setSiweMessageSignature, setWalletAddress) {
      const nonce = await this.litNodeClient.getLatestBlockhash();
      const expirationTime = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  
      const domain = "localhost";
      const origin = "https://localhost/login";
      const statement = "This is a test statement. You can put anything you want here.";
      const address = await wallet.getAddress();
  
      const siweMessage = new siwe.SiweMessage({
        domain,
        address,
        statement,
        uri: origin,
        version: "1",
        chainId: 1,
        nonce,
        expirationTime,
      });
      const messageToSign = siweMessage.prepareMessage();
  
      const siweMessageSignature = await wallet.signMessage(messageToSign);
      setSiweMessageSignature(siweMessageSignature);
  
      const authSig = {
        sig: siweMessageSignature,
        derivedVia: "web3.eth.personal.sign",
        signedMessage: messageToSign,
        address: address,
      };
      
      console.log("Siwe Message Signature:", siweMessageSignature);
      console.log("Auth Sig:", authSig);
      return { authSig, siweMessageSignature };
    }
  
    async mintPKP(authSig, setPKPTokenId, setPKPPublicKey, setPKPEthAddress) {
      const authMethod = {
        authMethodType: AuthMethodType.EthWallet,
        accessToken: JSON.stringify(authSig),
      };
  
      const mintInfo = await this.contractClient.mintWithAuth({
        authMethod: authMethod,
        scopes: [AuthMethodScope.SignAnything, AuthMethodScope.PersonalSign],
      });
  
      setPKPTokenId(mintInfo.pkp.tokenId);
      setPKPPublicKey(mintInfo.pkp.publicKey);
      setPKPEthAddress(mintInfo.pkp.ethAddress);

      console.log("Mint Info pkp:", mintInfo.pkp);
  
      return mintInfo;
    }
  
    async mintCapacityAndDelegate(mintInfo, wallet, setCapacityTokenId, setCapacityDelegationAuthSig) {
      const { capacityTokenIdStr } = await this.contractClient.mintCapacityCreditsNFT({
        requestsPerKilosecond: 80,
        daysUntilUTCMidnightExpiration: 2,
      });
      setCapacityTokenId(capacityTokenIdStr);
  
      const { capacityDelegationAuthSig } =
        await this.litNodeClient.createCapacityDelegationAuthSig({
          uses: "1",
          dAppOwnerWallet: wallet,
          capacityTokenId: capacityTokenIdStr,
          delegateeAddresses: [mintInfo.pkp.ethAddress],
        });
      setCapacityDelegationAuthSig(capacityDelegationAuthSig.address);
    
        console.log("capacityDelegationAuthSig:", capacityDelegationAuthSig);
      return capacityDelegationAuthSig;
    }
  
    async getPKPSessionSigs(mintInfo, capacityDelegationAuthSig, wallet, setPKPSessionSigs) {
      const expirationTime = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  
      const pkpSessionSigs = await this.litNodeClient.getSessionSigs({
        pkpPublicKey: mintInfo.pkp.publicKey,
        expiration: expirationTime,
        chain: "ethereum",
        resourceAbilityRequests: [
          {
            resource: new LitActionResource("*"),
            ability: LitAbility.LitActionExecution,
          },
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
          if (!expiration) throw new Error("expiration is required");
          if (!resources) throw new Error("resources is required");
          if (!resourceAbilityRequests)
            throw new Error("resourceAbilityRequests is required");
  
          const response = await this.litNodeClient.signSessionKey({
            statement: "Some custom statement.",
            authMethods: [authMethod],
            pkpPublicKey: mintInfo.pkp.publicKey,
            expiration: expiration,
            resources: resources,
            chainId: 1,
            resourceAbilityRequests: resourceAbilityRequests,
          });
          console.log("pkp session sig response:", response);
          return response.authSig;
        },
        capacityDelegationAuthSig: capacityDelegationAuthSig,
      });
      setPKPSessionSigs(pkpSessionSigs);
      console.log("PKP Session Sigs:", pkpSessionSigs);
      return pkpSessionSigs;
    }
  }
  
  export default LitUtil;
  