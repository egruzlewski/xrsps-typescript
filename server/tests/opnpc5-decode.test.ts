import assert from "node:assert/strict";

import { ClientPacketId } from "../../client/common/network/ClientPacketId";
import { decodePacket } from "../src/network/packet/PacketHandler";

/** Inverse of PacketBuffer.writeByteAdd + writeShortLE used for NPC option 5. */
function encodeNpcOption5(npcIndex: number, ctrlHeld: boolean): Uint8Array {
    const ctrl = ctrlHeld ? 1 : 0;
    return Uint8Array.of((ctrl + 128) & 0xff, npcIndex & 0xff, (npcIndex >> 8) & 0xff);
}

const payload = encodeNpcOption5(0x1234, true);

const fromOpnpc5 = decodePacket(ClientPacketId.OPNPC5, payload);
assert.equal(fromOpnpc5.type, "npc_op");
if (fromOpnpc5.type === "npc_op") {
    assert.equal(fromOpnpc5.opNum, 5);
    assert.equal(fromOpnpc5.npcIndex, 0x1234);
    assert.equal(fromOpnpc5.ctrlHeld, true);
}

const fromLegacyAlias = decodePacket(ClientPacketId.OPNPC1, encodeNpcOption5(42, false));
assert.equal(fromLegacyAlias.type, "npc_op");
if (fromLegacyAlias.type === "npc_op") {
    assert.equal(fromLegacyAlias.opNum, 5);
    assert.equal(fromLegacyAlias.npcIndex, 42);
    assert.equal(fromLegacyAlias.ctrlHeld, false);
}

assert.equal(ClientPacketId.OPNPC5, 50, "OPNPC5 remains opcode 50");
assert.equal(ClientPacketId.OPNPC1, 57, "legacy option-5 alias remains opcode 57");

console.log("opnpc5-decode.test.ts: all assertions passed");
