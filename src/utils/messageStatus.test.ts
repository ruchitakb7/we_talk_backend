import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateMessageStatus,
  getStatusTransition,
  initialRecipientStatus,
} from "./messageStatus";

test("offline message send starts as sent", () => {
  assert.equal(initialRecipientStatus(false), "sent");
});

test("online message send starts as delivered", () => {
  assert.equal(initialRecipientStatus(true), "delivered");
  assert.deepEqual(getStatusTransition("sent", "delivered"), {
    deliveredCountDelta: 1,
    seenCountDelta: 0,
  });
});

test("recipient reconnect delivers pending messages without marking them read", () => {
  assert.deepEqual(getStatusTransition("sent", "delivered"), {
    deliveredCountDelta: 1,
    seenCountDelta: 0,
  });
  assert.equal(getStatusTransition("delivered", "delivered"), null);
});

test("opening a chat marks sent and delivered messages read", () => {
  assert.deepEqual(getStatusTransition("sent", "read"), {
    deliveredCountDelta: 1,
    seenCountDelta: 1,
  });
  assert.deepEqual(getStatusTransition("delivered", "read"), {
    deliveredCountDelta: 0,
    seenCountDelta: 1,
  });
});

test("status transitions never downgrade or double-count", () => {
  assert.equal(getStatusTransition("read", "delivered"), null);
  assert.equal(getStatusTransition("delivered", "sent"), null);
  assert.equal(getStatusTransition("read", "read"), null);
});

test("aggregate message status reflects all recipients without downgrades", () => {
  assert.equal(aggregateMessageStatus(0, 0, 2), "sent");
  assert.equal(aggregateMessageStatus(1, 0, 2), "sent");
  assert.equal(aggregateMessageStatus(2, 0, 2), "delivered");
  assert.equal(aggregateMessageStatus(2, 2, 2), "read");
});
