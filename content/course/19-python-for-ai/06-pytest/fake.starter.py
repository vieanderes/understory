def triage(client, ticket):
    """The code under test. It only knows the client has classify()."""
    reply = client.classify(ticket)
    if reply["confidence"] >= 0.9:
        return "auto:" + reply["label"]
    return "human"


class FakeClient:
    def __init__(self, replies):
        # Your code here
        pass

    def classify(self, ticket):
        # Your code here
        return None


def test_confident_reply_is_automatic():
    # Your test here
    pass


def test_unsure_reply_goes_to_a_human():
    # Your test here
    pass
