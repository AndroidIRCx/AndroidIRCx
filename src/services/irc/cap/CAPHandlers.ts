/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * CAP handlers extracted from IRCService.
 */

export interface CAPHandlerContext {
  capAvailable: Set<string>;
  capEnabledSet: Set<string>;
  capRequested: Set<string>;
  config: any;

  getCapLSReceived: () => boolean;
  setCapLSReceived: (value: boolean) => void;
  setUserhostInNames: (value: boolean) => void;
  setExtendedJoin: (value: boolean) => void;
  getSaslAuthenticating: () => boolean;

  emit: (event: string, ...args: any[]) => void;
  logRaw: (message: string) => void;
  sendRaw: (command: string) => void;
  requestCapabilities: () => void;
  endCAPNegotiation: () => void;
  startSASL: () => void;
}

export class CAPHandlers {
  constructor(private ctx: CAPHandlerContext) {}

  public handleCAPCommand(params: string[]): void {
    let subcommand = params[0]?.toUpperCase();
    let actualParams = params;

    if (subcommand === '*') {
      subcommand = params[1]?.toUpperCase();
      actualParams = params.slice(1);
    }

    switch (subcommand) {
      case 'LS': {
        let capabilities = '';
        let isLastLine = false;

        if (actualParams.length >= 2) {
          if (actualParams[1] === '*') {
            capabilities = actualParams.slice(2).join(' ').replace(/^:/, '');
          } else {
            isLastLine = true;
            capabilities = actualParams.slice(1).join(' ').replace(/^:/, '');
          }
        } else if (actualParams.length === 1) {
          isLastLine = true;
          capabilities = actualParams[0].replace(/^:/, '');
        }

        const capList = capabilities.split(/\s+/).filter(c => c && c !== '*');
        capList.forEach(cap => {
          const [name, value] = cap.split('=');
          if (name) {
            this.ctx.capAvailable.add(name);
            this.ctx.logRaw(`IRCService: CAP available: ${name}${value ? '='+value : ''}`);
          }
        });

        if (isLastLine) {
          this.ctx.setCapLSReceived(true);
          this.ctx.emit('capabilities', Array.from(this.ctx.capAvailable));
          this.ctx.requestCapabilities();
        }
        break;
      }

      case 'ACK': {
        const ackCapsString = actualParams.slice(1).join(' ').replace(/^:/, '');
        const ackCaps = ackCapsString.split(/\s+/).filter(c => c);
        ackCaps.forEach(cap => {
          const [capName, capValue] = cap.split('=');
          if (capName) {
            this.ctx.capEnabledSet.add(capName);
            this.ctx.logRaw(`IRCService: CAP enabled: ${capName}`);
            if (capName === 'sts' && capValue && this.ctx.config) {
              this.ctx.emit('sts-policy', this.ctx.config.host, capValue);
            }
            if (capName === 'userhost-in-names') {
              this.ctx.setUserhostInNames(true);
            }
            if (capName === 'extended-join') {
              this.ctx.setExtendedJoin(true);
            }
          }
        });

        const forceSASL = this.ctx.config?.sasl?.force === true;
        const saslAcknowledged = this.ctx.capEnabledSet.has('sasl') || forceSASL;
        if ((this.ctx.config?.sasl || (this.ctx.config?.clientCert && this.ctx.config?.clientKey)) &&
            saslAcknowledged &&
            !this.ctx.getSaslAuthenticating()) {
          if (forceSASL && !this.ctx.capEnabledSet.has('sasl')) {
            this.ctx.logRaw('IRCService: Force SASL enabled, starting authentication');
          } else {
            this.ctx.logRaw('IRCService: SASL capability acknowledged, will start authentication');
          }
          setTimeout(() => this.ctx.startSASL(), 50);
          return;
        }

        this.ctx.endCAPNegotiation();
        break;
      }

      case 'NAK': {
        const nakCaps = actualParams.slice(1).join(' ').replace(/^:/, '').split(/\s+/).filter(c => c);
        nakCaps.forEach(cap => {
          this.ctx.logRaw(`IRCService: CAP rejected: ${cap}`);
          this.ctx.capRequested.delete(cap);
        });
        this.ctx.endCAPNegotiation();
        break;
      }

      case 'NEW': {
        const newCapsString = actualParams.slice(1).join(' ').replace(/^:/, '');
        const newCaps = newCapsString.split(/\s+/).filter(c => c);
        const newCapNames: string[] = [];
        newCaps.forEach(cap => {
          const [capName, capValue] = cap.split('=');
          if (capName) {
            this.ctx.capAvailable.add(capName);
            newCapNames.push(capName);
            this.ctx.logRaw(`IRCService: CAP NEW: ${capName}${capValue ? '='+capValue : ''}`);
          }
        });
        this.ctx.emit('capabilities', Array.from(this.ctx.capAvailable));

        // SASL re-auth: if server newly advertises sasl and we have credentials, re-authenticate
        if (newCapNames.includes('sasl') && !this.ctx.getSaslAuthenticating()) {
          const hasSaslConfig = !!this.ctx.config?.sasl?.account && !!this.ctx.config?.sasl?.password;
          const hasCert = !!(this.ctx.config?.clientCert && this.ctx.config?.clientKey);
          if (hasSaslConfig || hasCert) {
            this.ctx.logRaw('IRCService: SASL re-auth: server advertised sasl via CAP NEW, re-authenticating');
            this.ctx.capRequested.add('sasl');
            this.ctx.sendRaw('CAP REQ :sasl');
          }
        }
        break;
      }

      case 'DEL': {
        const delCapsString = actualParams.slice(1).join(' ').replace(/^:/, '');
        const delCaps = delCapsString.split(/\s+/).filter(c => c);
        delCaps.forEach(cap => {
          const [capName] = cap.split('=');
          if (capName) {
            this.ctx.capAvailable.delete(capName);
            this.ctx.capEnabledSet.delete(capName);
            this.ctx.logRaw(`IRCService: CAP DEL: ${capName}`);
          }
        });
        this.ctx.emit('capabilities', Array.from(this.ctx.capAvailable));
        break;
      }
    }
  }
}
