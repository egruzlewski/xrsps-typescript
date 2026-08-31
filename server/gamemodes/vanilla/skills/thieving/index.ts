import type { IScriptRegistry, ScriptServices } from "../../../../src/game/scripts/types";
import { register as registerChests } from "./chests";
import { register as registerPicklock } from "./picklock";
import { register as registerPickpocket } from "./pickpocket";
import { register as registerStalls } from "./stalls";

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registerPickpocket(registry, services);
    registerPicklock(registry, services);
    registerStalls(registry, services);
    registerChests(registry, services);
}
