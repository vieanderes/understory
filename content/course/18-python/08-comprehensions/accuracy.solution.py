def accuracy(predictions, labels):
    if len(predictions) != len(labels):
        raise ValueError("predictions and labels differ in length")
    if not labels:
        return 0.0
    correct = sum(1 for guess, answer in zip(predictions, labels) if guess == answer)
    return correct / len(labels)
