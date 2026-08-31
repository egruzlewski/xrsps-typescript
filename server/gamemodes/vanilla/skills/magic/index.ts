import type { IScriptRegistry, ScriptServices } from "../../../../src/game/scripts/types";
import { register as registerChargeOrb } from "./chargeOrb";
import { register as registerEnchantJewellery } from "./enchantJewellery";
import { register as registerSuperheatItem } from "./superheatItem";

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registerChargeOrb(registry, services);
    registerEnchantJewellery(registry, services);
    registerSuperheatItem(registry, services);
}
