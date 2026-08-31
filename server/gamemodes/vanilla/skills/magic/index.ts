import type { IScriptRegistry, ScriptServices } from "../../../../src/game/scripts/types";
import { register as registerChargeOrb } from "./chargeOrb";
import { register as registerEnchantJewellery } from "./enchantJewellery";

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registerChargeOrb(registry, services);
    registerEnchantJewellery(registry, services);
}
