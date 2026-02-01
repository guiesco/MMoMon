import { EXTRACTION_REQUIRED_SECONDS } from "../../../game/constants";
import type { ExpeditionState } from "../types/ExpeditionTypes";

/**
 * Gerencia o sistema de extração.
 */
export class ExtractionSystem {
  private extractionProgress = 0;
  private extractionRequired = EXTRACTION_REQUIRED_SECONDS;
  private isExtractionRequestSent = false;
  private serverExtractionPointId: string | null = null;
  private state: ExpeditionState;
  private sendExtractionRequest: (pointId: string, action: "start" | "cancel") => void;
  private extractionUI: any; // ExtractionUI

  constructor(
    initialState: ExpeditionState,
    dependencies: {
      sendExtractionRequest: (pointId: string, action: "start" | "cancel") => void;
      extractionUI: any;
    }
  ) {
    this.state = initialState;
    this.sendExtractionRequest = dependencies.sendExtractionRequest;
    this.extractionUI = dependencies.extractionUI;
  }

  /**
   * Verifica se o jogador está na zona de extração e processa a extração.
   */
  handleExtraction(
    inExtractionZone: boolean,
    extractKeyDown: boolean,
    playerX: number,
    playerY: number
  ): void {
    if (inExtractionZone && extractKeyDown) {
      // Verifica se temos o ID do ponto de extração do servidor
      if (!this.serverExtractionPointId) {
        console.warn(`[Extraction] ID do ponto de extração não disponível ainda. Aguardando sincronização do servidor...`);
        return;
      }
      
      // Envia intent de extração ao servidor apenas uma vez por tentativa
      if (!this.isExtractionRequestSent) {
        console.log(`[Extraction] Enviando pedido de extração ao servidor (ponto: ${this.serverExtractionPointId})...`);
        this.sendExtractionRequest(this.serverExtractionPointId, "start");
        this.isExtractionRequestSent = true;
      }
      
      // O progresso é controlado pelo servidor - apenas atualiza UI se já estiver extraindo
      if (this.state === "extracting") {
        const progressRatio = Math.min(1, this.extractionProgress / this.extractionRequired);
        this.extractionUI.show();
        this.extractionUI.update(this.extractionProgress, this.extractionRequired);
      }
    } else {
      // Jogador não está mais segurando o botão OU saiu da zona
      if (this.state === "extracting" && this.isExtractionRequestSent && this.serverExtractionPointId) {
        // Cancelar extração no servidor
        console.log(`[Extraction] Cancelando extração no servidor (ponto: ${this.serverExtractionPointId})...`);
        this.sendExtractionRequest(this.serverExtractionPointId, "cancel");
        this.isExtractionRequestSent = false;
      } else if (this.state !== "extracting") {
        // Se não estava extraindo, apenas esconde a barra
        this.extractionUI.hide();
      }
    }
  }

  /**
   * Atualiza o estado de extração recebido do servidor.
   */
  handleExtractionState(state: {
    playerId: string;
    pointId: string;
    progress: number;
    status: "extracting" | "completed" | "cancelled";
  }): ExpeditionState {
    if (state.status === "extracting") {
      this.state = "extracting";
      this.extractionProgress = (state.progress / 100) * this.extractionRequired;
      this.extractionUI.show();
      this.extractionUI.update(this.extractionProgress, this.extractionRequired);
    } else if (state.status === "completed") {
      this.state = "extracted";
      this.extractionProgress = this.extractionRequired;
      this.isExtractionRequestSent = false;
      this.extractionUI.hide();
    } else if (state.status === "cancelled") {
      this.state = "exploring";
      this.extractionProgress = 0;
      this.isExtractionRequestSent = false;
      this.extractionUI.hide();
    }

    return this.state;
  }

  /**
   * Define o ID do ponto de extração do servidor.
   */
  setServerExtractionPointId(pointId: string): void {
    this.serverExtractionPointId = pointId;
  }

  /**
   * Reseta o estado de extração.
   */
  reset(): void {
    this.extractionProgress = 0;
    this.isExtractionRequestSent = false;
    this.serverExtractionPointId = null;
  }

  get progress(): number {
    return this.extractionProgress;
  }

  get required(): number {
    return this.extractionRequired;
  }

  get requestSent(): boolean {
    return this.isExtractionRequestSent;
  }
}
