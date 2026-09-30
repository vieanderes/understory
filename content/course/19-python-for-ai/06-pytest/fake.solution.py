def triage(client, ticket):
    """The code under test. It only knows the client has classify()."""
    reply = client.classify(ticket)
    if reply["confidence"] >= 0.9:
        return "auto:" + reply["label"]
    return "human"


class FakeClient:
    def __init__(self, replies):
        self.replies = replies
        # Set per instance: a list on the class would be shared by every fake.
        self.calls = []

    def classify(self, ticket):
        if len(self.calls) == len(self.replies):
            raise AssertionError("no more replies")
        reply = self.replies[len(self.calls)]
        self.calls.append(ticket)
        return reply


def test_confident_reply_is_automatic():
    fake = FakeClient([{"label": "refund", "confidence": 0.9}])
    assert triage(fake, "Money back, please") == "auto:refund"
    assert fake.calls == ["Money back, please"]


def test_unsure_reply_goes_to_a_human():
    fake = FakeClient([{"label": "refund", "confidence": 0.89}])
    assert triage(fake, "Is this a refund?") == "human"
