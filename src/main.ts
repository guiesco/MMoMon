import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { AuthScene } from "./scenes/AuthScene";
import { BaseHubScene } from "./scenes/BaseHubScene";
import { CraftingScene } from "./scenes/CraftingScene";
import { CreatureUpgradeScene } from "./scenes/CreatureUpgradeScene";
import { ExpeditionScene } from "./scenes/ExpeditionScene";
import { InventoryScene } from "./scenes/InventoryScene";
import { TeamManagementScene } from "./scenes/TeamManagementScene";
import { ExpeditionInventorySelectionScene } from "./scenes/ExpeditionInventorySelectionScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#0b1220",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%",
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  dom: {
    createContainer: true
  },
  scene: [
    BootScene,
    AuthScene,
    BaseHubScene,
    CraftingScene,
    CreatureUpgradeScene,
    InventoryScene,
    TeamManagementScene,
    ExpeditionInventorySelectionScene,
    ExpeditionScene
  ]
};

// eslint-disable-next-line no-new
new Phaser.Game(config);

