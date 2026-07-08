import logger from 'electron-log';

type OAuthCallbackFlowCoordinatorDeps = {
  processProtocolUrl: (protocolUrl: string) => Promise<unknown>;
};

export class OAuthCallbackFlowCoordinator {
  private isProcessing = false;
  private isReady = false;
  private queuedProtocolUrls: string[] = [];

  constructor(private readonly deps: OAuthCallbackFlowCoordinatorDeps) {}

  async handleProtocolUrl(protocolUrl: string) {
    this.queuedProtocolUrls.push(protocolUrl);
    logger.info('Queued OAuth callback URL', {
      protocolUrl,
      queueLength: this.queuedProtocolUrls.length,
    });
    await this.flush();
  }

  async setReady() {
    this.isReady = true;
    await this.flush();
  }

  getQueueLength() {
    return this.queuedProtocolUrls.length;
  }

  getIsProcessing() {
    return this.isProcessing;
  }

  private async flush() {
    if (!this.isReady || this.isProcessing) {
      return;
    }

    const nextProtocolUrl = this.queuedProtocolUrls.shift();
    if (!nextProtocolUrl) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.deps.processProtocolUrl(nextProtocolUrl);
    } catch (error) {
      logger.error(`Failed to process protocol callback: ${nextProtocolUrl}`, error);
    } finally {
      this.isProcessing = false;
      if (this.queuedProtocolUrls.length > 0) {
        await this.flush();
      }
    }
  }
}
