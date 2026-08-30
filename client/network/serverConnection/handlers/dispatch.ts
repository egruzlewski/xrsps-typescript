import { handleAuthTickMessage } from "./authTick";
import { handleInboundSync } from "./inboundSync";
import { handleInboundUi } from "./inboundUi";
import { handleInboundWorld } from "./inboundWorld";

export function processServerMessage(msg: any): void {
    if (handleAuthTickMessage(msg)) return;
    if (handleInboundSync(msg)) return;
    if (handleInboundUi(msg)) return;
    handleInboundWorld(msg);
}
