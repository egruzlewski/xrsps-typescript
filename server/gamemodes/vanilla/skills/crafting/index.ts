import type { IScriptRegistry, ScriptServices } from "../../../../src/game/scripts/types";
import { register as registerBattlestaves } from "./battlestaves";
import { register as registerFlax } from "./flax";
import { register as registerGlassblowing } from "./glassblowing";
import { register as registerJewellery } from "./jewellery";
import { register as registerLeather } from "./leather";
import { register as registerPottery } from "./pottery";
import { register as registerSheepShearing } from "./sheepShearing";
import { register as registerSpinning } from "./spinning";
import { register as registerWeaving } from "./weaving";

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registerFlax(registry, services);
    registerSheepShearing(registry, services);
    registerSpinning(registry, services);
    registerWeaving(registry, services);
    registerJewellery(registry, services);
    registerLeather(registry, services);
    registerPottery(registry, services);
    registerGlassblowing(registry, services);
    registerBattlestaves(registry, services);
}
