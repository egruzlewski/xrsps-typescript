import type { IScriptRegistry, ScriptServices } from "../../../../src/game/scripts/types";
import { register as registerChargeOrb } from "./chargeOrb";

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registerChargeOrb(registry, services);
}
