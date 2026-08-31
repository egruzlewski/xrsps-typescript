/**
 * Unused high-level MAP_EDIT (opcode 195) was removed: nothing encoded it,
 * and ClientBinaryDecoder had no case. Unknown 195 frames stay dropped.
 *
 * Run with: npx tsx tests/map-edit-opcode.test.ts
 */
import assert from "node:assert/strict";

import { CLIENT_PACKET_LENGTHS } from "../../client/common/packets/ClientPacketId";
import { decodeClientPacket } from "../src/network/packet/ClientBinaryDecoder";

assert.equal(
    CLIENT_PACKET_LENGTHS[195 as keyof typeof CLIENT_PACKET_LENGTHS],
    undefined,
    "MAP_EDIT opcode 195 must not remain in the high-level length table",
);

const unknownFrame = Uint8Array.of(195, 1, 0);
assert.equal(decodeClientPacket(unknownFrame), null);

console.log("map-edit-opcode.test.ts: all assertions passed");
