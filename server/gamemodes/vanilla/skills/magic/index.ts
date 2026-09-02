import type { IScriptRegistry, ScriptServices } from "../../../../src/game/scripts/types";
import { register as registerAlchemy } from "./alchemy";
import { register as registerBonesToBananas } from "./bonesToBananas";
import { register as registerChargeOrb } from "./chargeOrb";
import { register as registerEnchantJewellery } from "./enchantJewellery";
import { register as registerSuperheatItem } from "./superheatItem";
import { register as registerTelekineticGrab } from "./telekineticGrab";

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registerChargeOrb(registry, services);
    registerEnchantJewellery(registry, services);
    registerSuperheatItem(registry, services);
    registerBonesToBananas(registry, services);
    registerAlchemy(registry, services);
    registerTelekineticGrab(registry);
}
