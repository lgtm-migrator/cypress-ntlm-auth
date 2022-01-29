import { Socket } from "net";
import { injectable, interfaces, inject } from "inversify";
import http from "http";
import https from "https";
import HttpProxyAgent from "http-proxy-agent";
import HttpsProxyAgent, { HttpsProxyAgentOptions } from "https-proxy-agent";
//const HttpProxyAgent = require("http-proxy-agent");
//const HttpsProxyAgent = require("https-proxy-agent");

import { CompleteUrl } from "../models/complete.url.model.js";
import { IConfigController } from "./interfaces/i.config.controller.js";
import { IConnectionContextManager } from "./interfaces/i.connection.context.manager.js";
import { IConnectionContext } from "./interfaces/i.connection.context.js";
import { IUpstreamProxyManager } from "./interfaces/i.upstream.proxy.manager.js";
import { TYPES } from "./dependency.injection.types.js";
import { IDebugLogger } from "../util/interfaces/i.debug.logger.js";
import { SslTunnel } from "../models/ssl.tunnel.model.js";

interface ConnectionContextHash {
  [ntlmHostUrl: string]: IConnectionContext;
}

interface SslTunnelHash {
  [ntlmHostUrl: string]: SslTunnel;
}

@injectable()
export class ConnectionContextManager implements IConnectionContextManager {
  private _agentCount: number = 0;
  private _connectionContexts: ConnectionContextHash = {};
  private _upstreamProxyManager: IUpstreamProxyManager;
  private _configController: IConfigController;
  private ConnectionContext: interfaces.Newable<IConnectionContext>;
  private _debug: IDebugLogger;
  private _tunnels: SslTunnelHash = {};

  constructor(
    @inject(TYPES.IUpstreamProxyManager)
    upstreamProxyManager: IUpstreamProxyManager,
    @inject(TYPES.IConfigController) configController: IConfigController,
    @inject(TYPES.NewableIConnectionContext)
    connectionContext: interfaces.Newable<IConnectionContext>,
    @inject(TYPES.IDebugLogger) debug: IDebugLogger
  ) {
    this._upstreamProxyManager = upstreamProxyManager;
    this._configController = configController;
    this.ConnectionContext = connectionContext;
    this._debug = debug;
  }

  private getClientAddress(clientSocket: Socket): string {
    return clientSocket.remoteAddress + ":" + clientSocket.remotePort;
  }

  createConnectionContext(clientSocket: Socket, isSSL: boolean, targetHost: CompleteUrl): IConnectionContext {
    const clientAddress = this.getClientAddress(clientSocket);
    if (clientAddress in this._connectionContexts) {
      return this._connectionContexts[clientAddress];
    }

    const agent = this.getAgent(isSSL, targetHost);
    this._agentCount++;
    //agent._cyAgentId = this._agentCount++;
    const context = new this.ConnectionContext();
    context.clientAddress = clientAddress;
    context.agent = agent;
    context.clientSocket = clientSocket;
    this._connectionContexts[clientAddress] = context;
    context.socketCloseListener = this.removeAgentOnClose.bind(this, clientAddress);
    clientSocket.once("close", context.socketCloseListener);
    this._debug.log("Created agent for client " + clientAddress + " to target " + targetHost.href);
    return context;
  }

  private removeAgentOnClose(clientAddress: string) {
    this.removeAgent("close", clientAddress);
  }

  getConnectionContextFromClientSocket(clientSocket: Socket): IConnectionContext | undefined {
    const clientAddress = this.getClientAddress(clientSocket);
    if (clientAddress in this._connectionContexts) {
      return this._connectionContexts[clientAddress];
    }
    return undefined;
  }

  private nodeTlsRejectUnauthorized(): boolean {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
      return process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0";
    }
    return true;
  }

  getAgent(isSSL: boolean, targetHost: CompleteUrl) {
    const agentOptions: https.AgentOptions = {
      keepAlive: true,
      maxSockets: 1, // Only one connection per peer -> 1:1 match between inbound and outbound socket
      rejectUnauthorized:
        // Allow self-signed certificates if target is on localhost
        this.nodeTlsRejectUnauthorized() && !targetHost.isLocalhost,
    };
    const useUpstreamProxy = this._upstreamProxyManager.setUpstreamProxyConfig(targetHost, isSSL, agentOptions);
    let agent;
    if (useUpstreamProxy) {
      agent = isSSL ? new HttpsProxyAgent(agentOptions as HttpsProxyAgentOptions) : HttpProxyAgent(agentOptions);
    } else {
      agent = isSSL ? new https.Agent(agentOptions) : new http.Agent(agentOptions);
    }
    return agent;
  }

  // Untracked agents are used for requests to the config API.
  // These should not be destroyed on reset since that breaks the config API response.
  getUntrackedAgent(targetHost: CompleteUrl) {
    let agent: any;
    // eslint-disable-next-line prefer-const
    agent = new http.Agent();
    this._agentCount++;
    //agent._cyAgentId = this._agentCount++;
    this._debug.log("Created untracked agent for target " + targetHost.href);
    return agent;
  }

  removeAllConnectionContexts(event: string) {
    const preservedContexts: ConnectionContextHash = {};
    for (const property in this._connectionContexts) {
      if (this._connectionContexts.hasOwnProperty(property)) {
        const context = this._connectionContexts[property];
        if (context.configApiConnection) {
          // Must let config api context stay alive, otherwise there is no response to a reset or quit call
          preservedContexts[context.clientAddress] = context;
        } else {
          context.clientSocket?.removeListener("close", context.socketCloseListener);
          this._debug.log("Destroying context for", context.clientAddress);
          context.destroy(event);
        }
      }
    }
    this._connectionContexts = preservedContexts;
    this._debug.log("Removed all agents due to " + event);
  }

  removeAgent(event: string, clientAddress: string) {
    if (clientAddress in this._connectionContexts) {
      this._connectionContexts[clientAddress].clientSocket?.removeListener(
        "close",
        this._connectionContexts[clientAddress].socketCloseListener
      );
      this._connectionContexts[clientAddress].destroy(event);
      delete this._connectionContexts[clientAddress];
      this._debug.log("Removed agent for " + clientAddress + " due to socket." + event);
    }
  }

  addTunnel(client: Socket, target: Socket) {
    this._tunnels[this.getClientAddress(client)] = {
      client: client,
      target: target,
    };
  }

  removeTunnel(client: Socket) {
    const clientAddress = this.getClientAddress(client);
    if (clientAddress in this._tunnels) {
      delete this._tunnels[clientAddress];
    }
  }

  removeAndCloseAllTunnels(event: string) {
    for (const property in this._tunnels) {
      if (this._tunnels.hasOwnProperty(property)) {
        if (this._tunnels[property].target) {
          this._tunnels[property].target.end();
        }
      }
    }
    this._tunnels = {};
    this._debug.log("Removed and closed all tunnels due to " + event);
  }
}
